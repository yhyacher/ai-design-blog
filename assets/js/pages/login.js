/* 登录 / 注册 / 找回密码
   覆盖四种流程：密码登录、邮箱验证码登录、验证码+密码注册、验证码重置密码。 */
(function () {
  'use strict';

  var modes = ['password', 'otp', 'signup', 'forgot'];
  var mode = 'password';
  var nextUrl = UI.qs('next') || 'studio.html';
  var busy = false;

  var host, alertHost;

  function esc(s) {
    return UI.esc(s);
  }

  function alertBox(kind, text) {
    alertHost.innerHTML = '<div class="alert alert-' + kind + '">' + esc(text) + '</div>';
  }
  function clearAlert() {
    alertHost.innerHTML = '';
  }

  function setBusy(btn, label) {
    busy = true;
    btn.disabled = true;
    btn.textContent = label;
  }
  function release(btn, label) {
    busy = false;
    btn.disabled = false;
    btn.textContent = label;
  }

  function reportError(err) {
    var text = Blog.messageOf(err);
    alertBox('error', text);
    return text;
  }

  function goAfterLogin() {
    UI.toast('登录成功');
    setTimeout(function () {
      location.href = nextUrl || 'studio.html';
    }, 350);
  }

  /* ---------- 表单模板 ---------- */

  function fieldEmail(id, value) {
    return (
      '<div class="field"><label for="' + id + '">邮箱</label>' +
      '<input type="email" id="' + id + '" autocomplete="email" placeholder="you@example.com" value="' +
      esc(value || '') + '"></div>'
    );
  }

  function fieldPassword(id, label, autocomplete, placeholder) {
    return (
      '<div class="field"><label for="' + id + '">' + esc(label) + '</label>' +
      '<input type="password" id="' + id + '" autocomplete="' + (autocomplete || 'current-password') +
      '" placeholder="' + esc(placeholder || '至少 8 位') + '"></div>'
    );
  }

  function fieldCode(id, extra) {
    return (
      '<div class="field"><label for="' + id + '">邮箱验证码</label>' +
      '<div style="display:flex;gap:8px">' +
      '<input type="text" id="' + id + '" inputmode="numeric" autocomplete="one-time-code" placeholder="6 位数字" style="flex:1">' +
      '<button class="btn" type="button" id="' + id + '-send">发送验证码</button>' +
      '</div>' + (extra || '') + '</div>'
    );
  }

  function bindSendCode(sendBtnId, emailId, onSent) {
    var btn = document.getElementById(sendBtnId);
    if (!btn) return;
    btn.addEventListener('click', async function () {
      var email = (document.getElementById(emailId).value || '').trim();
      if (!email) {
        alertBox('error', '请先填写邮箱。');
        return;
      }
      clearAlert();
      setBusy(btn, '发送中…');
      try {
        var res = await Blog.auth.sendOtp(email);
        if (res && res.error) throw res.error;
        var data = res ? res.data : null;
        if (onSent) onSent(data);
        alertBox('ok', '验证码已发送到 ' + email + '，请查收邮件。');
        startCountdown(btn);
      } catch (err) {
        reportError(err);
        release(btn, '发送验证码');
      }
    });
  }

  function startCountdown(btn) {
    var left = 60;
    btn.textContent = left + ' 秒后重发';
    var timer = setInterval(function () {
      left -= 1;
      if (left <= 0) {
        clearInterval(timer);
        release(btn, '发送验证码');
        return;
      }
      btn.textContent = left + ' 秒后重发';
    }, 1000);
  }

  /* ---------- 各模式表单 ---------- */

  function renderPassword() {
    host.innerHTML =
      fieldEmail('f-email') +
      fieldPassword('f-pwd', '密码') +
      '<button class="btn btn-primary" id="btn-go" style="width:100%;height:38px">登录</button>' +
      '<div style="margin-top:14px;font-size:13px;color:var(--fg-subtle)">没有账号？' +
      '<a href="#" data-mode-jump="signup" style="color:var(--accent)">注册一个</a>　·　' +
      '<a href="#" data-mode-jump="forgot" style="color:var(--accent)">忘记密码</a></div>';

    document.getElementById('btn-go').addEventListener('click', async function () {
      var btn = this;
      var email = (document.getElementById('f-email').value || '').trim();
      var password = document.getElementById('f-pwd').value;
      if (!email || !password) {
        alertBox('error', '请填写邮箱与密码。');
        return;
      }
      clearAlert();
      setBusy(btn, '登录中…');
      try {
        var res = await Blog.auth.signInWithPassword(email, password);
        if (res && res.error) throw res.error;
        goAfterLogin();
      } catch (err) {
        reportError(err);
        release(btn, '登录');
      }
    });
  }

  function renderOtp() {
    host.innerHTML =
      fieldEmail('f-email') +
      fieldCode('f-code') +
      '<button class="btn btn-primary" id="btn-go" style="width:100%;height:38px">登录</button>' +
      '<div class="hint" style="margin-top:14px">未注册的邮箱在验证通过后会自动创建账号。</div>';

    bindSendCode('f-code-send', 'f-email');

    document.getElementById('btn-go').addEventListener('click', async function () {
      var btn = this;
      var email = (document.getElementById('f-email').value || '').trim();
      var token = (document.getElementById('f-code').value || '').trim();
      if (!email || !token) {
        alertBox('error', '请填写邮箱与验证码。');
        return;
      }
      clearAlert();
      setBusy(btn, '验证中…');
      try {
        var started = await Blog.auth.signInWithOtp(email);
        if (started && started.error) throw started.error;
        var completed = await started.data.verify({ token: token });
        if (completed && completed.error) throw completed.error;
        goAfterLogin();
      } catch (err) {
        reportError(err);
        release(btn, '登录');
      }
    });
  }

  function renderSignup() {
    host.innerHTML =
      fieldEmail('f-email') +
      fieldCode('f-code', '<div class="hint">验证码用于确认邮箱归属，注册后可用密码直接登录。</div>') +
      fieldPassword('f-pwd', '设置密码', 'new-password') +
      fieldPassword('f-pwd2', '确认密码', 'new-password') +
      '<button class="btn btn-primary" id="btn-go" style="width:100%;height:38px">创建账号</button>' +
      '<div style="margin-top:14px;font-size:13px;color:var(--fg-subtle)">已有账号？' +
      '<a href="#" data-mode-jump="password" style="color:var(--accent)">直接登录</a></div>';

    var ctx = { verificationId: null, isExistingUser: false, email: '' };

    bindSendCode('f-code-send', 'f-email', function (data) {
      ctx.verificationId = data ? data.verificationId : null;
      ctx.isExistingUser = !!(data && data.isExistingUser);
      ctx.email = (document.getElementById('f-email').value || '').trim();
    });

    document.getElementById('btn-go').addEventListener('click', async function () {
      var btn = this;
      var email = (document.getElementById('f-email').value || '').trim();
      var token = (document.getElementById('f-code').value || '').trim();
      var pwd = document.getElementById('f-pwd').value;
      var pwd2 = document.getElementById('f-pwd2').value;

      if (!email) return alertBox('error', '请填写邮箱。');
      if (!ctx.verificationId || ctx.email !== email) {
        return alertBox('error', '请先点击「发送验证码」，验证码发送后再提交。');
      }
      if (!token) return alertBox('error', '请填写邮箱验证码。');
      if (String(pwd).length < 8) return alertBox('error', '密码至少 8 位。');
      if (pwd !== pwd2) return alertBox('error', '两次输入的密码不一致。');

      clearAlert();
      setBusy(btn, '创建中…');
      try {
        if (ctx.isExistingUser) {
          alertBox('info', '该邮箱已存在账号，请改用验证码或密码登录。');
          release(btn, '创建账号');
          return;
        }
        var res = await Blog.auth.verifyOtp({
          verificationId: ctx.verificationId,
          token: token,
          email: email,
          isExistingUser: ctx.isExistingUser,
          password: pwd,
        });
        if (res && res.error) throw res.error;
        goAfterLogin();
      } catch (err) {
        reportError(err);
        release(btn, '创建账号');
      }
    });
  }

  function renderForgot() {
    host.innerHTML =
      fieldEmail('f-email') +
      fieldCode('f-code', '<div class="hint">填写收到的验证码，并设置新密码。</div>') +
      fieldPassword('f-pwd', '新密码', 'new-password') +
      '<button class="btn btn-primary" id="btn-go" style="width:100%;height:38px">重置密码</button>';

    var ctx = { started: null, email: '' };

    var sendBtn = document.getElementById('f-code-send');
    sendBtn.addEventListener('click', async function () {
      var email = (document.getElementById('f-email').value || '').trim();
      if (!email) {
        alertBox('error', '请先填写邮箱。');
        return;
      }
      clearAlert();
      setBusy(sendBtn, '发送中…');
      try {
        var started = await Blog.auth.resetPasswordForEmail(email);
        if (started && started.error) throw started.error;
        ctx.started = started;
        ctx.email = email;
        alertBox('ok', '验证码已发送到 ' + email + '，请查收邮件。');
        startCountdown(sendBtn);
      } catch (err) {
        reportError(err);
        release(sendBtn, '发送验证码');
      }
    });

    document.getElementById('btn-go').addEventListener('click', async function () {
      var btn = this;
      var token = (document.getElementById('f-code').value || '').trim();
      var pwd = document.getElementById('f-pwd').value;
      if (!ctx.started) return alertBox('error', '请先点击「发送验证码」。');
      if (!token) return alertBox('error', '请填写验证码。');
      if (String(pwd).length < 8) return alertBox('error', '新密码至少 8 位。');

      clearAlert();
      setBusy(btn, '提交中…');
      try {
        var res = await ctx.started.data.updateUser({ nonce: token, password: pwd });
        if (res && res.error) throw res.error;
        goAfterLogin();
      } catch (err) {
        reportError(err);
        release(btn, '重置密码');
      }
    });
  }

  var renderers = {
    password: renderPassword,
    otp: renderOtp,
    signup: renderSignup,
    forgot: renderForgot,
  };

  function setMode(next) {
    if (modes.indexOf(next) === -1) next = 'password';
    mode = next;
    clearAlert();
    Array.prototype.forEach.call(document.querySelectorAll('#tabs button'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-mode') === mode);
    });
    renderers[mode]();
    // 事件委托：表单内的模式跳转链接
    Array.prototype.forEach.call(host.querySelectorAll('[data-mode-jump]'), function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        setMode(a.getAttribute('data-mode-jump'));
      });
    });
  }

  async function boot() {
    host = document.getElementById('form-host');
    alertHost = document.getElementById('auth-alert');
    UI.mountHeader(null);
    UI.mountFooter();
    UI.mountEnvWarning();

    Array.prototype.forEach.call(document.querySelectorAll('#tabs button'), function (b) {
      b.addEventListener('click', function () {
        if (busy) return;
        setMode(b.getAttribute('data-mode'));
      });
    });

    if (!Blog.ready) {
      host.innerHTML = UI.stateBlock('云端未连接', '登录功能暂不可用。');
      return;
    }

    var session = await UI.loadSession();
    if (session && session.user) {
      alertBox('info', '你已经处于登录状态，可直接进入写作台。');
      host.innerHTML =
        '<a class="btn btn-primary" href="studio.html" style="width:100%;height:38px">进入写作台</a>' +
        '<button class="btn btn-ghost" id="btn-out" style="width:100%;margin-top:10px;height:38px">退出当前账号</button>';
      document.getElementById('btn-out').addEventListener('click', function () {
        UI.signOut();
      });
      return;
    }

    setMode('password');
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
