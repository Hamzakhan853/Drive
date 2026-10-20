/**
 * Mini Drive – full local file manager (IndexedDB + localStorage)
 * Views: Home, My Drive, Shared, Starred, Recent, Trash
 * Features: folders, upload, open PDF/video/image, rename, delete→trash, recover, permanent delete
 */

(function () {
  "use strict";

  function tt(key, vars) {
    if (window.DriveI18n && window.DriveI18n.t) return window.DriveI18n.t(key, vars);
    return key;
  }


  const META_KEY_PREFIX = "miniDriveMeta_v2";
  const DB_NAME = "MiniDriveDB";
  const DB_STORE = "files";
  const DB_VERSION = 1;
  const MAX_FILE_BYTES = 1 * 1024 * 1024 * 1024; // 1 GB per file
  const STORAGE_QUOTA_BYTES = 1 * 1024 * 1024 * 1024; // 1 GB (Supabase Free)

  let currentView = "home";
  let currentFolderId = null; // null = root of My Drive
  let items = []; // metadata array
  let contextTarget = null;
  let db = null;
  let selectMode = false;
  let selectedIds = new Set();
  let folderHistory = [null]; // folder ids visited in My Drive
  let historyIndex = 0;
  let historyLock = false; // skip push while using back/forward
  let currentUserKey = "guest";

  function getLoggedInEmail() {
    try {
      if (localStorage.getItem("miniDriveLoggedIn") !== "true") return "";
      return (localStorage.getItem("miniDriveUser") || "").trim().toLowerCase();
    } catch (_) {
      return "";
    }
  }

  function getLoggedInUserId() {
    try {
      return (localStorage.getItem("miniDriveUserId") || "").trim();
    } catch (_) {
      return "";
    }
  }

  function metaKeyForUser(email) {
    // Prefer stable user id so accounts never share a cache slot
    const uid = getLoggedInUserId();
    if (uid) return META_KEY_PREFIX + ":uid:" + uid;
    const key = (email || "guest").toLowerCase().replace(/[^a-z0-9@._-]/g, "_");
    return META_KEY_PREFIX + ":" + key;
  }

  function switchUserStorage() {
    const email = getLoggedInEmail();
    const uid = getLoggedInUserId();
    currentUserKey = uid ? "uid:" + uid : email || "guest";
  }

  /* ---------- IndexedDB for binary content ---------- */

  function openDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error("IndexedDB is not available in this browser."));
        return;
      }
      let settled = false;
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        try {
          const database = req.result;
          if (!database.objectStoreNames.contains(DB_STORE)) {
            database.createObjectStore(DB_STORE, { keyPath: "id" });
          }
        } catch (e) {
          if (!settled) {
            settled = true;
            reject(e);
          }
        }
      };
      req.onsuccess = () => {
        if (!settled) {
          settled = true;
          resolve(req.result);
        }
      };
      req.onerror = () => {
        if (!settled) {
          settled = true;
          reject(req.error || new Error("IndexedDB open failed (Safari private mode or file://?)"));
        }
      };
      req.onblocked = () => {
        console.warn("IndexedDB open blocked — close other Mini Drive tabs.");
      };
    });
  }

  function idbPut(record) {
    return new Promise((resolve, reject) => {
      if (!db) {
        reject(new Error("Storage not available"));
        return;
      }
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  function idbGet(id) {
    return new Promise((resolve, reject) => {
      if (!db) {
        resolve(null);
        return;
      }
      const tx = db.transaction(DB_STORE, "readonly");
      const req = tx.objectStore(DB_STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  function idbDelete(id) {
    return new Promise((resolve, reject) => {
      if (!db) {
        resolve();
        return;
      }
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /* ---------- Metadata ---------- */

  function loadMeta() {
    switchUserStorage();
    try {
      const raw = localStorage.getItem(metaKeyForUser(currentUserKey));
      const parsed = raw ? JSON.parse(raw) : [];
      items = Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      items = [];
    }
  }

  function saveMeta() {
    switchUserStorage();
    try {
      localStorage.setItem(metaKeyForUser(currentUserKey), JSON.stringify(items));
    } catch (e) {
      console.warn("Could not save local metadata", e);
    }
    updateStorageBar();
  }

  function createId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function formatSize(bytes) {
    if (bytes == null || isNaN(bytes)) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1024 * 1024 * 1024)
      return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
  }

  function getFileIconInfo(type, name) {
    type = (type || "").toLowerCase();
    name = name || "";
    const ext = name.split(".").pop().toLowerCase();

    if (type.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext)) {
      return { icon: "image", color: "icon-image" };
    }
    if (type.startsWith("video/") || ["mp4", "webm", "mkv", "mov", "avi"].includes(ext)) {
      return { icon: "movie", color: "icon-video" };
    }
    if (type.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a", "flac", "aac"].includes(ext)) {
      return { icon: "audio_file", color: "icon-audio" };
    }
    if (type === "application/pdf" || ext === "pdf") {
      return { icon: "picture_as_pdf", color: "icon-pdf" };
    }
    if (
      type.includes("word") ||
      type.includes("document") ||
      ["doc", "docx", "odt", "rtf"].includes(ext)
    ) {
      return { icon: "description", color: "icon-doc" };
    }
    if (type.includes("sheet") || type.includes("excel") || ["xls", "xlsx", "csv"].includes(ext)) {
      return { icon: "table_chart", color: "icon-sheet" };
    }
    if (type.includes("presentation") || type.includes("powerpoint") || ["ppt", "pptx"].includes(ext)) {
      return { icon: "slideshow", color: "icon-slides" };
    }
    if (["html", "css", "js", "ts", "jsx", "tsx", "java", "py", "c", "cpp", "json", "xml"].includes(ext)) {
      return { icon: "code", color: "icon-code" };
    }
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
      return { icon: "folder_zip", color: "icon-zip" };
    }
    if (["txt", "md", "log"].includes(ext) || type.startsWith("text/")) {
      return { icon: "article", color: "icon-text" };
    }
    return { icon: "insert_drive_file", color: "icon-file" };
  }

  function getFileIcon(type, name) {
    return getFileIconInfo(type, name).icon;
  }

  /* ---------- DOM helpers ---------- */

  function $(sel) {
    return document.querySelector(sel);
  }
  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function toast(title, message, type) {
    const prefs =
      window.DriveSettings && window.DriveSettings.get
        ? window.DriveSettings.get()
        : {};
    if (prefs.notifications === false) return;
    if (typeof showToast === "function") {
      showToast(title, message, type || "success");
    } else {
      console.log(title, message);
    }
  }

  function notifyApp(title, message, kind) {
    try {
      if (window.DriveNotifications && typeof window.DriveNotifications.push === "function") {
        window.DriveNotifications.push({
          title: title,
          message: message,
          kind: kind || "add",
        });
      }
    } catch (e) {
      console.warn("notifyApp failed", e);
    }
  }

  /**
   * Themed confirm dialog (replaces window.confirm)
   * options: { title, message, confirmText, cancelText, danger, icon }
   */
  function showConfirm(options) {
    const opts =
      typeof options === "string"
        ? { message: options }
        : options || {};
    const title = opts.title || "Please confirm";
    const message = opts.message || "";
    const confirmText = opts.confirmText || "OK";
    const cancelText = opts.cancelText || "Cancel";
    const danger = !!opts.danger;
    const icon = opts.icon || (danger ? "warning" : "help");

    return new Promise((resolve) => {
      let modal = document.getElementById("driveConfirmModal");
      if (!modal) {
        modal = document.createElement("div");
        modal.id = "driveConfirmModal";
        modal.className = "drive-confirm-modal";
        modal.innerHTML = `
          <div class="drive-confirm-backdrop" data-cancel></div>
          <div class="drive-confirm-panel" role="dialog" aria-modal="true">
            <div class="drive-confirm-icon-wrap">
              <span class="material-symbols-outlined drive-confirm-icon"></span>
            </div>
            <h3 class="drive-confirm-title"></h3>
            <p class="drive-confirm-message"></p>
            <div class="drive-confirm-actions">
              <button type="button" class="drive-confirm-cancel" data-cancel></button>
              <button type="button" class="drive-confirm-ok"></button>
            </div>
          </div>`;
        document.body.appendChild(modal);
      }

      const iconEl = modal.querySelector(".drive-confirm-icon");
      const titleEl = modal.querySelector(".drive-confirm-title");
      const msgEl = modal.querySelector(".drive-confirm-message");
      const okBtn = modal.querySelector(".drive-confirm-ok");
      const cancelBtn = modal.querySelector(".drive-confirm-cancel");
      const panel = modal.querySelector(".drive-confirm-panel");

      iconEl.textContent = icon;
      titleEl.textContent = title;
      msgEl.textContent = message;
      okBtn.textContent = confirmText;
      cancelBtn.textContent = cancelText;
      panel.classList.toggle("danger", danger);
      okBtn.classList.toggle("danger", danger);

      function close(result) {
        modal.classList.remove("show");
        document.body.classList.remove("upload-open");
        modal.querySelectorAll("[data-cancel]").forEach((n) => {
          n.onclick = null;
        });
        okBtn.onclick = null;
        document.removeEventListener("keydown", onKey);
        resolve(result);
      }

      function onKey(e) {
        if (e.key === "Escape") close(false);
        if (e.key === "Enter") close(true);
      }

      modal.querySelectorAll("[data-cancel]").forEach((n) => {
        n.onclick = () => close(false);
      });
      okBtn.onclick = () => close(true);
      document.addEventListener("keydown", onKey);

      modal.classList.add("show");
      document.body.classList.add("upload-open");
      setTimeout(() => okBtn.focus(), 30);
    });
  }

  /* ---------- Queries ---------- */

  function activeItems() {
    return items.filter((i) => !i.trashed);
  }

  function trashedItems() {
    return items.filter((i) => i.trashed);
  }

  function childrenOf(folderId) {
    return activeItems().filter((i) => (i.parentId || null) === (folderId || null));
  }

  function getItem(id) {
    return items.find((i) => i.id === id);
  }

  function folderPath(folderId) {
    const path = [];
    let id = folderId;
    while (id) {
      const f = getItem(id);
      if (!f) break;
      path.unshift(f);
      id = f.parentId;
    }
    return path;
  }

  /* ---------- Views ---------- */

  function setView(view, folderId, opts) {
    opts = opts || {};
    currentView = view;
    if (view === "mydrive" || view === "folder") {
      if (folderId !== undefined) currentFolderId = folderId;
      else if (view === "mydrive" && folderId === undefined && !opts.keepFolder)
        currentFolderId = currentFolderId;
      if (view === "mydrive" && folderId === null) currentFolderId = null;
      if (view === "mydrive" && folderId === undefined && opts.resetRoot)
        currentFolderId = null;
    }
    if (view === "folder") currentView = "mydrive";

    // Folder navigation history (My Drive only)
    if (currentView === "mydrive" && !historyLock && !opts.skipHistory) {
      const id = currentFolderId || null;
      const last = folderHistory[historyIndex];
      if (last !== id) {
        folderHistory = folderHistory.slice(0, historyIndex + 1);
        folderHistory.push(id);
        historyIndex = folderHistory.length - 1;
      }
    }

    if (currentView !== "trash") {
      selectMode = false;
      selectedIds = new Set();
    }

    document.querySelectorAll(".menu li[data-view]").forEach((li) => {
      li.classList.toggle("active", li.getAttribute("data-view") === currentView);
    });

    wireEmptyNewMenu(document);
    transitionRender();
  }

  function getContentFadeTargets() {
    const ids = ["foldersSection", "filesSection", "driveEmptyState", "settingsHost", "quickAccessContainer", "recentFilesContainer"];
    const nodes = [];
    ids.forEach((id) => {
      const n = document.getElementById(id);
      if (n) nodes.push(n);
    });
    return nodes;
  }

  let __viewFadeTimer = null;

  function transitionRender() {
    // Cancel any in-flight fade so rapid Back/Forward never leaves content at opacity 0
    if (__viewFadeTimer) {
      clearTimeout(__viewFadeTimer);
      __viewFadeTimer = null;
    }
    const targets = getContentFadeTargets();
    if (!targets.length) {
      render();
      return;
    }
    targets.forEach((n) => {
      n.classList.add("drive-content-fade", "is-leaving");
      n.classList.remove("is-visible", "is-entering");
    });
    __viewFadeTimer = setTimeout(() => {
      __viewFadeTimer = null;
      render();
      const after = getContentFadeTargets();
      after.forEach((n) => {
        n.classList.add("drive-content-fade", "is-entering");
        n.classList.remove("is-leaving", "is-visible");
      });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          after.forEach((n) => {
            n.classList.remove("is-entering", "is-leaving");
            n.classList.add("is-visible");
            // Hard guarantee — never stay invisible
            n.style.opacity = "";
          });
        });
      });
    }, 140);
  }

  function navFolderBack() {
    if (historyIndex <= 0) return;
    historyLock = true;
    historyIndex -= 1;
    const id = folderHistory[historyIndex];
    currentView = "mydrive";
    currentFolderId = id;
    historyLock = false;
    document.querySelectorAll(".menu li[data-view]").forEach((li) => {
      li.classList.toggle("active", li.getAttribute("data-view") === "mydrive");
    });
    transitionRender();
  }

  function navFolderForward() {
    if (historyIndex >= folderHistory.length - 1) return;
    historyLock = true;
    historyIndex += 1;
    const id = folderHistory[historyIndex];
    currentView = "mydrive";
    currentFolderId = id;
    historyLock = false;
    document.querySelectorAll(".menu li[data-view]").forEach((li) => {
      li.classList.toggle("active", li.getAttribute("data-view") === "mydrive");
    });
    transitionRender();
  }

  function itemsForCurrentView() {
    if (currentView === "trash") return trashedItems();
    if (currentView === "starred")
      return activeItems().filter((i) => i.starred);
    if (currentView === "shared")
      return activeItems().filter((i) => i.shared || i.sharedWithMe);
    if (currentView === "recent")
      return activeItems()
        .filter((i) => i.kind === "file")
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        .slice(0, 40);
    if (currentView === "home") {
      const folders = activeItems()
        .filter((i) => i.kind === "folder" && !i.parentId)
        .slice(0, 12);
      const recent = activeItems()
        .filter((i) => i.kind === "file")
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        .slice(0, 12);
      return { folders, recent, isHome: true };
    }
    // my drive / folder
    return childrenOf(currentFolderId);
  }

  /* ---------- Render ---------- */


  function resetEmptyNewMenuLabels(emptyState) {
    if (!emptyState) return;
    const createLabel = emptyState.querySelector('[data-act="create-folder"] .empty-new-label');
    const uploadLabel = emptyState.querySelector('[data-act="upload-folder"] .empty-new-label');
    // Fallback if structure is old (icon + text node only)
    const createBtn = emptyState.querySelector('[data-act="create-folder"]');
    const uploadBtn = emptyState.querySelector('[data-act="upload-folder"]');
    if (createLabel) {
      createLabel.textContent = "Create a new folder";
    } else if (createBtn) {
      createBtn.innerHTML =
        '<span class="empty-new-icon"><span class="material-symbols-outlined">create_new_folder</span></span>' +
        '<span class="empty-new-label">Create a new folder</span>';
    }
    if (uploadLabel) {
      uploadLabel.textContent = "Upload a folder";
    } else if (uploadBtn) {
      uploadBtn.innerHTML =
        '<span class="empty-new-icon folder-up"><span class="material-symbols-outlined">drive_folder_upload</span></span>' +
        '<span class="empty-new-label">Upload a folder</span>';
    }
  }

  function wireEmptyNewMenu(root) {
    const scope = root || document;
    const wraps = scope.querySelectorAll
      ? scope.querySelectorAll(".empty-new-wrap")
      : [];
    const list = wraps.length
      ? wraps
      : [document.getElementById("emptyNewWrap")].filter(Boolean);
    list.forEach((wrap) => {
      // allow rewire after empty state rebuild
      if (wrap.dataset.wired === "1" && wrap.querySelector("#emptyNewBtn")) {
        /* already wired on this node */
        return;
      }
      wrap.dataset.wired = "1";
      const btn =
        wrap.querySelector("#emptyNewBtn") ||
        wrap.querySelector(".primary-empty-btn");
      const menu =
        wrap.querySelector("#emptyNewMenu") ||
        wrap.querySelector(".empty-new-menu");
      if (!btn || !menu) return;

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const willOpen = !wrap.classList.contains("open");
        document.querySelectorAll(".empty-new-wrap.open").forEach((w) => {
          w.classList.remove("open");
        });
        if (willOpen) wrap.classList.add("open");
      });

      menu.querySelectorAll("[data-act]").forEach((item) => {
        item.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          wrap.classList.remove("open");
          const act = item.dataset.act;
          if (act === "create-folder") {
            if (typeof openCreateFolderModal === "function") openCreateFolderModal();
          } else if (act === "upload-folder") {
            if (typeof openFolderPicker === "function") openFolderPicker();
            else {
              const fi = document.getElementById("folderInput");
              if (fi) fi.click();
            }
          }
        });
      });
    });

    if (!document._emptyNewMenuDocWired) {
      document._emptyNewMenuDocWired = true;
      document.addEventListener("click", () => {
        document.querySelectorAll(".empty-new-wrap.open").forEach((w) => {
          w.classList.remove("open");
        });
      });
    }
  }

  function render() {
    const dash = $(".dashboard");
    if (!dash) return;

    const titleEl = dash.querySelector("h1");
    const titles = {
      home: tt("titleHome"),
      mydrive: tt("titleMyDrive"),
      shared: tt("titleShared"),
      starred: tt("titleStarred"),
      recent: tt("titleRecent"),
      trash: tt("titleTrash"),
      settings: tt("titleSettings"),
    };
    if (titleEl) {
      if (currentView === "mydrive" && currentFolderId) {
        const f = getItem(currentFolderId);
        titleEl.textContent = f ? f.name : "My Drive";
      } else {
        titleEl.textContent = titles[currentView] || "My Drive";
      }
    }

    // Breadcrumb
    let breadcrumb = $("#driveBreadcrumb");
    if (!breadcrumb) {
      breadcrumb = el("div", "drive-breadcrumb");
      breadcrumb.id = "driveBreadcrumb";
      if (titleEl) titleEl.after(breadcrumb);
      else dash.prepend(breadcrumb);
    }
    breadcrumb.innerHTML = "";
    if (currentView === "mydrive") {
      const navRow = el("div", "folder-nav-row");
      // Only show back/forward when current location has items OR history can go somewhere
      const hereCount = childrenOf(currentFolderId).length;
      const canNav = hereCount > 0 || historyIndex > 0 || historyIndex < folderHistory.length - 1;
      if (canNav) {
      const backBtn = el("button", "folder-nav-btn");
      backBtn.type = "button";
      backBtn.title = "Back";
      backBtn.disabled = historyIndex <= 0;
      backBtn.innerHTML = '<span class="material-symbols-outlined">arrow_back</span>';
      backBtn.onclick = () => navFolderBack();
      const fwdBtn = el("button", "folder-nav-btn");
      fwdBtn.type = "button";
      fwdBtn.title = "Forward";
      fwdBtn.disabled = historyIndex >= folderHistory.length - 1;
      fwdBtn.innerHTML = '<span class="material-symbols-outlined">arrow_forward</span>';
      fwdBtn.onclick = () => navFolderForward();
      navRow.append(backBtn, fwdBtn);
      }

      const crumbs = el("div", "folder-crumbs");
      const rootBtn = el("button", "crumb-btn");
      rootBtn.type = "button";
      rootBtn.textContent = tt("myDrive");
      rootBtn.onclick = () => setView("mydrive", null);
      crumbs.appendChild(rootBtn);
      folderPath(currentFolderId).forEach((f) => {
        crumbs.appendChild(el("span", "crumb-sep", "/"));
        const b = el("button", "crumb-btn");
        b.type = "button";
        b.textContent = f.name;
        b.onclick = () => setView("mydrive", f.id);
        crumbs.appendChild(b);
      });
      navRow.appendChild(crumbs);
      breadcrumb.appendChild(navRow);
      // drive select toolbar placeholder (filled after count)
      const driveBarHost = el("div", "drive-select-host");
      driveBarHost.id = "driveSelectHost";
      breadcrumb.appendChild(driveBarHost);
    } else if (currentView === "trash") {
      const count = trashedItems().length;
      breadcrumb.innerHTML = "";
      if (count > 0) {
      const hint = el("span", "crumb-hint");
      hint.textContent = tt("trashHint");
      breadcrumb.appendChild(hint);

      const bar = el("div", "trash-toolbar");
      if (!selectMode) {
        bar.innerHTML = `
          <div class="drive-bulk-left">
            <button type="button" class="trash-tool-btn" data-act="select" ${count ? "" : "disabled"}>
              <span class="material-symbols-outlined">check_box</span> ${tt("select")}
            </button>
          </div>
          <div class="drive-bulk-right">
            <button type="button" class="trash-tool-btn recover-btn" data-act="recover-all" ${count ? "" : "disabled"}>
              <span class="material-symbols-outlined">restore_from_trash</span> ${tt("recoverAll")}
            </button>
            <button type="button" class="trash-tool-btn danger" data-act="empty" ${count ? "" : "disabled"}>
              <span class="material-symbols-outlined">delete_forever</span> ${tt("emptyTrash")}
            </button>
          </div>`;
      } else {
        const n = selectedIds.size;
        bar.innerHTML = `
          <div class="drive-bulk-left">
            <button type="button" class="trash-tool-btn" data-act="cancel-select">
              <span class="material-symbols-outlined">close</span> ${tt("cancel")}
            </button>
            <button type="button" class="trash-tool-btn" data-act="select-all-trash">
              <span class="material-symbols-outlined">select_all</span> Select all
            </button>
            <span class="trash-select-count">${tt("selected", { n })}</span>
          </div>
          <div class="drive-bulk-right">
            <button type="button" class="trash-tool-btn recover-btn" data-act="recover-selected" ${n ? "" : "disabled"}>
              <span class="material-symbols-outlined">restore_from_trash</span> ${tt("recover")}
            </button>
            <button type="button" class="trash-tool-btn danger" data-act="delete-selected" ${n ? "" : "disabled"}>
              <span class="material-symbols-outlined">warning</span> ${tt("deletePermanently")}
            </button>
          </div>`;
      }
      breadcrumb.appendChild(bar);
      bar.querySelectorAll("button[data-act]").forEach((btn) => {
        btn.addEventListener("click", () => handleTrashToolbar(btn.dataset.act));
      });
      } // end count > 0
    } else if (
      currentView === "home" ||
      currentView === "shared" ||
      currentView === "starred" ||
      currentView === "recent"
    ) {
      breadcrumb.innerHTML = "";
      // selection bar added after we know item counts (below)
    } else {
      breadcrumb.innerHTML = "";
    }

    // Sort toolbar (My Drive, Shared, Starred, Recent, Home, Trash)
    let sortBar = $("#driveSortBar");
    if (!sortBar) {
      sortBar = el("div", "drive-sort-bar");
      sortBar.id = "driveSortBar";
      const bc = $("#driveBreadcrumb");
      if (bc && bc.parentNode) bc.after(sortBar);
      else if (titleEl) titleEl.after(sortBar);
      else dash.prepend(sortBar);
    }
    // Preview count so empty views never flash sort controls
    const previewData = itemsForCurrentView();
    const previewList = Array.isArray(previewData) ? previewData : [];
    let previewCount = 0;
    if (previewData && previewData.isHome) {
      previewCount = (previewData.folders || []).length + (previewData.recent || []).length;
    } else if (currentView === "trash") {
      previewCount = trashedItems().length;
    } else {
      previewCount = previewList.length;
    }

    if (currentView !== "settings" && previewCount > 0) {
      const s = getSettings();
      const sortOptions = [
        ["name", tt("sortName")],
        ["date", tt("sortDate")],
        ["size", tt("sortSize")],
        ["type", tt("sortType")],
      ];
      const currentLab = (sortOptions.find(([v]) => v === (s.sortBy || "name")) || sortOptions[0])[1];
      sortBar.style.display = "flex";
      sortBar.innerHTML = `
        <div class="drive-sort-dd" id="pageSortDd">
          <button type="button" class="drive-sort-btn" id="pageSortBtn">
            <span class="material-symbols-outlined">sort</span>
            <span id="pageSortLabel">${currentLab}</span>
            <span class="material-symbols-outlined">expand_more</span>
          </button>
          <div class="drive-sort-menu" id="pageSortMenu">
            ${sortOptions
              .map(
                ([v, lab]) =>
                  `<button type="button" class="drive-sort-item ${v === (s.sortBy || "name") ? "active" : ""}" data-sort="${v}">${lab}</button>`,
              )
              .join("")}
          </div>
        </div>
        <button type="button" class="drive-sort-dir" id="pageSortDir" title="${tt("sortDirection")}">
          <span class="material-symbols-outlined">${s.sortDir === "desc" ? "arrow_downward" : "arrow_upward"}</span>
        </button>
        <button type="button" class="drive-view-toggle" id="pageViewToggle" title="${tt("viewLayout")}">
          <span class="material-symbols-outlined">${s.viewMode === "list" ? "grid_view" : "view_list"}</span>
        </button>
      `;
      const dd = sortBar.querySelector("#pageSortDd");
      const btn = sortBar.querySelector("#pageSortBtn");
      const menu = sortBar.querySelector("#pageSortMenu");
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        dd.classList.toggle("open");
      });
      menu.querySelectorAll(".drive-sort-item").forEach((item) => {
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          if (window.DriveSettings) window.DriveSettings.save({ sortBy: item.dataset.sort });
          dd.classList.remove("open");
          render();
        });
      });
      sortBar.querySelector("#pageSortDir").addEventListener("click", () => {
        const cur = getSettings().sortDir === "desc" ? "asc" : "desc";
        if (window.DriveSettings) window.DriveSettings.save({ sortDir: cur });
        render();
      });
      sortBar.querySelector("#pageViewToggle").addEventListener("click", () => {
        const cur = getSettings().viewMode === "list" ? "grid" : "list";
        if (window.DriveSettings) window.DriveSettings.save({ viewMode: cur });
        render();
      });
      document.addEventListener(
        "click",
        () => dd.classList.remove("open"),
        { once: true },
      );
    } else if (sortBar) {
      sortBar.style.display = "none";
      sortBar.innerHTML = "";
    }

    // Settings view
    if (currentView === "settings") {
      const foldersSection = $("#foldersSection");
      const filesSection = $("#filesSection");
      const emptyState = $("#driveEmptyState");
      if (foldersSection) foldersSection.innerHTML = "";
      if (filesSection) filesSection.innerHTML = "";
      if (emptyState) emptyState.style.display = "none";
      let settingsHost = $("#settingsHost");
      if (!settingsHost) {
        settingsHost = el("div");
        settingsHost.id = "settingsHost";
        const dash = $(".dashboard");
        if (dash) dash.appendChild(settingsHost);
      }
      settingsHost.style.display = "block";
      if (window.DriveSettings && window.DriveSettings.renderPanel) {
        window.DriveSettings.renderPanel(settingsHost);
      }
      return;
    } else {
      const settingsHost = $("#settingsHost");
      if (settingsHost) settingsHost.style.display = "none";
    }

    const data = itemsForCurrentView();
    let list = Array.isArray(data) ? data : [];
    let homeMode = data && data.isHome;
    list = sortItems(list);

    // Ensure containers
    let foldersSection = $("#foldersSection");
    let filesSection = $("#filesSection");
    let emptyState = $("#driveEmptyState");
    let qa = $("#quickAccessContainer");
    let rf = $("#recentFilesContainer");

    if (!foldersSection) {
      // rebuild dashboard body under h1/breadcrumb
      const oldH2s = dash.querySelectorAll("h2");
      oldH2s.forEach((h) => h.remove());
      if (qa) qa.remove();
      if (rf) rf.remove();

      foldersSection = el("div");
      foldersSection.id = "foldersSection";
      filesSection = el("div");
      filesSection.id = "filesSection";
      emptyState = el("div", "drive-empty");
      emptyState.id = "driveEmptyState";
      emptyState.innerHTML = `
        <span class="material-symbols-outlined empty-icon">cloud_off</span>
        <h3></h3>
        <p></p>
        <div class="empty-actions">
          <div class="empty-new-wrap" id="emptyNewWrap">
            <button type="button" class="primary-empty-btn" id="emptyNewBtn" aria-haspopup="menu"></button>
            <div class="empty-new-menu" id="emptyNewMenu" role="menu">
              <button type="button" class="empty-new-item" data-act="create-folder" role="menuitem">
                <span class="empty-new-icon"><span class="material-symbols-outlined">create_new_folder</span></span>
                <span class="empty-new-label">Create a new folder</span>
              </button>
              <button type="button" class="empty-new-item" data-act="upload-folder" role="menuitem">
                <span class="empty-new-icon folder-up"><span class="material-symbols-outlined">drive_folder_upload</span></span>
                <span class="empty-new-label">Upload a folder</span>
              </button>
            </div>
          </div>
          <button type="button" class="secondary-empty-btn" id="emptyUpload"></button>
        </div>`;
      emptyState.querySelector("h3").textContent = tt("emptyTitle");
      emptyState.querySelector("p").textContent = tt("emptyDesc");
      emptyState.querySelector("#emptyNewBtn").innerHTML =
        tt("newFolder") +
        ' <span class="material-symbols-outlined empty-new-chevron">expand_more</span>';
      emptyState.querySelector("#emptyUpload").textContent = tt("uploadFiles");
      dash.append(foldersSection, filesSection, emptyState);
      wireEmptyNewMenu(emptyState);
      resetEmptyNewMenuLabels(emptyState);
      emptyState.querySelector("#emptyUpload").onclick = () => {
        if (typeof openUploadModal === "function") openUploadModal();
        else if (typeof openUploadModalFromMenu === "function")
          openUploadModalFromMenu();
      };
    }

    foldersSection.innerHTML = "";
    filesSection.innerHTML = "";

    let folders = [];
    let files = [];

    if (homeMode) {
      folders = sortItems(data.folders);
      files = sortItems(data.recent);
    } else if (currentView === "trash") {
      folders = list.filter((i) => i.kind === "folder");
      files = list.filter((i) => i.kind === "file");
    } else if (currentView === "recent") {
      files = list;
    } else {
      folders = list.filter((i) => i.kind === "folder");
      files = list.filter((i) => i.kind === "file");
    }

    const total = folders.length + files.length;
    emptyState.style.display = total === 0 ? "flex" : "none";

    // Drive selection toolbar (My Drive / Home / Shared / Starred / Recent)
    renderDriveSelectToolbar(total);

    // Hide sorting controls when there is nothing to sort
    if (sortBar) {
      if (total === 0 || currentView === "settings") {
        sortBar.style.display = "none";
        sortBar.innerHTML = "";
      }
    }

    // Empty-state copy (Trash vs Drive)
    if (total === 0 && emptyState) {
      const h3 = emptyState.querySelector("h3");
      const p = emptyState.querySelector("p");
      const actions = emptyState.querySelector(".empty-actions");
      if (currentView === "trash") {
        if (h3) h3.textContent = tt("trashIsEmpty");
        if (p) p.textContent = tt("trashEmptyHint");
        if (actions) actions.style.display = "none";
      } else if (currentView === "starred") {
        if (h3) h3.textContent = tt("nothingStarred");
        if (p) p.textContent = tt("nothingStarredHint");
        if (actions) actions.style.display = "none";
      } else if (currentView === "shared") {
        if (h3) h3.textContent = tt("nothingShared");
        if (p) p.textContent = tt("nothingSharedHint");
        if (actions) actions.style.display = "none";
      } else if (
        currentView === "mydrive" &&
        currentFolderId
      ) {
        // Inside a folder
        if (h3) h3.textContent = tt("folderEmptyTitle");
        if (p) p.textContent = tt("folderEmptyDesc");
        if (actions) {
          actions.style.display = "flex";
          const b0 = emptyState.querySelector("#emptyNewBtn");
          const b1 = emptyState.querySelector("#emptyUpload");
          if (b0)
            b0.innerHTML =
              tt("newFolder") +
              ' <span class="material-symbols-outlined empty-new-chevron">expand_more</span>';
          if (b1) b1.textContent = tt("uploadFiles");
          wireEmptyNewMenu(emptyState);
          resetEmptyNewMenuLabels(emptyState);
        }
        const icon = emptyState.querySelector(".empty-icon");
        if (icon) icon.textContent = "folder_open";
      } else {
        if (h3) h3.textContent = tt("emptyTitle");
        if (p) p.textContent = tt("emptyDesc");
        if (actions) {
          actions.style.display = "flex";
          const b0 = emptyState.querySelector("#emptyNewBtn");
          const b1 = emptyState.querySelector("#emptyUpload");
          if (b0)
            b0.innerHTML =
              tt("newFolder") +
              ' <span class="material-symbols-outlined empty-new-chevron">expand_more</span>';
          if (b1) b1.textContent = tt("uploadFiles");
          wireEmptyNewMenu(emptyState);
          resetEmptyNewMenuLabels(emptyState);
        }
        const icon = emptyState.querySelector(".empty-icon");
        if (icon) icon.textContent = "cloud_off";
      }
    }

    if (folders.length) {
      const h2 = el("h2");
      h2.textContent =
        currentView === "home"
          ? tt("folders")
          : currentView === "trash"
            ? tt("foldersInTrash")
            : tt("folders");
      foldersSection.appendChild(h2);
      const grid = el("div", "card-container");
      grid.id = "quickAccessContainer";
      folders.forEach((item) => grid.appendChild(renderCard(item)));
      foldersSection.appendChild(grid);
    }

    if (files.length) {
      const h2 = el("h2");
      h2.textContent =
        currentView === "home" || currentView === "recent"
          ? tt("recentFiles")
          : currentView === "trash"
            ? tt("filesInTrash")
            : tt("files");
      filesSection.appendChild(h2);
      const grid = el("div", "card-container");
      grid.id = "recentFilesContainer";
      files.forEach((item) => grid.appendChild(renderCard(item)));
      filesSection.appendChild(grid);
    }

    updateStorageBar();
  }

  function getSettings() {
    return (window.DriveSettings && window.DriveSettings.get)
      ? window.DriveSettings.get()
      : {};
  }

  function sortItems(list) {
    const s = getSettings();
    const by = s.sortBy || "name";
    const dir = s.sortDir === "desc" ? -1 : 1;
    return [...list].sort((a, b) => {
      // folders first
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
      let av;
      let bv;
      if (by === "size") {
        av = a.size || 0;
        bv = b.size || 0;
      } else if (by === "date") {
        av = a.updatedAt || 0;
        bv = b.updatedAt || 0;
      } else if (by === "type") {
        av = (a.mimeType || a.kind || "").toLowerCase();
        bv = (b.mimeType || b.kind || "").toLowerCase();
      } else {
        av = (a.name || "").toLowerCase();
        bv = (b.name || "").toLowerCase();
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }

  function displayItemName(item) {
    const s = getSettings();
    if (item.kind === "folder") return item.name;
    if (s.showExtensions !== false) return item.name;
    const n = item.name || "";
    const dot = n.lastIndexOf(".");
    if (dot > 0) return n.slice(0, dot);
    return n;
  }

  function folderTotalSize(folderId) {
    let total = 0;
    function walk(id) {
      items
        .filter((i) => (i.parentId || null) === id)
        .forEach((c) => {
          if (c.kind === "file") total += c.size || 0;
          else if (c.kind === "folder") walk(c.id);
        });
    }
    walk(folderId);
    return total;
  }

  function renderCard(item) {
    const card = el(
      "div",
      `drive-card ${item.kind === "folder" ? "folder-card" : "file-card"}`,
    );
    card.dataset.id = item.id;
    card.title = item.name;

    let iconClass = "material-symbols-outlined";
    let iconName = "insert_drive_file";
    if (item.kind === "folder") {
      iconClass += " folder icon-folder";
      iconName = "folder";
    } else {
      const info = getFileIconInfo(item.mimeType, item.name);
      iconClass += " " + info.color;
      iconName = info.icon;
    }
    const icon = el("span", iconClass);
    icon.textContent = iconName;

    const h3 = el("h3");
    h3.textContent = displayItemName(item);

    const p = el("p");
    if (item.kind === "folder") {
      if (currentView === "trash") {
        // Show size of folder contents instead of "In trash"
        p.textContent = formatSize(folderTotalSize(item.id)) || "0 B";
      } else {
        const count = activeItems().filter((i) => i.parentId === item.id).length;
        p.textContent =
          count === 0
            ? tt("emptyFolder")
            : count === 1
              ? tt("items", { n: count })
              : tt("items_plural", { n: count });
      }
    } else {
      p.textContent = formatSize(item.size) || "File";
    }

    card.append(icon, h3, p);

    // actions row
    const actions = el("div", "card-actions");
    if (selectMode && currentView !== "settings") {
      const check = el(
        "button",
        "card-action-btn card-select-btn" +
          (selectedIds.has(item.id) ? " selected" : ""),
      );
      check.type = "button";
      check.title = "Select";
      check.innerHTML = selectedIds.has(item.id)
        ? '<span class="material-symbols-outlined">check_box</span>'
        : '<span class="material-symbols-outlined">check_box_outline_blank</span>';
      check.onclick = (e) => {
        e.stopPropagation();
        toggleSelect(item.id);
      };
      actions.append(check);
      if (selectedIds.has(item.id)) card.classList.add("card-selected");
    } else if (currentView === "trash") {
      {
        const recoverBtn = el("button", "card-action-btn recover-btn");
        recoverBtn.type = "button";
        recoverBtn.title = "Recover";
        recoverBtn.innerHTML =
          '<span class="material-symbols-outlined">restore_from_trash</span>';
        recoverBtn.onclick = (e) => {
          e.stopPropagation();
          recoverItem(item.id);
        };
        const delBtn = el("button", "card-action-btn danger");
        delBtn.type = "button";
        delBtn.title = "Delete permanently";
        delBtn.innerHTML =
          '<span class="material-symbols-outlined">delete_forever</span>';
        delBtn.onclick = (e) => {
          e.stopPropagation();
          permanentDelete(item.id);
        };
        actions.append(recoverBtn, delBtn);
      }
    } else {
      const moreBtn = el("button", "card-action-btn");
      moreBtn.type = "button";
      moreBtn.title = "More";
      moreBtn.innerHTML =
        '<span class="material-symbols-outlined">more_vert</span>';
      moreBtn.onclick = (e) => {
        e.stopPropagation();
        openContextMenu(e, item);
      };
      actions.append(moreBtn);
    }
    card.appendChild(actions);

    card.addEventListener("click", () => onItemOpen(item));
    card.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (currentView !== "trash") openContextMenu(e, item);
    });

    return card;
  }


  function formatMediaTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return "0:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return h + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
    }
    return m + ":" + String(s).padStart(2, "0");
  }

  function wireCustomVideoPlayer(stage, video) {
    const playBtn = stage.querySelector(".v-play");
    const playIcon = playBtn.querySelector(".material-symbols-outlined");
    const backBtn = stage.querySelector(".v-back");
    const fwdBtn = stage.querySelector(".v-fwd");
    const muteBtn = stage.querySelector(".v-mute");
    const muteIcon = muteBtn.querySelector(".material-symbols-outlined");
    const fsBtn = stage.querySelector(".v-fs");
    const progress = stage.querySelector(".v-progress");
    const fill = stage.querySelector(".v-progress-fill");
    const vol = stage.querySelector(".v-volume");
    const curEl = stage.querySelector(".v-current");
    const durEl = stage.querySelector(".v-duration");
    const frame = stage.querySelector(".media-frame-video");
    let dragging = false;

    function syncPlayIcon() {
      playIcon.textContent = video.paused ? "play_arrow" : "pause";
    }

    function syncMuteIcon() {
      if (video.muted || video.volume === 0) muteIcon.textContent = "volume_off";
      else if (video.volume < 0.45) muteIcon.textContent = "volume_down";
      else muteIcon.textContent = "volume_up";
    }

    function syncProgress() {
      if (dragging) return;
      const pct = video.duration ? (video.currentTime / video.duration) * 1000 : 0;
      progress.value = String(pct);
      fill.style.width = (pct / 10) + "%";
      curEl.textContent = formatMediaTime(video.currentTime);
    }

    playBtn.addEventListener("click", () => {
      if (video.paused) video.play();
      else video.pause();
    });
    backBtn.addEventListener("click", () => {
      video.currentTime = Math.max(0, video.currentTime - 10);
    });
    fwdBtn.addEventListener("click", () => {
      video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
    });
    muteBtn.addEventListener("click", () => {
      video.muted = !video.muted;
      syncMuteIcon();
    });
    vol.addEventListener("input", () => {
      video.volume = Number(vol.value);
      video.muted = video.volume === 0;
      syncMuteIcon();
    });
    fsBtn.addEventListener("click", () => {
      if (!document.fullscreenElement) {
        (frame.requestFullscreen || frame.webkitRequestFullscreen || (() => {})).call(frame);
      } else {
        (document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document);
      }
    });
    progress.addEventListener("pointerdown", () => { dragging = true; });
    progress.addEventListener("pointerup", () => { dragging = false; });
    progress.addEventListener("input", () => {
      const pct = Number(progress.value) / 1000;
      fill.style.width = (pct * 100) + "%";
      if (video.duration) video.currentTime = pct * video.duration;
      curEl.textContent = formatMediaTime(video.currentTime);
    });

    video.addEventListener("play", () => {
      syncPlayIcon();
      frame.classList.remove("is-paused");
    });
    video.addEventListener("pause", () => {
      syncPlayIcon();
      frame.classList.add("is-paused");
    });
    frame.classList.add("is-paused");
    video.addEventListener("timeupdate", syncProgress);
    video.addEventListener("loadedmetadata", () => {
      durEl.textContent = formatMediaTime(video.duration);
      syncProgress();
    });
    video.addEventListener("volumechange", syncMuteIcon);
    video.addEventListener("click", () => {
      if (video.paused) video.play();
      else video.pause();
    });

    syncPlayIcon();
    syncMuteIcon();
  }

  /* ---------- Open items ---------- */


  async function onItemOpen(item) {
    if (selectMode) {
      toggleSelect(item.id);
      return;
    }
    if (currentView === "trash") {
      return;
    }
    if (item.kind === "folder") {
      setView("mydrive", item.id);
      return;
    }
    await openFileViewer(item);
  }


  function wireCustomAudioPlayer(stage, audio, objectUrl, fileName) {
    const playBtn = stage.querySelector(".a-play");
    const playIcon = playBtn.querySelector(".material-symbols-outlined");
    const backBtn = stage.querySelector(".a-back");
    const fwdBtn = stage.querySelector(".a-fwd");
    const progress = stage.querySelector(".a-progress");
    const fill = stage.querySelector(".a-progress-fill");
    const curEl = stage.querySelector(".a-current");
    const durEl = stage.querySelector(".a-duration");
    const bars = stage.querySelector(".audio-bars");
    const speedBtn = stage.querySelector(".a-speed-btn");
    const speedLabel = stage.querySelector(".a-speed-label");
    const speedMenu = stage.querySelector(".a-speed-menu");
    const downloadBtn = stage.querySelector(".a-download-btn");
    let dragging = false;

    function syncPlayIcon() {
      playIcon.textContent = audio.paused ? "play_arrow" : "pause";
      if (bars) bars.classList.toggle("playing", !audio.paused);
    }

    function syncProgress() {
      if (dragging) return;
      const pct = audio.duration ? (audio.currentTime / audio.duration) * 1000 : 0;
      progress.value = String(pct);
      fill.style.width = pct / 10 + "%";
      curEl.textContent = formatMediaTime(audio.currentTime);
    }

    playBtn.addEventListener("click", () => {
      if (audio.paused) audio.play();
      else audio.pause();
    });
    backBtn.addEventListener("click", () => {
      audio.currentTime = Math.max(0, audio.currentTime - 10);
    });
    fwdBtn.addEventListener("click", () => {
      audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10);
    });

    progress.addEventListener("pointerdown", () => {
      dragging = true;
    });
    progress.addEventListener("pointerup", () => {
      dragging = false;
    });
    progress.addEventListener("input", () => {
      const pct = Number(progress.value) / 1000;
      fill.style.width = pct * 100 + "%";
      if (audio.duration) audio.currentTime = pct * audio.duration;
      curEl.textContent = formatMediaTime(audio.currentTime);
    });

    audio.addEventListener("play", syncPlayIcon);
    audio.addEventListener("pause", syncPlayIcon);
    audio.addEventListener("ended", syncPlayIcon);
    audio.addEventListener("timeupdate", syncProgress);
    audio.addEventListener("loadedmetadata", () => {
      durEl.textContent = formatMediaTime(audio.duration);
      syncProgress();
    });

    // Playback speed menu
    speedBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      speedMenu.classList.toggle("show");
    });
    speedMenu.addEventListener("click", (e) => e.stopPropagation());
    speedMenu.querySelectorAll("button[data-speed]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const rate = Number(btn.dataset.speed);
        audio.playbackRate = rate;
        speedLabel.textContent = rate + "x";
        speedMenu.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        speedMenu.classList.remove("show");
      });
    });
    document.addEventListener("click", () => speedMenu.classList.remove("show"));

    // Download
    downloadBtn.addEventListener("click", () => {
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = fileName || "audio";
      document.body.appendChild(a);
      a.click();
      a.remove();
    });

    syncPlayIcon();
  }

  /** Resolve file blob from IndexedDB, or from server when logged in */
  async function getFileBlob(item) {
    if (!item || item.kind === "folder") return null;
    try {
      const record = await idbGet(item.id);
      if (record && record.blob) return record.blob;
    } catch (_) {}
    if (window.MiniDriveAPI && window.MiniDriveAPI.isServerAvailable()) {
      try {
        const blob = await window.MiniDriveAPI.downloadBlob(item.id);
        if (blob) {
          // cache in IndexedDB for faster next open
          try {
            await idbPut({
              id: item.id,
              blob: blob,
              name: item.name,
              type: item.mimeType || blob.type || "",
            });
          } catch (_) {}
          return blob;
        }
      } catch (err) {
        console.warn("Server download failed:", err && err.message);
        throw err;
      }
    }
    return null;
  }

  async function openFileViewer(item) {
    let blob = null;
    try {
      blob = await getFileBlob(item);
    } catch (err) {
      toast(
        "Cannot open",
        (err && err.message) || "Could not load file from server.",
        "error",
      );
      return;
    }
    if (!blob) {
      toast("Cannot open", "File data is missing. Try uploading again.", "error");
      return;
    }

    const modal = ensureViewerModal();
    const body = modal.querySelector(".viewer-body");
    const title = modal.querySelector(".viewer-title");
    title.textContent = item.name;
    body.innerHTML = "";
    body.className = "viewer-body";

    const url = URL.createObjectURL(blob);
    modal._objectUrl = url;

    const mime = item.mimeType || blob.type || "";

    if (mime.startsWith("image/")) {
      const img = el("img", "viewer-media");
      img.src = url;
      img.alt = item.name;
      body.appendChild(img);
    } else if (mime.startsWith("video/")) {
      body.classList.add("viewer-body-media");
      const stage = el("div", "media-stage media-stage-video");
      stage.innerHTML = `
        <div class="media-glow media-glow-video"></div>
        <div class="media-frame media-frame-video">
          <video class="viewer-video" playsinline></video>
          <div class="v-controls">
            <div class="v-progress-wrap">
              <input type="range" class="v-progress" min="0" max="1000" value="0" step="1" />
              <div class="v-progress-fill"></div>
            </div>
            <div class="v-bar">
              <div class="v-left">
                <button type="button" class="v-btn v-play" title="Play/Pause">
                  <span class="material-symbols-outlined">play_arrow</span>
                </button>
                <button type="button" class="v-btn v-back" title="Back 10s">
                  <span class="material-symbols-outlined">replay_10</span>
                </button>
                <button type="button" class="v-btn v-fwd" title="Forward 10s">
                  <span class="material-symbols-outlined">forward_10</span>
                </button>
                <div class="v-time-chip">
                  <span class="v-current">0:00</span>
                  <span class="v-time-sep">/</span>
                  <span class="v-duration">0:00</span>
                </div>
              </div>
              <div class="v-right">
                <button type="button" class="v-btn v-mute" title="Mute">
                  <span class="material-symbols-outlined">volume_up</span>
                </button>
                <input type="range" class="v-volume" min="0" max="1" step="0.05" value="1" title="Volume" />
                <button type="button" class="v-btn v-fs" title="Fullscreen">
                  <span class="material-symbols-outlined">fullscreen</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="media-meta">
          <span class="material-symbols-outlined media-meta-icon">movie</span>
          <div class="media-meta-text">
            <strong class="media-meta-name"></strong>
            <span class="media-meta-sub">Video playback</span>
          </div>
        </div>`;
      const video = stage.querySelector("video");
      video.src = url;
      stage.querySelector(".media-meta-name").textContent = item.name;
      wireCustomVideoPlayer(stage, video);
      video.play().catch(() => {});
      body.appendChild(stage);
    } else if (mime.startsWith("audio/")) {
      body.classList.add("viewer-body-media");
      const stage = el("div", "media-stage media-stage-audio");
      stage.innerHTML = `
        <div class="media-glow media-glow-audio"></div>
        <div class="audio-art">
          <div class="audio-art-ring"></div>
          <div class="audio-art-core">
            <span class="material-symbols-outlined">graphic_eq</span>
          </div>
          <div class="audio-bars" aria-hidden="true">
            <span></span><span></span><span></span><span></span><span></span>
          </div>
        </div>
        <div class="media-meta audio-meta">
          <strong class="media-meta-name"></strong>
          <span class="media-meta-sub">Now playing</span>
        </div>
        <div class="audio-player-shell">
          <audio class="viewer-audio"></audio>
          <div class="a-progress-wrap">
            <input type="range" class="a-progress" min="0" max="1000" value="0" step="1" />
            <div class="a-progress-fill"></div>
          </div>
          <div class="a-time-row">
            <span class="a-current">0:00</span>
            <span class="a-duration">0:00</span>
          </div>
          <div class="a-bar">
            <button type="button" class="a-btn a-back" title="Back 10s">
              <span class="material-symbols-outlined">replay_10</span>
            </button>
            <button type="button" class="a-btn a-play" title="Play/Pause">
              <span class="material-symbols-outlined">play_arrow</span>
            </button>
            <button type="button" class="a-btn a-fwd" title="Forward 10s">
              <span class="material-symbols-outlined">forward_10</span>
            </button>
          </div>
          <div class="a-actions">
            <div class="a-speed-wrap">
              <button type="button" class="a-action-btn a-speed-btn" title="Playback speed">
                <span class="material-symbols-outlined">speed</span>
                <span class="a-speed-label">1x</span>
              </button>
              <div class="a-speed-menu" role="menu">
                <button type="button" data-speed="0.5">0.5x</button>
                <button type="button" data-speed="0.75">0.75x</button>
                <button type="button" data-speed="1" class="active">1x</button>
                <button type="button" data-speed="1.25">1.25x</button>
                <button type="button" data-speed="1.5">1.5x</button>
                <button type="button" data-speed="2">2x</button>
              </div>
            </div>
            <button type="button" class="a-action-btn a-download-btn" title="Download">
              <span class="material-symbols-outlined">download</span>
              <span>Download</span>
            </button>
          </div>
        </div>`;
      const audio = stage.querySelector("audio");
      audio.src = url;
      stage.querySelector(".media-meta-name").textContent = item.name;
      wireCustomAudioPlayer(stage, audio, url, item.name);
      audio.play().catch(() => {});
      body.appendChild(stage);
    } else if (mime === "application/pdf" || item.name.toLowerCase().endsWith(".pdf")) {
      const iframe = el("iframe", "viewer-frame");
      iframe.src = url;
      iframe.title = item.name;
      body.appendChild(iframe);
    } else if (
      mime.startsWith("text/") ||
      /\.(txt|md|csv|json|js|css|html|py)$/i.test(item.name)
    ) {
      const text = await blob.text();
      const pre = el("pre", "viewer-text");
      pre.textContent = text.slice(0, 200000);
      body.appendChild(pre);
    } else {
      const wrap = el("div", "viewer-fallback");
      wrap.innerHTML = `
        <span class="material-symbols-outlined">draft</span>
        <p>Preview not available for this file type.</p>
        <a class="viewer-download" download="${item.name}">Download file</a>`;
      wrap.querySelector("a").href = url;
      body.appendChild(wrap);
    }

    // mark recent
    item.updatedAt = Date.now();
    saveMeta();

    modal.classList.add("show");
    document.body.classList.add("upload-open");
  }

  function closeViewer() {
    const modal = $("#fileViewerModal");
    if (!modal) return;
    modal.classList.remove("show");
    if (!document.querySelector(".upload-modal.show") &&
        !document.querySelector(".folder-create-modal.show")) {
      document.body.classList.remove("upload-open");
    }
    const body = modal.querySelector(".viewer-body");
    if (body) body.innerHTML = "";
    if (modal._objectUrl) {
      URL.revokeObjectURL(modal._objectUrl);
      modal._objectUrl = null;
    }
  }

  function ensureViewerModal() {
    let modal = $("#fileViewerModal");
    if (modal) return modal;
    modal = el("div", "file-viewer-modal");
    modal.id = "fileViewerModal";
    modal.innerHTML = `
      <div class="viewer-backdrop" data-close></div>
      <div class="viewer-panel">
        <div class="viewer-top">
          <h2 class="viewer-title">File</h2>
          <button type="button" class="viewer-close" aria-label="Close">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <div class="viewer-body"></div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector(".viewer-close").onclick = closeViewer;
    modal.querySelector("[data-close]").onclick = closeViewer;
    return modal;
  }

  /* ---------- Context menu ---------- */

  function ensureContextMenu() {
    let menu = $("#driveContextMenu");
    if (menu) return menu;
    menu = el("div", "drive-context-menu");
    menu.id = "driveContextMenu";
    menu.innerHTML = `
      <button type="button" data-action="open"><span class="material-symbols-outlined">open_in_new</span> Open</button>
      <button type="button" data-action="download"><span class="material-symbols-outlined">download</span> Download</button>
      <button type="button" data-action="rename"><span class="material-symbols-outlined">drive_file_rename_outline</span> Rename</button>
      <button type="button" data-action="star"><span class="material-symbols-outlined">star</span> <span class="star-label">Star</span></button>
      <button type="button" data-action="share"><span class="material-symbols-outlined">share</span> <span class="share-label">Share</span></button>
      <div class="ctx-divider"></div>
      <button type="button" data-action="delete" class="danger"><span class="material-symbols-outlined">delete</span> Move to trash</button>`;
    document.body.appendChild(menu);
    menu.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn || !contextTarget) return;
      const action = btn.dataset.action;
      const item = contextTarget;
      hideContextMenu();
      if (action === "open") onItemOpen(item);
      if (action === "download") downloadItem(item);
      if (action === "rename") openRename(item);
      if (action === "star") toggleStar(item.id);
      if (action === "share") toggleShare(item.id);
      if (action === "delete") moveToTrash(item.id);
    });
    document.addEventListener("click", hideContextMenu);
    return menu;
  }

  async function downloadItem(item) {
    if (!item || item.kind !== "file") {
      toast("Download", "Folders cannot be downloaded directly.");
      return;
    }
    toast("Downloading", item.name || "file…");
    try {
      const blob = await getFileBlob(item);
      if (!blob) {
        toast("Download failed", "File data was not found.", "error");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = item.name || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast("Downloaded", (item.name || "File") + " saved to your device.");
    } catch (err) {
      toast(
        "Download failed",
        (err && err.message) || "Could not download this file.",
        "error",
      );
    }
  }

  function openContextMenu(e, item) {
    const menu = ensureContextMenu();
    contextTarget = item;
    const starLabel = menu.querySelector(".star-label");
    const shareLabel = menu.querySelector(".share-label");
    if (starLabel) starLabel.textContent = item.starred ? "Unstar" : "Star";
    if (shareLabel)
      shareLabel.textContent = item.sharedWithMe ? "Shared with you" : "Share…";
    const dlBtn = menu.querySelector('[data-action="download"]');
    if (dlBtn) dlBtn.style.display = item.kind === "file" ? "" : "none";
    menu.classList.add("show");
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - 240);
    menu.style.left = x + "px";
    menu.style.top = y + "px";
  }

  function hideContextMenu() {
    const menu = $("#driveContextMenu");
    if (menu) menu.classList.remove("show");
    contextTarget = null;
  }

  /* ---------- Rename ---------- */

  function getNameParts(item) {
    if (!item || item.kind === "folder") {
      return { base: (item && item.name) || "", ext: "" };
    }
    const name = item.name || "";
    const dot = name.lastIndexOf(".");
    // Keep extension locked for normal files (e.g. report.pdf → base=report, ext=.pdf)
    if (dot > 0 && dot < name.length - 1) {
      return { base: name.slice(0, dot), ext: name.slice(dot) };
    }
    return { base: name, ext: "" };
  }

  function openRename(item) {
    let modal = $("#renameModal");
    if (!modal) {
      modal = el("div", "folder-create-modal");
      modal.id = "renameModal";
      modal.innerHTML = `
        <div class="folder-dialog">
          <div class="folder-dialog-header">
            <div class="folder-dialog-icon">
              <span class="material-symbols-outlined">drive_file_rename_outline</span>
            </div>
            <div>
              <h2>Rename</h2>
              <p id="renameHint">Enter a new name for this item.</p>
            </div>
          </div>
          <label class="folder-name-label" for="renameInput">Name</label>
          <div class="rename-input-row" id="renameInputRow">
            <input class="folder-name-input" id="renameInput" type="text" maxlength="120" />
            <span class="rename-ext-lock" id="renameExtLock" hidden></span>
          </div>
          <p class="folder-error" id="renameError"></p>
          <div class="folder-dialog-actions">
            <button class="dialog-btn cancel" type="button" id="renameCancel">Cancel</button>
            <button class="dialog-btn create" type="button" id="renameConfirm">Rename</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      modal.querySelector("#renameCancel").onclick = closeRename;
      modal.onclick = (e) => {
        if (e.target === modal) closeRename();
      };
    }
    modal._itemId = item.id;
    const parts = getNameParts(item);
    modal._lockedExt = parts.ext || "";
    const input = modal.querySelector("#renameInput");
    const extLock = modal.querySelector("#renameExtLock");
    const hint = modal.querySelector("#renameHint");
    input.value = parts.base;
    if (parts.ext) {
      extLock.hidden = false;
      extLock.textContent = parts.ext;
      if (hint) hint.textContent = "Rename the file. The extension stays the same.";
    } else {
      extLock.hidden = true;
      extLock.textContent = "";
      if (hint) hint.textContent = "Enter a new name for this item.";
    }
    modal.querySelector("#renameError").textContent = "";
    modal.classList.add("show");
    document.body.classList.add("upload-open");
    setTimeout(() => {
      input.focus();
      input.select();
    }, 50);
    modal.querySelector("#renameConfirm").onclick = () => confirmRename();
    input.onkeydown = (e) => {
      if (e.key === "Enter") confirmRename();
    };
  }

  function closeRename() {
    const modal = $("#renameModal");
    if (!modal) return;
    modal.classList.remove("show");
    if (!$(".upload-modal.show") && !$(".folder-create-modal.show")) {
      document.body.classList.remove("upload-open");
    }
  }

  function confirmRename() {
    const modal = $("#renameModal");
    const input = $("#renameInput");
    const err = $("#renameError");
    const id = modal && modal._itemId;
    const item = getItem(id);
    if (!item) return closeRename();
    let base = (input.value || "").trim();
    // Strip any extension user tried to type into the base field
    if (item.kind === "file" && modal._lockedExt) {
      const locked = modal._lockedExt.toLowerCase();
      if (base.toLowerCase().endsWith(locked)) {
        base = base.slice(0, -modal._lockedExt.length);
      }
      // Also strip a trailing dot-extension if user added another
      const dot = base.lastIndexOf(".");
      if (dot > 0) base = base.slice(0, dot);
      base = base.trim();
    }
    if (!base) {
      err.textContent = "Please enter a name.";
      return;
    }
    if (/[\\/:*?"<>|]/.test(base)) {
      err.textContent = 'Name cannot contain \\ / : * ? " < > or |';
      return;
    }
    const lockedExt = item.kind === "file" ? modal._lockedExt || "" : "";
    let name = base + lockedExt;
    const siblings = items.filter(
      (i) =>
        !i.trashed &&
        i.id !== id &&
        (i.parentId || null) === (item.parentId || null) &&
        i.name.toLowerCase() === name.toLowerCase(),
    );
    if (siblings.length) {
      err.textContent = "An item with this name already exists here.";
      return;
    }
    item.name = name;
    item.updatedAt = Date.now();
    saveMeta();
    closeRename();
    render();
    toast(tt("renamed"), tt("nowNamed", { name }));
  }

  /* ---------- Create / Upload API used by existing UI ---------- */

  async function createFolder(name, parentId) {
    parentId = parentId === undefined ? currentFolderId : parentId;
    if (currentView === "trash") parentId = null;

    name = (name || "").trim();
    if (!name) return { error: "Please enter a folder name." };
    if (/[\\/:*?"<>|]/.test(name))
      return { error: 'A folder name cannot contain \\ / : * ? " < > or |' };

    const exists = childrenOf(parentId).find(
      (i) =>
        i.kind === "folder" &&
        !i.trashed &&
        i.name.toLowerCase() === name.toLowerCase(),
    );
    if (exists) return { folder: exists };

    const folder = {
      id: createId(),
      kind: "folder",
      name,
      parentId: parentId || null,
      starred: false,
      shared: false,
      trashed: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (window.MiniDriveAPI && window.MiniDriveAPI.isServerAvailable()) {
      try {
        const serverItem = await window.MiniDriveAPI.createFolder(
          name,
          parentId || null,
        );
        if (serverItem && serverItem.id) {
          folder.id = serverItem.id;
          folder.createdAt = serverItem.createdAt
            ? Date.parse(serverItem.createdAt) || Date.now()
            : Date.now();
          folder.updatedAt = serverItem.updatedAt
            ? Date.parse(serverItem.updatedAt) || Date.now()
            : Date.now();
          folder.serverBacked = true;
        }
      } catch (err) {
        console.warn("Server folder create failed:", err && err.message);
        return {
          error: (err && err.message) || "Could not create folder on server.",
        };
      }
    }

    items.push(folder);
    saveMeta();
    if (currentView === "home") setView("mydrive", parentId || null);
    else render();
    notifyApp(
      "Folder created",
      "\u201c" + folder.name + "\u201d was added to your Drive.",
      "folder",
    );
    return { folder };
  }

  async function ensureFolderPath(pathParts, rootParentId) {
    let parentId = rootParentId || null;
    for (let i = 0; i < pathParts.length; i++) {
      const part = String(pathParts[i] || "").trim();
      if (!part) continue;
      const result = await createFolder(part, parentId);
      if (result.error || !result.folder) {
        throw new Error(result.error || "Could not create folder " + part);
      }
      parentId = result.folder.id;
    }
    return parentId;
  }

  async function addUploadedFiles(fileList, parentId) {
    parentId = parentId === undefined ? currentFolderId : parentId;
    if (
      currentView === "trash" ||
      currentView === "shared" ||
      currentView === "starred"
    )
      parentId = null;

    const SKIP_NAMES = {
      ".ds_store": 1,
      "thumbs.db": 1,
      "desktop.ini": 1,
      ".gitkeep": 1,
    };
    const files = Array.from(fileList || []).filter(function (file) {
      const n = String(file.name || "").toLowerCase();
      if (SKIP_NAMES[n]) return false;
      // Skip 0-byte placeholders (folders themselves never appear as File objects)
      if (!file.size) return false;
      return true;
    });
    let added = 0;
    let lastError = null;

    if (!files.length) return 0;

    // 1 GB quota — block when full (matches Supabase Free)
    const batchBytes = files.reduce(function (s, f) {
      return s + (Number(f.size) || 0);
    }, 0);
    if (!assertStorageSpace(batchBytes)) return 0;

    // Prefer server upload when logged in
    if (
      window.MiniDriveAPI &&
      window.MiniDriveAPI.isServerAvailable() &&
      files.length
    ) {
      try {
        // Group by folder path so nested folder uploads work
        const groups = {};
        for (const file of files) {
          const rel = String(file.webkitRelativePath || file.name || "");
          const parts = rel.split("/").filter(Boolean);
          let destParent = parentId || null;
          let fileName = file.name;
          if (parts.length > 1) {
            // path: Folder/sub/file.txt → ensure Folder/sub, upload file.txt
            fileName = parts[parts.length - 1];
            const folderParts = parts.slice(0, -1);
            destParent = await ensureFolderPath(folderParts, parentId || null);
          }
          const key = destParent || "__root__";
          if (!groups[key]) groups[key] = [];
          groups[key].push({ file: file, name: fileName, parentId: destParent });
        }

        for (const key of Object.keys(groups)) {
          const group = groups[key];
          const destParent = group[0].parentId || null;
          // Validate parent is a folder on server when set
          if (destParent) {
            const parentItem = getItem(destParent);
            if (!parentItem || parentItem.kind !== "folder") {
              lastError = new Error(
                "Parent folder not found. Try creating the folder first.",
              );
              continue;
            }
          }
          // Upload one file at a time so one failure does not drop the whole folder
          for (let gi = 0; gi < group.length; gi++) {
            const g = group[gi];
            let renamed;
            try {
              renamed = new File([g.file], g.name, {
                type: g.file.type || "application/octet-stream",
                lastModified: g.file.lastModified,
              });
            } catch (_) {
              renamed = g.file;
            }
            try {
              const serverItems = await window.MiniDriveAPI.uploadFiles(
                [renamed],
                destParent,
              );
              for (let i = 0; i < serverItems.length; i++) {
                const s = serverItems[i];
                const original = g.file;
                if (original) {
                  try {
                    await idbPut({
                      id: s.id,
                      blob: original,
                      name: s.name,
                      type: s.mimeType || original.type || "",
                    });
                  } catch (_) {}
                }
                items.push({
                  id: s.id,
                  kind: "file",
                  name: s.name,
                  parentId: s.parentId || destParent || null,
                  mimeType: s.mimeType || "",
                  size: s.size || 0,
                  starred: !!s.starred,
                  shared: !!s.shared,
                  trashed: !!s.trashed,
                  createdAt: s.createdAt
                    ? Date.parse(s.createdAt) || Date.now()
                    : Date.now(),
                  updatedAt: s.updatedAt
                    ? Date.parse(s.updatedAt) || Date.now()
                    : Date.now(),
                  serverBacked: true,
                });
                added++;
              }
            } catch (fileErr) {
              lastError = fileErr;
              console.warn(
                "File upload failed:",
                g.name,
                fileErr && fileErr.message,
              );
            }
          }
        }

        if (added) {
          saveMeta();
          if (currentView === "home") setView("mydrive", parentId || null);
          else render();
          notifyApp(
            added === 1 ? "File added" : "Files added",
            added === 1
              ? "1 file was uploaded to your Drive."
              : added + " files were uploaded to your Drive.",
            "add",
          );
        }
        if (lastError && !added) {
          toast(
            "Upload failed",
            (lastError && lastError.message) || "Could not upload to server.",
            "error",
          );
        } else if (lastError && added) {
          toast(
            "Partial upload",
            added +
              " file(s) uploaded; some failed: " +
              ((lastError && lastError.message) || "error"),
            "error",
          );
        }
        return added;
      } catch (err) {
        console.warn("Server upload failed:", err && err.message);
        toast(
          "Upload failed",
          (err && err.message) || "Could not upload to server.",
          "error",
        );
        // fall through to local only if no server items added
        if (added) return added;
      }
    }

    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        toast(
          "File too large",
          file.name + " is over the size limit.",
          "error",
        );
        continue;
      }
      let destParent = parentId || null;
      const rel = String(file.webkitRelativePath || "");
      const parts = rel.split("/").filter(Boolean);
      if (parts.length > 1) {
        try {
          destParent = await ensureFolderPath(
            parts.slice(0, -1),
            parentId || null,
          );
        } catch (e) {
          toast("Folder error", e.message || "Could not create folders.");
          continue;
        }
      }
      const id = createId();
      try {
        await idbPut({
          id: id,
          blob: file,
          name: file.name,
          type: file.type,
        });
      } catch (err) {
        toast("Storage error", "Could not save " + file.name + ".");
        continue;
      }
      items.push({
        id: id,
        kind: "file",
        name: parts.length ? parts[parts.length - 1] : file.name,
        parentId: destParent || null,
        mimeType: file.type || "",
        size: file.size,
        starred: false,
        shared: false,
        trashed: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      added++;
    }
    if (added) {
      saveMeta();
      if (currentView === "home") setView("mydrive", parentId || null);
      else render();
    }
    return added;
  }


  /* ---------- Trash / recover / permanent ---------- */

  async function moveToTrash(id) {
    const item = getItem(id);
    if (!item) return;
    const prefs = getSettings();
    if (prefs.confirmBeforeDelete !== false) {
      const ok = await showConfirm({
        title: tt("moveToTrashTitle"),
        message: tt("moveToTrashMsg", { name: item.name }),
        confirmText: tt("moveToTrashBtn"),
        cancelText: tt("cancel"),
        icon: "delete",
        danger: false,
      });
      if (!ok) return;
    }
    item.trashed = true;
    item.trashedAt = Date.now();
    item.originalParentId = item.parentId || null;
    if (item.kind === "folder") trashDescendants(id);
    item.updatedAt = Date.now();
    saveMeta();
    render();
    toast(
      tt("movedToTrash"),
      tt("movedToTrashMsg", { name: item.name }),
    );
    notifyApp(
      "Moved to Trash",
      "“" + item.name + "” was deleted and moved to Trash.",
      "delete",
    );
    if (window.MiniDriveAPI && window.MiniDriveAPI.isServerAvailable()) {
      window.MiniDriveAPI.patchFile(id, { trashed: true }).catch(function (err) {
        console.warn("Server trash failed:", err && err.message);
      });
    }
  }

  function trashDescendants(folderId) {
    items
      .filter((i) => !i.trashed && i.parentId === folderId)
      .forEach((child) => {
        child.trashed = true;
        child.trashedAt = Date.now();
        child.originalParentId = child.parentId;
        if (child.kind === "folder") trashDescendants(child.id);
      });
  }

  function recoverItem(id) {
    const item = getItem(id);
    if (!item) return;
    // restore parent if possible and not trashed
    let parent = item.originalParentId || null;
    if (parent) {
      const p = getItem(parent);
      if (!p || p.trashed) parent = null;
    }
    // avoid name clash
    item.name = uniqueName(item.name, parent, item.kind, item.id);
    item.parentId = parent;
    item.trashed = false;
    delete item.trashedAt;
    item.updatedAt = Date.now();

    // recover direct children that were trashed with it (same trashedAt window optional - recover nested)
    recoverDescendants(id);
    saveMeta();
    render();
    toast(tt("recovered"), tt("recoveredMsg", { name: item.name, place: parent ? tt("itsFolder") : tt("myDrivePlace") }));
    notifyApp("Recovered", "“" + item.name + "” was restored from Trash.", "add");
    if (window.MiniDriveAPI && window.MiniDriveAPI.isServerAvailable()) {
      window.MiniDriveAPI.patchFile(id, {
        trashed: false,
        parentId: parent || null,
        name: item.name,
      }).catch(function (err) {
        console.warn("Server recover failed:", err && err.message);
      });
    }
  }

  function recoverDescendants(folderId) {
    items
      .filter((i) => i.trashed && i.originalParentId === folderId)
      .forEach((child) => {
        child.parentId = folderId;
        child.trashed = false;
        delete child.trashedAt;
        child.updatedAt = Date.now();
        if (child.kind === "folder") recoverDescendants(child.id);
      });
  }

  function uniqueName(name, parentId, kind, excludeId) {
    const base = name;
    let candidate = base;
    let n = 1;
    while (
      items.some(
        (i) =>
          !i.trashed &&
          i.id !== excludeId &&
          (i.parentId || null) === (parentId || null) &&
          i.name.toLowerCase() === candidate.toLowerCase(),
      )
    ) {
      const dot = base.lastIndexOf(".");
      if (kind === "file" && dot > 0) {
        candidate = `${base.slice(0, dot)} (${n})${base.slice(dot)}`;
      } else {
        candidate = `${base} (${n})`;
      }
      n++;
    }
    return candidate;
  }

  async function permanentDelete(id) {
    const item = getItem(id);
    if (!item) return;
    const prefs = getSettings();
    if (prefs.confirmPermanentDelete !== false) {
      const ok = await showConfirm({
        title: tt("deletePermTitle"),
        message: tt("deletePermMsg", { name: item.name }),
        confirmText: tt("deleteForever"),
        cancelText: tt("cancel"),
        icon: "warning",
        danger: true,
      });
      if (!ok) return;
    }

    await permanentDeleteIds([id]);
    toast(tt("deletedPermanently"), tt("removedForever", { name: item.name }));
    notifyApp(
      "Deleted permanently",
      "“" + item.name + "” was permanently removed.",
      "delete",
    );
  }

  async function permanentDeleteIds(ids) {
    const toRemove = [];
    ids.forEach((id) => {
      toRemove.push(id);
      const item = getItem(id);
      if (item && item.kind === "folder") collectDescendantIds(id, toRemove);
    });
    const unique = [...new Set(toRemove)];
    for (const rid of unique) {
      try {
        await idbDelete(rid);
      } catch (e) {
        /* ignore */
      }
    }
    items = items.filter((i) => !unique.includes(i.id));
    selectedIds = new Set([...selectedIds].filter((id) => !unique.includes(id)));
    saveMeta();
    render();
    if (window.MiniDriveAPI && window.MiniDriveAPI.isServerAvailable() && unique.length) {
      window.MiniDriveAPI.purgeFiles(unique).catch(function (err) {
        console.warn("Server purge failed:", err && err.message);
      });
    }
  }

  function toggleSelect(id) {
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
    render();
  }

  
  function canBulkSelect() {
    return (
      currentView === "mydrive" ||
      currentView === "home" ||
      currentView === "shared" ||
      currentView === "starred" ||
      currentView === "recent"
    );
  }

  function renderDriveSelectToolbar(total) {
    let host = $("#driveSelectHost");
    if (!host && canBulkSelect()) {
      const bc = $("#driveBreadcrumb");
      if (bc) {
        host = el("div", "drive-select-host");
        host.id = "driveSelectHost";
        bc.appendChild(host);
      }
    }
    if (!host) {
      // create floating bar under breadcrumb for home/shared/etc
      if (!canBulkSelect() || currentView === "trash") return;
      const bc = $("#driveBreadcrumb");
      if (!bc) return;
      host = el("div", "drive-select-host");
      host.id = "driveSelectHost";
      bc.appendChild(host);
    }

    if (!canBulkSelect() || total === 0) {
      host.innerHTML = "";
      host.style.display = "none";
      return;
    }
    host.style.display = "block";
    if (!selectMode) {
      host.innerHTML = `
        <div class="trash-toolbar drive-bulk-toolbar">
          <button type="button" class="trash-tool-btn" data-act="select">
            <span class="material-symbols-outlined">check_box</span> Select
          </button>
        </div>`;
    } else {
      const n = selectedIds.size;
      host.innerHTML = `
        <div class="trash-toolbar drive-bulk-toolbar">
          <div class="drive-bulk-left">
            <button type="button" class="trash-tool-btn" data-act="cancel-select">
              <span class="material-symbols-outlined">close</span> Cancel
            </button>
            <button type="button" class="trash-tool-btn" data-act="select-all">
              <span class="material-symbols-outlined">select_all</span> Select all
            </button>
            <span class="trash-select-count">${n} selected</span>
          </div>
          <div class="drive-bulk-right">
            <button type="button" class="trash-tool-btn" data-act="move-selected" ${n ? "" : "disabled"}>
              <span class="material-symbols-outlined">drive_file_move</span> Move to folder
            </button>
            <button type="button" class="trash-tool-btn danger" data-act="trash-selected" ${n ? "" : "disabled"}>
              <span class="material-symbols-outlined">delete</span> Move to Trash
            </button>
          </div>
        </div>`;
    }
    host.querySelectorAll("button[data-act]").forEach((btn) => {
      btn.addEventListener("click", () => handleDriveSelectToolbar(btn.dataset.act));
    });
  }

  function handleDriveSelectToolbar(act) {
    if (act === "select") {
      selectMode = true;
      selectedIds = new Set();
      render();
      return;
    }
    if (act === "cancel-select") {
      selectMode = false;
      selectedIds = new Set();
      render();
      return;
    }
    if (act === "select-all") {
      const data = itemsForCurrentView();
      let list = [];
      if (data && data.isHome) {
        list = [...(data.folders || []), ...(data.recent || [])];
      } else if (Array.isArray(data)) {
        list = data;
      }
      selectedIds = new Set(list.map((i) => i.id));
      render();
      return;
    }
    if (act === "trash-selected") {
      const ids = [...selectedIds];
      if (!ids.length) return;
      showConfirm({
        title: "Move to Trash?",
        message:
          ids.length +
          " selected item(s) will be moved to Trash. You can recover them later.",
        confirmText: "Move to Trash",
        cancelText: "Cancel",
        icon: "delete",
      }).then(async (ok) => {
        if (!ok) return;
        for (const id of ids) {
          await moveToTrashSilent(id);
        }
        selectMode = false;
        selectedIds = new Set();
        saveMeta();
        render();
        toast("Moved to Trash", ids.length + " item(s) moved to Trash.");
        notifyApp(
          "Moved to Trash",
          ids.length + " selected item(s) were moved to Trash.",
          "delete",
        );
      });
      return;
    }
    if (act === "move-selected") {
      const ids = [...selectedIds];
      if (!ids.length) return;
      openMoveToFolderModal(ids);
    }
  }

  function moveToTrashSilent(id) {
    const item = getItem(id);
    if (!item || item.trashed) return;
    item.trashed = true;
    item.trashedAt = Date.now();
    item.originalParentId = item.parentId || null;
    if (item.kind === "folder") trashDescendants(id);
    item.updatedAt = Date.now();
  }

  function openMoveToFolderModal(ids) {
    const blockedIds = new Set(ids);
    ids.forEach((id) => {
      const item = getItem(id);
      if (item && item.kind === "folder") {
        const acc = [];
        collectDescendantIds(id, acc);
        acc.forEach((x) => blockedIds.add(x));
      }
    });

    const folders = activeItems().filter(
      (i) => i.kind === "folder" && !blockedIds.has(i.id),
    );

    function shortName(name, max) {
      max = max || 22;
      const s = String(name || "");
      if (s.length <= max) return s;
      return s.slice(0, max - 1) + "…";
    }

    // Always rebuild modal so structure stays correct
    let modal = document.getElementById("moveFolderModal");
    if (modal) modal.remove();
    modal = document.createElement("div");
    modal.id = "moveFolderModal";
    modal.className = "drive-confirm-modal";
    modal.innerHTML = `
        <div class="drive-confirm-backdrop" data-move-close></div>
        <div class="drive-confirm-panel" role="dialog" style="max-width:440px;text-align:left">
          <div class="drive-confirm-icon-wrap" style="margin:0 auto 12px">
            <span class="material-symbols-outlined drive-confirm-icon">drive_file_move</span>
          </div>
          <h3 class="drive-confirm-title" style="text-align:center">Move to folder</h3>
          <p class="drive-confirm-message" style="text-align:center" id="moveFolderMsg"></p>
          <button type="button" class="move-folder-item" id="moveRootOption">
            <span class="material-symbols-outlined folder-ico">home</span>
            <span class="folder-name">My Drive (root)</span>
            <span class="material-symbols-outlined tick-ico">check_circle</span>
          </button>
          <div id="moveFolderList" class="move-folder-list"></div>
          <div class="drive-confirm-actions" style="margin-top:14px">
            <button type="button" class="drive-confirm-cancel" data-move-close>Cancel</button>
            <button type="button" class="drive-confirm-ok move-dest-btn" id="moveConfirmBtn" disabled>Not selected</button>
          </div>
        </div>`;
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-move-close]").forEach((n) => {
      n.onclick = () => {
        modal.classList.remove("show");
        document.body.classList.remove("upload-open");
      };
    });

    let selectedDest = null;
    let selectedLabel = "";
    const confirmBtn = modal.querySelector("#moveConfirmBtn");
    const rootOpt = modal.querySelector("#moveRootOption");
    const list = modal.querySelector("#moveFolderList");

    function updateConfirmBtn() {
      if (!selectedDest) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = "Not selected";
        confirmBtn.title = "Not selected";
      } else {
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Move to " + shortName(selectedLabel, 18);
        confirmBtn.title = "Move to " + selectedLabel;
      }
    }

    function clearSelectionUI() {
      modal.querySelectorAll(".move-folder-item").forEach((el) => {
        el.classList.remove("selected");
      });
    }

    function selectDest(key, label, el) {
      selectedDest = key;
      selectedLabel = label;
      clearSelectionUI();
      if (el) el.classList.add("selected");
      updateConfirmBtn();
    }

    modal.querySelector("#moveFolderMsg").textContent =
      "Choose a destination for " + ids.length + " item(s).";

    rootOpt.onclick = () => selectDest("root", "My Drive (root)", rootOpt);

    list.innerHTML = "";
    if (!folders.length) {
      list.innerHTML =
        '<p style="text-align:center;color:#64748b;font-size:13px;padding:8px">No other folders yet. You can select My Drive (root).</p>';
    } else {
      folders
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((f) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "move-folder-item";
          btn.innerHTML =
            '<span class="material-symbols-outlined folder-ico">folder</span>' +
            '<span class="folder-name"></span>' +
            '<span class="material-symbols-outlined tick-ico">check_circle</span>';
          btn.querySelector(".folder-name").textContent = f.name;
          btn.title = f.name;
          btn.onclick = () => selectDest(f.id, f.name, btn);
          list.appendChild(btn);
        });
    }

    confirmBtn.onclick = () => {
      if (!selectedDest) return;
      const targetParentId = selectedDest === "root" ? null : selectedDest;
      ids.forEach((id) => {
        const item = getItem(id);
        if (!item) return;
        if (id === targetParentId) return;
        item.parentId = targetParentId;
        item.updatedAt = Date.now();
        item.name = uniqueName(item.name, item.parentId, item.kind, item.id);
      });
      saveMeta();
      selectMode = false;
      selectedIds = new Set();
      modal.classList.remove("show");
      document.body.classList.remove("upload-open");
      render();
      toast("Moved", ids.length + " item(s) moved to " + selectedLabel + ".");
      notifyApp(
        "Items moved",
        ids.length + " item(s) moved to " + selectedLabel + ".",
        "folder",
      );
    };

    updateConfirmBtn();
    modal.classList.add("show");
    document.body.classList.add("upload-open");
  }

  function handleTrashToolbar(act) {
    if (act === "select") {
      selectMode = true;
      selectedIds = new Set();
      render();
      return;
    }
    if (act === "cancel-select") {
      selectMode = false;
      selectedIds = new Set();
      render();
      return;
    }
    if (act === "select-all-trash") {
      selectedIds = new Set(trashedItems().map((i) => i.id));
      render();
      return;
    }
    if (act === "recover-all") {
      const list = trashedItems();
      if (!list.length) return;
      showConfirm({
        title: tt("recoverAllTitle"),
        message: tt("recoverAllMsg", { n: list.length }),
        confirmText: tt("recoverAllBtn"),
        cancelText: tt("cancel"),
        icon: "restore_from_trash",
      }).then((ok) => {
        if (!ok) return;
        list.forEach((item) => recoverItemSilent(item.id));
        saveMeta();
        selectMode = false;
        selectedIds = new Set();
        render();
        toast(tt("recovered"), tt("recoveredCount", { n: list.length }));
      });
      return;
    }
    if (act === "empty") {
      const list = trashedItems();
      if (!list.length) return;
      showConfirm({
        title: tt("emptyTrashTitle"),
        message: tt("emptyTrashMsg", { n: list.length }),
        confirmText: tt("emptyTrashBtn"),
        cancelText: tt("cancel"),
        icon: "warning",
        danger: true,
      }).then((ok) => {
        if (!ok) return;
        permanentDeleteIds(list.map((i) => i.id)).then(() => {
          selectMode = false;
          selectedIds = new Set();
          toast(tt("trashEmptied"), tt("allDeleted"));
        });
      });
      return;
    }
    if (act === "recover-selected") {
      const ids = [...selectedIds];
      if (!ids.length) return;
      ids.forEach((id) => recoverItemSilent(id));
      saveMeta();
      selectMode = false;
      selectedIds = new Set();
      render();
      toast(tt("recovered"), tt("recoveredCount", { n: ids.length }));
      return;
    }
    if (act === "delete-selected") {
      const ids = [...selectedIds];
      if (!ids.length) return;
      showConfirm({
        title: tt("deletePermTitle"),
        message: tt("deleteSelectedMsg", { n: ids.length }),
        confirmText: tt("deleteForever"),
        cancelText: tt("cancel"),
        icon: "warning",
        danger: true,
      }).then((ok) => {
        if (!ok) return;
        permanentDeleteIds(ids).then(() => {
          selectMode = false;
          selectedIds = new Set();
          toast(tt("deletedPermanently"), tt("removedCount", { n: ids.length }));
        });
      });
    }
  }

  function recoverItemSilent(id) {
    const item = getItem(id);
    if (!item || !item.trashed) return;
    let parent = item.originalParentId || null;
    if (parent) {
      const p = getItem(parent);
      if (!p || p.trashed) parent = null;
    }
    item.name = uniqueName(item.name, parent, item.kind, item.id);
    item.parentId = parent;
    item.trashed = false;
    delete item.trashedAt;
    item.updatedAt = Date.now();
    recoverDescendants(id);
  }

  function collectDescendantIds(folderId, acc) {
    items
      .filter((i) => i.parentId === folderId)
      .forEach((c) => {
        acc.push(c.id);
        if (c.kind === "folder") collectDescendantIds(c.id, acc);
      });
  }

  function toggleStar(id) {
    const item = getItem(id);
    if (!item) return;
    item.starred = !item.starred;
    item.updatedAt = Date.now();
    saveMeta();
    render();
    toast(item.starred ? tt("starred") : tt("removedStar"), item.name);
    if (window.MiniDriveAPI && window.MiniDriveAPI.isServerAvailable()) {
      window.MiniDriveAPI.patchFile(id, { starred: item.starred }).catch(function (err) {
        console.warn("Server star failed:", err && err.message);
      });
    }
  }

  function mapServerItem(s) {
    return {
      id: s.id,
      kind: s.kind === "folder" ? "folder" : "file",
      name: s.name,
      parentId: s.parentId || null,
      mimeType: s.mimeType || "",
      size: s.size || 0,
      starred: !!s.starred,
      shared: !!s.shared,
      trashed: !!s.trashed,
      trashedAt: s.trashedAt ? Date.parse(s.trashedAt) || null : null,
      createdAt: s.createdAt ? Date.parse(s.createdAt) || Date.now() : Date.now(),
      updatedAt: s.updatedAt ? Date.parse(s.updatedAt) || Date.now() : Date.now(),
      serverBacked: true,
      sharedWithMe: !!s.sharedWithMe,
      ownerId: s.ownerId || null,
      ownerEmail: s.ownerEmail || "",
      ownerName: s.ownerName || "",
      sharedWith: Array.isArray(s.sharedWith) ? s.sharedWith : [],
    };
  }

  function openShareDialog(item) {
    if (!item) return;
    if (item.sharedWithMe) {
      toast("Shared with you", "Only the owner can manage sharing.");
      return;
    }
    if (!window.MiniDriveAPI || !MiniDriveAPI.isServerAvailable()) {
      // Offline fallback: mark as shared locally
      item.shared = !item.shared;
      item.updatedAt = Date.now();
      saveMeta();
      render();
      toast(item.shared ? tt("markedShared") : tt("removedShared"), item.name);
      return;
    }

    let modal = document.getElementById("shareModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "shareModal";
      modal.className = "share-modal";
      modal.innerHTML =
        '<div class="share-modal-backdrop" data-close></div>' +
        '<div class="share-modal-panel" role="dialog" aria-modal="true">' +
        '<h3>Share “<span data-name></span>”</h3>' +
        '<p class="share-hint">Enter the email of another Mini Drive account.</p>' +
        '<input type="email" id="shareEmailInput" placeholder="friend@email.com" autocomplete="email" />' +
        '<div class="share-people" id="sharePeopleList"></div>' +
        '<div class="share-modal-actions">' +
        '<button type="button" class="share-cancel" data-close>Cancel</button>' +
        '<button type="button" class="share-submit" id="shareSubmitBtn">Share</button>' +
        "</div></div>";
      document.body.appendChild(modal);
      modal.addEventListener("click", function (e) {
        if (e.target.closest("[data-close]")) {
          modal.classList.remove("open");
        }
      });
      const submit = modal.querySelector("#shareSubmitBtn");
      submit.addEventListener("click", async function () {
        const input = modal.querySelector("#shareEmailInput");
        const email = (input && input.value || "").trim().toLowerCase();
        if (!email) {
          toast("Email required", "Enter a Mini Drive user email.");
          return;
        }
        const myEmail = (
          (window.MiniDriveAuth &&
            MiniDriveAuth.getSession &&
            MiniDriveAuth.getSession() &&
            MiniDriveAuth.getSession().email) ||
          ""
        )
          .trim()
          .toLowerCase();
        if (myEmail && email === myEmail) {
          toast(
            "Cannot share with yourself",
            "Sign in as the other account in another browser/profile, or enter that account email.",
          );
          return;
        }
        submit.disabled = true;
        try {
          const data = await MiniDriveAPI.shareFile(modal._itemId, email);
          const updated = data && data.item;
          const local = getItem(modal._itemId);
          if (local && updated) {
            local.shared = true;
            local.sharedWith = data.sharedWith || updated.sharedWith || [];
            local.updatedAt = Date.now();
            // Mark nested items shared locally so UI matches server recursive share
            if (local.kind === "folder") {
              (function markTree(pid) {
                items.forEach(function (ch) {
                  if ((ch.parentId || null) === (pid || null) && !ch.trashed) {
                    ch.shared = true;
                    if (ch.kind === "folder") markTree(ch.id);
                  }
                });
              })(local.id);
            }
            saveMeta();
          }
          toast(
            "Shared",
            (local && local.kind === "folder" ? "Folder" : "Item") +
              " shared with " +
              email,
          );
          if (window.DriveNotifications) {
            DriveNotifications.push({
              title:
                local && local.kind === "folder"
                  ? "You shared a folder"
                  : "You shared a file",
              message: "“" + (local && local.name) + "” → " + email,
              kind: "share",
            });
          }
          renderSharePeople(modal, local);
          if (input) input.value = "";
          render();
        } catch (err) {
          toast("Share failed", (err && err.message) || "Could not share.");
        }
        submit.disabled = false;
      });
    }
    modal._itemId = item.id;
    modal.querySelector("[data-name]").textContent = item.name || "item";
    const input = modal.querySelector("#shareEmailInput");
    if (input) input.value = "";
    renderSharePeople(modal, item);
    modal.classList.add("open");
    // refresh people list from server
    if (MiniDriveAPI.listShares) {
      MiniDriveAPI.listShares(item.id)
        .then(function (people) {
          item.sharedWith = people;
          renderSharePeople(modal, item);
        })
        .catch(function () {});
    }
  }

  function renderSharePeople(modal, item) {
    const box = modal.querySelector("#sharePeopleList");
    if (!box) return;
    const people = (item && item.sharedWith) || [];
    if (!people.length) {
      box.innerHTML = '<p class="share-empty">Not shared with anyone yet.</p>';
      return;
    }
    box.innerHTML =
      '<p class="share-people-label">People with access</p>' +
      people
        .map(function (p) {
          const em = p.email || "";
          return (
            '<div class="share-person">' +
            '<span class="share-person-email">' +
            em.replace(/</g, "&lt;") +
            "</span>" +
            '<button type="button" class="share-remove" data-email="' +
            em.replace(/"/g, "&quot;") +
            '">Remove</button></div>'
          );
        })
        .join("");
    box.querySelectorAll(".share-remove").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        const email = btn.getAttribute("data-email");
        try {
          const data = await MiniDriveAPI.unshareFile(item.id, email);
          item.sharedWith = (data && data.sharedWith) || [];
          item.shared = item.sharedWith.length > 0;
          saveMeta();
          renderSharePeople(modal, item);
          render();
          toast("Access removed", email);
        } catch (err) {
          toast("Failed", (err && err.message) || "Could not remove access.");
        }
      });
    });
  }

  function toggleShare(id) {
    const item = getItem(id);
    if (!item) return;
    openShareDialog(item);
  }

  /* ---------- Storage bar ---------- */

  function getUsedStorageBytes() {
    return items
      .filter((i) => i.kind === "file" && !i.trashed)
      .reduce((s, i) => s + (Number(i.size) || 0), 0);
  }

  function updateStorageBar() {
    const used = getUsedStorageBytes();
    const quota = STORAGE_QUOTA_BYTES;
    const pct = Math.min(100, (used / quota) * 100);
    const bar = document.querySelector(".storage .progress div");
    const label = document.querySelector(".storage p");
    if (bar) {
      bar.style.width = (used > 0 ? Math.max(pct, 1.5) : 0) + "%";
      bar.style.minWidth = used > 0 ? "4px" : "0";
    }
    if (label) {
      label.textContent = (formatSize(used) || "0 B") + " of 1 GB used";
    }
  }

  function assertStorageSpace(extraBytes) {
    const used = getUsedStorageBytes();
    const need = Number(extraBytes) || 0;
    if (used + need > STORAGE_QUOTA_BYTES) {
      const left = Math.max(0, STORAGE_QUOTA_BYTES - used);
      toast(
        "Storage is full",
        "You have used " +
          (formatSize(used) || "0 B") +
          " of 1 GB. Only " +
          (formatSize(left) || "0 B") +
          " free. Delete files or free space to upload more.",
        "error",
      );
      return false;
    }
    return true;
  }

  /* ---------- Public API + hooks into existing UI ---------- */

  async function purgeTrashByAge() {
    const s = getSettings();
    const days = Number(s.autoDeleteDays || 0);
    if (!days) return;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const doomed = trashedItems().filter(
      (i) => (i.trashedAt || 0) && i.trashedAt < cutoff,
    );
    if (!doomed.length) return;
    await permanentDeleteIds(doomed.map((i) => i.id));
  }

  async function emptyTrashFromSettings() {
    const list = trashedItems();
    if (!list.length) {
      toast(tt("trashIsEmpty"), tt("nothingToDelete"));
      return;
    }
    const prefs = getSettings();
    if (prefs.confirmPermanentDelete !== false) {
      const ok = await showConfirm({
        title: tt("emptyTrashTitle"),
        message: tt("emptyTrashMsg", { n: list.length }),
        confirmText: tt("emptyTrashBtn"),
        cancelText: tt("cancel"),
        icon: "warning",
        danger: true,
      });
      if (!ok) return;
    }
    await permanentDeleteIds(list.map((i) => i.id));
    toast(tt("trashEmptied"), tt("allDeleted"));
  }

  window.DriveApp = {
    init,
    setView,
    createFolder,
    addUploadedFiles,
    getCurrentFolderId: () => currentFolderId,
    getItems: () => items.slice(),
    getUsedStorageBytes,
    STORAGE_QUOTA_BYTES,
    render,
    purgeTrashByAge,
    emptyTrashFromSettings,
    showConfirm,
  };

  // Override existing globals used by the page
  window.createNewFolder = async function () {
    const input = document.getElementById("folderNameInput");
    const err = document.getElementById("folderNameError");
    const name = input ? input.value.trim() : "";
    const result = await createFolder(name);
    if (result.error) {
      if (err) {
        err.textContent = result.error;
        if (input) input.focus();
      }
      return;
    }
    if (typeof closeCreateFolderModal === "function") closeCreateFolderModal();
    toast(tt("folderCreated"), tt("folderAdded", { name: result.folder.name }));
  };

  // Hook upload completion: existing uploadFiles will call these if we patch
  window.DriveAppSaveFiles = addUploadedFiles;

  async function init() {
    try {
      db = await openDB();
    } catch (err) {
      console.error(err);
      const msg =
        location.protocol === "file:"
          ? "Safari may block storage when opening the file directly. Run a local server and open http://localhost instead of a file:// page."
          : "Could not open local storage. In Safari Private Browsing, try a normal window.";
      if (typeof showToast === "function") {
        showToast("Storage unavailable", msg, "error", 8000);
      } else if (typeof toast === "function") {
        toast("Storage unavailable", msg, "error");
      } else {
        console.warn(msg);
      }
      db = null;
    }
    // Hard reset — never keep previous account's in-memory list
    items = [];
    currentFolderId = null;
    selectMode = false;
    selectedIds = new Set();
    folderHistory = [null];
    historyIndex = 0;

    switchUserStorage();
    const myEmail = getLoggedInEmail();

    // Verify session with server so token always matches the email on screen
    if (window.MiniDriveAPI && window.MiniDriveAPI.isServerAvailable()) {
      try {
        if (window.MiniDriveAPI.request) {
          const me = await window.MiniDriveAPI.request("/api/auth/me");
          if (me && me.user) {
            const serverEmail = String(me.user.email || "")
              .trim()
              .toLowerCase();
            if (serverEmail && myEmail && serverEmail !== myEmail) {
              console.warn(
                "Session mismatch: local",
                myEmail,
                "server",
                serverEmail,
                "— using server identity",
              );
            }
            if (window.MiniDriveAuth && MiniDriveAuth.saveSession) {
              const tok =
                (MiniDriveAuth.getSession && MiniDriveAuth.getSession()) || {};
              MiniDriveAuth.saveSession({
                id: me.user.id,
                email: me.user.email,
                name: me.user.name,
                picture: me.user.picture,
                provider: me.user.provider,
                token: tok.token || localStorage.getItem("miniDriveAuthToken"),
              });
            }
            switchUserStorage();
          }
        }

        let own = [];
        let sharedWithMe = [];
        if (window.MiniDriveAPI.listFilesPack) {
          const pack = await window.MiniDriveAPI.listFilesPack();
          own = pack.items || [];
          sharedWithMe = pack.sharedWithMe || [];
        } else {
          own = (await window.MiniDriveAPI.listFiles()) || [];
        }

        const sessionEmail = getLoggedInEmail();
        // Own files only (ignore any accidental cross-user payload)
        const mappedOwn = own.map(mapServerItem).filter(function (it) {
          if (it.sharedWithMe) return false;
          if (it.ownerEmail) {
            return (
              String(it.ownerEmail).trim().toLowerCase() === sessionEmail
            );
          }
          return true; // server already scoped by JWT
        });
        const mappedShared = sharedWithMe.map(mapServerItem).filter(function (it) {
          return !!it.sharedWithMe;
        });

        const byId = {};
        mappedOwn.forEach(function (it) {
          byId[it.id] = it;
        });
        mappedShared.forEach(function (it) {
          byId[it.id] = it;
        });
        items = Object.keys(byId).map(function (k) {
          return byId[k];
        });
        saveMeta();
      } catch (err) {
        console.warn("Could not load files from server:", err && err.message);
        // Do NOT fall back to another account's cache
        items = [];
        try {
          loadMeta();
          // Only keep local cache if it was keyed to this exact user
          if (currentUserKey !== getLoggedInEmail() && currentUserKey !== "guest") {
            items = [];
          }
        } catch (_) {
          items = [];
        }
      }
    } else {
      if (!myEmail) {
        items = [];
      } else {
        loadMeta();
      }
    }

    // Clear demo cards from HTML if still present
    const qa = document.getElementById("quickAccessContainer");
    const rf = document.getElementById("recentFilesContainer");
    if (qa) qa.innerHTML = "";
    if (rf) rf.innerHTML = "";

    // Menu navigation
    document.querySelectorAll(".menu li").forEach((li) => {
      const text = (li.textContent || "").trim().toLowerCase();
      let view = null;
      if (text.includes("home")) view = "home";
      else if (text.includes("my drive")) view = "mydrive";
      else if (text.includes("shared")) view = "shared";
      else if (text.includes("starred")) view = "starred";
      else if (text.includes("recent")) view = "recent";
      else if (text.includes("trash")) view = "trash";
      else if (text.includes("settings")) view = "settings";
      if (view) {
        li.setAttribute("data-view", view);
        li.addEventListener("click", () => {
          if (view === "mydrive") setView("mydrive", null);
          else setView(view, undefined, { skipHistory: true });
        });
      }
    });

    // Escape closes viewer
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeViewer();
    });

    purgeTrashByAge();
    setView("home");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    // page may still be executing later scripts; defer slightly
    setTimeout(init, 0);
  }
})();
