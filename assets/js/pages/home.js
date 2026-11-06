/* 首页：文章列表 + 标签筛选 + 关键词搜索 */
(function () {
  'use strict';

  var all = [];
  var activeTag = UI.qs('tag') || '';
  var keyword = '';

  var host, tagbar, stats;

  function tagCounts() {
    var map = {};
    all.forEach(function (p) {
      (p.tags || []).forEach(function (t) {
        map[t] = (map[t] || 0) + 1;
      });
    });
    return Object.keys(map)
      .map(function (k) {
        return { tag: k, n: map[k] };
      })
      .sort(function (a, b) {
        return b.n - a.n || a.tag.localeCompare(b.tag, 'zh-Hans-CN');
      });
  }

  function renderTagbar() {
    if (!tagbar) return;
    var list = tagCounts();
    var total = all.length;
    var html =
      '<button class="chip' + (activeTag ? '' : ' active') + '" data-tag="">全部<span class="n">' + total + '</span></button>';
    html += list
      .map(function (item) {
        return (
          '<button class="chip' + (item.tag === activeTag ? ' active' : '') + '" data-tag="' +
          UI.esc(item.tag) + '">' + UI.esc(item.tag) + '<span class="n">' + item.n + '</span></button>'
        );
      })
      .join('');
    tagbar.innerHTML = html;

    Array.prototype.forEach.call(tagbar.querySelectorAll('.chip'), function (btn) {
      btn.addEventListener('click', function () {
        activeTag = btn.getAttribute('data-tag') || '';
        renderTagbar();
        renderList();
        var url = activeTag ? '?tag=' + encodeURIComponent(activeTag) : location.pathname;
        history.replaceState(null, '', url);
      });
    });
  }

  function visible() {
    var out = all;
    if (activeTag) {
      out = out.filter(function (p) {
        return (p.tags || []).indexOf(activeTag) !== -1;
      });
    }
    if (keyword) {
      var k = keyword.toLowerCase();
      out = out.filter(function (p) {
        return (
          String(p.title || '').toLowerCase().indexOf(k) !== -1 ||
          String(p.excerpt || '').toLowerCase().indexOf(k) !== -1
        );
      });
    }
    return out;
  }

  function itemHtml(post) {
    var tags = (post.tags || [])
      .map(function (t) {
        return '<span class="tag-pill">' + UI.esc(t) + '</span>';
      })
      .join('');
    var minutes = UI.readingMinutes(post.content);
    return (
      '<li class="post-item"><a href="post.html?id=' + encodeURIComponent(post.id) + '">' +
      '<div class="date">' + UI.formatDate(post.published_at || post.created_at) + '</div>' +
      '<div>' +
      '<h3>' + UI.esc(post.title) + '</h3>' +
      (post.excerpt ? '<p class="excerpt">' + UI.esc(post.excerpt) + '</p>' : '') +
      '<div class="row"><div class="tags-inline">' + tags + '</div>' +
      '<span class="rt">约 ' + minutes + ' 分钟</span></div>' +
      '</div></a></li>'
    );
  }

  function renderList() {
    var list = visible();
    var title = document.getElementById('list-title');
    if (title) {
      if (keyword) title.textContent = '搜索「' + keyword + '」· ' + list.length + ' 篇';
      else if (activeTag) title.textContent = '标签：' + activeTag + ' · ' + list.length + ' 篇';
      else title.textContent = '最新文章';
    }

    if (!list.length) {
      host.innerHTML = UI.stateBlock(
        keyword ? '没有匹配的文章' : '这个标签下暂时还没有文章',
        keyword ? '换一个关键词试试。' : '换个标签看看，或者回到全部文章。'
      );
      return;
    }
    host.innerHTML = '<ul class="post-list">' + list.map(itemHtml).join('') + '</ul>';
  }

  function renderStats() {
    if (!stats) return;
    var tags = tagCounts();
    var latest = all.length ? all[0].published_at || all[0].created_at : null;
    stats.innerHTML =
      '<span>' + all.length + ' 篇文章</span>' +
      '<span>' + tags.length + ' 个标签</span>' +
      (latest ? '<span>最近更新 ' + UI.formatDate(latest) + '</span>' : '');
  }

  function debounce(fn, wait) {
    var timer;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(fn, wait);
    };
  }

  /**
   * 渲染兜底。
   * 之前 itemHtml 里引用了未加载的模块，异常直接冒泡，
   * 页面永远停在骨架屏上且不给任何线索 —— 这是最糟的失败形态。这里统一接住并报出来。
   */
  function safeRenderList() {
    try {
      renderList();
    } catch (err) {
      host.innerHTML = UI.stateBlock('文章列表渲染失败', (err && err.message) || String(err));
      if (window.console && console.error) console.error('[blog] render list failed:', err);
    }
  }

  async function boot() {
    host = document.getElementById('post-host');
    tagbar = document.getElementById('tagbar');
    stats = document.getElementById('stats');

    UI.mountHeader('posts');
    UI.mountFooter();
    UI.mountEnvWarning();

    var search = document.getElementById('search');
    if (search) {
      search.addEventListener(
        'input',
        debounce(function () {
          keyword = search.value.trim();
          safeRenderList();
        }, 180)
      );
    }

    if (!Blog.ready) {
      host.innerHTML = UI.stateBlock('云端未连接', '无法读取文章数据，请检查网络后刷新。');
      return;
    }

    host.innerHTML = UI.skeletonList(4);

    try {
      all = (await Blog.posts.listPublished()) || [];
    } catch (err) {
      host.innerHTML = UI.failBlock('文章加载失败', err);
      UI.bindRetry(host);
      return;
    }

    renderStats();
    renderTagbar();
    safeRenderList();
  }

  document.addEventListener('DOMContentLoaded', function () {
    boot().catch(function (err) {
      var h = document.getElementById('post-host');
      if (h) h.innerHTML = UI.stateBlock('页面初始化失败', (err && err.message) || String(err));
      if (window.console && console.error) console.error('[blog] boot failed:', err);
    });
  });
})();

