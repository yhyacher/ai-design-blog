/* 首页：文章列表 + 标签筛选 + 关键词搜索 */
(function () {
  'use strict';

  var all = [];
  var activeTag = UI.qs('tag') || '';
  var keyword = '';
  var currentPage = 1;
  var pageSize = 20;
  var pageSizeOptions = [10, 20, 50];

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
        currentPage = 1;
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

  function paginationTokens(totalPages) {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, function (_, i) {
        return i + 1;
      });
    }

    var tokens = [1];
    var start = Math.max(2, currentPage - 1);
    var end = Math.min(totalPages - 1, currentPage + 1);
    if (start > 2) tokens.push('ellipsis-left');
    for (var i = start; i <= end; i++) tokens.push(i);
    if (end < totalPages - 1) tokens.push('ellipsis-right');
    tokens.push(totalPages);
    return tokens;
  }

  function paginationHtml(total) {
    var totalPages = Math.max(1, Math.ceil(total / pageSize));
    var pages = paginationTokens(totalPages)
      .map(function (page) {
        if (typeof page !== 'number') return '<span class="pagination-ellipsis" aria-hidden="true">…</span>';
        var active = page === currentPage;
        return (
          '<button type="button" class="page-btn' + (active ? ' active' : '') + '" data-page="' + page + '"' +
          (active ? ' aria-current="page"' : '') + ' aria-label="第 ' + page + ' 页">' + page + '</button>'
        );
      })
      .join('');

    return (
      '<nav class="pagination" aria-label="文章分页">' +
      '<span class="pagination-summary">共 ' + total + ' 篇 · 第 ' + currentPage + ' / ' + totalPages + ' 页</span>' +
      '<div class="pagination-pages">' +
      '<button type="button" class="page-btn page-prev" data-page="' + (currentPage - 1) + '" aria-label="上一页"' +
      (currentPage === 1 ? ' disabled' : '') + '>上一页</button>' +
      pages +
      '<button type="button" class="page-btn page-next" data-page="' + (currentPage + 1) + '" aria-label="下一页"' +
      (currentPage === totalPages ? ' disabled' : '') + '>下一页</button>' +
      '</div>' +
      '<div class="pagination-size"><span id="page-size-label">每页</span>' +
      '<div class="page-size-control">' +
      '<button type="button" class="page-size-trigger" id="page-size-trigger" aria-haspopup="listbox" aria-expanded="false" aria-controls="page-size-menu" aria-labelledby="page-size-label page-size-value">' +
      '<span id="page-size-value">' + pageSize + ' 篇</span>' +
      '<svg class="page-size-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>' +
      '</button>' +
      '<div class="page-size-menu" id="page-size-menu" role="listbox" aria-label="每页文章数量" hidden>' +
      pageSizeOptions.map(function (size) {
        var selected = size === pageSize;
        return (
          '<button type="button" class="page-size-option' + (selected ? ' active' : '') + '" role="option" data-size="' + size + '" aria-selected="' + selected + '">' +
          '<span>' + size + ' 篇</span>' +
          '<svg class="page-size-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 7"/></svg></button>'
        );
      }).join('') +
      '</div></div></div></nav>'
    );
  }

  function bindPagination() {
    Array.prototype.forEach.call(host.querySelectorAll('[data-page]'), function (btn) {
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        var target = Number(btn.getAttribute('data-page'));
        if (!Number.isFinite(target) || target === currentPage) return;
        currentPage = target;
        safeRenderList();
        var head = document.querySelector('.section-head');
        if (head) head.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    var control = host.querySelector('.page-size-control');
    if (!control) return;
    var trigger = document.getElementById('page-size-trigger');
    var menu = document.getElementById('page-size-menu');
    var options = Array.prototype.slice.call(menu.querySelectorAll('[data-size]'));

    function onDocumentClick(event) {
      if (!control.contains(event.target)) closeMenu(false);
    }

    function closeMenu(restoreFocus) {
      menu.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      document.removeEventListener('click', onDocumentClick);
      if (restoreFocus) trigger.focus();
    }

    function openMenu(moveFocus) {
      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      document.addEventListener('click', onDocumentClick);
      if (moveFocus) {
        var selected = options.filter(function (option) {
          return option.getAttribute('aria-selected') === 'true';
        })[0];
        (selected || options[0]).focus();
      }
    }

    trigger.addEventListener('click', function () {
      if (menu.hidden) openMenu(false);
      else closeMenu(false);
    });

    trigger.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        openMenu(true);
      }
    });

    menu.addEventListener('keydown', function (event) {
      var index = options.indexOf(document.activeElement);
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu(true);
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        var step = event.key === 'ArrowDown' ? 1 : -1;
        options[(index + step + options.length) % options.length].focus();
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        options[event.key === 'Home' ? 0 : options.length - 1].focus();
      } else if (event.key === 'Tab') {
        closeMenu(false);
      }
    });

    options.forEach(function (option) {
      option.addEventListener('click', function () {
        var nextSize = Number(option.getAttribute('data-size'));
        if (pageSizeOptions.indexOf(nextSize) === -1) return;
        closeMenu(false);
        pageSize = nextSize;
        currentPage = 1;
        safeRenderList();
        var nextTrigger = document.getElementById('page-size-trigger');
        if (nextTrigger) nextTrigger.focus();
      });
    });
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

    var totalPages = Math.max(1, Math.ceil(list.length / pageSize));
    currentPage = Math.min(Math.max(1, currentPage), totalPages);
    var start = (currentPage - 1) * pageSize;
    var pageItems = list.slice(start, start + pageSize);
    host.innerHTML = '<ul class="post-list">' + pageItems.map(itemHtml).join('') + '</ul>' + paginationHtml(list.length);
    bindPagination();
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
          currentPage = 1;
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

