/* --------------------------------------------------------------------------
   云服务接入层
   单一 client 实例：Auth / Database / Storage 共用。
   -------------------------------------------------------------------------- */

(function (global) {
  'use strict';

  var CFG = global.BLOG_CONFIG || {};

  function fail(msg) {
    var e = new Error(msg);
    e.kind = 'sdk-unavailable';
    return e;
  }

  var cloud = null;
  var initError = null;

  if (!global.WorkBuddyCloud || typeof global.WorkBuddyCloud.createWorkBuddyCloud !== 'function') {
    initError = fail('云端能力未能加载，请检查网络后刷新页面。');
  } else {
    try {
      cloud = global.WorkBuddyCloud.createWorkBuddyCloud({
        endpoint: CFG.endpoint,
        publishableKey: CFG.publishableKey,
      });
    } catch (err) {
      initError = err;
    }
  }

  /* ---------------- 通用工具 ---------------- */

  function unwrap(res) {
    if (res && res.error) throw res.error;
    return res ? res.data : null;
  }

  /**
   * 网络层失败识别。
   * 浏览器对「请求被 CORS/安全策略挡掉」的情况统一抛出 TypeError: Failed to fetch，
   * 它不携带 HTTP 状态码，因此必须单独识别，否则用户只会看到一句无意义的英文报错。
   */
  var NETWORK_RE = /failed to fetch|networkerror|load failed|network request failed|err_|blocked by cors/i;

  function isNetworkError(error) {
    if (!error) return false;
    var text = String(error.message || error.name || error);
    return NETWORK_RE.test(text);
  }

  function messageOf(error) {
    if (!error) return '发生未知错误，请稍后重试。';
    if (isNetworkError(error)) {
      return '浏览器未能把请求发到云端（网络层被拦截），通常是页面打开位置不是站点的正式域名。';
    }
    var code = error.code;
    if (code === '42P01') return '数据表尚未创建，请联系站点维护者。';
    if (code === '42501') return '没有执行该操作的权限。';
    if (code === '23505') return '已存在相同记录。';
    if (code === '23503') return '关联的数据不存在。';
    if (error.kind === 'invalid_grant' || error.kind === 'unauthenticated') return '登录状态已失效，请重新登录。';
    if (error.kind === 'network') return '网络连接异常，请稍后重试。';
    if (error.kind === 'backend-unavailable') return '服务暂时不可用，请稍后重试。';
    if (error.message) return String(error.message);
    return '操作失败，请稍后重试。';
  }


  /* ---------------- 认证 ---------------- */

  var auth = {
    available: function () {
      return !!cloud && !!cloud.auth;
    },

    getSession: async function () {
      if (!cloud) return null;
      try {
        var res = await cloud.auth.getSession();
        if (res && res.error) return null;
        return res ? res.data : null;
      } catch (e) {
        return null;
      }
    },

    currentUser: async function () {
      var session = await auth.getSession();
      return session && session.user ? session.user : null;
    },

    signInWithPassword: function (email, password) {
      return cloud.auth.signInWithPassword({ email: email, password: password });
    },

    sendOtp: function (email) {
      return cloud.auth.sendOtp({ email: email });
    },

    verifyOtp: function (payload) {
      return cloud.auth.verifyOtp(payload);
    },

    signInWithOtp: function (email) {
      return cloud.auth.signInWithOtp({ email: email });
    },

    resetPasswordForEmail: function (email) {
      return cloud.auth.resetPasswordForEmail(email);
    },

    signOut: function () {
      return cloud.auth.signOut();
    },

    onAuthStateChange: function (cb) {
      if (!cloud) return function () {};
      try {
        return cloud.auth.onAuthStateChange(cb) || function () {};
      } catch (e) {
        return function () {};
      }
    },
  };

  /* ---------------- 文章 ---------------- */

  var POST_FIELDS =
    'id, owner_id, owner_name, title, slug, excerpt, content, cover_path, tags, status, created_at, updated_at, published_at';

  var posts = {
    /** 公开列表：已发布文章（匿名可读） */
    listPublished: async function (options) {
      var opts = options || {};
      var query = cloud.database
        .from('posts')
        .select(POST_FIELDS)
        .eq('status', 'published')
        .order('published_at', { ascending: false });

      if (opts.limit) query = query.limit(opts.limit);
      else query = query.limit(200);
      if (opts.tag) query = query.contains('tags', [opts.tag]);
      if (opts.search) query = query.or('title.ilike.%' + opts.search + '%,excerpt.ilike.%' + opts.search + '%');

      return unwrap(await query);
    },

    /** 标签页只需要轻量字段 */
    listForTags: async function () {
      return unwrap(
        await cloud.database
          .from('posts')
          .select('id, title, tags, published_at')
          .eq('status', 'published')
          .order('published_at', { ascending: false })
          .limit(500)
      );
    },

    getById: async function (id) {
      var res = await cloud.database.from('posts').select(POST_FIELDS).eq('id', id).maybeSingle();
      if (res && res.error) throw res.error;
      return res ? res.data : null;
    },

    /** 当前登录用户的全部文章（含草稿），由 RLS 保证只返回自己的 */
    listMine: async function (userId) {
      var data = unwrap(
        await cloud.database
          .from('posts')
          .select(POST_FIELDS)
          .eq('owner_id', userId)
          .order('updated_at', { ascending: false })
          .limit(300)
      );
      return data || [];
    },

    create: async function (payload) {
      var res = await cloud.database.from('posts').insert(payload).select(POST_FIELDS);
      if (res && res.error) throw res.error;
      var rows = res && res.data ? res.data : [];
      if (!rows.length) throw new Error('创建未生效，请确认已登录。');
      return rows[0];
    },

    update: async function (id, payload) {
      var res = await cloud.database.from('posts').update(payload).eq('id', id).select(POST_FIELDS);
      if (res && res.error) throw res.error;
      var rows = res && res.data ? res.data : [];
      if (!rows.length) throw new Error('保存未生效：文章不存在，或不属于当前账号。');
      return rows[0];
    },

    remove: async function (id) {
      var res = await cloud.database.from('posts').delete().eq('id', id).select('id');
      if (res && res.error) throw res.error;
      var rows = res && res.data ? res.data : [];
      if (!rows.length) throw new Error('删除未生效：文章不存在，或不属于当前账号。');
      return true;
    },
  };

  /* ---------------- 附件 ---------------- */

  var attachments = {
    listByPost: async function (postId) {
      var data = unwrap(
        await cloud.database
          .from('attachments')
          .select('id, post_id, file_name, object_path, mime_type, size_bytes, created_at')
          .eq('post_id', postId)
          .order('created_at', { ascending: true })
      );
      return data || [];
    },

    listMine: async function () {
      var data = unwrap(
        await cloud.database
          .from('attachments')
          .select('id, post_id, file_name, object_path, mime_type, size_bytes, created_at')
          .order('created_at', { ascending: false })
      );
      return data || [];
    },

    create: async function (payload) {
      var res = await cloud.database.from('attachments').insert(payload).select('id');
      if (res && res.error) throw res.error;
      var rows = res && res.data ? res.data : [];
      if (!rows.length) throw new Error('附件记录写入失败，请确认已登录。');
      return rows[0];
    },

    remove: async function (id) {
      var res = await cloud.database.from('attachments').delete().eq('id', id).select('id');
      if (res && res.error) throw res.error;
      return (res.data || []).length > 0;
    },

    /** 把草稿期上传的附件挂到正式文章上 */
    bindToPost: async function (id, postId) {
      var res = await cloud.database.from('attachments').update({ post_id: postId }).eq('id', id).select('id');
      if (res && res.error) throw res.error;
      return (res.data || []).length > 0;
    },

    removeByPath: async function (path) {
      var res = await cloud.database.from('attachments').delete().eq('object_path', path).select('id');
      if (res && res.error) throw res.error;
      return (res.data || []).length > 0;
    },
  };

  /* ---------------- 站点资料 ---------------- */

  var profile = {
    get: async function () {
      var res = await cloud.database
        .from('site_profile')
        .select('id, owner_id, display_name, tagline, bio, avatar_path, links, updated_at')
        .order('updated_at', { ascending: false })
        .limit(1);
      if (res && res.error) throw res.error;
      var rows = res && res.data ? res.data : [];
      return rows.length ? rows[0] : null;
    },

    upsertMine: async function (userId, payload) {
      var existing = await cloud.database.from('site_profile').select('id').eq('owner_id', userId).limit(1);
      if (existing && existing.error) throw existing.error;
      var rows = existing && existing.data ? existing.data : [];
      if (rows.length) {
        var upd = await cloud.database
          .from('site_profile')
          .update(payload)
          .eq('id', rows[0].id)
          .select('id');
        if (upd && upd.error) throw upd.error;
      } else {
        var ins = await cloud.database.from('site_profile').insert(payload).select('id');
        if (ins && ins.error) throw ins.error;
      }
      return profile.get();
    },
  };

  /* ---------------- 存储 ---------------- */

  var signedCache = new Map();

  function extOf(name, fallback) {
    var m = /\.([a-z0-9]+)$/i.exec(String(name || ''));
    return m ? m[1].toLowerCase() : fallback || 'bin';
  }

  function uuid() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') return global.crypto.randomUUID();
    return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  var storage = {
    /** 上传文章内嵌图片，返回对象路径 */
    uploadImage: async function (userId, file) {
      if (CFG.allowedImageTypes.indexOf(file.type) === -1) {
        throw new Error('仅支持 PNG / JPG / WebP / GIF / SVG 图片。');
      }
      if (file.size > CFG.maxUploadBytes) {
        throw new Error('图片超过 ' + Math.round(CFG.maxUploadBytes / 1024 / 1024) + 'MB 上限。');
      }
      var path = cloud.storage.sharedPath(userId, 'blog/' + uuid() + '.' + extOf(file.name, 'png'));
      var res = await cloud.storage.upload(path, file, { contentType: file.type, cacheControl: '3600' });
      if (res && res.error) throw res.error;
      return path;
    },

    /** 上传封面，返回对象路径 */
    uploadCover: async function (userId, file) {
      if (CFG.allowedImageTypes.indexOf(file.type) === -1) {
        throw new Error('封面仅支持 PNG / JPG / WebP / GIF / SVG。');
      }
      if (file.size > CFG.maxUploadBytes) {
        throw new Error('封面超过 ' + Math.round(CFG.maxUploadBytes / 1024 / 1024) + 'MB 上限。');
      }
      var path = cloud.storage.sharedPath(userId, 'covers/' + uuid() + '.' + extOf(file.name, 'png'));
      var res = await cloud.storage.upload(path, file, { contentType: file.type, cacheControl: '3600' });
      if (res && res.error) throw res.error;
      return path;
    },

    /** 上传附件，返回对象路径 */
    uploadAttachment: async function (userId, file) {
      if (CFG.allowedFileTypes.indexOf(file.type) === -1) {
        throw new Error('不支持该文件类型：' + (file.type || '未知'));
      }
      if (file.size > CFG.maxUploadBytes) {
        throw new Error('附件超过 ' + Math.round(CFG.maxUploadBytes / 1024 / 1024) + 'MB 上限。');
      }
      var safe = extOf(file.name, 'dat');
      var path = cloud.storage.sharedPath(userId, 'files/' + uuid() + '.' + safe);
      var res = await cloud.storage.upload(path, file, { contentType: file.type, cacheControl: '3600' });
      if (res && res.error) throw res.error;
      return path;
    },

    avatar: async function (userId, file) {
      var path = cloud.storage.sharedPath(userId, 'avatar/' + uuid() + '.' + extOf(file.name, 'png'));
      var res = await cloud.storage.upload(path, file, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: true,
      });
      if (res && res.error) throw res.error;
      return path;
    },

    /**
     * 取得签名访问地址（默认 1 小时）。
     * 存储资源仅对已登录用户开放，未登录时返回 null。
     */
    signedUrl: async function (path, ttl) {
      if (!path || !cloud) return null;
      var life = ttl || 3600;
      var key = path + '|' + life;
      var hit = signedCache.get(key);
      if (hit && hit.expiresAt > Date.now() + 60000) return hit.url;
      var session = await auth.getSession();
      if (!session) return null;
      try {
        var res = await cloud.storage.createSignedUrl(path, life);
        if (res && res.error) return null;
        var url = res && res.data ? res.data.signedUrl || res.data.url || res.data : null;
        if (typeof url !== 'string') return null;
        signedCache.set(key, { url: url, expiresAt: Date.now() + (life - 120) * 1000 });
        return url;
      } catch (e) {
        return null;
      }
    },

    remove: async function (paths) {
      var res = await cloud.storage.remove(paths);
      if (res && res.error) throw res.error;
      return true;
    },

    downloadBlob: async function (path) {
      var blob = await cloud.storage.download(path);
      if (blob && blob.error) throw blob.error;
      return blob;
    },
  };

  /* ---------------- 对外接口 ---------------- */

  global.Blog = {
    cloud: cloud,
    initError: initError,
    ready: !!cloud,
    config: CFG,
    auth: auth,
    posts: posts,
    attachments: attachments,
    profile: profile,
    storage: storage,
    unwrap: unwrap,
    messageOf: messageOf,
    isNetworkError: isNetworkError,
    uuid: uuid,
  };
})(window);
