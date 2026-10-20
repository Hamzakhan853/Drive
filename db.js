/**
 * Mini Drive – SQLite database using Node.js built-in `node:sqlite`
 * (no native compile / better-sqlite3 needed — works on Node 22.5+)
 *
 * Tables: users, files. Binary content: data/uploads/{userId}/
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");

const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "minidrive.sqlite");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const LEGACY_USERS = path.join(DATA_DIR, "users.json");
const LEGACY_FILES = path.join(DATA_DIR, "files.json");

let _db = null;

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  getDb();
}

function getDb() {
  if (_db) return _db;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  _db = new DatabaseSync(DB_PATH);
  try {
    _db.exec("PRAGMA journal_mode = WAL");
  } catch (_) {}
  try {
    _db.exec("PRAGMA foreign_keys = ON");
  } catch (_) {}

  _db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL DEFAULT '',
      picture TEXT NOT NULL DEFAULT '',
      provider TEXT NOT NULL DEFAULT 'email',
      google_sub TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub);

    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('file', 'folder')),
      parent_id TEXT,
      mime_type TEXT NOT NULL DEFAULT '',
      size INTEGER NOT NULL DEFAULT 0,
      storage_path TEXT NOT NULL DEFAULT '',
      starred INTEGER NOT NULL DEFAULT 0,
      shared INTEGER NOT NULL DEFAULT 0,
      trashed INTEGER NOT NULL DEFAULT 0,
      trashed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_files_user ON files(user_id);
    CREATE INDEX IF NOT EXISTS idx_files_parent ON files(user_id, parent_id);
    CREATE INDEX IF NOT EXISTS idx_files_trashed ON files(user_id, trashed);

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_reset_user ON password_reset_tokens(user_id);

    CREATE TABLE IF NOT EXISTS shares (
      id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      shared_with_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(file_id, shared_with_id),
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (shared_with_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_shares_with ON shares(shared_with_id);
    CREATE INDEX IF NOT EXISTS idx_shares_file ON shares(file_id);
    CREATE INDEX IF NOT EXISTS idx_shares_owner ON shares(owner_id);

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL DEFAULT 'share',
      file_id TEXT,
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, created_at);
  `);

  migrateFromJsonIfNeeded(_db);
  return _db;
}

function migrateFromJsonIfNeeded(database) {
  const countRow = database.prepare("SELECT COUNT(*) AS c FROM users").get();
  const userCount = countRow && (countRow.c ?? countRow["COUNT(*)"]) || 0;
  if (userCount > 0) return;

  let users = [];
  let files = [];
  try {
    if (fs.existsSync(LEGACY_USERS)) {
      users = JSON.parse(fs.readFileSync(LEGACY_USERS, "utf8"));
      if (!Array.isArray(users)) users = [];
    }
  } catch (_) {
    users = [];
  }
  try {
    if (fs.existsSync(LEGACY_FILES)) {
      files = JSON.parse(fs.readFileSync(LEGACY_FILES, "utf8"));
      if (!Array.isArray(files)) files = [];
    }
  } catch (_) {
    files = [];
  }
  if (!users.length && !files.length) return;

  const insertUser = database.prepare(`
    INSERT OR IGNORE INTO users
      (id, email, name, password_hash, picture, provider, google_sub, created_at, updated_at)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertFile = database.prepare(`
    INSERT OR IGNORE INTO files
      (id, user_id, name, kind, parent_id, mime_type, size, storage_path,
       starred, shared, trashed, trashed_at, created_at, updated_at)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = database.transaction(() => {
    for (const u of users) {
      const now = u.createdAt || new Date().toISOString();
      insertUser.run(
        u.id || crypto.randomUUID(),
        String(u.email || "").toLowerCase(),
        u.name || "",
        u.passwordHash || "",
        u.picture || "",
        u.provider || "email",
        u.googleSub || "",
        now,
        u.updatedAt || now,
      );
    }
    for (const f of files) {
      const now = f.createdAt || new Date().toISOString();
      const created =
        typeof now === "number" ? new Date(now).toISOString() : String(now);
      const updated = f.updatedAt
        ? typeof f.updatedAt === "number"
          ? new Date(f.updatedAt).toISOString()
          : String(f.updatedAt)
        : created;
      insertFile.run(
        f.id || crypto.randomUUID(),
        f.userId,
        f.name || "Untitled",
        f.kind === "folder" ? "folder" : "file",
        f.parentId || null,
        f.mimeType || "",
        Number(f.size) || 0,
        f.storagePath || "",
        f.starred ? 1 : 0,
        f.shared ? 1 : 0,
        f.trashed ? 1 : 0,
        f.trashedAt || null,
        created,
        updated,
      );
    }
  });
  tx();
  console.log(
    "Migrated " + users.length + " users and " + files.length + " files from JSON → SQLite",
  );
}

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name || "",
    passwordHash: row.password_hash || "",
    picture: row.picture || "",
    provider: row.provider || "email",
    googleSub: row.google_sub || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToFile(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    kind: row.kind,
    parentId: row.parent_id || null,
    mimeType: row.mime_type || "",
    size: row.size || 0,
    storagePath: row.storage_path || "",
    starred: !!row.starred,
    shared: !!row.shared,
    trashed: !!row.trashed,
    trashedAt: row.trashed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* ---------- Users ---------- */

