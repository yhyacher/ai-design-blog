/* --------------------------------------------------------------------------
   GitHub Pages 静态阅读模式
   仅在 github.io 域名生效：公开文章与站点资料来自仓库内快照，
   其它域名仍由 cloud.js 连接 WorkBuddy Cloud。
   -------------------------------------------------------------------------- */

(function (global) {
  'use strict';

  var isGitHubPages = /(^|\.)github\.io$/i.test(global.location.hostname || '');
  if (!isGitHubPages) return;

  var postsPromise = null;
  var profilePromise = null;

  function fetchJson(path) {
    return fetch(path, { cache: 'no-cache' }).then(function (response) {
      if (!response.ok) throw new Error('静态内容读取失败（HTTP ' + response.status + '）。');
      return response.json();
    });
  }

  function loadPosts() {
    if (!postsPromise) {
      postsPromise = fetchJson('assets/data/posts.json').then(function (rows) {
        return (rows || [])
          .filter(function (post) {
            return post.status === 'published';
          })
          .sort(function (a, b) {
            return String(b.published_at || b.created_at || '').localeCompare(
              String(a.published_at || a.created_at || '')
            );
          });
      });
    }
    return postsPromise;
  }

  function loadProfile() {
    if (!profilePromise) profilePromise = fetchJson('assets/data/profile.json');
    return profilePromise;
  }

  var auth = {
    available: function () {
      return false;
    },
    getSession: function () {
      return Promise.resolve(null);
    },
    currentUser: function () {
      return Promise.resolve(null);
    },
    onAuthStateChange: function () {
      return function () {};
    },
    signOut: function () {
      return Promise.resolve();
    },
  };

  var posts = {
    listPublished: function (options) {
      var opts = options || {};
      return loadPosts().then(function (rows) {
        var out = rows.slice();
        if (opts.tag) {
          out = out.filter(function (post) {
            return (post.tags || []).indexOf(opts.tag) !== -1;
          });
        }
        if (opts.search) {
          var keyword = String(opts.search).toLowerCase();
          out = out.filter(function (post) {
            return (
              String(post.title || '').toLowerCase().indexOf(keyword) !== -1 ||
              String(post.excerpt || '').toLowerCase().indexOf(keyword) !== -1
            );
          });
        }
        if (opts.limit) out = out.slice(0, opts.limit);
        return out;
      });
    },

    listForTags: function () {
      return loadPosts().then(function (rows) {
        return rows.map(function (post) {
          return {
            id: post.id,
            title: post.title,
            tags: post.tags,
            published_at: post.published_at,
          };
        });
      });
    },

    getById: function (id) {
      return loadPosts().then(function (rows) {
        var matches = rows.filter(function (post) {
          return String(post.id) === String(id);
        });
        return matches.length ? matches[0] : null;
      });
    },
  };

  global.Blog = Object.assign({}, global.Blog, {
    cloud: null,
    initError: null,
    ready: true,
    staticMode: true,
    auth: auth,
    posts: posts,
    attachments: {
      listByPost: function () {
        return Promise.resolve([]);
      },
    },
    profile: {
      get: loadProfile,
    },
    storage: {
      signedUrl: function () {
        return Promise.resolve(null);
      },
    },
  });
})(window);
