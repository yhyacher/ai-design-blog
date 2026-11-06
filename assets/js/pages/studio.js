/* 写作台：文章增删改、草稿/发布、封面与附件上传、Markdown 实时预览 */
(function () {
  'use strict';

  var state = {
    session: null,
    userId: null,
    posts: [],
    current: null,
    attachments: [],
    pendingAttachmentIds: [],
    dirty: false,
    previewVisible: true,
  };

  var navHost, editorHost, alertHost, gateHost, studioHost, previewTimer;

  function alertBox(kind, text) {
    alertHost.innerHTML = '<div class="alert alert-' + kind + '">' + UI.esc(text) + '</div>';
  }
  function clearAlert() {
    alertHost.innerHTML = '';
  }

  function markDirty() {
    state.dirty = true;
  }

  /* ---------------- 侧栏 ---------------- */

  function renderNav() {
    if (!state.posts.length) {
      navHost.innerHTML =
        '<p style="font-size:13px;color:var(--fg-subtle);line-height:1.7;padding:6px 4px">还没有文章。点击右上角「新建」开始写第一篇。</p>';
      return;
    }
    navHost.innerHTML = state.posts
      .map(function (p) {
        var active = state.current && String(state.current.id) === String(p.id);
        return (
          '<button class="side-item' + (active ? ' active' : '') + '" data-id="' + p.id + '">' +
          '<div class="t">' + UI.esc(p.title || '未命名') + '</div>' +
          '<div class="m"><span>' + UI.formatDate(p.updated_at || p.created_at) + '</span>' +
          (p.status === 'published' ? '<span>已发布</span>' : '<span class="badge-draft">草稿</span>') +
          '</div></button>'
        );
      })
      .join('');

    Array.prototype.forEach.call(navHost.querySelectorAll('.side-item'), function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        if (state.dirty && !confirm('当前编辑尚未保存，确定要切换吗？')) return;
        openPost(id);
      });
    });
  }

  /* ---------------- 编辑器 ---------------- */

  function slugify(title) {
    var s = String(title || '')
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return /[a-z0-9]/.test(s) ? s.slice(0, 80) : null;
  }

  function renderEditor() {
    var p = state.current || {};
    var tagsText = (p.tags || []).join(', ');

    editorHost.innerHTML =
      '<div class="field" style="margin-bottom:14px">' +
      '<input type="text" id="f-title" placeholder="文章标题" value="' + UI.esc(p.title || '') +
      '" style="font-size:20px;font-weight:600;height:46px;letter-spacing:-0.01em">' +
      '</div>' +

      '<div class="toolbar">' +
      '<button class="btn btn-sm btn-primary" id="btn-save">保存</button>' +
      (p.status === 'published'
        ? '<button class="btn btn-sm" id="btn-unpublish">撤回为草稿</button>'
        : '<button class="btn btn-sm" id="btn-publish">发布</button>') +
      '<button class="btn btn-sm" id="btn-cover">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m21 16-5-5-6 6-3-3-4 4"/></svg>' +
      '封面</button>' +
      '<button class="btn btn-sm" id="btn-image">插入图片</button>' +
      '<button class="btn btn-sm" id="btn-attach">添加附件</button>' +
      '<span class="spacer"></span>' +
      '<span style="font-size:12px;color:var(--fg-subtle);font-variant-numeric:tabular-nums" id="stat">—</span>' +
      '<button class="btn btn-sm btn-ghost" id="btn-preview">隐藏预览</button>' +
      (p.id ? '<button class="btn btn-sm btn-danger" id="btn-delete">删除</button>' : '') +
      '</div>' +

      '<div class="editor-grid" id="editor-grid">' +
      '<div>' +
      '<div class="field"><textarea id="f-content" rows="24" placeholder="用 Markdown 写作。支持标题、列表、表格、引用与代码块。">' +
      UI.esc(p.content || '') + '</textarea></div>' +
      '<div id="cover-slot"></div>' +
      '<div id="attach-slot"></div>' +
      '</div>' +
      '<div class="preview-pane" id="preview-pane"><div class="prose" id="preview"></div></div>' +
      '</div>' +

      '<div class="card card-sm" style="margin-top:22px">' +
      '<div class="field"><label>标签</label>' +
      '<input type="text" id="f-tags" placeholder="用逗号分隔，例如：AI产品, 交互设计" value="' + UI.esc(tagsText) + '">' +
      '<div class="hint">标签会用于首页筛选与「标签分类」页的聚合。</div></div>' +
      '<div class="field" style="margin-bottom:0"><label>摘要</label>' +
      '<textarea id="f-excerpt" rows="3" placeholder="一到两句话，会显示在列表页。留空则从正文自动截取。">' +
      UI.esc(p.excerpt || '') + '</textarea></div>' +
      '</div>' +

      '<input type="file" id="file-cover" accept="image/*" style="display:none">' +
      '<input type="file" id="file-image" accept="image/*" style="display:none">' +
      '<input type="file" id="file-attach" style="display:none">';

    var content = document.getElementById('f-content');
    content.addEventListener('input', function () {
      markDirty();
      updateStat();
      schedulePreview();
    });
    document.getElementById('f-title').addEventListener('input', markDirty);
    document.getElementById('f-tags').addEventListener('input', markDirty);
    document.getElementById('f-excerpt').addEventListener('input', markDirty);

    document.getElementById('btn-save').addEventListener('click', function () {
      save('draft');
    });
    var pub = document.getElementById('btn-publish');
    if (pub) pub.addEventListener('click', function () {
      save('publish');
    });
    var unpub = document.getElementById('btn-unpublish');
    if (unpub) unpub.addEventListener('click', function () {
      save('unpublish');
    });
    var del = document.getElementById('btn-delete');
    if (del) del.addEventListener('click', removePost);

    document.getElementById('btn-cover').addEventListener('click', function () {
      document.getElementById('file-cover').click();
    });
    document.getElementById('btn-image').addEventListener('click', function () {
      document.getElementById('file-image').click();
    });
    document.getElementById('btn-attach').addEventListener('click', function () {
      document.getElementById('file-attach').click();
    });

    document.getElementById('file-cover').addEventListener('change', onCoverPicked);
    document.getElementById('file-image').addEventListener('change', onInlinePicked);
    document.getElementById('file-attach').addEventListener('change', onAttachPicked);

    var toggle = document.getElementById('btn-preview');
    toggle.addEventListener('click', function () {
      state.previewVisible = !state.previewVisible;
      document.getElementById('preview-pane').style.display = state.previewVisible ? '' : 'none';
      toggle.textContent = state.previewVisible ? '隐藏预览' : '显示预览';
    });

    renderCoverSlot();
    renderAttachSlot();
    updateStat();
    refreshPreview();
  }

  function updateStat() {
    var value = document.getElementById('f-content').value || '';
    var chars = value.length;
    var minutes = MD.readingMinutes(value);
    var el = document.getElementById('stat');
    if (el) el.textContent = chars + ' 字 · 约 ' + minutes + ' 分钟';
  }

  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(refreshPreview, 260);
  }

  async function refreshPreview() {
    var pane = document.getElementById('preview');
    if (!pane) return;
    var value = document.getElementById('f-content').value || '';
    pane.innerHTML = MD.render(value || '*（正文为空）*');
    await MD.resolveMedia(pane);
  }

  /* ---------------- 封面 ---------------- */

  async function renderCoverSlot() {
    var slot = document.getElementById('cover-slot');
    if (!slot) return;
    var path = state.current ? state.current.cover_path : null;
    if (!path) {
      slot.innerHTML = '';
      return;
    }
    var url = null;
    try {
      url = await Blog.storage.signedUrl(path, 3600);
    } catch (e) {
      url = null;
    }
    slot.innerHTML =
      '<div class="field"><label>封面</label>' +
      (url
        ? '<img src="' + UI.esc(url) + '" alt="封面" style="max-height:180px;border-radius:8px;border:1px solid var(--border);margin-bottom:10px">'
        : '<div class="locked-media" style="margin:0 0 10px">封面已上传，当前无法取得预览连接。</div>') +
      '<button class="btn btn-sm btn-danger" id="btn-cover-remove">移除封面</button></div>';

    document.getElementById('btn-cover-remove').addEventListener('click', async function () {
      state.current.cover_path = null;
      markDirty();
      renderCoverSlot();
      UI.toast('封面已移除，保存后生效');
    });
  }

  async function onCoverPicked(e) {
    var file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    clearAlert();
    try {
      var path = await Blog.storage.uploadCover(state.userId, file);
      state.current.cover_path = path;
      markDirty();
      await renderCoverSlot();
      UI.toast('封面已上传');
    } catch (err) {
      alertBox('error', Blog.messageOf(err));
    }
  }

  /* ---------------- 正文内嵌图片 ---------------- */

  function insertAtCursor(ta, text) {
    var start = ta.selectionStart;
    var end = ta.selectionEnd;
    var before = ta.value.slice(0, start);
    var after = ta.value.slice(end);
    ta.value = before + text + after;
    ta.selectionStart = ta.selectionEnd = start + text.length;
    ta.focus();
  }

  async function onInlinePicked(e) {
    var file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    clearAlert();
    try {
      var path = await Blog.storage.uploadImage(state.userId, file);
      var ta = document.getElementById('f-content');
      var alt = (file.name || '图片').replace(/\.[^.]+$/, '');
      insertAtCursor(ta, '\n![' + alt + '](' + MD.IMG_PREFIX + path + ')\n');
      markDirty();
      updateStat();
      await refreshPreview();
      UI.toast('图片已插入正文');
    } catch (err) {
      alertBox('error', Blog.messageOf(err));
    }
  }

  /* ---------------- 附件 ---------------- */

  function renderAttachSlot() {
    var slot = document.getElementById('attach-slot');
    if (!slot) return;
    if (!state.attachments.length) {
      slot.innerHTML =
        '<div class="field" style="margin-top:6px"><label>附件</label>' +
        '<div class="hint">用于 PDF、压缩包等随文章发布的文件。附件本身仅在你的账号下可见，访客登录后可下载。</div></div>';
      return;
    }
    slot.innerHTML =
      '<div class="field" style="margin-top:6px"><label>附件（' + state.attachments.length + '）</label>' +
      '<div class="attach-list">' +
      state.attachments
        .map(function (a) {
          return (
            '<div class="attach-item"><span class="name">' + UI.esc(a.file_name) + '</span>' +
            '<span class="size">' + UI.formatBytes(a.size_bytes) + '</span>' +
            '<button class="btn btn-sm btn-ghost" data-attach-insert="' + UI.esc(a.object_path) + '">插入链接</button>' +
            '<button class="btn btn-sm btn-danger" data-attach-remove="' + a.id + '">删除</button></div>'
          );
        })
        .join('') +
      '</div></div>';

    Array.prototype.forEach.call(slot.querySelectorAll('[data-attach-insert]'), function (btn) {
      btn.addEventListener('click', function () {
        var path = btn.getAttribute('data-attach-insert');
        var row = state.attachments.filter(function (a) {
          return a.object_path === path;
        })[0];
        var label = row ? row.file_name : '附件';
        var ta = document.getElementById('f-content');
        insertAtCursor(ta, '\n[' + label + '](' + MD.FILE_PREFIX + path + ')\n');
        markDirty();
        schedulePreview();
        UI.toast('附件链接已插入正文');
      });
    });

    Array.prototype.forEach.call(slot.querySelectorAll('[data-attach-remove]'), function (btn) {
      btn.addEventListener('click', function () {
        removeAttachment(btn.getAttribute('data-attach-remove'));
      });
    });
  }

  async function onAttachPicked(e) {
    var file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    clearAlert();
    try {
      var path = await Blog.storage.uploadAttachment(state.userId, file);
      var row = await Blog.attachments.create({
        post_id: state.current && state.current.id ? state.current.id : null,
        file_name: file.name,
        object_path: path,
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
      });
      if (!(state.current && state.current.id)) state.pendingAttachmentIds.push(row.id);
      state.attachments.push({
        id: row.id,
        file_name: file.name,
        object_path: path,
        mime_type: file.type,
        size_bytes: file.size,
      });
      renderAttachSlot();
      UI.toast('附件已上传');
    } catch (err) {
      alertBox('error', Blog.messageOf(err));
    }
  }

  async function removeAttachment(id) {
    if (!confirm('确定删除该附件？云端文件也会一并删除，且不可恢复。')) return;
    var row = state.attachments.filter(function (a) {
      return String(a.id) === String(id);
    })[0];
    try {
      await Blog.attachments.remove(id);
      if (row && row.object_path) {
        try {
          await Blog.storage.remove([row.object_path]);
        } catch (e) {}
      }
      state.attachments = state.attachments.filter(function (a) {
        return String(a.id) !== String(id);
      });
      state.pendingAttachmentIds = state.pendingAttachmentIds.filter(function (x) {
        return String(x) !== String(id);
      });
      renderAttachSlot();
      UI.toast('附件已删除');
    } catch (err) {
      alertBox('error', Blog.messageOf(err));
    }
  }

  /* ---------------- 读写 ---------------- */

  function collect(values) {
    var title = (document.getElementById('f-title').value || '').trim();
    var tagsRaw = (document.getElementById('f-tags').value || '').trim();
    var content = document.getElementById('f-content').value || '';
    var excerpt = (document.getElementById('f-excerpt').value || '').trim();

    var tags = tagsRaw
      ? tagsRaw
          .split(/[,，]/)
          .map(function (t) {
            return t.trim();
          })
          .filter(Boolean)
          .filter(function (t, i, arr) {
            return arr.indexOf(t) === i;
          })
      : [];

    if (!excerpt && content) {
      excerpt = content
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/[#>*`|_\[\]()\-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 110);
    }

    return {
      title: title,
      slug: slugify(title),
      excerpt: excerpt,
      content: content,
      tags: tags,
      cover_path: state.current ? state.current.cover_path : null,
      owner_name: (Blog.config && Blog.config.defaultAuthor) || '作者',
      updated_at: new Date().toISOString(),
    };
  }

  async function save(mode) {
    clearAlert();
    var payload = collect();

    if (!payload.title) {
      alertBox('error', '请先填写文章标题。');
      document.getElementById('f-title').focus();
      return;
    }

    var buttons = editorHost.querySelectorAll('.toolbar .btn');
    Array.prototype.forEach.call(buttons, function (b) {
      b.disabled = true;
    });

    try {
      if (mode === 'publish') {
        payload.status = 'published';
        payload.published_at = new Date().toISOString();
      } else if (mode === 'unpublish') {
        payload.status = 'draft';
      } else {
        payload.status = state.current && state.current.id ? state.current.status || 'draft' : 'draft';
      }

      var saved;
      if (state.current && state.current.id) {
        saved = await Blog.posts.update(state.current.id, payload);
      } else {
        saved = await Blog.posts.create(payload);
        // 把草稿期上传的附件挂到新文章上
        for (var i = 0; i < state.pendingAttachmentIds.length; i++) {
          try {
            await Blog.attachments.bindToPost(state.pendingAttachmentIds[i], saved.id);
          } catch (e) {}
        }
        state.pendingAttachmentIds = [];
      }

      state.current = saved;
      state.dirty = false;
      await loadNav();
      alertBox('ok', mode === 'publish' ? '文章已发布。' : '已保存。');
      UI.toast(mode === 'publish' ? '文章已发布' : '已保存');

      if (mode === 'publish' || mode === 'unpublish') renderEditor();
      else {
        renderNav();
        Array.prototype.forEach.call(editorHost.querySelectorAll('.toolbar .btn'), function (b) {
          b.disabled = false;
        });
      }
    } catch (err) {
      alertBox('error', Blog.messageOf(err));
      Array.prototype.forEach.call(editorHost.querySelectorAll('.toolbar .btn'), function (b) {
        b.disabled = false;
      });
    }
  }

  async function removePost() {
    if (!state.current || !state.current.id) return;
    if (!confirm('确定删除《' + (state.current.title || '未命名') + '》？删除后不可恢复。')) return;
    try {
      await Blog.posts.remove(state.current.id);
      state.dirty = false;
      state.current = null;
      state.attachments = [];
      await loadNav();
      newPost();
      UI.toast('文章已删除');
    } catch (err) {
      alertBox('error', Blog.messageOf(err));
    }
  }

  /* ---------------- 打开 / 新建 ---------------- */

  async function loadAttachments() {
    if (!(state.current && state.current.id)) {
      state.attachments = [];
      return;
    }
    try {
      state.attachments = await Blog.attachments.listByPost(state.current.id);
    } catch (e) {
      state.attachments = [];
    }
  }

  async function openPost(id) {
    clearAlert();
    var found = state.posts.filter(function (p) {
      return String(p.id) === String(id);
    })[0];
    if (!found) {
      try {
        found = await Blog.posts.getById(id);
      } catch (e) {
        found = null;
      }
    }
    if (!found) {
      alertBox('error', '没有找到这篇文章。');
      return;
    }
    state.current = found;
    state.pendingAttachmentIds = [];
    state.dirty = false;
    await loadAttachments();
    renderNav();
    renderEditor();
  }

  function newPost() {
    clearAlert();
    state.current = {
      id: null,
      title: '',
      excerpt: '',
      content: '',
      tags: [],
      cover_path: null,
      status: 'draft',
    };
    state.attachments = [];
    state.pendingAttachmentIds = [];
    state.dirty = false;
    renderNav();
    renderEditor();
    var t = document.getElementById('f-title');
    if (t) t.focus();
    history.replaceState(null, '', 'studio.html');
  }

  async function loadNav() {
    try {
      state.posts = await Blog.posts.listMine(state.userId);
    } catch (err) {
      navHost.innerHTML = '<div class="hint">' + UI.esc(Blog.messageOf(err)) + '</div>';
      return;
    }
    renderNav();
  }

  /* ---------------- 启动 ---------------- */

  async function boot() {
    navHost = document.getElementById('post-nav');
    editorHost = document.getElementById('editor-host');
    alertHost = document.getElementById('editor-alert');
    gateHost = document.getElementById('gate-host');
    studioHost = document.getElementById('studio-host');

    UI.mountHeader(null);
    UI.mountFooter();
    UI.mountEnvWarning();

    var next = 'studio.html' + (location.search || '');
    document.getElementById('gate-login').setAttribute('href', 'login.html?next=' + encodeURIComponent(next));

    if (!Blog.ready) {
      gateHost.style.display = '';
      gateHost.querySelector('h1').textContent = '云端未连接';
      gateHost.querySelector('.sub').textContent = '无法访问写作台，请检查网络后刷新。';
      return;
    }

    state.session = await UI.loadSession();
    if (!state.session || !state.session.user) {
      gateHost.style.display = '';
      return;
    }

    state.userId = state.session.user.id;
    studioHost.style.display = '';
    document.getElementById('btn-new').addEventListener('click', function () {
      if (state.dirty && !confirm('当前编辑尚未保存，确定要新建吗？')) return;
      newPost();
    });

    window.addEventListener('beforeunload', function (e) {
      if (state.dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    await loadNav();

    var id = UI.qs('id');
    if (id) await openPost(id);
    else if (state.posts.length) await openPost(state.posts[0].id);
    else newPost();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
