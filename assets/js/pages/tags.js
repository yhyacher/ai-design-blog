/* 标签分类页：标签云 + 按标签聚合的文章分组 */
(function () {
  'use strict';

  function group(posts) {
    var map = {};
    posts.forEach(function (p) {
      (p.tags || []).forEach(function (t) {
        if (!map[t]) map[t] = [];
        map[t].push(p);
      });
    });
    return Object.keys(map)
      .map(function (k) {
        return { tag: k, posts: map[k] };
      })
      .sort(function (a, b) {
        return b.posts.length - a.posts.length || a.tag.localeCompare(b.tag, 'zh-Hans-CN');
      });
  }

  function render(tags) {
    var bar = document.getElementById('tagbar');
    var host = document.getElementById('groups-host');

    if (!tags.length) {
      bar.innerHTML = '';
      host.innerHTML = UI.stateBlock('还没有已发布的文章', '写点什么之后，标签会自动出现在这里。');
      return;
    }

    var total = tags.reduce(function (sum, g) {
      return sum + g.posts.length;
    }, 0);

    bar.innerHTML =
      '<span class="chip active" style="pointer-events:none">共 ' + tags.length + ' 个标签 · ' + total +
      ' 次引用</span>';

    host.innerHTML = tags
      .map(function (g) {
        var rows = g.posts
          .map(function (p) {
            return (
              '<li><a class="t" href="post.html?id=' + encodeURIComponent(p.id) + '">' + UI.esc(p.title) + '</a>' +
              '<span class="d">' + UI.formatDate(p.published_at) + '</span></li>'
            );
          })
          .join('');
        return (
          '<section class="tag-group" id="tag-' + encodeURIComponent(g.tag) + '">' +
          '<div class="tag-group-head">' +
          '<h3>' + UI.esc(g.tag) + '</h3>' +
          '<span class="n">' + g.posts.length + ' 篇</span>' +
          '<span class="spacer"></span>' +
          '<a class="btn btn-sm btn-ghost" href="index.html?tag=' + encodeURIComponent(g.tag) + '">只看这个标签</a>' +
          '</div>' +
          '<ul class="mini-list">' + rows + '</ul>' +
          '</section>'
        );
      })
      .join('');
  }

  async function boot() {
    UI.mountHeader('tags');
    UI.mountFooter();
    UI.mountEnvWarning();

    var host = document.getElementById('groups-host');
    if (!Blog.ready) {
      host.innerHTML = UI.stateBlock('云端未连接', '无法读取标签数据。');
      return;
    }

    host.innerHTML = UI.skeletonList(3);
    try {
      var posts = (await Blog.posts.listForTags()) || [];
      render(group(posts));
    } catch (err) {
      host.innerHTML = UI.failBlock('标签加载失败', err);
      UI.bindRetry(host);
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
