/**
 * Mini Drive – notifications (local + server for shares)
 */
(function () {
  "use strict";

  const STORE_KEY = "miniDriveNotifications";
  let panelOpen = false;

  function $(id) {
    return document.getElementById(id);
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  function saveLocal(list) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify((list || []).slice(0, 50)));
    } catch (_) {}
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatTime(ts) {
    const t = typeof ts === "number" ? ts : Date.parse(ts) || Date.now();
    const d = Date.now() - t;
    if (d < 60000) return "Just now";
    if (d < 3600000) return Math.floor(d / 60000) + " min ago";
    if (d < 86400000) return Math.floor(d / 3600000) + " h ago";
    return new Date(t).toLocaleDateString();
  }

  function iconFor(kind) {
    if (kind === "delete") return { icon: "delete", cls: "delete" };
    if (kind === "folder") return { icon: "create_new_folder", cls: "folder" };
    if (kind === "share") return { icon: "share", cls: "share" };
    return { icon: "upload_file", cls: "add" };
  }

  function updateBadge(total) {
    const badge = $("notifBadge");
    const btn = $("notificationsBtn");
    if (total == null) {
      const list = loadLocal();
      total = list.filter(function (n) {
        return !n.read;
      }).length;
    }
    if (badge) {
      if (!total) {
        badge.setAttribute("hidden", "true");
        badge.style.display = "none";
        badge.textContent = "";
      } else {
        badge.removeAttribute("hidden");
        badge.textContent = total > 99 ? "99+" : String(total);
        badge.style.display = "flex";
      }
    }
    if (btn) {
      btn.setAttribute(
        "aria-label",
        total ? "Notifications, " + total + " unread" : "Notifications",
      );
    }
  }

  function renderList(list) {
    const listEl = $("notifList");
    if (!listEl) return;
    list = list || loadLocal();
    if (!list.length) {
      listEl.innerHTML =
        '<div class="notif-empty">No notifications yet.<br/>Uploads, shares, and deletes show up here.</div>';
      return;
    }
    listEl.innerHTML = list
      .map(function (n) {
        const meta = iconFor(n.kind || "add");
        return (
          '<div class="notif-item' +
          (n.read ? "" : " unread") +
          '" data-id="' +
          escapeHtml(n.id) +
          '">' +
          '<div class="notif-item-icon ' +
          meta.cls +
          '"><span class="material-symbols-outlined">' +
          meta.icon +
          "</span></div>" +
          '<div class="notif-item-text">' +
          '<p class="notif-item-title">' +
          escapeHtml(n.title) +
          "</p>" +
          '<p class="notif-item-msg">' +
          escapeHtml(n.message) +
          "</p>" +
          '<div class="notif-item-time">' +
          formatTime(n.time || n.createdAt) +
          "</div></div></div>"
        );
      })
      .join("");
  }

  function push(entry) {
    if (!entry) return;
    const list = loadLocal();
    list.unshift({
      id: "n_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
      title: entry.title || "Update",
      message: entry.message || "",
      kind: entry.kind || "add",
      time: Date.now(),
      read: false,
    });
    saveLocal(list);
    updateBadge();
    if (panelOpen) renderList(list);
  }

  async function refreshFromServer() {
    if (!window.MiniDriveAPI || !MiniDriveAPI.isServerAvailable()) {
      updateBadge();
      if (panelOpen) renderList();
      return;
    }
    if (!MiniDriveAPI.listNotifications) return;
    try {
      const data = await MiniDriveAPI.listNotifications();
      const serverItems = (data.items || []).map(function (n) {
        return {
          id: n.id,
          title: n.title,
          message: n.message,
          kind: n.kind || "share",
          time: n.time || Date.now(),
          read: !!n.read,
        };
      });
      // Merge: server first (shares etc.), then local activity not on server
      const local = loadLocal().filter(function (n) {
        return n.kind !== "share" || String(n.id).indexOf("n_") === 0;
      });
      const serverIds = {};
      serverItems.forEach(function (n) {
        serverIds[n.id] = true;
      });
      const merged = serverItems.concat(
        local.filter(function (n) {
          return !serverIds[n.id];
        }),
      );
      saveLocal(merged.slice(0, 50));
      updateBadge(
        typeof data.unread === "number"
          ? data.unread
          : merged.filter(function (n) {
              return !n.read;
            }).length,
      );
      if (panelOpen) renderList(merged);
    } catch (e) {
      updateBadge();
      if (panelOpen) renderList();
    }
  }

  function openPanel() {
    const panel = $("notifPanel");
    if (!panel) return;
    if (typeof setProfileMenu === "function") {
      try {
        setProfileMenu(false);
      } catch (e) {}
    }
    if (typeof setNewMenu === "function") {
      try {
        setNewMenu(false);
      } catch (e) {}
    }
    panel.hidden = false;
    panel.removeAttribute("hidden");
    panel.classList.add("open");
    panelOpen = true;
    renderList();
    refreshFromServer().then(function () {
      if (
        window.MiniDriveAPI &&
        MiniDriveAPI.isServerAvailable() &&
        MiniDriveAPI.markNotificationsRead
      ) {
        MiniDriveAPI.markNotificationsRead(null).catch(function () {});
      }
      const list = loadLocal().map(function (n) {
        n.read = true;
        return n;
      });
      saveLocal(list);
      updateBadge(0);
      renderList(list);
    });
  }

  function closePanel() {
    const panel = $("notifPanel");
    if (!panel) return;
    panel.classList.remove("open");
    panel.hidden = true;
    panelOpen = false;
  }

  function togglePanel(e) {
    if (e) e.stopPropagation();
    if (panelOpen) closePanel();
    else openPanel();
  }

  function clearAll() {
    saveLocal([]);
    updateBadge(0);
    renderList([]);
    if (
      window.MiniDriveAPI &&
      MiniDriveAPI.isServerAvailable() &&
      MiniDriveAPI.clearNotifications
    ) {
      MiniDriveAPI.clearNotifications().catch(function () {});
    }
  }

  function bind() {
    const btn = $("notificationsBtn");
    const clearBtn = $("notifClearAll");
    const wrap = $("notifWrap");
    if (btn) btn.addEventListener("click", togglePanel);
    if (clearBtn) clearBtn.addEventListener("click", clearAll);
    document.addEventListener("click", function (e) {
      if (!wrap) return;
      if (!wrap.contains(e.target)) closePanel();
    });
    updateBadge();
    refreshFromServer();
    // Poll for new shares every 30s while page open
    setInterval(refreshFromServer, 12000);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") refreshFromServer();
    });
    window.addEventListener("focus", function () {
      refreshFromServer();
    });
  }

  window.DriveNotifications = {
    push: push,
    refresh: refreshFromServer,
    open: openPanel,
    close: closePanel,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
