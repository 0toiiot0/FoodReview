// Supabase 이메일/비밀번호 로그인·회원가입. config.js가 정의하는 SUPABASE_URL/SUPABASE_ANON_KEY와
// CDN으로 불러온 supabase-js 전역(window.supabase)에 의존한다.
// 로그인 여부 확인이 필요한 다른 기능(예: 맛집 담기)은 window.Auth.getUser() / window.Auth.onChange()를 가져다 쓰면 된다.

(function () {
  "use strict";

  const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const authSlot = document.getElementById("authSlot");
  const authModal = document.getElementById("authModal");
  const authModalClose = document.getElementById("authModalClose");
  const authForm = document.getElementById("authForm");
  const authName = document.getElementById("authName");
  const authEmail = document.getElementById("authEmail");
  const authPassword = document.getElementById("authPassword");
  const authMessage = document.getElementById("authModalMessage");
  const authSubmitLogin = document.getElementById("authSubmitLogin");
  const authSubmitSignup = document.getElementById("authSubmitSignup");

  function openModal() {
    if (!authModal) return;
    clearMessage();
    authModal.hidden = false;
    authModal.setAttribute("aria-hidden", "false");
    if (authEmail) authEmail.focus();
  }

  function closeModal() {
    if (!authModal) return;
    authModal.hidden = true;
    authModal.setAttribute("aria-hidden", "true");
    if (authForm) authForm.reset();
    clearMessage();
  }

  function clearMessage() {
    if (!authMessage) return;
    authMessage.hidden = true;
    authMessage.textContent = "";
    authMessage.classList.remove("auth-modal__message--error");
  }

  function setMessage(text, isError) {
    if (!authMessage) return;
    authMessage.textContent = text;
    authMessage.hidden = false;
    authMessage.classList.toggle("auth-modal__message--error", !!isError);
  }

  function setLoading(isLoading) {
    if (authSubmitLogin) authSubmitLogin.disabled = isLoading;
    if (authSubmitSignup) authSubmitSignup.disabled = isLoading;
  }

  function mapSignupError(error) {
    const msg = (error && error.message || "").toLowerCase();
    if (msg.indexOf("rate limit") !== -1) return "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
    if (msg.indexOf("already registered") !== -1) return "이미 가입된 이메일입니다.";
    if (msg.indexOf("password") !== -1) return "비밀번호는 6자 이상이어야 합니다.";
    if (msg.indexOf("unable to validate email") !== -1 || msg.indexOf("invalid format") !== -1) return "올바른 이메일 형식이 아닙니다.";
    return "회원가입에 실패했습니다. 잠시 후 다시 시도해주세요.";
  }

  function mapLoginError(error) {
    const msg = (error && error.message || "").toLowerCase();
    if (msg.indexOf("rate limit") !== -1) return "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
    if (msg.indexOf("invalid login credentials") !== -1) return "이메일 또는 비밀번호가 올바르지 않습니다.";
    if (msg.indexOf("email not confirmed") !== -1) return "이메일 인증이 필요합니다.";
    return "로그인에 실패했습니다. 잠시 후 다시 시도해주세요.";
  }

  function handleLogin() {
    const email = authEmail ? authEmail.value.trim() : "";
    const password = authPassword ? authPassword.value : "";
    if (!email || !password) {
      setMessage("이메일과 비밀번호를 입력해주세요.", true);
      return;
    }
    clearMessage();
    setLoading(true);
    supabaseClient.auth
      .signInWithPassword({ email: email, password: password })
      .then(function (result) {
        if (result.error) {
          setMessage(mapLoginError(result.error), true);
          return;
        }
        closeModal();
      })
      .finally(function () {
        setLoading(false);
      });
  }

  function handleSignup() {
    const name = authName ? authName.value.trim() : "";
    const email = authEmail ? authEmail.value.trim() : "";
    const password = authPassword ? authPassword.value : "";
    if (!name) {
      setMessage("이름을 입력해주세요.", true);
      return;
    }
    if (!email || !password) {
      setMessage("이메일과 비밀번호를 입력해주세요.", true);
      return;
    }
    clearMessage();
    setLoading(true);
    supabaseClient.auth
      .signUp({ email: email, password: password, options: { data: { name: name } } })
      .then(function (result) {
        if (result.error) {
          setMessage(mapSignupError(result.error), true);
          return;
        }
        if (!result.data || !result.data.session) {
          setMessage("이미 가입된 이메일이거나 이메일 인증이 필요합니다.", true);
          return;
        }
        closeModal();
      })
      .finally(function () {
        setLoading(false);
      });
  }

  function getDisplayName(user) {
    const name = user && user.user_metadata && user.user_metadata.name;
    if (name) return name;
    const email = (user && user.email) || "";
    return email.split("@")[0];
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function renderAuthSlot(user) {
    if (!authSlot) return;
    if (user) {
      authSlot.innerHTML =
        '<span class="auth-user">' + escapeHtml(getDisplayName(user)) + '님</span>' +
        '<button class="btn-pill btn-pill-outline auth-logout-btn" id="authLogoutBtn" type="button">로그아웃</button>';
    } else {
      authSlot.innerHTML =
        '<button class="btn-pill btn-pill-outline auth-login-btn" id="authLoginBtn" type="button">로그인</button>';
    }
  }

  if (authSlot) {
    authSlot.addEventListener("click", function (event) {
      if (event.target.closest("#authLoginBtn")) {
        openModal();
      } else if (event.target.closest("#authLogoutBtn")) {
        supabaseClient.auth.signOut();
      }
    });
  }

  if (authModalClose) {
    authModalClose.addEventListener("click", closeModal);
  }

  if (authModal) {
    authModal.addEventListener("click", function (event) {
      if (event.target === authModal) closeModal();
    });
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && authModal && !authModal.hidden) closeModal();
  });

  if (authForm) {
    authForm.addEventListener("submit", function (event) {
      event.preventDefault();
      handleLogin();
    });
  }

  if (authSubmitSignup) {
    authSubmitSignup.addEventListener("click", handleSignup);
  }

  supabaseClient.auth.getSession().then(function (result) {
    renderAuthSlot(result.data.session ? result.data.session.user : null);
  });

  supabaseClient.auth.onAuthStateChange(function (_event, session) {
    renderAuthSlot(session ? session.user : null);
  });

  window.Auth = {
    getClient: function () {
      return supabaseClient;
    },
    getUser: function () {
      return supabaseClient.auth.getSession().then(function (result) {
        return result.data.session ? result.data.session.user : null;
      });
    },
    onChange: function (callback) {
      return supabaseClient.auth.onAuthStateChange(function (_event, session) {
        callback(session ? session.user : null);
      });
    },
    signOut: function () {
      return supabaseClient.auth.signOut();
    },
  };
})();
