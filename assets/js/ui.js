/* --------------------------------------------------------------------------
   站点外壳：主题、页头、页脚、Toast、时间格式化、会话状态
   -------------------------------------------------------------------------- */

(function (global) {
  'use strict';

  var CFG = global.BLOG_CONFIG || {};
  var THEME_KEY = 'blog-theme';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ---------------- 主题 ---------------- */

  var theme = {
    current: function () {
      var stored = null;
      try {
        stored = global.localStorage.getItem(THEME_KEY);
      } catch (e) {}
      if (stored === 'light' || stored === 'dark') return stored;
      return 'light';
    },
    apply: function (value) {
      document.documentElement.setAttribute('data-theme', value);
      try {
        global.localStorage.setItem(THEME_KEY, value);
      } catch (e) {}
      var btn = document.getElementById('theme-toggle');
      if (btn) btn.innerHTML = value === 'dark' ? iconSun() : iconMoon();
    },
    toggle: function () {
      theme.apply(theme.current() === 'dark' ? 'light' : 'dark');
    },
    init: function () {
      theme.apply(theme.current());
    },
  };

  function iconMoon() {
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/></svg>';
  }
  function iconSun() {
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  }

  /* ---------------- Toast ---------------- */

  function toastRoot() {
    var root = document.getElementById('toast-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'toast-root';
      document.body.appendChild(root);
    }
    return root;
  }

  var toast = function (message, kind) {
    var el = document.createElement('div');
    el.className = 'toast' + (kind === 'error' ? ' err' : '');
    el.textContent = message;
    toastRoot().appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .25s, transform .25s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(6px)';
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 260);
    }, kind === 'error' ? 4200 : 2600);
  };

  /* ---------------- 时间 ---------------- */

  function pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function toDate(value) {
    if (!value) return null;
    var d = value instanceof Date ? value : new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  /** 列表用：2026.09.15 */
  function formatDate(value) {
    var d = toDate(value);
    if (!d) return '—';
    return d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate());
  }

  /** 详情用：2026 年 9 月 15 日 */
  function formatDateLong(value) {
    var d = toDate(value);
    if (!d) return '—';
    return d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日';
  }

  function formatBytes(n) {
    if (!n && n !== 0) return '';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }

  /**
   * 大致阅读时长（中文按字数、英文按词数估算）。
   * 刻意放在 ui.js 而不是 md.js：它是纯文本工具，不依赖任何 Markdown 解析库，
   * 放在这里可以让首页这类不需要渲染 Markdown 的页面免于引入 marked / DOMPurify。
   */
  function readingMinutes(markdown) {
    var text = String(markdown || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/[#>*`\-|_\[\]()]/g, ' ');
    var cjk = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    var words = (text.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[A-Za-z0-9]+/g) || []).length;
    return Math.max(1, Math.round(cjk / 380 + words / 220));
  }

  /* ---------------- 查询参数 ---------------- */

  function qs(name) {
    var params = new URLSearchParams(global.location.search);
    return params.get(name);
  }

  /* ---------------- 会话 ---------------- */

  var sessionPromise = null;
  var listeners = [];

  function loadSession(force) {
    if (!global.Blog || !global.Blog.ready) return Promise.resolve(null);
    if (force || !sessionPromise) {
      sessionPromise = global.Blog.auth.getSession().catch(function () {
        return null;
      });
    }
    return sessionPromise;
  }

  function notify(session) {
    listeners.forEach(function (cb) {
      try {
        cb(session);
      } catch (e) {}
    });
  }

  function onSession(cb) {
    listeners.push(cb);
    loadSession().then(cb);
  }

  function requireLogin(nextUrl) {
    var target = nextUrl || global.location.pathname.split('/').pop() + global.location.search;
    global.location.href = 'login.html?next=' + encodeURIComponent(target);
  }

  function signOut() {
    if (!global.Blog || !global.Blog.ready) return Promise.resolve();
    return global.Blog.auth
      .signOut()
      .catch(function () {})
      .then(function () {
        sessionPromise = null;
        toast('已退出登录');
        setTimeout(function () {
          global.location.href = 'index.html';
        }, 400);
      });
  }

  /* ---------------- 页头 / 页脚 ---------------- */

  var NAV = [
    { key: 'posts', label: '文章', href: 'index.html' },
    { key: 'tags', label: '标签', href: 'tags.html' },
    { key: 'about', label: '关于', href: 'about.html' },
  ];

  function headerHtml(active) {
    var nav = NAV.map(function (item) {
      return (
        '<a href="' + item.href + '"' + (item.key === active ? ' class="active"' : '') + '>' + esc(item.label) + '</a>'
      );
    }).join('');

    return (
      '<div class="wrap inner">' +
      '<a class="brand" href="index.html">' +
      '<svg class="brand-logo" viewBox="161 210 751 724" aria-hidden="true"><path fill="currentColor" transform="translate(239,235)" d="M0 0 C2.6 1.6 2.6 1.6 5.2 3.6 C6.1 4.4 7.1 5.1 8.1 5.8 C8.6 6.2 9 6.6 9.5 6.9 C11.8 8.6 14.2 10 16.6 11.5 C21.2 14.4 25.3 17.6 29.5 21 C33.5 24.2 37.8 27.1 42 30 C42.7 30.5 43.5 31 44.2 31.5 C48.3 34.3 52.4 36.9 56.6 39.5 C60.5 42 64.2 44.6 67.9 47.5 C71.3 49.9 74.8 52.1 78.4 54.3 C81 56 81 56 83.4 57.9 C86.5 60.4 89.7 62.3 93.1 64.3 C98.7 67.6 104.1 71 109.6 74.4 C111.8 75.9 114.1 77.3 116.4 78.7 C119.4 80.6 122.2 82.7 125 85 C130.4 89 135.8 92.5 141.7 95.7 C145.3 97.7 148.7 99.9 152.2 102.2 C154.1 103.4 156 104.6 158 105.9 C158.9 106.5 159.9 107.1 160.9 107.7 C161.3 108 161.3 108 163.5 109.3 C166 111 166 111 168.5 113 C170.8 114.9 173.1 116.4 175.7 117.9 C176.1 118.1 176.1 118.1 178.3 119.4 C179.2 119.9 180.1 120.5 181 121 C190.4 126.5 190.4 126.5 193.5 129.1 C195.9 131 198.2 132.2 201 133.5 C204.8 135.3 207.8 137.3 211 140 C215.9 143.7 220.9 147 226.2 150.1 C231.9 153.3 237.4 156.7 242.9 160.2 C244.4 161.2 245.9 162.1 247.3 163 C251.8 165.8 256 168.7 260 172 C261.3 172.8 262.5 173.5 263.8 174.2 C264.1 174.4 264.1 174.4 265.6 175.3 C266.1 175.5 266.5 175.8 267 176 C267 176.7 267 177.3 267 178 C267.6 178.3 268.2 178.6 268.8 178.9 C271 180 271 180 272.9 181.2 C276.1 182.4 277.7 182.1 281 181 C285.2 177.4 287.7 172.9 290 167.9 C291 166 292.1 164.6 293.5 163 C295.9 160.3 297.4 157.5 298.9 154.2 C300.5 151 302.4 148 304.2 144.9 C305.6 142.7 306.9 140.5 308.2 138.3 C311.7 132.4 315.1 126.6 319.4 121.1 C321.5 118.3 323.5 115.3 325.4 112.2 C325.6 111.9 325.6 111.9 326.5 110.4 C326.9 109.8 327.3 109.2 327.7 108.6 C332.4 101.2 337.3 93.8 342.6 86.8 C344.4 84.5 346 82.1 347.6 79.7 C349.1 77.8 350.8 76.1 352.6 74.4 C355.3 71.7 357.9 68.8 360.6 66 C361.1 65.4 361.7 64.8 362.3 64.2 C364.7 61.6 367.1 59 369.2 56.2 C370.8 54.3 371.9 53.2 373.9 52 C376.6 50.5 378.5 48.5 380.6 46.3 C388.6 38.6 399.1 33.6 409 28.9 C410.9 28 412.7 27.1 414.6 26.1 C423.8 21.4 433.1 19.1 443.2 17 C446.7 16.3 449.7 15.4 453 14 C472.3 10.8 494.9 12 513.5 17.9 C518.4 19.5 523.5 20.5 528.6 21.4 C533.2 22.4 537 23.8 541.1 26 C543.9 27.5 546.8 28.4 549.8 29.4 C556.5 31.7 562.7 34.6 569 38 C569.7 38.3 570.3 38.7 571 39.1 C577 42.4 583.1 46 588 51 C589.4 52 590.9 52.9 592.3 53.9 C594.1 55.1 595.8 56.3 597.5 57.6 C600.1 59.6 602.8 61.5 605.4 63.4 C606.1 63.9 606.7 64.3 607.3 64.7 C608.5 65.6 609.8 66.5 611 67.3 C614.7 69.9 617.8 72.7 621 76 C622.7 77.5 624.5 78.9 626.2 80.3 C629.9 83.2 633.4 86.2 636.8 89.3 C639.2 91.5 641.6 93.5 644.4 95.2 C647.4 97.3 648.7 98.6 650 102 C650.2 105.8 649.9 107.7 647.8 110.8 C641.6 117.8 633.1 122 625.1 126.7 C615.8 132.3 608 138.5 600.1 146 C597.5 148.5 594.8 150.8 592 153 C590.8 154.1 589.6 155.3 588.5 156.5 C587.3 157.7 586.2 158.8 585 160 C579.9 164.9 575.4 170 571.1 175.5 C569.9 177.2 568.6 178.8 567.3 180.5 C564.5 184 561.7 187.5 559 191 C558.4 191.8 557.8 192.5 557.2 193.3 C553.8 197.8 550.8 202.4 547.8 207.2 C545.5 210.8 543.1 214.2 540.6 217.6 C538.7 220.5 536.9 223.5 535.1 226.5 C534 228 534 228 531 229 C530.3 231 529.6 233 529 235 C528 236.5 527.1 237.9 526.1 239.4 C524.3 242 522.8 244.7 521.2 247.5 C520.5 248.7 519.8 250 519.1 251.2 C518.8 251.8 518.4 252.5 518.1 253.1 C505.2 275.8 505.2 275.8 500.1 283.2 C493.1 293.7 487.8 305.4 482.5 316.9 C480.4 321.4 478.3 325.2 475 329 C474 330.9 473.1 332.8 472.2 334.7 C471.2 336.7 470.1 338.2 468.8 339.9 C464.9 345.2 462.5 351.3 459.9 357.2 C459.1 359 458.3 360.7 457.5 362.5 C456.8 364.1 456.1 365.7 455.4 367.3 C454.1 369.8 452.7 371.8 451 374 C450.3 375.6 449.7 377.3 449.1 378.9 C447.5 382.9 445.7 385.7 443 389 C441.9 391.2 441 393.5 440 395.8 C439.1 397.7 438.2 399.3 437 401 C434.9 403.9 433.6 407 432.2 410.3 C429.7 415.9 426.8 421.5 424 427 C422.4 427 420.7 427 419 427 C415.5 420.6 412 414.3 409.1 407.5 C407 402.7 404.5 398 402.1 393.3 C400.7 390.5 399.3 387.6 397.9 384.8 C392.6 373.9 386.9 364.1 379.2 354.7 C376.6 351.5 374.2 348.2 371.9 344.8 C368.5 340 365 335.4 361 331 C359.8 329.6 358.6 328.3 357.4 326.9 C356.8 326.2 356.2 325.5 355.6 324.8 C354.4 323.4 353.2 321.9 352.1 320.4 C349.7 317.6 347 315.3 344.1 312.9 C342 311 340 309 338 307 C334.8 303.8 331.5 300.8 328.1 297.8 C326.6 296.6 325.2 295.3 323.8 293.9 C317.2 287.8 310 282.5 302.7 277.2 C300.6 275.7 298.5 274.1 296.4 272.6 C294.3 270.9 292.1 269.4 289.8 267.9 C287.2 266.1 285.2 264.2 283 262 C281.6 261.1 280.3 260.1 278.9 259.2 C276.5 257.7 274.2 256 271.9 254.2 C267.4 250.9 262.6 247.9 257.8 244.9 C252.7 241.8 247.8 238.5 243 235 C229.9 225.7 216.5 216.9 202.7 208.6 C199.2 206.5 195.9 204.2 192.7 201.6 C186.3 196.6 179.4 192.4 172.4 188.3 C171.5 187.8 170.7 187.4 169.8 186.9 C168.2 185.9 166.6 185 164.9 184.1 C160.3 181.4 155.9 178.6 151.7 175.3 C145.8 170.8 139.3 167 133 163.1 C132.4 162.8 131.9 162.5 131.4 162.2 C130.2 161.5 129.1 160.8 128 160.1 C124.3 157.8 120.7 155.5 117.1 153.2 C114.3 151.4 111.6 149.7 108.7 148.4 C106 147 104 145.4 101.8 143.4 C95.5 138.3 88.6 134.1 81.6 130 C62.6 118.7 62.6 118.7 54.7 112.1 C50.3 108.7 45.5 105.9 40.7 103.1 C35.3 99.8 30.2 96.3 25.3 92.4 C22.6 90.8 21 90.7 18 91 C17.8 91.6 17.6 92.3 17.4 92.9 C15.2 100.9 15.2 100.9 13.4 104.3 C6.2 120.6 8.5 144.4 9.8 161.6 C9.9 162.7 10 163.8 10 164.9 C10.5 171.4 11.7 176.9 14 183 C14.4 184.3 14.8 185.6 15.2 186.8 C17.5 194.5 20.2 200.6 25 207 C25.8 208.3 26.6 209.6 27.4 210.9 C31.7 217.9 36.8 224.6 42 231 C42.5 231.6 43 232.2 43.5 232.9 C48.5 238.9 54.3 243.7 60.3 248.6 C61.9 249.9 63.5 251.3 65.2 252.6 C68.1 255.1 71 257.6 74 260 C74.9 260.7 75.8 261.4 76.7 262.2 C83.6 267.8 90.9 272.7 98.4 277.4 C104.9 281.5 111.2 285.9 117.4 290.5 C124.1 295.3 130.8 299.9 138 304 C145.8 308.6 153.5 313.2 160.8 318.5 C163.4 320.3 166.1 322 168.9 323.7 C171.4 325.2 173.8 326.8 176.3 328.4 C177.2 329 178.2 329.6 179.1 330.2 C181 331.4 182.9 332.6 184.8 333.8 C189.2 336.6 193.6 339.4 198.1 342 C202.7 344.8 207.1 347.7 211.4 350.9 C214.8 353.3 218.2 355.7 221.6 358.1 C222.3 358.6 223 359.1 223.8 359.7 C228.2 362.7 232.6 365.8 237.1 368.7 C239.8 370.5 242.3 372.5 244.9 374.4 C247.3 376.2 249.7 377.9 252.2 379.6 C254.9 381.4 257.3 383.2 259.6 385.6 C261.7 387.7 263.6 389.1 266.2 390.8 C271.6 394.3 276.2 398.6 281 403 C282.4 404.2 283.7 405.4 285.1 406.6 C285.8 407.2 286.4 407.7 287.1 408.3 C288.4 409.5 289.7 410.6 291.1 411.7 C295.1 415.1 298.4 418.5 301.4 422.8 C303.2 425.3 305 427.5 306.9 429.8 C310.4 434.1 313.4 438.6 316.3 443.3 C317.9 445.8 319.5 448.2 321.1 450.6 C335.7 472.6 340.3 497 342 523 C342.1 523.7 342.1 524.3 342.2 525 C342.9 534.9 341.3 544.5 339.7 554.3 C339.6 555 339.5 555.6 339.4 556.3 C337.5 567.3 335.2 578.1 330.6 588.4 C330.4 588.7 330.4 588.7 329.7 590.4 C327.9 594.4 325.9 597.6 323 601 C322 602.4 321.1 603.8 320.2 605.2 C317 610 313.6 614.5 310 619 C309.4 619.8 308.7 620.7 308.1 621.5 C300.6 631.2 291.6 637.9 281.7 644.8 C280.2 645.9 278.7 647 277.2 648.1 C272.7 651.3 268.4 654 263.3 656 C261.3 656.9 259.6 657.8 257.8 658.9 C240.2 669 218.5 670.8 198.8 673.7 C197.2 674 195.6 674.3 194 674.5 C190.2 675.1 186.4 675.3 182.6 675.4 C181.8 675.4 181 675.4 180.1 675.5 C177.5 675.5 174.9 675.6 172.2 675.7 C171.4 675.7 170.5 675.7 169.5 675.8 C151.8 676.2 134.4 675.8 116.8 672.5 C111.7 671.6 106.6 671.2 101.4 670.6 C91.5 669.5 82 668 72.3 665.6 C69.7 664.9 67.1 664.4 64.5 663.8 C62.6 663.3 60.8 662.9 58.9 662.5 C58 662.3 57.1 662.1 56.3 661.9 C51.4 660.8 47.3 659.3 42.9 656.9 C39.1 655 34.9 654.2 30.9 653.1 C27.7 651.9 26.6 651 25 648 C24.2 641.9 26.1 638.3 29 633 C29.8 631.5 30.5 630 31.2 628.5 C31.7 627.7 32.1 626.8 32.5 626 C33.7 623.7 34.8 621.4 35.9 619.1 C36.6 617.6 37.3 616.2 38 614.8 C38.2 614.5 38.2 614.5 39 612.8 C41 608.8 43.2 605.2 45.9 601.6 C47.3 599.5 48.4 597.4 49.5 595.1 C50.9 592 52.5 589.2 54.3 586.3 C57.3 581.6 59.7 576.6 62 571.5 C64.7 565.7 67.4 560.1 70.9 554.7 C72 553 73 551.2 74.1 549.4 C75.3 547.2 76.6 545.1 78 543.1 C79.9 540.2 81.4 537.2 82.9 534.1 C84 532 84 532 85.9 529.2 C88.2 525.7 90.1 522 91.9 518.2 C92.3 517.5 92.6 516.8 93 516.1 C94 514.1 95 512 96 510 C105.5 490.7 105.5 490.7 111 484 C114 479.4 116.7 474.8 118.9 469.8 C121.1 464.8 123.6 460 126.3 455.2 C126.6 454.7 126.6 454.7 127.8 452.5 C132.3 444.4 137 436.3 141.8 428.4 C146 421.4 149.9 414.2 153.8 407.1 C154.6 405.7 155.4 404.4 156.2 403 C158.2 399.8 159.5 397.5 159.2 393.6 C159.2 392.9 159.2 392.2 159.1 391.5 C159.1 391 159 390.5 159 390 C158.4 389.7 157.8 389.4 157.2 389.2 C155.1 388 153.2 386.8 151.3 385.4 C150.6 384.9 149.9 384.4 149.2 383.9 C148.4 383.3 147.7 382.8 146.9 382.2 C141.3 378.2 135.8 374.5 129.6 371.4 C126.7 369.8 123.9 368.1 121.1 366.3 C119 365 116.9 363.8 114.7 362.5 C114 362.1 113.3 361.7 112.6 361.3 C111.2 360.5 109.7 359.7 108.3 358.8 C104 356.4 100.3 353.7 96.6 350.4 C91.7 346.2 85.9 343.1 80.4 339.7 C79.9 339.4 79.4 339.1 78.8 338.7 C77.8 338.1 76.7 337.4 75.7 336.8 C69.2 332.8 63.2 328.7 57.3 323.9 C53.9 321.1 50.4 318.5 46.9 315.9 C45.6 314.9 44.2 313.9 42.9 312.9 C42.3 312.5 41.6 312 41 311.5 C17.3 293.8 17.3 293.8 11.8 287.3 C8 283 4 278.9 -0.1 274.8 C-0.8 274.1 -1.5 273.4 -2.2 272.7 C-7.6 267.4 -7.6 267.4 -9.5 265.6 C-18.8 256.5 -26.5 243.8 -32 232.1 C-32.8 230.4 -33.6 228.8 -34.5 227.2 C-37.5 221.4 -39.7 215.9 -41.3 209.4 C-42 207.1 -42.8 205.5 -44.1 203.5 C-46.8 199 -47.3 194.1 -48 189 C-48.2 187.8 -48.4 186.5 -48.5 185.3 C-48.8 183.5 -49.1 181.6 -49.3 179.8 C-49.6 177.5 -49.9 175.3 -50.5 173.1 C-55.6 152.2 -53.1 129.9 -50 109 C-49.9 108 -49.7 106.9 -49.5 105.8 C-49.1 102.8 -48.6 99.7 -48.1 96.6 C-48 95.7 -47.9 94.8 -47.7 93.8 C-46.7 88 -44.9 83.4 -42.1 78.2 C-40.8 75.6 -40.1 73 -39.6 70.1 C-38.3 64.6 -36.1 60 -33.5 55 C-31.1 50.2 -29.6 45.1 -28 40 C-25.3 31.8 -22.2 23.8 -18.4 16 C-17.2 13.3 -16 10.7 -14.9 7.9 C-12 1.2 -7.3 -1.8 0 0 Z M453.2 75.8 C452.6 75.9 451.9 76 451.2 76 C447.1 76.6 444.4 77.7 441 80 C440.7 80.2 440.7 80.2 439 81.3 C437.7 82.1 436.4 82.9 435.2 83.7 C433 85 433 85 430.1 86.4 C426.8 88 423.9 90.1 421 92.4 C420.5 92.8 419.9 93.2 419.4 93.6 C417.9 94.7 416.5 95.9 415 97 C414.4 97.5 413.8 97.9 413.1 98.4 C402.4 106.9 394.6 119.5 386.7 130.5 C384.3 133.8 382 137.1 379.3 140.2 C377 142.9 375.1 145.9 373.2 148.9 C372.9 149.5 372.6 150 372.2 150.6 C371.2 152.4 370.1 154.2 369 156 C368.2 157.3 367.5 158.5 366.7 159.8 C366.4 160.4 366 161.1 365.6 161.7 C365.2 162.3 364.8 163 364.4 163.6 C364.1 164.3 363.7 164.9 363.3 165.5 C359.3 172.2 355.2 178.7 350.9 185.2 C346.4 191.9 342.3 198.7 338.2 205.6 C337.7 206.4 337.2 207.3 336.7 208.1 C332.2 215.7 332.2 215.7 333 221 C337 229.2 345.7 235.2 353 240.5 C360.9 246.4 368.2 252.8 375.5 259.6 C377 261 378.5 262.4 380.1 263.8 C391.1 273.6 400.1 284.1 408.5 296.2 C409 296.8 409.4 297.5 409.9 298.1 C410.2 298.7 410.6 299.2 411 299.8 C412 301 412 301 414 302 C419.4 302.5 419.4 302.5 421.5 300.8 C423.4 298.5 424.3 296.1 425.4 293.3 C427.2 288.8 429.1 284.9 431.8 280.9 C433 278.9 434.1 276.9 435.1 274.9 C436.3 272.4 437.5 270.1 439.1 267.9 C440.7 265.5 441.9 263.2 443.1 260.7 C444.2 258.6 445.5 256.7 446.8 254.8 C451.3 248.1 455 241 458.6 233.8 C461.5 227.8 465.1 222.3 468.9 216.7 C470.3 214.6 471.6 212.4 472.9 210.2 C474.7 207.1 476.6 204 478.7 201 C482.8 194.9 486.5 188.7 490.3 182.4 C491.2 180.9 492.1 179.5 493 178 C493.4 177.3 493.9 176.6 494.3 175.8 C496.6 172.2 498.8 168.8 501.6 165.5 C505.2 161.1 508.6 156.6 512 152.1 C512.5 151.4 512.9 150.8 513.4 150.1 C513.7 149.8 513.7 149.8 514.9 148.2 C515.4 147.6 515.9 146.9 516.4 146.2 C517.5 144.6 518.6 143.1 519.7 141.5 C525.7 132.8 533 125.8 540.7 118.6 C542.4 117 544 115.4 545.7 113.8 C546.2 113.3 546.7 112.8 547.3 112.3 C550.9 108.7 551.9 106.2 552 101 C548.8 96.8 544.7 94.4 540.1 91.9 C539.8 91.7 539.8 91.7 538.3 90.9 C532.7 87.7 526.9 85.3 520.9 83 C518.2 81.9 515.7 80.8 513.1 79.4 C496.1 71.9 471.3 73.8 453.2 75.8 Z M209 434 C206 438.3 203.5 442.8 201.1 447.4 C199.2 450.8 197.3 454 195.1 457.2 C191.9 461.9 189.5 466.8 187 471.9 C184.4 477.2 181.6 482.3 178.5 487.4 C177.4 489.2 176.4 491.2 175.5 493.1 C174.3 495.4 173.1 497.3 171.6 499.4 C169.3 502.4 167.7 505.5 166.1 508.9 C165 511 165 511 163.2 513.6 C159.7 518.7 157.4 524.6 154.8 530.2 C152.6 535 150.3 539.3 147.1 543.5 C145.6 545.6 144.5 547.8 143.4 550.1 C141.6 553.9 139.6 556.8 137 560 C135.8 562.3 134.7 564.6 133.5 566.9 C131.6 570.7 129.6 574.5 127.6 578.3 C127.2 579 126.9 579.8 126.5 580.5 C125.3 582.7 124.2 584.8 123 587 C122.7 587.7 122.3 588.3 121.9 589 C121 590.8 120 592.6 119.1 594.4 C118.8 594.9 118.5 595.4 118.2 596 C117.2 597.9 116.1 599.8 114.8 601.6 C113.2 604.3 113.8 607 114 610 C116.9 612.9 120.1 612.7 124 613 C124.4 613 124.4 613 126.5 613.3 C136.7 614.2 146.8 614.2 157 614.2 C160.1 614.2 163.2 614.2 166.3 614.2 C182.3 614.3 198.5 614 214 609.1 C214.9 608.9 215.8 608.6 216.7 608.3 C219.1 607.6 221.6 606.8 224 606 C224.6 605.8 225.2 605.6 225.8 605.4 C244.2 599.7 261.6 585.4 271.9 569.1 C282 548.2 285.2 523.1 277.6 500.8 C277.4 500.2 277.2 499.6 277 499 C276.8 498.4 276.6 497.7 276.3 497.1 C267.7 472.2 247.3 449.9 225.7 435.2 C225.3 434.9 225.3 434.9 223.2 433.5 C222.5 433 221.7 432.5 221 432 C220.5 431.6 219.9 431.2 219.4 430.8 C214.9 428.1 211.9 430.4 209 434 Z "/></svg>' +
      esc(CFG.siteName || '博客') + '</a>' +
      '<nav class="nav">' + nav + '</nav>' +
      '<div class="header-actions">' +
      '<button id="theme-toggle" class="icon-btn" type="button" aria-label="切换主题" title="切换主题">' +
      iconMoon() +
      '</button>' +
      '<span id="auth-slot"></span>' +
      '</div>' +
      '</div>'
    );
  }

  function renderAuthSlot(session) {
    var slot = document.getElementById('auth-slot');
    if (!slot) return;
    if (global.Blog && global.Blog.staticMode) {
      slot.innerHTML =
        '<a class="btn btn-sm btn-ghost" href="https://ai-design-blog.app.workbuddy.host/" target="_blank" rel="noopener">原站</a>';
      return;
    }
    if (session && session.user) {
      var label = session.user.email ? String(session.user.email).split('@')[0] : '我';
      slot.innerHTML =
        '<a class="btn btn-sm" href="studio.html">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>' +
        '写作台</a>' +
        '<button class="btn btn-sm btn-ghost" type="button" id="btn-signout">' +
        esc(label) +
        ' · 退出</button>';
      var out = document.getElementById('btn-signout');
      if (out) out.addEventListener('click', signOut);
    } else {
      slot.innerHTML = '<a class="btn btn-sm btn-primary" href="login.html">登录</a>';
    }
  }

  function mountHeader(active) {
    var host = document.getElementById('site-header');
    if (!host) return;
    host.className = 'site-header';
    host.innerHTML = headerHtml(active);
    var toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.innerHTML = theme.current() === 'dark' ? iconSun() : iconMoon();
      toggle.addEventListener('click', theme.toggle);
    }
    onSession(renderAuthSlot);
    if (global.Blog && global.Blog.ready) {
      global.Blog.auth.onAuthStateChange(function (event, session) {
        sessionPromise = Promise.resolve(session || null);
        renderAuthSlot(session);
      });
    }
  }

  function mountFooter() {
    var host = document.getElementById('site-footer');
    if (!host) return;
    var year = new Date().getFullYear();
    host.className = 'site-footer';
    host.innerHTML =
      '<div class="wrap inner">' +
      '<span>© ' + year + ' ' + esc(CFG.siteName || '') + '　·　' + esc(CFG.siteTagline || '') + '</span>' +
      '<span><a href="index.html">文章</a>　·　<a href="tags.html">标签</a>　·　<a href="about.html">关于</a></span>' +
      '</div>';
  }

  /** 云端不可用时的顶部提示 */
  function mountEnvWarning() {
    if (global.Blog && global.Blog.ready) return;
    var banner = document.createElement('div');
    banner.className = 'wrap';
    banner.innerHTML =
      '<div class="alert alert-error" style="margin-top:16px">云端能力未加载，页面数据无法读取。请确认网络可访问 CDN 后刷新。</div>';
    var main = document.getElementById('main') || document.body;
    main.insertBefore(banner, main.firstChild);
  }

  /* ---------------- 骨架屏 ---------------- */

  function skeletonList(count) {
    var html = '<ul class="post-list">';
    for (var i = 0; i < (count || 4); i++) {
      html +=
        '<li class="post-item"><div style="display:grid;grid-template-columns:108px 1fr;gap:32px;padding:30px 0">' +
        '<div><div class="skeleton" style="height:12px;width:72px"></div></div>' +
        '<div><div class="skeleton" style="height:20px;width:62%"></div>' +
        '<div class="skeleton" style="height:14px;width:92%"></div>' +
        '<div class="skeleton" style="height:14px;width:74%"></div></div></div></li>';
    }
    return html + '</ul>';
  }

  function stateBlock(title, desc) {
    return (
      '<div class="state"><strong>' + esc(title) + '</strong>' + (desc ? esc(desc) : '') + '</div>'
    );
  }

  /* ---------------- 失败诊断 ---------------- */

  function originInfo() {
    var expected = String(CFG.endpoint || '').replace(/\/+$/, '');
    var loc = global.location || {};
    var proto = loc.protocol || '';
    var here = loc.origin || '';
    var opaque = !here || here === 'null' || proto === 'file:' || proto === 'blob:' || proto === 'data:' || proto === 'about:';
    return {
      here: opaque ? proto + '//（不透明来源）' : here,
      expected: expected,
      mismatch: !opaque && !!expected && here !== expected,
      opaque: opaque,
    };
  }

  /**
   * 加载失败面板。
   * 网络层失败（request 被 CORS/安全策略挡掉）在浏览器里只会表现为 "Failed to fetch"，
   * 用户无法据此判断是「站点坏了」还是「打开位置不对」。这里把它翻译成可执行的判断。
   */
  function failBlock(title, err) {
    var net = global.Blog && global.Blog.isNetworkError ? global.Blog.isNetworkError(err) : false;
    if (!net) {
      var msg = global.Blog && global.Blog.messageOf ? global.Blog.messageOf(err) : String(err);
      return stateBlock(title || '加载失败', msg);
    }

    var o = originInfo();
    var body;

    if (o.mismatch || o.opaque) {
      body =
        '<p>浏览器没能把请求送到云端接口。云端只接受来自本应用已登记域名的请求，其它来源会被服务端直接拒绝，而浏览器对这类拒绝统一抛出 <code>Failed to fetch</code>，不带任何状态码，所以看不到具体原因。</p>' +
        '<dl class="diag">' +
        '<dt>当前页面来源</dt><dd><code>' + esc(o.here) + '</code></dd>' +
        '<dt>站点正式域名</dt><dd><code>' + esc(o.expected) + '</code></dd>' +
        '</dl>' +
        '<p>在应用的预览面板、或把页面文件直接拖进浏览器打开时，就会出现这个现象 —— <strong>它不代表站点里没有数据</strong>。请通过下面的正式地址访问。</p>';
    } else {
      body =
        '<p>页面来源与站点正式域名一致，因此不是来源限制问题。请求在传输层就失败了，常见原因是网络不通、代理或 VPN 拦截、浏览器扩展（广告拦截类）阻断，或临时的 DNS 故障。</p>' +
        '<dl class="diag">' +
        '<dt>当前页面来源</dt><dd><code>' + esc(o.here) + '</code></dd>' +
        '<dt>站点正式域名</dt><dd><code>' + esc(o.expected) + '</code></dd>' +
        '</dl>' +
        '<p>可以先点「重新加载」重试；若持续失败，请检查网络与扩展后再说。</p>';
    }

    return (
      '<div class="state state-left">' +
      '<strong>' + esc(title || '无法连接云端服务') + '</strong>' +
      body +
      '<div class="diag-actions">' +
      (o.expected ? '<a class="btn btn-primary" href="' + esc(o.expected) + '/">打开正式站点</a>' : '') +
      '<button class="btn" type="button" id="btn-retry">重新加载</button>' +
      '</div>' +
      '</div>'
    );
  }

  /** 让 failBlock 里的「重新加载」按钮生效 */
  function bindRetry(scope) {
    var root = scope || document;
    var btn = root.querySelector ? root.querySelector('#btn-retry') : null;
    if (btn) {
      btn.addEventListener('click', function () {
        global.location.reload();
      });
    }
  }

  global.UI = {
    esc: esc,
    theme: theme,
    toast: toast,
    formatDate: formatDate,
    formatDateLong: formatDateLong,
    formatBytes: formatBytes,
    readingMinutes: readingMinutes,
    qs: qs,
    loadSession: loadSession,
    onSession: onSession,
    requireLogin: requireLogin,
    signOut: signOut,
    mountHeader: mountHeader,
    mountFooter: mountFooter,
    mountEnvWarning: mountEnvWarning,
    skeletonList: skeletonList,
    stateBlock: stateBlock,
    originInfo: originInfo,
    failBlock: failBlock,
    bindRetry: bindRetry,
    iconMoon: iconMoon,
    iconSun: iconSun,
  };
})(window);
