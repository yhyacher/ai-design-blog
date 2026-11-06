/* 文章详情页 */
(function () {
  'use strict';

  var host;

  function headHtml(post, session) {
    var isOwner = session && session.user && String(session.user.id) === String(post.owner_id);
    var tags = (post.tags || [])
      .map(function (t) {
        return '<a class="tag-pill" href="index.html?tag=' + encodeURIComponent(t) + '">' + UI.esc(t) + '</a>';
      })
      .join('');
    var minutes = MD.readingMinutes(post.content);
    var dateText = UI.formatDateLong(post.published_at || post.created_at);

    return (
      '<a class="backlink" href="index.html">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>' +
      '全部文章</a>' +
      '<div class="article-head">' +
      '<div class="kicker"><span>' + dateText + '</span><span>·</span><span>约 ' + minutes + ' 分钟</span>' +
      (post.status !== 'published' ? '<span class="badge-draft">草稿</span>' : '') +
      (isOwner ? '<span class="spacer"></span><a class="btn btn-sm" href="studio.html?id=' + encodeURIComponent(post.id) + '">编辑</a>' : '') +
      '</div>' +
      '<h1>' + UI.esc(post.title) + '</h1>' +
      (tags ? '<div class="tags-inline">' + tags + '</div>' : '') +
      '</div>'
    );
  }

  async function renderCover(post, container) {
    if (!post.cover_path) return;
    var url = null;
    try {
      url = await Blog.storage.signedUrl(post.cover_path, 3600);
    } catch (e) {
      url = null;
    }
    if (url) {
      var img = document.createElement('img');
      img.src = url;
      img.alt = post.title || '封面';
      img.style.marginTop = '32px';
      img.style.borderRadius = '8px';
      img.style.border = '1px solid var(--border)';
      container.appendChild(img);
    } else {
      var box = document.createElement('div');
      box.className = 'locked-media';
      box.textContent = '封面图存放在云端存储，登录后可查看。';
      container.appendChild(box);
    }
  }

  async function renderAttachments(post, container) {
    var rows = [];
    try {
      rows = await Blog.attachments.listByPost(post.id);
    } catch (e) {
      return;
    }
    if (!rows.length) return;

    var wrap = document.createElement('section');
    wrap.style.marginTop = '8px';
    wrap.innerHTML =
      '<div class="section-head" style="padding-top:0"><h2>附件</h2></div>' +
      '<div class="attach-list">' +
      rows
        .map(function (a) {
          return (
            '<div class="attach-item" data-path="' + UI.esc(a.object_path) + '">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21.4 11.05 12.25 20.2a5.5 5.5 0 0 1-7.78-7.78l9.2-9.2a3.6 3.6 0 0 1 5.09 5.09l-9.2 9.2a1.7 1.7 0 0 1-2.4-2.4l8.5-8.5"/></svg>' +
            '<span class="name">' + UI.esc(a.file_name) + '</span>' +
            '<span class="size">' + UI.formatBytes(a.size_bytes) + '</span>' +
            '<span class="size" data-role="link">获取链接中…</span>' +
            '</div>'
          );
        })
        .join('') +
      '</div>';

    var prose = document.getElementById('prose');
    if (prose && prose.parentNode) prose.parentNode.insertBefore(wrap, prose.nextSibling);

    var items = wrap.querySelectorAll('.attach-item');
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var path = item.getAttribute('data-path');
      var slot = item.querySelector('[data-role="link"]');
      var url = null;
      try {
        url = await Blog.storage.signedUrl(path, 3600);
      } catch (e) {
        url = null;
      }
      if (url) {
        var a = document.createElement('a');
        a.className = 'btn btn-sm';
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.download = '';
        a.textContent = '下载';
        slot.parentNode.replaceChild(a, slot);
      } else {
        slot.textContent = '登录后可下载';
      }
    }
  }

  async function boot() {
    host = document.getElementById('article-host');
    UI.mountHeader(null);
    UI.mountFooter();
    UI.mountEnvWarning();

    var id = UI.qs('id');
    if (!id) {
      host.innerHTML = UI.stateBlock('缺少文章标识', '请从文章列表进入。');
      return;
    }
    if (!Blog.ready) {
      host.innerHTML = UI.stateBlock('云端未连接', '无法读取文章数据。');
      return;
    }

    var session = await UI.loadSession();
    var post = null;
    try {
      post = await Blog.posts.getById(id);
    } catch (err) {
      host.innerHTML = UI.failBlock('文章加载失败', err);
      UI.bindRetry(host);
      return;
    }

    if (!post) {
      host.innerHTML = UI.stateBlock('没有找到这篇文章', '它可能已被删除，或者仍未发布。');
      return;
    }

    document.title = post.title + ' · ' + (Blog.config.siteName || '博客') + '';

    host.innerHTML = headHtml(post, session) + '<div class="prose" id="prose"></div>';

    try {
      var prose = document.getElementById('prose');
      await renderCover(post, host);
      await MD.renderInto(prose, post.content);
      await renderAttachments(post, host);

      var tail = document.createElement('div');
      tail.style.padding = '0 0 80px';
      tail.innerHTML =
        '<div style="display:flex;gap:10px;flex-wrap:wrap;padding-top:26px;border-top:1px solid var(--border)">' +
        '<a class="btn" href="index.html">全部文章</a>' +
        (post.tags && post.tags.length ? '<a class="btn btn-ghost" href="tags.html">浏览标签</a>' : '') +
        '</div>';
      host.appendChild(tail);
    } catch (err) {
      // 正文渲染失败时必须给出可见反馈，否则页面只剩标题、看起来像"内容没加载出来"
      var body = document.getElementById('prose');
      var msg = (err && err.message) || String(err);
      if (body) {
        body.innerHTML =
          '<div class="alert alert-error">正文渲染失败：' + UI.esc(msg) + '</div>';
      }
      if (window.console && console.error) console.error('[blog] post render failed:', err);
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
