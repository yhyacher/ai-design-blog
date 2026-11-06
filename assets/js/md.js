/* --------------------------------------------------------------------------
   Markdown 渲染
   依赖（CDN，无构建步骤）：marked + DOMPurify
   自定义协议：
     wbimg://<对象路径>   内嵌图片，渲染时换取签名地址
     wbfile://<对象路径>  附件下载，渲染时换取签名地址
   存储资源仅对已登录用户开放，未登录时以占位块降级展示，不会静默失败。
   -------------------------------------------------------------------------- */

(function (global) {
  'use strict';

  var IMG_PREFIX = 'wbimg://';
  var FILE_PREFIX = 'wbfile://';

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function parserAvailable() {
    return typeof global.marked !== 'undefined' && global.marked && typeof global.marked.parse === 'function';
  }

  function sanitize(html) {
    if (global.DOMPurify && typeof global.DOMPurify.sanitize === 'function') {
      return global.DOMPurify.sanitize(html, {
        ADD_ATTR: ['target', 'rel'],
        FORBID_TAGS: ['style', 'form', 'input', 'iframe', 'object', 'embed'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick'],
      });
    }
    // DOMPurify 未加载时不渲染 HTML，退回纯文本，避免注入
    return '<p>' + escapeHtml(html.replace(/<[^>]*>/g, '')) + '</p>';
  }

  function preprocess(markdown) {
    var src = String(markdown || '');
    // 支持 ::: 提示块  >>> 引用块可扩展预留
    return src;
  }

  function render(markdown) {
    var src = preprocess(markdown);
    if (!parserAvailable()) {
      return sanitize('<p>' + escapeHtml(src) + '</p>');
    }
    var raw = global.marked.parse(src, { gfm: true, breaks: false, headerIds: false, mangle: false });
    return sanitize(raw);
  }

  /**
   * 阅读时长：唯一实现放在 ui.js（纯文本工具，与 Markdown 解析无关），此处仅做转发，
   * 保留这个入口是为了兼容已有调用点。
   */
  function readingMinutes(markdown) {
    if (global.UI && typeof global.UI.readingMinutes === 'function') {
      return global.UI.readingMinutes(markdown);
    }
    // ui.js 未加载时的兜底，避免调用方拿到 NaN
    var n = String(markdown || '').length;
    return Math.max(1, Math.round(n / 380));
  }

  function lockedBlock(label) {
    var div = document.createElement('div');
    div.className = 'locked-media';
    div.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="4" y="10.5" width="16" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>' +
      '<span>' + escapeHtml(label || '该资源存放在云端存储，登录后可查看。') + '</span>';
    return div;
  }

  /**
   * 把渲染结果里的 wbimg:// 与 wbfile:// 换成签名地址。
   * 未登录时降级为占位块（图片）或移除下载链接（附件）。
   */
  async function resolveMedia(root) {
    if (!root || !global.Blog) return;

    var imgs = Array.prototype.slice.call(root.querySelectorAll('img[src^="' + IMG_PREFIX + '"]'));
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      var path = img.getAttribute('src').slice(IMG_PREFIX.length);
      var url = null;
      try {
        url = await global.Blog.storage.signedUrl(path, 3600);
      } catch (e) {
        url = null;
      }
      if (url) {
        img.setAttribute('src', url);
        img.setAttribute('loading', 'lazy');
        img.setAttribute('data-object-path', path);
      } else {
        var block = lockedBlock('图片存放在云端存储，登录后可查看。');
        img.parentNode.replaceChild(block, img);
      }
    }

    var files = Array.prototype.slice.call(root.querySelectorAll('a[href^="' + FILE_PREFIX + '"]'));
    for (var j = 0; j < files.length; j++) {
      var a = files[j];
      var fpath = a.getAttribute('href').slice(FILE_PREFIX.length);
      var furl = null;
      try {
        furl = await global.Blog.storage.signedUrl(fpath, 3600);
      } catch (e) {
        furl = null;
      }
      if (furl) {
        a.setAttribute('href', furl);
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener');
        a.setAttribute('download', '');
        a.setAttribute('data-object-path', fpath);
      } else {
        var span = document.createElement('span');
        span.className = 'attach-item';
        span.innerHTML =
          '<span class="name">' + escapeHtml(a.textContent || '附件') + '</span>' +
          '<span class="size">登录后可下载</span>';
        a.parentNode.replaceChild(span, a);
      }
    }

    // 外部链接统一新开
    var links = Array.prototype.slice.call(root.querySelectorAll('a[href^="http"]'));
    links.forEach(function (el) {
      if (!el.getAttribute('target')) {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener');
      }
    });
  }

  async function renderInto(el, markdown) {
    if (!el) return;
    el.innerHTML = render(markdown);
    await resolveMedia(el);
  }

  global.MD = {
    render: render,
    renderInto: renderInto,
    resolveMedia: resolveMedia,
    readingMinutes: readingMinutes,
    escapeHtml: escapeHtml,
    IMG_PREFIX: IMG_PREFIX,
    FILE_PREFIX: FILE_PREFIX,
  };
})(window);
