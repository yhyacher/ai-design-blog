/* 关于页：读取站点资料并支持站点所有者就地编辑 */
(function () {
  'use strict';

  var host;
  var state = { profile: null, session: null, editing: false };

  var FALLBACK = {
    display_name: (Blog.config && Blog.config.siteName) || '本站',
    tagline: (Blog.config && Blog.config.siteTagline) || '',
    bio:
      '这个站点用来存放那些还没成熟到可以写成正式文档、但又值得被记录下来的想法。\n\n内容大致分三类：AI 产品的交互设计、设计系统与工程实践的落地细节、以及在真实项目里踩过的坑。',
    links: [],
    avatar_path: null,
  };

  function linksOf(profile) {
    var raw = profile && profile.links;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try {
        var parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  async function avatarHtml(profile) {
    var path = profile && profile.avatar_path;
    if (!path) {
      var initial = String((profile && profile.display_name) || '·').slice(0, 1);
      return '<div class="about-portrait" style="display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:600;color:var(--fg-subtle)">' +
        UI.esc(initial) + '</div>';
    }
    var url = null;
    try {
      url = await Blog.storage.signedUrl(path, 3600);
    } catch (e) {
      url = null;
    }
    if (url) {
      return '<img class="about-portrait" src="' + UI.esc(url) + '" alt="头像">';
    }
    return '<div class="about-portrait" style="display:flex;align-items:center;justify-content:center;color:var(--fg-subtle)">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="10.5" width="16" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg></div>';
  }

  function isOwner() {
    var p = state.profile;
    var s = state.session;
    if (!s || !s.user) return false;
    if (!p) return true; // 还没有资料行，登录用户即为首位所有者
    return String(p.owner_id) === String(s.user.id);
  }

  async function renderView() {
    var p = state.profile || FALLBACK;
    var links = linksOf(p);
    var own = isOwner();

    var linkHtml = links
      .map(function (l) {
        if (!l || !l.url) return '';
        var external = /^https?:/i.test(l.url);
        return (
          '<a href="' + UI.esc(l.url) + '"' + (external ? ' target="_blank" rel="noopener"' : '') + '>' +
          UI.esc(l.label || l.url) + '</a>'
        );
      })
      .join('');

    host.innerHTML =
      '<div class="about-head">' +
      (await avatarHtml(p)) +
      '<div style="flex:1;min-width:0">' +
      '<h1>' + UI.esc(p.display_name || '') + '</h1>' +
      (p.tagline ? '<p class="tagline">' + UI.esc(p.tagline) + '</p>' : '') +
      '</div>' +
      (own ? '<button class="btn btn-sm" id="btn-edit">编辑资料</button>' : '') +
      '</div>' +
      '<div class="prose" id="bio-prose"></div>' +
      (linkHtml ? '<div class="link-row">' + linkHtml + '</div>' : '') +
      '<div style="padding:40px 0 80px"><a class="btn btn-ghost" href="index.html">去看文章 →</a></div>';

    await MD.renderInto(document.getElementById('bio-prose'), p.bio || '');

    var edit = document.getElementById('btn-edit');
    if (edit) {
      edit.addEventListener('click', function () {
        state.editing = true;
        renderEdit();
      });
    }
  }

  function renderEdit() {
    var p = state.profile || FALLBACK;
    var links = linksOf(p)
      .map(function (l) {
        return (l.label || '') + ' | ' + (l.url || '');
      })
      .join('\n');

    host.innerHTML =
      '<div class="about-head" style="padding-bottom:22px">' +
      '<div style="flex:1"><h1>编辑站点资料</h1>' +
      '<p class="tagline">这部分内容会显示在「关于」页，所有访客可见。</p></div>' +
      '</div>' +
      '<div class="card" style="margin-bottom:26px">' +
      '<div class="field"><label>显示名称</label><input type="text" id="f-name" value="' + UI.esc(p.display_name || '') + '"></div>' +
      '<div class="field"><label>一句话简介</label><input type="text" id="f-tagline" value="' + UI.esc(p.tagline || '') + '"></div>' +
      '<div class="field"><label>正文（支持 Markdown）</label><textarea id="f-bio" rows="12">' + UI.esc(p.bio || '') + '</textarea></div>' +
      '<div class="field"><label>外链</label><textarea id="f-links" rows="3" placeholder="GitHub | https://github.com/you">' + UI.esc(links) + '</textarea>' +
      '<div class="hint">每行一条，格式为「名称 | 地址」。留空则隐藏。</div></div>' +
      '<div class="field"><label>头像</label><input type="file" id="f-avatar" accept="image/*">' +
      '<div class="hint">上传后立即生效，单张不超过 ' + Math.round(Blog.config.maxUploadBytes / 1024 / 1024) + 'MB。</div></div>' +
      '</div>' +
      '<div style="display:flex;gap:10px;padding-bottom:80px">' +
      '<button class="btn btn-primary" id="btn-save">保存</button>' +
      '<button class="btn btn-ghost" id="btn-cancel">取消</button>' +
      '</div>';

    document.getElementById('btn-cancel').addEventListener('click', function () {
      state.editing = false;
      renderView();
    });
    document.getElementById('btn-save').addEventListener('click', save);
  }

  function parseLinks(text) {
    return String(text || '')
      .split('\n')
      .map(function (line) {
        return line.trim();
      })
      .filter(Boolean)
      .map(function (line) {
        var idx = line.indexOf('|');
        if (idx === -1) return { label: line, url: line };
        return { label: line.slice(0, idx).trim(), url: line.slice(idx + 1).trim() };
      })
      .filter(function (l) {
        return !!l.url;
      });
  }

  async function save() {
    var btn = document.getElementById('btn-save');
    btn.disabled = true;
    btn.textContent = '保存中…';

    try {
      var userId = state.session && state.session.user ? state.session.user.id : null;
      if (!userId) throw new Error('登录状态已失效，请重新登录。');

      var avatarInput = document.getElementById('f-avatar');
      var avatarPath = state.profile ? state.profile.avatar_path : null;
      if (avatarInput && avatarInput.files && avatarInput.files[0]) {
        avatarPath = await Blog.storage.avatar(userId, avatarInput.files[0]);
      }

      state.profile = await Blog.profile.upsertMine(userId, {
        display_name: document.getElementById('f-name').value.trim() || Blog.config.siteName,
        tagline: document.getElementById('f-tagline').value.trim(),
        bio: document.getElementById('f-bio').value,
        avatar_path: avatarPath,
        links: parseLinks(document.getElementById('f-links').value),
        updated_at: new Date().toISOString(),
      });

      state.editing = false;
      UI.toast('站点资料已更新');
      await renderView();
    } catch (err) {
      UI.toast(Blog.messageOf(err), 'error');
      btn.disabled = false;
      btn.textContent = '保存';
    }
  }

  async function boot() {
    host = document.getElementById('about-host');
    UI.mountHeader('about');
    UI.mountFooter();
    UI.mountEnvWarning();

    if (!Blog.ready) {
      host.innerHTML = UI.stateBlock('云端未连接', '无法读取站点资料。');
      return;
    }

    state.session = await UI.loadSession();

    try {
      state.profile = await Blog.profile.get();
    } catch (err) {
      host.innerHTML = UI.failBlock('站点资料加载失败', err);
      UI.bindRetry(host);
      return;
    }

    if (state.profile && state.profile.display_name) {
      document.title = '关于 ' + state.profile.display_name + ' · ' + Blog.config.siteName;
    }

    try {
      await renderView();
    } catch (err) {
      // 渲染异常必须报出来，不能停在骨架屏上
      host.innerHTML = UI.stateBlock('关于页渲染失败', (err && err.message) || String(err));
      if (window.console && console.error) console.error('[blog] about render failed:', err);
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
