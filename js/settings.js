/**
 * Mini Drive Settings – functional preferences panel
 */
(function () {
  "use strict";

  function tt(key, vars) {
    if (window.DriveI18n && window.DriveI18n.t) return window.DriveI18n.t(key, vars);
    return key;
  }


  const KEY = "miniDriveSettings";

  const DEFAULTS = {
    appearance: "system", // light | dark | system
    viewMode: "grid", // grid | list
    sortBy: "name", // name | date | size | type
    sortDir: "asc", // asc | desc
    showExtensions: true,
    confirmBeforeDelete: true,
    notifications: true,
    autoDeleteDays: 0, // 0 = never, 7, 30, 90
    confirmPermanentDelete: true,
    language: "en",
    reducedMotion: false,
    largeText: false,
    textScale: 100, // 85–130 %
  };

  const LANG_LABELS = {
    en: "English",
    hi: "हिन्दी (Hindi)",
    es: "Español",
    fr: "Français",
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return { ...DEFAULTS, ...(raw ? JSON.parse(raw) : {}) };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function save(partial) {
    const next = { ...load(), ...partial };
    localStorage.setItem(KEY, JSON.stringify(next));
    apply(next);
    return next;
  }

  function get() {
    return load();
  }

  function apply(s) {
    s = s || load();
    applyAppearance(s.appearance);
    document.body.classList.toggle("view-list", s.viewMode === "list");
    document.body.classList.toggle("view-grid", s.viewMode !== "list");
    document.body.classList.toggle("hide-extensions", !s.showExtensions);
    document.body.classList.toggle("a11y-reduced-motion", !!s.reducedMotion);
    var scale = Number(s.textScale);
    if (!scale || isNaN(scale)) scale = s.largeText ? 115 : 100;
    scale = Math.min(130, Math.max(85, scale));
    if (scale === 100) {
      document.documentElement.style.removeProperty("--md-text-scale");
      document.body.style.removeProperty("--md-text-scale");
      document.body.classList.remove("a11y-scaled");
    } else {
      document.documentElement.style.setProperty("--md-text-scale", String(scale / 100));
      document.body.style.setProperty("--md-text-scale", String(scale / 100));
      document.body.classList.add("a11y-scaled");
    }
    document.body.classList.toggle("a11y-large-text", scale >= 112);
    document.documentElement.lang = s.language || "en";
  }

  function applyAppearance(mode) {
    const preferDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    let dark = false;
    if (mode === "dark") dark = true;
    else if (mode === "light") dark = false;
    else dark = preferDark;

    // Keep every dark class in sync (mobile + desktop CSS)
    document.body.classList.toggle("dark", dark);
    document.body.classList.toggle("dark-theme", dark);
    document.body.classList.toggle("dark-mode", dark);
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
    if (mode === "dark" || mode === "light" || mode === "system") {
      localStorage.setItem("themeMode", mode);
    }

    const icon = document.getElementById("themeIcon");
    const btn = document.getElementById("theme");
    if (icon) icon.textContent = dark ? "light_mode" : "dark_mode";
    if (btn)
      btn.title = dark ? "Switch to light mode" : "Switch to dark mode";
  }

  function getEmail() {
    try {
      if (window.MiniDriveAuth && MiniDriveAuth.getSession()) {
        return MiniDriveAuth.getSession().email;
      }
      return (
        localStorage.getItem("miniDriveUser") ||
        localStorage.getItem("miniDriveEmail") ||
        "guest@minidrive.com"
      );
    } catch {
      return "guest@minidrive.com";
    }
  }

  function displayName(email) {
    if (window.MiniDriveAuth) {
      return MiniDriveAuth.displayNameFromSession(
        MiniDriveAuth.getSession() || { email },
      );
    }
    const local = (email || "User").split("@")[0];
    return local.charAt(0).toUpperCase() + local.slice(1);
  }

  function formatSize(bytes) {
    if (!bytes) return "0 B";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
    return (bytes / 1073741824).toFixed(2) + " GB";
  }

  function storageStats() {
    let meta = [];
    // Prefer live DriveApp items (accurate sizes) over stale cache
    if (window.DriveApp && typeof window.DriveApp.getItems === "function") {
      try {
        meta = window.DriveApp.getItems() || [];
      } catch (_) {
        meta = [];
      }
    }
    if (!meta.length) {
      try {
        // Scan user-scoped meta keys
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.indexOf("miniDriveMeta_v2") === 0) {
            const arr = JSON.parse(localStorage.getItem(k) || "[]");
            if (Array.isArray(arr) && arr.length) {
              meta = arr;
              break;
            }
          }
        }
      } catch {
        meta = [];
      }
    }
    const active = meta.filter((i) => !i.trashed && i.kind === "file");
    const trashed = meta.filter((i) => i.trashed && i.kind === "file");
    const by = { images: 0, videos: 0, audio: 0, docs: 0, other: 0 };
    let total = 0;
    active.forEach((f) => {
      const size = f.size || 0;
      total += size;
      const t = (f.mimeType || "").toLowerCase();
      const n = (f.name || "").toLowerCase();
      if (t.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/.test(n))
        by.images += size;
      else if (t.startsWith("video/") || /\.(mp4|webm|mov)$/.test(n))
        by.videos += size;
      else if (t.startsWith("audio/") || /\.(mp3|wav|ogg)$/.test(n))
        by.audio += size;
      else if (t.includes("pdf") || t.includes("document") || /\.(pdf|docx?|txt)$/.test(n))
        by.docs += size;
      else by.other += size;
    });
    const trashSize = trashed.reduce((s, f) => s + (f.size || 0), 0);
    return { total, by, trashSize, fileCount: active.length, trashCount: trashed.length };
  }

  function section(title, icon, bodyHtml) {
    return `
      <section class="settings-section">
        <h2 class="settings-section-title">
          <span class="material-symbols-outlined">${icon}</span>
          ${title}
        </h2>
        <div class="settings-section-body">${bodyHtml}</div>
      </section>`;
  }

  function row(label, controlHtml, hint) {
    return `
      <div class="settings-row">
        <div class="settings-row-text">
          <div class="settings-row-label">${label}</div>
          ${hint ? `<div class="settings-row-hint">${hint}</div>` : ""}
        </div>
        <div class="settings-row-control">${controlHtml}</div>
      </div>`;
  }

  function toggle(id, checked) {
    return `<label class="settings-switch">
      <input type="checkbox" id="${id}" ${checked ? "checked" : ""} />
      <span class="settings-slider"></span>
    </label>`;
  }

  function select(id, options, value) {
    // Themed custom dropdown (not system default)
    const current = options.find(([v]) => String(v) === String(value)) || options[0];
    const label = current ? current[1] : "";
    return `<div class="settings-pick" data-id="${id}" data-value="${String(value)}">
      <button type="button" class="settings-pick-btn" aria-haspopup="listbox" aria-expanded="false">
        <span class="settings-pick-label">${label}</span>
        <span class="material-symbols-outlined settings-pick-chevron">expand_more</span>
      </button>
      <div class="settings-pick-menu" role="listbox">
        ${options
          .map(
            ([v, lab]) =>
              `<button type="button" class="settings-pick-item ${String(v) === String(value) ? "active" : ""}" data-value="${v}" role="option">${lab}</button>`,
          )
          .join("")}
      </div>
    </div>`;
  }

  function segmented(id, options, value) {
    return `<div class="settings-segmented" data-id="${id}">
      ${options
        .map(
          ([v, lab]) =>
            `<button type="button" class="seg-btn ${v === value ? "active" : ""}" data-value="${v}">${lab}</button>`,
        )
        .join("")}
    </div>`;
  }

  function syncSettingsAvatar(el) {
    if (!el) el = document.getElementById("settingsAvatarBtn");
    if (!el) return;
    const email = getEmail();
    const nameForLetter = displayName(email) || email || "U";
    const letter = (nameForLetter.trim().charAt(0) || "U").toUpperCase();
    try {
      const sessionPic =
        window.MiniDriveAuth && MiniDriveAuth.getSession()
          ? MiniDriveAuth.getSession().picture
          : "";
      let saved = "";
      try {
        const key = email
          ? "miniDriveAvatar:" + String(email).trim().toLowerCase()
          : "";
        if (key) saved = localStorage.getItem(key) || "";
      } catch (_) {}
      // Prefer account (DB) picture linked to email, then local cache
      const src = sessionPic || saved;
      if (src) {
        el.classList.add("has-photo");
        el.innerHTML =
          '<img src="' +
          src.replace(/"/g, "&quot;") +
          '" alt="Profile" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" />';
        return;
      }
    } catch (_) {}
    el.classList.remove("has-photo");
    el.style.backgroundImage = "";
    el.textContent = letter;
  }

  function renderPanel(container) {
    const s = load();
    const email = getEmail();
    const stats = storageStats();
    const quota = (window.DriveApp && window.DriveApp.STORAGE_QUOTA_BYTES) || (1 * 1024 * 1024 * 1024);
    // Prefer live used bytes from DriveApp so bar matches sidebar
    let usedTotal = stats.total;
    if (window.DriveApp && typeof window.DriveApp.getUsedStorageBytes === "function") {
      try {
        usedTotal = window.DriveApp.getUsedStorageBytes() || 0;
      } catch (_) {}
    }
    stats.total = usedTotal;
    const pct = Math.min(100, (usedTotal / quota) * 100);

    container.innerHTML = `
      <div class="settings-page">
        <p class="settings-intro">${tt("settingsIntro")}</p>

        ${section(
          tt("account"),
          "person",
          `
          <div class="settings-account">
            <button type="button" class="settings-avatar" id="settingsAvatarBtn" title="View or change profile picture">${(displayName(email) || email || "U").trim().charAt(0).toUpperCase()}</button>
            <div class="settings-account-info">
              <div class="settings-account-name">${displayName(email)}</div>
              <div class="settings-account-email">${email}</div>
              <button type="button" class="settings-change-photo" id="settingsChangePhoto">Change profile picture</button>
            </div>
          </div>
          <input type="file" id="settingsAvatarInput" accept="image/*" style="display:none" />
          ${row(
            tt("signOut"),
            `<button type="button" class="settings-btn" id="settingsLogout">${tt("logOut")}</button>`,
            tt("signOutHint"),
          )}
          ${row(
            tt("switchAccount"),
            `<button type="button" class="settings-btn secondary" id="settingsSwitch">${tt("switch")}</button>`,
          )}
        `,
        )}

        ${section(
          tt("appearance"),
          "palette",
          row(
            tt("theme"),
            segmented(
              "appearance",
              [
                ["light", tt("light")],
                ["dark", tt("dark")],
                ["system", tt("system")],
              ],
              s.appearance,
            ),
            tt("systemHint"),
          ),
        )}

        ${section(
          tt("filePrefs"),
          "folder_open",
          `
          ${row(
            tt("viewLayout"),
            segmented(
              "viewMode",
              [
                ["grid", tt("grid")],
                ["list", tt("list")],
              ],
              s.viewMode,
            ),
          )}
          ${row(
            tt("defaultSort"),
            select(
              "sortBy",
              [
                ["name", tt("sortName")],
                ["date", tt("sortDate")],
                ["size", tt("sortSize")],
                ["type", tt("sortType")],
              ],
              s.sortBy,
            ),
          )}
          ${row(
            tt("sortDirection"),
            segmented(
              "sortDir",
              [
                ["asc", tt("ascending")],
                ["desc", tt("descending")],
              ],
              s.sortDir,
            ),
          )}
          ${row(
            tt("showExtensions"),
            toggle("showExtensions", s.showExtensions),
            tt("showExtensionsHint"),
          )}
          ${row(
            tt("confirmBeforeDelete"),
            toggle("confirmBeforeDelete", s.confirmBeforeDelete),
            tt("confirmBeforeDeleteHint"),
          )}
        `,
        )}

        ${section(
          tt("notificationsSection"),
          "notifications",
          row(
            tt("inAppNotifications"),
            toggle("notifications", s.notifications),
            tt("inAppNotificationsHint"),
          ),
        )}

        ${section(
          tt("trashSection"),
          "delete",
          `
          ${row(
            tt("autoDelete"),
            select(
              "autoDeleteDays",
              [
                ["0", tt("never")],
                ["7", tt("after7")],
                ["30", tt("after30")],
                ["90", tt("after90")],
              ],
              String(s.autoDeleteDays),
            ),
            tt("autoDeleteHint"),
          )}
          ${row(
            tt("confirmPermanentDelete"),
            toggle("confirmPermanentDelete", s.confirmPermanentDelete),
            tt("confirmPermanentDeleteHint"),
          )}
          ${row(
            tt("emptyTrashNow"),
            `<button type="button" class="settings-btn danger" id="settingsEmptyTrash">${tt("emptyTrashBtn")}</button>`,
          )}
        `,
        )}

        ${section(
          tt("storageSection"),
          "cloud",
          `
          <div class="settings-storage">
            <div class="settings-storage-top">
              <strong>${formatSize(stats.total) || "0 B"}</strong>
              <span>of 1 GB used · ${stats.fileCount} file${stats.fileCount === 1 ? "" : "s"}</span>
            </div>
            <div class="settings-storage-bar"><div style="width:${Math.max(pct, stats.total > 0 ? 1.5 : 0)}%"></div></div>
            <div class="settings-breakdown">
              <div><span class="dot images"></span> ${tt("images")} <b>${formatSize(stats.by.images)}</b></div>
              <div><span class="dot videos"></span> ${tt("videos")} <b>${formatSize(stats.by.videos)}</b></div>
              <div><span class="dot audio"></span> ${tt("audio")} <b>${formatSize(stats.by.audio)}</b></div>
              <div><span class="dot docs"></span> ${tt("documents")} <b>${formatSize(stats.by.docs)}</b></div>
              <div><span class="dot other"></span> ${tt("other")} <b>${formatSize(stats.by.other)}</b></div>
              <div><span class="dot trash"></span> ${tt("inTrashLabel")} <b>${formatSize(stats.trashSize)}</b> (${stats.trashCount})</div>
            </div>
          </div>
        `,
        )}

        ${section(
          tt("languageSection"),
          "language",
          row(
            tt("appLanguage"),
            select(
              "language",
              Object.entries(LANG_LABELS),
              s.language,
            ),
            tt("languageHint"),
          ),
        )}

        ${section(
          tt("accessibility"),
          "accessibility",
          `
          ${row(
            tt("reducedMotion"),
            toggle("reducedMotion", s.reducedMotion),
            tt("reducedMotionHint"),
          )}
          ${row(
            tt("largerText") || "Text size",
            `<div class="settings-scale">
              <span class="settings-scale-min">A</span>
              <input type="range" id="textScale" min="85" max="130" step="5" value="${Number(s.textScale) || (s.largeText ? 115 : 100)}" aria-label="Text size" />
              <span class="settings-scale-max">A</span>
              <span class="settings-scale-val" id="textScaleVal">${Number(s.textScale) || (s.largeText ? 115 : 100)}%</span>
            </div>`,
            tt("largerTextHint") || "Drag to make text smaller or larger",
          )}
        `,
        )}

        <div class="settings-shortcuts-section">
        ${section(
          tt("keyboardShortcuts"),
          "keyboard",
          `
          <div class="settings-shortcuts">
            <div><kbd>N</kbd> New folder</div>
            <div><kbd>U</kbd> Upload files</div>
            <div><kbd>/</kbd> Focus search</div>
            <div><kbd>?</kbd> Open settings</div>
            <div><kbd>Esc</kbd> Close dialogs / viewer</div>
            <div><kbd>D</kbd> Toggle dark mode</div>
          </div>
        `,
        )}
        </div>

        ${section(
          "Account actions",
          "warning",
          `
          ${row(
            "Delete account",
            `<button type="button" class="settings-btn danger" id="settingsDeleteAccount">Delete account</button>`,
            "Permanently deletes your account, files, and shares. This cannot be undone.",
          )}
        `,
        )}
      </div>`;

    bind(container);
  }

  function bind(root) {
    // text size slider
    const scaleInput = root.querySelector("#textScale");
    const scaleVal = root.querySelector("#textScaleVal");
    if (scaleInput) {
      const applyScale = () => {
        let v = Number(scaleInput.value) || 100;
        v = Math.min(130, Math.max(85, v));
        if (scaleVal) scaleVal.textContent = v + "%";
        save({ textScale: v, largeText: v >= 112 });
        if (v === 100) {
          document.documentElement.style.removeProperty("--md-text-scale");
          document.body.style.removeProperty("--md-text-scale");
          document.body.classList.remove("a11y-scaled");
        } else {
          document.documentElement.style.setProperty("--md-text-scale", String(v / 100));
          document.body.style.setProperty("--md-text-scale", String(v / 100));
          document.body.classList.add("a11y-scaled");
        }
        document.body.classList.toggle("a11y-large-text", v >= 112);
        notify(tt("settingsSaved"), tt("preferenceUpdated"));
      };
      scaleInput.addEventListener("input", () => {
        if (scaleVal) scaleVal.textContent = (Number(scaleInput.value) || 100) + "%";
      });
      scaleInput.addEventListener("change", applyScale);
    }


    const delAcc = root.querySelector("#settingsDeleteAccount");
    if (delAcc) {
      delAcc.onclick = async function () {
        const ok1 = window.confirm(
          "Delete your Mini Drive account permanently? All files and shares will be removed. This cannot be undone.",
        );
        if (!ok1) return;
        const ok2 = window.confirm(
          "Final confirmation: type-level check. Click OK to permanently delete your account.",
        );
        if (!ok2) return;
        delAcc.disabled = true;
        try {
          if (window.MiniDriveAPI && MiniDriveAPI.isServerAvailable() && MiniDriveAPI.deleteAccount) {
            await MiniDriveAPI.deleteAccount();
          }
          // Clear local data for this browser
          try {
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k && (k.indexOf("miniDrive") === 0 || k.indexOf("md") === 0)) keys.push(k);
            }
            keys.forEach(function (k) { localStorage.removeItem(k); });
            sessionStorage.clear();
          } catch (_) {}
          if (window.MiniDriveAuth && MiniDriveAuth.logout) {
            MiniDriveAuth.logout("frontpage.html");
          } else {
            window.location.href = "frontpage.html";
          }
        } catch (err) {
          delAcc.disabled = false;
          notify("Delete failed", (err && err.message) || "Could not delete account.");
        }
      };
    }

    // segmented
    root.querySelectorAll(".settings-segmented").forEach((group) => {
      const id = group.dataset.id;
      group.querySelectorAll(".seg-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          group.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          const val = btn.dataset.value;
          save({ [id]: val });
          if (window.DriveApp && window.DriveApp.render) window.DriveApp.render();
          notify(tt("settingsSaved"), tt("preferenceUpdated"));
        });
      });
    });

    function commitPick(id, val) {
      if (id === "autoDeleteDays") val = Number(val);
      save({ [id]: val });
      if (id === "language" && window.DriveI18n && window.DriveI18n.applyStaticUI) {
        window.DriveI18n.applyStaticUI();
      }
      if (window.DriveApp && window.DriveApp.render) window.DriveApp.render();
      if (id === "autoDeleteDays" && window.DriveApp && window.DriveApp.purgeTrashByAge) {
        window.DriveApp.purgeTrashByAge();
      }
      notify(tt("settingsSaved"), tt("preferenceUpdated"));
      if (id === "language") renderPanel(root);
    }

    function closeAllPicks() {
      root.querySelectorAll(".settings-pick.open").forEach((p) => {
        p.classList.remove("open");
        const b = p.querySelector(".settings-pick-btn");
        if (b) b.setAttribute("aria-expanded", "false");
      });
    }

    root.querySelectorAll(".settings-pick").forEach((pick) => {
      const btn = pick.querySelector(".settings-pick-btn");
      const menu = pick.querySelector(".settings-pick-menu");
      if (!btn || !menu) return;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const wasOpen = pick.classList.contains("open");
        closeAllPicks();
        if (!wasOpen) {
          pick.classList.add("open");
          btn.setAttribute("aria-expanded", "true");
          // Keep menu inside viewport horizontally
          const r = btn.getBoundingClientRect();
          if (r.right > window.innerWidth - 12) {
            menu.style.right = "0";
            menu.style.left = "auto";
          } else {
            menu.style.left = "0";
            menu.style.right = "auto";
          }
        }
      });
      menu.querySelectorAll(".settings-pick-item").forEach((item) => {
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          const val = item.dataset.value;
          pick.dataset.value = val;
          const label = pick.querySelector(".settings-pick-label");
          if (label) label.textContent = item.textContent;
          menu.querySelectorAll(".settings-pick-item").forEach((i) => i.classList.remove("active"));
          item.classList.add("active");
          closeAllPicks();
          commitPick(pick.dataset.id, val);
        });
      });
    });
    document.addEventListener("click", () => closeAllPicks());

    // custom dropdowns (legacy, if any remain)
    function commitDropdown(id, val) {
      if (id === "autoDeleteDays") val = Number(val);
      save({ [id]: val });
      if (id === "language" && window.DriveI18n && window.DriveI18n.applyStaticUI) {
        window.DriveI18n.applyStaticUI();
      }
      if (window.DriveApp && window.DriveApp.render) window.DriveApp.render();
      if (id === "autoDeleteDays" && window.DriveApp && window.DriveApp.purgeTrashByAge) {
        window.DriveApp.purgeTrashByAge();
      }
      notify(tt("settingsSaved"), tt("preferenceUpdated"));
      // re-render panel so labels update (esp. language)
      if (id === "language") renderPanel(root);
    }

    function closeAllSettingsDd() {
      root.querySelectorAll(".settings-dd.open").forEach((x) => {
        x.classList.remove("open");
        const m = x.querySelector(".settings-dd-menu");
        if (m) {
          m.style.position = "";
          m.style.left = "";
          m.style.top = "";
          m.style.right = "";
          m.style.width = "";
          m.style.bottom = "";
        }
      });
    }

    function positionSettingsDd(dd) {
      const btn = dd.querySelector(".settings-dd-btn");
      const menu = dd.querySelector(".settings-dd-menu");
      if (!btn || !menu) return;
      const r = btn.getBoundingClientRect();
      const menuH = Math.min(240, menu.scrollHeight || 180);
      const spaceBelow = window.innerHeight - r.bottom;
      const openUp = spaceBelow < menuH + 12 && r.top > menuH;
      menu.style.position = "fixed";
      menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 200)) + "px";
      menu.style.right = "auto";
      menu.style.width = Math.max(r.width, 180) + "px";
      if (openUp) {
        menu.style.top = "auto";
        menu.style.bottom = window.innerHeight - r.top + 6 + "px";
      } else {
        menu.style.bottom = "auto";
        menu.style.top = r.bottom + 6 + "px";
      }
    }

    root.querySelectorAll(".settings-dd").forEach((dd) => {
      const btn = dd.querySelector(".settings-dd-btn");
      const menu = dd.querySelector(".settings-dd-menu");
      if (!btn || !menu) return;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const open = dd.classList.contains("open");
        closeAllSettingsDd();
        if (!open) {
          dd.classList.add("open");
          positionSettingsDd(dd);
        }
      });
      menu.querySelectorAll(".settings-dd-item").forEach((item) => {
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          const val = item.dataset.value;
          dd.dataset.value = val;
          closeAllSettingsDd();
          const label = dd.querySelector(".settings-dd-label");
          if (label) label.textContent = item.textContent;
          menu.querySelectorAll(".settings-dd-item").forEach((i) => i.classList.remove("active"));
          item.classList.add("active");
          commitDropdown(dd.dataset.id, val);
        });
      });
    });
    document.addEventListener("click", () => closeAllSettingsDd());
    window.addEventListener("resize", () => closeAllSettingsDd());
    const dash = document.querySelector(".dashboard");
    if (dash) dash.addEventListener("scroll", () => closeAllSettingsDd(), { passive: true });

    // settings avatar — click to view (if photo) or change
    const settingsAvatarBtn = root.querySelector("#settingsAvatarBtn");
    const settingsChangePhoto = root.querySelector("#settingsChangePhoto");
    const settingsAvatarInput = root.querySelector("#settingsAvatarInput");
    function openSettingsAvatarPicker() {
      if (settingsAvatarInput) settingsAvatarInput.click();
    }
    function openAvatarPreview(src) {
      let modal = document.getElementById("avatarPreviewModal");
      if (!modal) {
        modal = document.createElement("div");
        modal.id = "avatarPreviewModal";
        modal.className = "avatar-preview-modal";
        modal.innerHTML =
          '<div class="avatar-preview-backdrop" data-close></div>' +
          '<div class="avatar-preview-panel">' +
          '<img class="avatar-preview-img" alt="Profile picture" />' +
          "<h3 style=\"margin:0 0 6px;font-size:17px\">Profile picture</h3>" +
          '<p style="margin:0 0 16px;font-size:13px;opacity:0.75">Your current photo</p>' +
          '<div class="avatar-preview-actions">' +
          '<button type="button" class="avatar-preview-close" data-close>Close</button>' +
          '<button type="button" class="avatar-preview-change" data-change>Change photo</button>' +
          "</div></div>";
        document.body.appendChild(modal);
        modal.addEventListener("click", function (e) {
          if (e.target.closest("[data-close]")) {
            modal.classList.remove("show");
          }
          if (e.target.closest("[data-change]")) {
            modal.classList.remove("show");
            openSettingsAvatarPicker();
          }
        });
      }
      const img = modal.querySelector(".avatar-preview-img");
      if (img) img.src = src;
      modal.classList.add("show");
    }
    if (settingsAvatarBtn) {
      settingsAvatarBtn.onclick = function () {
        const img = settingsAvatarBtn.querySelector("img");
        if (img && img.src) {
          openAvatarPreview(img.src);
        } else {
          openSettingsAvatarPicker();
        }
      };
      settingsAvatarBtn.title = "View or change profile picture";
    }
    if (settingsChangePhoto) settingsChangePhoto.onclick = openSettingsAvatarPicker;
    if (settingsAvatarInput) {
      settingsAvatarInput.addEventListener("change", function () {
        const file = this.files && this.files[0];
        this.value = "";
        if (!file) return;
        if (!file.type.startsWith("image/")) {
          notify("Invalid file", "Please choose an image.");
          return;
        }
        if (file.size > 2 * 1024 * 1024) {
          notify("File too large", "Please choose an image under 2 MB.");
          return;
        }
        const reader = new FileReader();
        reader.onload = function (ev) {
          const dataUrl = ev.target.result;
          // Save to account in database (linked to email) via API
          const finishLocal = function (pic) {
            try {
              const em = getEmail();
            const akey = em
              ? "miniDriveAvatar:" + String(em).trim().toLowerCase()
              : "miniDriveAvatar:guest";
            localStorage.setItem(akey, pic || dataUrl);
            } catch (_) {}
            if (window.MiniDriveAuth && MiniDriveAuth.getSession) {
              const s = MiniDriveAuth.getSession() || {};
              if (window.MiniDriveAuth.saveSession) {
                MiniDriveAuth.saveSession(
                  Object.assign({}, s, { picture: pic || dataUrl, token: s.token }),
                );
              }
            }
            if (window.applyDriveAvatar) window.applyDriveAvatar(pic || dataUrl);
            syncSettingsAvatar(settingsAvatarBtn);
            notify(tt("settingsSaved"), "Profile picture saved to your account.");
          };
          if (
            window.MiniDriveAPI &&
            MiniDriveAPI.isServerAvailable() &&
            MiniDriveAPI.updateProfile
          ) {
            MiniDriveAPI.updateProfile({ picture: dataUrl })
              .then(function (user) {
                finishLocal((user && user.picture) || dataUrl);
              })
              .catch(function (err) {
                notify(
                  "Could not save to server",
                  (err && err.message) || "Saved only on this device.",
                );
                finishLocal(dataUrl);
              });
          } else {
            finishLocal(dataUrl);
          }
        };
        reader.readAsDataURL(file);
      });
    }
    syncSettingsAvatar(settingsAvatarBtn);

    // toggles
    [
      "showExtensions",
      "confirmBeforeDelete",
      "notifications",
      "confirmPermanentDelete",
      "reducedMotion",
      "largeText",
    ].forEach((id) => {
      const el = root.querySelector("#" + id);
      if (!el) return;
      el.addEventListener("change", () => {
        save({ [id]: el.checked });
        if (window.DriveApp && window.DriveApp.render) window.DriveApp.render();
        notify(tt("settingsSaved"), tt("preferenceUpdated"));
      });
    });

    const logout = root.querySelector("#settingsLogout");
    if (logout)
      logout.onclick = () => {
        if (window.MiniDriveAuth) MiniDriveAuth.logout("frontpage.html");
        else {
          localStorage.removeItem("miniDriveLoggedIn");
          window.location.href = "frontpage.html";
        }
      };
    const sw = root.querySelector("#settingsSwitch");
    if (sw)
      sw.onclick = () => {
        if (window.MiniDriveAuth)
          MiniDriveAuth.logout("login.html?mode=signin");
        else window.location.href = "login.html";
      };

    const empty = root.querySelector("#settingsEmptyTrash");
    if (empty) {
      empty.onclick = async () => {
        if (window.DriveApp && window.DriveApp.emptyTrashFromSettings) {
          await window.DriveApp.emptyTrashFromSettings();
          renderPanel(root);
        }
      };
    }
  }

  function notify(title, msg) {
    const s = load();
    if (!s.notifications) return;
    if (typeof showToast === "function") showToast(title, msg, "success");
  }

  // Keyboard shortcuts
  function setupShortcuts() {
    document.addEventListener("keydown", (e) => {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        if (window.DriveApp) window.DriveApp.setView("settings");
      }
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        if (typeof openCreateFolderModal === "function") openCreateFolderModal();
      }
      if (e.key === "u" || e.key === "U") {
        e.preventDefault();
        if (typeof openUploadModalFromMenu === "function") openUploadModalFromMenu();
        else if (typeof openUploadModal === "function") openUploadModal();
      }
      if (e.key === "/") {
        e.preventDefault();
        const search = document.getElementById("search");
        if (search) search.focus();
      }
      if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        const s = load();
        const next =
          s.appearance === "dark"
            ? "light"
            : s.appearance === "light"
              ? "dark"
              : document.body.classList.contains("dark")
                ? "light"
                : "dark";
        save({ appearance: next });
      }
    });
  }

  // System theme listener
  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      const s = load();
      if (s.appearance === "system") applyAppearance("system");
    });
  }

  window.DriveSettings = {
    get,
    save,
    load,
    apply,
    renderPanel,
    notify,
    syncSettingsAvatar,
  };

  function init() {
    apply(load());
    setupShortcuts();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    setTimeout(init, 0);
  }
})();