function findUserById(id) {
  const row = getDb().prepare("SELECT * FROM users WHERE id = ?").get(id);
  return rowToUser(row);
}

function findUserByEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return null;
  const row = getDb().prepare("SELECT * FROM users WHERE email = ?").get(normalized);
  return rowToUser(row);
}

function findUserByGoogleSub(sub) {
  if (!sub) return null;
  const row = getDb().prepare("SELECT * FROM users WHERE google_sub = ?").get(sub);
  return rowToUser(row);
}

function createUser(fields) {
  const now = new Date().toISOString();
  const user = {
    id: crypto.randomUUID(),
    email: String(fields.email || "").trim().toLowerCase(),
    name: String(fields.name || "").trim(),
    passwordHash: fields.passwordHash || "",
    picture: fields.picture || "",
    provider: fields.provider || "email",
    googleSub: fields.googleSub || "",
    createdAt: now,
    updatedAt: now,
  };

  getDb()
    .prepare(
      `INSERT INTO users
        (id, email, name, password_hash, picture, provider, google_sub, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      user.id,
      user.email,
      user.name,
      user.passwordHash,
      user.picture,
      user.provider,
      user.googleSub,
      user.createdAt,
      user.updatedAt,
    );

  const userDir = path.join(UPLOADS_DIR, user.id);
  if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
  return user;
}

function updateUser(id, patch) {
  const existing = findUserById(id);
  if (!existing) return null;

  const next = {
    name: patch.name !== undefined ? patch.name : existing.name,
    picture: patch.picture !== undefined ? patch.picture : existing.picture,
    provider: patch.provider !== undefined ? patch.provider : existing.provider,
    googleSub: patch.googleSub !== undefined ? patch.googleSub : existing.googleSub,
    passwordHash:
      patch.passwordHash !== undefined ? patch.passwordHash : existing.passwordHash,
    updatedAt: new Date().toISOString(),
  };

  getDb()
    .prepare(
      `UPDATE users SET
        name = ?, picture = ?, provider = ?, google_sub = ?,
        password_hash = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      next.name,
      next.picture,
      next.provider,
      next.googleSub,
      next.passwordHash,
      next.updatedAt,
      id,
    );

  return findUserById(id);
}

/* ---------- Files ---------- */

function getUserFiles(userId) {
  const rows = getDb()
    .prepare("SELECT * FROM files WHERE user_id = ? ORDER BY updated_at DESC")
    .all(userId);
  return (rows || []).map(rowToFile);
}

function getFileById(userId, fileId) {
  const row = getDb()
    .prepare("SELECT * FROM files WHERE id = ? AND user_id = ?")
    .get(fileId, userId);
  return rowToFile(row);
}

