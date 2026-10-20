(function (global) {
  const KEYS = {
    loggedIn: "miniDriveLoggedIn",
    user: "miniDriveUser",
    name: "miniDriveUserName",
    picture: "miniDriveUserPicture",
    provider: "miniDriveAuthProvider",
    googleSub: "miniDriveGoogleSub",
    token: "miniDriveAuthToken",
    users: "miniDriveGoogleUsers",
  };

  function getClientId() {
    const id = String(global.MINIDRIVE_GOOGLE_CLIENT_ID || "").trim();
    if (!id || id.indexOf("YOUR_CLIENT_ID") !== -1) return "";
    return id;
  }

  function getApiBase() {
    const configured = String(global.MINIDRIVE_API_BASE || "")
      .trim()
      .replace(/\/$/, "");
    if (configured) return configured;
    try {
      const proto = global.location && global.location.protocol;
      const port = String((global.location && global.location.port) || "");
      if (proto === "file:" || !global.location.hostname) {
        return "http://localhost:3000";
      }
      if (port === "3000" || port === "") return "";
      return "http://localhost:3000";
    } catch (_) {
      return "http://localhost:3000";
    }
  }

  function apiUrl(pathname) {
    return getApiBase() + pathname;
  }

  async function apiRequest(pathname, options) {
    const opts = options || {};
    const headers = Object.assign(
      { "Content-Type": "application/json" },
      opts.headers || {},
    );
    const token = getToken();
    if (token && !headers.Authorization) {
      headers.Authorization = "Bearer " + token;
    }
    let res;
    try {
      res = await fetch(apiUrl(pathname), Object.assign({}, opts, { headers }));
    } catch (_) {
      throw new Error(
        "Cannot reach the Mini Drive server. Start it with npm start, then open http://localhost:3000/login.html",
      );
    }
    let data = {};
    try {
      data = await res.json();
    } catch (_) {
      data = {};
    }
    if (!res.ok) {
      throw new Error(data.error || "Request failed.");
    }
    return data;
  }

  function getToken() {
    try {
      return (localStorage.getItem(KEYS.token) || "").trim();
    } catch (_) {
      return "";
    }
  }

  function getSession() {
    try {
      if (localStorage.getItem(KEYS.loggedIn) !== "true") return null;
      const email = (localStorage.getItem(KEYS.user) || "").trim();
      if (!email) return null;
      return {
        email,
        id: (localStorage.getItem(KEYS.userId) || "").trim(),
        name: (localStorage.getItem(KEYS.name) || "").trim(),
        picture: (localStorage.getItem(KEYS.picture) || "").trim(),
        provider: localStorage.getItem(KEYS.provider) || "",
        token: getToken(),
      };
    } catch (_) {
      return null;
    }
  }

  function isLoggedIn() {
    return !!getSession();
  }

  function registeredEmails() {
    try {
      const list = JSON.parse(localStorage.getItem(KEYS.users) || "[]");
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  function rememberGoogleUser(email) {
    if (!email) return;
    const list = registeredEmails();
    if (!list.includes(email)) {
      list.push(email);
      localStorage.setItem(KEYS.users, JSON.stringify(list));
    }
  }

  function hasGoogleAccount(email) {
    return registeredEmails().includes(email);
  }

  function saveSession(user) {
    // Always replace identity as one atomic session (prevents token/email mismatch)
    localStorage.setItem(KEYS.loggedIn, "true");
    localStorage.setItem(KEYS.user, String(user.email || "").trim().toLowerCase());
    if (user.id) localStorage.setItem(KEYS.userId, String(user.id));
    else localStorage.removeItem(KEYS.userId);
    localStorage.setItem(KEYS.name, user.name || "");
    localStorage.setItem(KEYS.provider, user.provider || "email");
    if (user.picture) localStorage.setItem(KEYS.picture, user.picture);
    else localStorage.removeItem(KEYS.picture);
    if (user.sub) localStorage.setItem(KEYS.googleSub, user.sub);
    else localStorage.removeItem(KEYS.googleSub);
    if (user.token) localStorage.setItem(KEYS.token, user.token);
    else localStorage.removeItem(KEYS.token);
    clearDriveCachesExceptCurrent(user.email);
    // Wipe this account's local file list so a previous session cannot show wrong files
    try {
      const em = String(user.email || "").trim().toLowerCase();
      if (em) {
        const safe = em.replace(/[^a-z0-9@._-]/g, "_");
        localStorage.removeItem("miniDriveMeta_v2:" + safe);
        localStorage.removeItem("miniDriveMeta_v2:" + em);
        localStorage.removeItem("miniDriveNotifications");
      }
    } catch (_) {}
  }

  /** Drop any drive metadata that could leak between accounts on this browser */
  function clearDriveCachesExceptCurrent(email) {
    try {
      // Remove legacy GLOBAL keys that leaked files across accounts
      [
        "miniDriveMeta",
        "miniDriveFiles",
        "miniDriveFolders",
        "miniDriveAvatar",
        "miniDriveNotifications",
        "miniDriveMeta_v1",
      ].forEach(function (k) {
        localStorage.removeItem(k);
      });
    } catch (_) {}
  }

  function clearSession() {
    [
      KEYS.loggedIn,
      KEYS.user,
      KEYS.userId,
      KEYS.name,
      KEYS.picture,
      KEYS.provider,
      KEYS.googleSub,
      KEYS.token,
    ].forEach(function (key) {
      localStorage.removeItem(key);
    });
    try {
      if (global.google && google.accounts && google.accounts.id) {
        google.accounts.id.disableAutoSelect();
      }
    } catch (_) {}
  }

  function requireLogin() {
    if (!isLoggedIn()) {
      try {
        sessionStorage.setItem("mdPortalEnter", "1");
      } catch (_) {}
      window.location.replace("login.html?mode=signin");
      return;
    }
    const token = getToken();
    if (!token) return;
    apiRequest("/api/auth/me")
      .then(function (data) {
        if (data && data.user) {
          saveSession({
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            picture: data.user.picture,
            provider: data.user.provider,
            token: token,
          });
          try {
            const em = (data.user.email || "").trim().toLowerCase();
            if (data.user.picture && em) {
              localStorage.setItem("miniDriveAvatar:" + em, data.user.picture);
            } else if (em) {
              localStorage.removeItem("miniDriveAvatar:" + em);
            }
            // Clear legacy global key so it cannot leak across accounts
            localStorage.removeItem("miniDriveAvatar");
          } catch (_) {}
          if (window.applyDriveAvatar) {
            if (data.user.picture) window.applyDriveAvatar(data.user.picture);
            else if (window.applyLetterAvatar) {
              const nm = (data.user.name || data.user.email || "U").trim();
              const letter = nm.charAt(0).toUpperCase();
              window.applyLetterAvatar(letter);
            }
          }
        }
      })
      .catch(function (err) {
        const message = (err && err.message) || "";
        if (
          /expired|no longer valid|Sign in required/i.test(message)
        ) {
          logout("login.html?mode=signin");
        }
      });
  }

  function redirectIfLoggedIn() {
    // Allow signup / forgot / reset even if someone is already logged in
    try {
      const params = new URLSearchParams(window.location.search || "");
      const mode = (params.get("mode") || "signin").toLowerCase();
      if (mode === "signup" || mode === "forgot" || mode === "reset") {
        return;
      }
    } catch (_) {}
    if (isLoggedIn()) {
      try {
        sessionStorage.setItem("mdPortalEnter", "1");
      } catch (_) {}
      window.location.replace("index.html");
    }
  }

  function logout(to) {
    const token = getToken();
    if (token) {
      fetch(apiUrl("/api/auth/logout"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
      }).catch(function () {});
    }
    clearSession();
    try {
      sessionStorage.setItem("mdPortalEnter", "1");
    } catch (_) {}
    if (typeof window.navigatePortal === "function") {
      window.navigatePortal(to || "frontpage.html", { dir: "out" });
    } else {
      window.location.href = to || "frontpage.html";
    }
  }

  function displayNameFromSession(session) {
    if (session && session.name) return session.name;
    const email = (session && session.email) || "";
    if (!email) return "User";
    const localPart = email.split("@")[0] || "User";
    return localPart
      .split(/([._\-])/)
      .map(function (part, index) {
        if (index === 0 || (part.length && !/^[._\-]$/.test(part))) {
          return part.charAt(0).toUpperCase() + part.slice(1);
        }
        return part;
      })
      .join("");
  }

  async function signupWithPassword(details) {
    const data = await apiRequest("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        name: details.name,
        email: details.email,
        password: details.password,
      }),
    });
    return {
      id: data.user.id,
      email: data.user.email,
      name: data.user.name,
      picture: data.user.picture || "",
      provider: data.user.provider || "email",
      token: data.token,
    };
  }

  async function loginWithPassword(details) {
    const data = await apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: details.email,
        password: details.password,
      }),
    });
    return {
      id: data.user.id,
      email: data.user.email,
      name: data.user.name,
      picture: data.user.picture || "",
      provider: data.user.provider || "email",
      token: data.token,
    };
  }

  async function loginWithGoogleAccessToken(accessToken) {
    const data = await apiRequest("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ accessToken: accessToken }),
    });
    return {
      id: data.user.id,
      email: data.user.email,
      name: data.user.name,
      picture: data.user.picture || "",
      provider: data.user.provider || "google",
      token: data.token,
      created: !!data.created,
    };
  }


  async function requestPasswordReset(email) {
    return apiRequest("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: email }),
    });
  }

  async function validateResetToken(token) {
    return apiRequest(
      "/api/auth/reset-password/validate?token=" + encodeURIComponent(token),
      { method: "GET" },
    );
  }

  async function resetPasswordWithToken(token, password) {
    return apiRequest("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token: token, password: password }),
    });
  }

  global.MiniDriveAuth = {
    clearDriveCachesExceptCurrent: clearDriveCachesExceptCurrent,
    KEYS,
    getClientId,
    getApiBase,
    getSession,
    isLoggedIn,
    saveSession,
    clearSession,
    requireLogin,
    redirectIfLoggedIn,
    logout,
    rememberGoogleUser,
    hasGoogleAccount,
    registeredEmails,
    displayNameFromSession,
    signupWithPassword,
    loginWithPassword,
    loginWithGoogleAccessToken,
    requestPasswordReset,
    validateResetToken,
    resetPasswordWithToken,
  };
})(window);
