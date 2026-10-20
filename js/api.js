/**
 * Mini Drive – server API client (auth token from localStorage)
 */
(function (global) {
  "use strict";

  const TOKEN_KEY = "miniDriveAuthToken";

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

  function getToken() {
    try {
      return (localStorage.getItem(TOKEN_KEY) || "").trim();
    } catch (_) {
      return "";
    }
  }

  function isServerAvailable() {
    return !!getToken();
  }

  async function request(pathname, options) {
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
      res = await fetch(getApiBase() + pathname, Object.assign({}, opts, { headers }));
    } catch (e) {
      throw new Error(
        "Cannot reach the Mini Drive server. Start it with npm start.",
      );
    }
    let data = {};
    try {
      data = await res.json();
    } catch (_) {
      data = {};
    }
    if (!res.ok) {
      throw new Error(data.error || "Request failed (" + res.status + ").");
    }
    return data;
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ""));
      };
      reader.onerror = function () {
        reject(new Error("Could not read " + (file && file.name)));
      };
      reader.readAsDataURL(file);
    });
  }

  async function listFiles() {
    const data = await request("/api/files");
    return data.items || [];
  }

  async function createFolder(name, parentId) {
    const data = await request("/api/files/folder", {
      method: "POST",
      body: JSON.stringify({ name, parentId: parentId || null }),
    });
    return data.item;
  }

  async function uploadFiles(fileList, parentId) {
    const files = [];
    for (const f of Array.from(fileList || [])) {
      const contentBase64 = await fileToBase64(f);
      files.push({
        name: f.name,
        mimeType: f.type || "application/octet-stream",
        contentBase64: contentBase64,
      });
    }
    const data = await request("/api/files/upload", {
      method: "POST",
      body: JSON.stringify({
        parentId: parentId || null,
        files: files,
      }),
    });
    return data.items || [];
  }

  async function patchFile(id, patch) {
    const data = await request("/api/files/" + encodeURIComponent(id), {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return data.item;
  }

  async function deleteFile(id) {
    return request("/api/files/" + encodeURIComponent(id), {
      method: "DELETE",
    });
  }

  async function purgeFiles(ids) {
    return request("/api/files/purge", {
      method: "POST",
      body: JSON.stringify({ ids }),
    });
  }

  async function emptyTrash() {
    return request("/api/files/empty-trash", {
      method: "POST",
      body: "{}",
    });
  }

  function downloadUrl(id) {
    return getApiBase() + "/api/files/" + encodeURIComponent(id) + "/download";
  }

  async function downloadBlob(id) {
    const token = getToken();
    const res = await fetch(downloadUrl(id), {
      headers: token ? { Authorization: "Bearer " + token } : {},
    });
    if (!res.ok) {
      let msg = "Download failed.";
      try {
        const j = await res.json();
        if (j.error) msg = j.error;
      } catch (_) {}
      throw new Error(msg);
    }
    return res.blob();
  }


  async function listFilesPack() {
    const data = await request("/api/files");
    return {
      items: data.items || [],
      sharedWithMe: data.sharedWithMe || [],
    };
  }

  async function reportBug(payload) {
    return request("/api/report-bug", {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });
  }

  async function deleteAccount() {
    return request("/api/auth/account", { method: "DELETE" });
  }

  async function updateProfile(patch) {
    const data = await request("/api/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(patch || {}),
    });
    return data.user;
  }

  async function shareFile(id, email) {
    return request("/api/files/" + encodeURIComponent(id) + "/share", {
      method: "POST",
      body: JSON.stringify({ email: email }),
    });
  }

  async function unshareFile(id, email) {
    return request("/api/files/" + encodeURIComponent(id) + "/share", {
      method: "DELETE",
      body: JSON.stringify({ email: email }),
    });
  }

  async function listShares(id) {
    const data = await request(
      "/api/files/" + encodeURIComponent(id) + "/shares",
    );
    return data.sharedWith || [];
  }

  async function listNotifications() {
    return request("/api/notifications");
  }

  async function markNotificationsRead(ids) {
    return request("/api/notifications/read", {
      method: "POST",
      body: JSON.stringify({ ids: ids || null }),
    });
  }

  async function clearNotifications() {
    return request("/api/notifications/clear", {
      method: "POST",
      body: "{}",
    });
  }

  global.MiniDriveAPI = {
    isServerAvailable: isServerAvailable,
    listFiles: listFiles,
    listFilesPack: listFilesPack,
    createFolder: createFolder,
    uploadFiles: uploadFiles,
    patchFile: patchFile,
    deleteFile: deleteFile,
    purgeFiles: purgeFiles,
    emptyTrash: emptyTrash,
    downloadUrl: downloadUrl,
    downloadBlob: downloadBlob,
    updateProfile: updateProfile,
    deleteAccount: deleteAccount,
    reportBug: reportBug,
    shareFile: shareFile,
    unshareFile: unshareFile,
    listShares: listShares,
    listNotifications: listNotifications,
    markNotificationsRead: markNotificationsRead,
    clearNotifications: clearNotifications,
    request: request,
  };
})(typeof window !== "undefined" ? window : this);