function createFileRecord(userId, fields) {
  const now = new Date().toISOString();
  const record = {
    id: fields.id || crypto.randomUUID(),
    userId,
    name: String(fields.name || "Untitled").trim(),
    kind: fields.kind === "folder" ? "folder" : "file",
    parentId: fields.parentId || null,
    mimeType: fields.mimeType || "",
    size: Number(fields.size) || 0,
    storagePath: fields.storagePath || "",
    starred: !!fields.starred,
    shared: !!fields.shared,
    trashed: !!fields.trashed,
    trashedAt: fields.trashedAt || null,
    createdAt: fields.createdAt || now,
    updatedAt: now,
  };

  getDb()
    .prepare(
      `INSERT INTO files
        (id, user_id, name, kind, parent_id, mime_type, size, storage_path,
         starred, shared, trashed, trashed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      record.id,
      record.userId,
      record.name,
      record.kind,
      record.parentId,
      record.mimeType,
      record.size,
      record.storagePath,
      record.starred ? 1 : 0,
      record.shared ? 1 : 0,
      record.trashed ? 1 : 0,
      record.trashedAt,
      record.createdAt,
      record.updatedAt,
    );

  return record;
}

function updateFileRecord(userId, fileId, patch) {
  const existing = getFileById(userId, fileId);
  if (!existing) return null;

  const next = {
    name: patch.name !== undefined ? patch.name : existing.name,
    parentId: Object.prototype.hasOwnProperty.call(patch, "parentId")
      ? patch.parentId
      : existing.parentId,
    starred: patch.starred !== undefined ? !!patch.starred : existing.starred,
    shared: patch.shared !== undefined ? !!patch.shared : existing.shared,
    trashed: patch.trashed !== undefined ? !!patch.trashed : existing.trashed,
    trashedAt:
      patch.trashedAt !== undefined
        ? patch.trashedAt
        : patch.trashed === false
          ? null
          : existing.trashedAt,
    mimeType: patch.mimeType !== undefined ? patch.mimeType : existing.mimeType,
    size: patch.size !== undefined ? Number(patch.size) : existing.size,
    storagePath:
      patch.storagePath !== undefined ? patch.storagePath : existing.storagePath,
    updatedAt: new Date().toISOString(),
  };

  getDb()
    .prepare(
      `UPDATE files SET
        name = ?, parent_id = ?, starred = ?, shared = ?, trashed = ?,
        trashed_at = ?, mime_type = ?, size = ?, storage_path = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    )
    .run(
      next.name,
      next.parentId,
      next.starred ? 1 : 0,
      next.shared ? 1 : 0,
      next.trashed ? 1 : 0,
      next.trashedAt,
      next.mimeType,
      next.size,
      next.storagePath,
      next.updatedAt,
      fileId,
      userId,
    );

  return getFileById(userId, fileId);
}

function deleteFileRecord(userId, fileId) {
  const existing = getFileById(userId, fileId);
  if (!existing) return null;
  getDb()
    .prepare("DELETE FROM files WHERE id = ? AND user_id = ?")
    .run(fileId, userId);
  return existing;
}

function deleteFileRecordsByIds(userId, ids) {
  if (!ids || !ids.length) return [];
  const removed = [];
  const getOne = getDb().prepare("SELECT * FROM files WHERE id = ? AND user_id = ?");
  const del = getDb().prepare("DELETE FROM files WHERE id = ? AND user_id = ?");

  const run = getDb().transaction((idList) => {
    for (const id of idList) {
      const row = getOne.get(id, userId);
      if (row) {
        removed.push(rowToFile(row));
        del.run(id, userId);
      }
    }
  });
  run(ids);
  return removed;
}

/* ---------- Disk helpers ---------- */

