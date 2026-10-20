/**
 * Mini Drive – Supabase Storage adapter
 * Primary cloud storage for file bytes. Falls back to local disk when not configured.
 *
 * Env vars:
 *   SUPABASE_URL              e.g. https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY  (server-side only — never expose in frontend)
 *   SUPABASE_BUCKET            default: minidrive
 */

const fs = require("fs");
const path = require("path");

let _client = null;
let _bucket = "minidrive";
let _enabled = false;
let _initTried = false;

function normalizeSupabaseUrl(raw) {
  let url = String(raw || "").trim().replace(/\/+$/, "");
  // Strip accidental paths like /storage/v1 so the client builds the correct API URL
  url = url.replace(/\/storage(\/v1)?$/i, "");
  return url;
}

function isConfigured() {
  const url = process.env.SUPABASE_URL || "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";
  return !!(url && key && !url.includes("YOUR_") && !key.includes("YOUR_"));
}

function init() {
  if (_initTried) return _enabled;
  _initTried = true;

  if (!isConfigured()) {
    console.log(
      "[storage] Supabase not configured — using local disk (data/uploads/).",
    );
    console.log(
      "[storage] Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable cloud storage.",
    );
    _enabled = false;
    return false;
  }

  try {
    const { createClient } = require("@supabase/supabase-js");
    const url = normalizeSupabaseUrl(process.env.SUPABASE_URL);
    const key = (
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY
    ).trim();
    _bucket = (process.env.SUPABASE_BUCKET || "minidrive")
      .trim()
      .replace(/^\/+|\/+$/g, "");
    if (!_bucket) _bucket = "minidrive";
    _client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    _enabled = true;
    console.log("[storage] Supabase cloud storage ENABLED. Bucket:", _bucket);
    console.log("[storage] Supabase URL:", url);
    return true;
  } catch (err) {
    console.warn(
      "[storage] Failed to init Supabase:",
      err && err.message,
      "— falling back to local disk.",
    );
    _enabled = false;
    return false;
  }
}

function enabled() {
  if (!_initTried) init();
  return _enabled;
}

function objectPath(userId, storageName) {
  // Keep files isolated per user in the bucket.
  // Supabase rejects paths that are empty, start with /, or contain // or \\.
  const uid = String(userId || "")
    .trim()
    .replace(/[\\/]+/g, "")
    .replace(/^\.+/, "");
  const name = String(storageName || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/[^\w.\-]/g, "_");
  if (!uid || !name) {
    throw new Error(
      "Invalid storage path (missing user id or file key). Check that you are signed in.",
    );
  }
  return uid + "/" + name;
}

/**
 * Upload a Buffer to Supabase (or local disk).
 * Returns { storagePath, provider: 'supabase'|'local' }
 */
async function uploadFile(userId, storageName, buffer, mimeType) {
  if (enabled()) {
    const key = objectPath(userId, storageName);
    if (!Buffer.isBuffer(buffer) || !buffer.length) {
      throw new Error("Cannot upload empty file content.");
    }
    const { error } = await _client.storage.from(_bucket).upload(key, buffer, {
      contentType: mimeType || "application/octet-stream",
      upsert: true,
    });
    if (error) {
      const hint =
        error.message && /invalid path/i.test(error.message)
          ? " (check SUPABASE_URL, SUPABASE_BUCKET='" +
            _bucket +
            "', and that the bucket exists in Supabase Storage)"
          : "";
      throw new Error(
        "Supabase upload failed: " + error.message + hint + " [path=" + key + "]",
      );
    }
    return { storagePath: storageName, provider: "supabase", objectKey: key };
  }

  // Local fallback
  const db = require("./db");
  const abs = db.absoluteStoragePath(userId, storageName);
  fs.writeFileSync(abs, buffer);
  return { storagePath: storageName, provider: "local", objectKey: abs };
}

/**
 * Download file bytes. Returns Buffer.
 */
async function downloadFile(userId, storageName) {
  if (enabled()) {
    const key = objectPath(userId, storageName);
    const { data, error } = await _client.storage.from(_bucket).download(key);
    if (error) {
      // try local fallback if file was uploaded before Supabase was enabled
      const local = tryLocalRead(userId, storageName);
      if (local) return local;
      throw new Error("Supabase download failed: " + error.message);
    }
    const ab = await data.arrayBuffer();
    return Buffer.from(ab);
  }

  const local = tryLocalRead(userId, storageName);
  if (!local) throw new Error("File content is missing on the server.");
  return local;
}

function tryLocalRead(userId, storageName) {
  try {
    const db = require("./db");
    const abs = db.absoluteStoragePath(userId, storageName);
    if (abs && fs.existsSync(abs)) return fs.readFileSync(abs);
  } catch (_) {}
  return null;
}

/**
 * Delete object from cloud (and local if present).
 */
async function deleteFile(userId, storageName) {
  if (!storageName) return;

  if (enabled()) {
    const key = objectPath(userId, storageName);
    try {
      await _client.storage.from(_bucket).remove([key]);
    } catch (err) {
      console.warn("[storage] Supabase delete warning:", err && err.message);
    }
  }

  // Always try local cleanup too
  try {
    const db = require("./db");
    db.removeStorageFile(userId, storageName);
  } catch (_) {}
}

/**
 * Create a short-lived signed URL (optional, for direct browser download).
 */
async function getSignedUrl(userId, storageName, expiresSec) {
  if (!enabled()) return null;
  const key = objectPath(userId, storageName);
  const { data, error } = await _client.storage
    .from(_bucket)
    .createSignedUrl(key, expiresSec || 3600);
  if (error) return null;
  return data && data.signedUrl;
}

function status() {
  return {
    provider: enabled() ? "supabase" : "local",
    bucket: enabled() ? _bucket : null,
    configured: isConfigured(),
  };
}

module.exports = {
  init,
  enabled,
  isConfigured,
  uploadFile,
  downloadFile,
  deleteFile,
  getSignedUrl,
  status,
  objectPath,
};