function userUploadDir(userId) {
  const dir = path.join(UPLOADS_DIR, userId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function absoluteStoragePath(userId, storagePath) {
  if (!storagePath) return null;
  const safe = path.normalize(storagePath).replace(/^(\.\.(\/|\\|$))+/, "");
  return path.join(userUploadDir(userId), safe);
}

function removeStorageFile(userId, storagePath) {
  const abs = absoluteStoragePath(userId, storagePath);
  if (!abs) return;
  try {
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch (_) {}
}

function publicFile(record) {
  if (!record) return null;
  return {
    id: record.id,
    name: record.name,
    kind: record.kind,
    parentId: record.parentId,
    mimeType: record.mimeType,
    size: record.size,
    starred: !!record.starred,
    shared: !!record.shared,
    trashed: !!record.trashed,
    trashedAt: record.trashedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    ownerId: record.userId || record.ownerId || null,
    ownerEmail: record.ownerEmail || null,
    ownerName: record.ownerName || null,
    sharedWithMe: !!record.sharedWithMe,
    sharedWith: record.sharedWith || [],
  };
}

/* ---------- Shares ---------- */

function listChildFiles(ownerId, parentId) {
  if (parentId == null || parentId === undefined || parentId === "") {
    return getDb()
      .prepare(
        `SELECT * FROM files WHERE user_id = ? AND (parent_id IS NULL OR parent_id = '') AND trashed = 0`,
      )
      .all(ownerId)
      .map(rowToFile)
      .filter(Boolean);
  }
  return getDb()
    .prepare(
      `SELECT * FROM files WHERE user_id = ? AND parent_id = ? AND trashed = 0`,
    )
    .all(ownerId, parentId)
    .map(rowToFile)
    .filter(Boolean);
}

function shareFile(ownerId, fileId, sharedWithId) {
  const file = getFileById(ownerId, fileId);
  if (!file || file.trashed) return null;
  if (ownerId === sharedWithId) return null;
  const existing = getDb()
    .prepare("SELECT * FROM shares WHERE file_id = ? AND shared_with_id = ?")
    .get(fileId, sharedWithId);
  if (existing) {
    getDb()
      .prepare("UPDATE files SET shared = 1, updated_at = ? WHERE id = ? AND user_id = ?")
      .run(new Date().toISOString(), fileId, ownerId);
    return getFileById(ownerId, fileId);
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO shares (id, file_id, owner_id, shared_with_id, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(id, fileId, ownerId, sharedWithId, now);
  getDb()
    .prepare("UPDATE files SET shared = 1, updated_at = ? WHERE id = ? AND user_id = ?")
    .run(now, fileId, ownerId);
  return getFileById(ownerId, fileId);
}

/** Share a file or folder and every descendant (so shared folders are not empty). */
function shareFileRecursive(ownerId, fileId, sharedWithId) {
  const root = shareFile(ownerId, fileId, sharedWithId);
  if (!root) return null;
  function walk(pid) {
    const kids = listChildFiles(ownerId, pid);
    kids.forEach(function (child) {
      if (!child || !child.id) return;
      shareFile(ownerId, child.id, sharedWithId);
      if (child.kind === "folder") walk(child.id);
    });
  }
  if (root.kind === "folder") walk(root.id);
  return getFileById(ownerId, fileId);
}

function unshareFileRecursive(ownerId, fileId, sharedWithId) {
  const root = getFileById(ownerId, fileId);
  if (!root) return null;
  function walk(pid) {
    const kids = listChildFiles(ownerId, pid);
    kids.forEach(function (child) {
      if (!child || !child.id) return;
      if (child.kind === "folder") walk(child.id);
      unshareFile(ownerId, child.id, sharedWithId);
    });
  }
  if (root.kind === "folder") walk(root.id);
  return unshareFile(ownerId, fileId, sharedWithId);
}

function unshareFile(ownerId, fileId, sharedWithId) {
  getDb()
    .prepare(
      "DELETE FROM shares WHERE file_id = ? AND owner_id = ? AND shared_with_id = ?",
    )
    .run(fileId, ownerId, sharedWithId);
  const left = getDb()
    .prepare("SELECT COUNT(*) AS c FROM shares WHERE file_id = ?")
    .get(fileId);
  if (!left || left.c === 0) {
    getDb()
      .prepare("UPDATE files SET shared = 0, updated_at = ? WHERE id = ? AND user_id = ?")
      .run(new Date().toISOString(), fileId, ownerId);
  }
  return getFileById(ownerId, fileId);
}

function listSharesForFile(ownerId, fileId) {
  const rows = getDb()
    .prepare(
      `SELECT s.id, s.shared_with_id, s.created_at, u.email, u.name, u.picture
       FROM shares s
       JOIN users u ON u.id = s.shared_with_id
       WHERE s.file_id = ? AND s.owner_id = ?
       ORDER BY s.created_at DESC`,
    )
    .all(fileId, ownerId);
  return (rows || []).map(function (r) {
    return {
      id: r.id,
      userId: r.shared_with_id,
      email: r.email,
      name: r.name || "",
      picture: r.picture || "",
      createdAt: r.created_at,
    };
  });
}

function getSharedWithMe(userId) {
  const rows = getDb()
    .prepare(
      `SELECT f.*, u.email AS owner_email, u.name AS owner_name
       FROM shares s
       JOIN files f ON f.id = s.file_id
       JOIN users u ON u.id = s.owner_id
       WHERE s.shared_with_id = ? AND f.trashed = 0
       ORDER BY s.created_at DESC`,
    )
    .all(userId);
  return (rows || []).map(function (row) {
    const rec = rowToFile(row);
    if (!rec) return null;
    rec.ownerEmail = row.owner_email || "";
    rec.ownerName = row.owner_name || "";
    rec.sharedWithMe = true;
    rec.shared = true;
    return rec;
  }).filter(Boolean);
}

function canAccessFile(userId, fileId) {
  const own = getFileById(userId, fileId);
  if (own) return { file: own, asOwner: true };
  const row = getDb()
    .prepare(
      `SELECT f.*, u.email AS owner_email, u.name AS owner_name
       FROM shares s
       JOIN files f ON f.id = s.file_id
       JOIN users u ON u.id = s.owner_id
       WHERE s.file_id = ? AND s.shared_with_id = ? AND f.trashed = 0`,
    )
    .get(fileId, userId);
  if (!row) return null;
  const rec = rowToFile(row);
  rec.ownerEmail = row.owner_email || "";
  rec.ownerName = row.owner_name || "";
  rec.sharedWithMe = true;
  return { file: rec, asOwner: false };
}

function getUserFilesWithShareMeta(userId) {
  const own = getUserFiles(userId).map(function (f) {
    const people = listSharesForFile(userId, f.id);
    f.sharedWith = people;
    f.shared = people.length > 0 || !!f.shared;
    f.sharedWithMe = false;
    const owner = findUserById(userId);
    f.ownerEmail = owner ? owner.email : "";
    f.ownerName = owner ? owner.name : "";
    f.ownerId = userId;
    return f;
  });
  const incoming = getSharedWithMe(userId);
  return { own: own, sharedWithMe: incoming };
}

/* ---------- Notifications ---------- */

function createNotification(userId, fields) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO notifications (id, user_id, title, message, kind, file_id, read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    )
    .run(
      id,
      userId,
      String(fields.title || "Update"),
      String(fields.message || ""),
      String(fields.kind || "share"),
      fields.fileId || null,
      now,
    );
  return {
    id: id,
    userId: userId,
    title: fields.title || "Update",
    message: fields.message || "",
    kind: fields.kind || "share",
    fileId: fields.fileId || null,
    read: false,
    createdAt: now,
  };
}

function getUserNotifications(userId, limit) {
  const lim = Math.min(Number(limit) || 50, 100);
  const rows = getDb()
    .prepare(
      `SELECT * FROM notifications WHERE user_id = ?
       ORDER BY created_at DESC LIMIT ?`,
    )
    .all(userId, lim);
  return (rows || []).map(function (r) {
    return {
      id: r.id,
      title: r.title,
      message: r.message || "",
      kind: r.kind || "share",
      fileId: r.file_id,
      read: !!r.read,
      time: r.created_at ? Date.parse(r.created_at) || Date.now() : Date.now(),
      createdAt: r.created_at,
    };
  });
}

function markNotificationsRead(userId, ids) {
  if (ids && ids.length) {
    const stmt = getDb().prepare(
      "UPDATE notifications SET read = 1 WHERE user_id = ? AND id = ?",
    );
    ids.forEach(function (id) {
      stmt.run(userId, id);
    });
  } else {
    getDb()
      .prepare("UPDATE notifications SET read = 1 WHERE user_id = ?")
      .run(userId);
  }
  return true;
}

function clearNotifications(userId) {
  getDb().prepare("DELETE FROM notifications WHERE user_id = ?").run(userId);
  return true;
}

function unreadNotificationCount(userId) {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read = 0")
    .get(userId);
  return (row && row.c) || 0;
}


/* ---------- Password reset tokens ---------- */

function createPasswordResetToken(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const now = new Date();
  const expires = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour
  // invalidate previous unused tokens for this user
  getDb()
    .prepare("UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0")
    .run(userId);
  getDb()
    .prepare(
      `INSERT INTO password_reset_tokens (token, user_id, expires_at, used, created_at)
       VALUES (?, ?, ?, 0, ?)`,
    )
    .run(token, userId, expires.toISOString(), now.toISOString());
  return { token, expiresAt: expires.toISOString() };
}

function findValidResetToken(token) {
  if (!token) return null;
  const row = getDb()
    .prepare(
      `SELECT t.token, t.user_id, t.expires_at, t.used, u.email, u.name
       FROM password_reset_tokens t
       JOIN users u ON u.id = t.user_id
       WHERE t.token = ?`,
    )
    .get(token);
  if (!row) return null;
  if (row.used) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return {
    token: row.token,
    userId: row.user_id,
    email: row.email,
    name: row.name,
    expiresAt: row.expires_at,
  };
}

function markResetTokenUsed(token) {
  getDb()
    .prepare("UPDATE password_reset_tokens SET used = 1 WHERE token = ?")
    .run(token);
}

function updateUserPassword(userId, passwordHash) {
  getDb()
    .prepare(
      `UPDATE users SET password_hash = ?, provider = CASE WHEN provider = '' THEN 'email' ELSE provider END, updated_at = ? WHERE id = ?`,
    )
    .run(passwordHash, new Date().toISOString(), userId);
  return findUserById(userId);
}


function deleteUserAccount(userId) {
  if (!userId) return false;
  const database = getDb();
  // Remove shares (as owner or recipient)
  database.prepare("DELETE FROM shares WHERE owner_id = ? OR shared_with_id = ?").run(userId, userId);
  // Notifications
  try {
    database.prepare("DELETE FROM notifications WHERE user_id = ?").run(userId);
  } catch (_) {}
  // Password reset tokens
  try {
    database.prepare("DELETE FROM password_reset_tokens WHERE user_id = ?").run(userId);
  } catch (_) {}
  // Files + storage
  const files = getUserFiles(userId) || [];
  files.forEach(function (f) {
    try {
      if (f.kind === "file" && f.storagePath) {
        removeStorageFile(userId, f.storagePath);
      }
    } catch (_) {}
  });
  // Also try cloud delete if available at runtime — server may clean via supabase
  try {
    database.prepare("DELETE FROM files WHERE user_id = ?").run(userId);
  } catch (_) {}
  // User row
  database.prepare("DELETE FROM users WHERE id = ?").run(userId);
  // Local upload dir
  try {
    const dir = userUploadDir(userId);
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch (_) {}
  return true;
}

module.exports = {
  ensureDirs,
  findUserById,
  findUserByEmail,
  findUserByGoogleSub,
  createUser,
  updateUser,
  deleteUserAccount,
  getUserFiles,
  getFileById,
  createFileRecord,
  updateFileRecord,
  deleteFileRecord,
  deleteFileRecordsByIds,
  publicFile,
  userUploadDir,
  absoluteStoragePath,
  removeStorageFile,
  UPLOADS_DIR,
  DB_PATH,
  createPasswordResetToken,
  findValidResetToken,
  markResetTokenUsed,
  updateUserPassword,
  shareFile,
  shareFileRecursive,
  unshareFile,
  unshareFileRecursive,
  listSharesForFile,
  getSharedWithMe,
  canAccessFile,
  getUserFilesWithShareMeta,
  createNotification,
  getUserNotifications,
  markNotificationsRead,
  clearNotifications,
  unreadNotificationCount,
};
