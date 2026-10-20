/**
 * Mini Drive – Express server with database-backed auth + file storage
 * Upload API accepts JSON with base64 content (no multer required).
 */

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const db = require("./db");
const cloud = require("./supabase-storage");

/* Load .env if present (no dotenv package required) */
(function loadEnv() {
  try {
    const envPath = path.join(__dirname, ".env");
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const s = line.trim();
      if (!s || s.startsWith("#")) continue;
      const i = s.indexOf("=");
      if (i < 1) continue;
      const key = s.slice(0, i).trim();
      let val = s.slice(i + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch (_) {}
})();



const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET =
  process.env.JWT_SECRET || "minidrive-dev-secret-change-me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const MAX_FILE_BYTES = 1 * 1024 * 1024 * 1024; // 1 GB per file

db.ensureDirs();

/* ---------- Auth helpers ---------- */

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name || "",
    picture: user.picture || "",
    provider: user.provider || "email",
  };
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

function authPayload(user) {
  return { token: signToken(user), user: publicUser(user) };
}

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

function requireAuth(req, res, next) {
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return sendError(res, 401, "Sign in required.");
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.findUserById(payload.sub);
    if (!user) return sendError(res, 401, "Session is no longer valid.");
    req.user = user;
    next();
  } catch (_) {
    return sendError(res, 401, "Session expired. Please sign in again.");
  }
}

/* ---------- App ---------- */

const app = express();
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
// Large limit for base64 file payloads (~33% overhead)
app.use(express.json({ limit: "1200mb" })); // base64 overhead for up to ~1 GB files
app.use(express.static(__dirname));

/* ========== AUTH ROUTES ========== */

app.post("/api/auth/signup", async (req, res) => {
  const name = String((req.body && req.body.name) || "").trim();
  const email = normalizeEmail(req.body && req.body.email);
  const password = String((req.body && req.body.password) || "");

  if (!name) return sendError(res, 400, "Please enter your name.");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return sendError(res, 400, "Please enter a valid email address.");
  }
  if (password.length < 6) {
    return sendError(res, 400, "Password must be at least 6 characters.");
  }

  if (db.findUserByEmail(email)) {
    return sendError(res, 409, "An account with this email already exists.");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = db.createUser({
    email,
    name,
    passwordHash,
    provider: "email",
  });
  return res.status(201).json(authPayload(user));
});

app.post("/api/auth/login", async (req, res) => {
  const email = normalizeEmail(req.body && req.body.email);
  const password = String((req.body && req.body.password) || "");

  if (!email || !password) {
    return sendError(res, 400, "Email and password are required.");
  }

  const user = db.findUserByEmail(email);
  if (!user) {
    return sendError(res, 401, "No account found for this email.");
  }
  if (!user.passwordHash) {
    return sendError(
      res,
      401,
      "This account uses Google sign-in. Use Continue with Google.",
    );
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return sendError(res, 401, "Incorrect email or password.");

  return res.json(authPayload(user));
});

app.post("/api/auth/google", async (req, res) => {
  const accessToken = String((req.body && req.body.accessToken) || "").trim();
  if (!accessToken) {
    return sendError(res, 400, "Google access token is missing.");
  }

  let profile;
  try {
    const googleRes = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      { headers: { Authorization: "Bearer " + accessToken } },
    );
    if (!googleRes.ok) {
      return sendError(res, 401, "Google could not verify this sign-in.");
    }
    profile = await googleRes.json();
  } catch (_) {
    return sendError(res, 502, "Could not reach Google to verify the account.");
  }

  const email = normalizeEmail(profile.email);
  if (!email) {
    return sendError(res, 400, "Google did not return an email for this account.");
  }

  let user =
    db.findUserByEmail(email) ||
    (profile.sub ? db.findUserByGoogleSub(profile.sub) : null);
  const created = !user;

  if (!user) {
    user = db.createUser({
      email,
      name: profile.name || profile.given_name || email.split("@")[0],
      passwordHash: "",
      picture: profile.picture || "",
      provider: "google",
      googleSub: profile.sub || "",
    });
  } else {
    user = db.updateUser(user.id, {
      name: profile.name || user.name,
      picture: profile.picture || user.picture,
      provider: user.passwordHash ? user.provider : "google",
      googleSub: profile.sub || user.googleSub,
    });
  }

  return res.json({ ...authPayload(user), created });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  return res.json({ user: publicUser(req.user) });
});

/** Update profile (name + picture linked to account email in DB) */
app.patch("/api/auth/profile", requireAuth, async (req, res) => {
  const body = req.body || {};
  const patch = {};
  if (body.name !== undefined) {
    const name = String(body.name || "").trim();
    if (!name) return sendError(res, 400, "Name cannot be empty.");
    patch.name = name;
  }
  if (body.picture !== undefined) {
    const picture = String(body.picture || "");
    // Allow empty (remove) or data-URL images under ~2.5MB base64
    if (picture && picture.length > 3.5 * 1024 * 1024) {
      return sendError(res, 400, "Profile picture is too large (max about 2 MB).");
    }
    if (picture && !/^data:image\//i.test(picture) && picture.length > 0) {
      return sendError(res, 400, "Profile picture must be an image.");
    }
    patch.picture = picture;
  }
  if (!Object.keys(patch).length) {
    return sendError(res, 400, "Nothing to update.");
  }
  const user = db.updateUser(req.user.id, patch);
  return res.json({ user: publicUser(user) });
});

app.post("/api/auth/logout", (_req, res) => {
  return res.json({ ok: true });
});

/* ========== FILES API ========== */

app.get("/api/files", requireAuth, (req, res) => {
  const pack = db.getUserFilesWithShareMeta(req.user.id);
  const own = (pack.own || []).map(db.publicFile);
  const sharedWithMe = (pack.sharedWithMe || []).map(db.publicFile);
  return res.json({ items: own, sharedWithMe: sharedWithMe });
});

app.post("/api/files/folder", requireAuth, (req, res) => {
  const name = String((req.body && req.body.name) || "").trim() || "New Folder";
  const parentId = (req.body && req.body.parentId) || null;

  if (parentId) {
    const parent = db.getFileById(req.user.id, parentId);
    if (!parent || parent.kind !== "folder" || parent.trashed) {
      return sendError(res, 400, "Parent folder not found.");
    }
  }

  const record = db.createFileRecord(req.user.id, {
    name,
    kind: "folder",
    parentId,
  });
  return res.status(201).json({ item: db.publicFile(record) });
});

/**
 * Upload files as JSON:
 * { parentId?, files: [ { name, mimeType, contentBase64 } ] }
 */
app.post("/api/files/upload", requireAuth, async (req, res) => {
  const parentId = (req.body && req.body.parentId) || null;
  const fileList = Array.isArray(req.body && req.body.files)
    ? req.body.files
    : [];

  if (!fileList.length) {
    return sendError(res, 400, "No files provided.");
  }

  if (parentId) {
    const parent = db.getFileById(req.user.id, parentId);
    if (!parent || parent.kind !== "folder" || parent.trashed) {
      return sendError(res, 400, "Parent folder not found.");
    }
  }

  const created = [];
  try {
    for (const f of fileList) {
      const name = String(f.name || "file").trim() || "file";
      const mimeType = String(f.mimeType || "application/octet-stream");
      let b64 = String(f.contentBase64 || "");
      const comma = b64.indexOf(",");
      if (b64.startsWith("data:") && comma !== -1) {
        b64 = b64.slice(comma + 1);
      }
      let buffer;
      try {
        buffer = Buffer.from(b64, "base64");
      } catch (_) {
        return sendError(res, 400, "Invalid base64 content for " + name);
      }
      if (buffer.length > MAX_FILE_BYTES) {
        return sendError(res, 400, name + " is too large (max 1 GB).");
      }
      if (!buffer.length) {
        return sendError(res, 400, name + " is empty.");
      }

      if (!req.user || !req.user.id) {
        return sendError(res, 401, "Not signed in.");
      }

      const ext = path.extname(name) || "";
      const safeExt = ext.slice(0, 20).replace(/[^\w.]/g, "");
      // Storage key must stay simple — UUID + optional extension only
      const storageName = crypto.randomUUID() + (safeExt || "");

      // Primary: Supabase cloud storage (falls back to local disk)
      await cloud.uploadFile(req.user.id, storageName, buffer, mimeType);

      const record = db.createFileRecord(req.user.id, {
        name,
        kind: "file",
        parentId,
        mimeType,
        size: buffer.length,
        storagePath: storageName,
      });
      created.push(db.publicFile(record));
    }
  } catch (err) {
    console.error("Upload error:", err);
    return sendError(res, 500, err.message || "Upload failed.");
  }

  return res.status(201).json({
    items: created,
    storage: cloud.status(),
  });
});

app.get("/api/files/:id/download", requireAuth, async (req, res) => {
  const access = db.canAccessFile(req.user.id, req.params.id);
  if (!access || !access.file || access.file.kind !== "file") {
    return sendError(res, 404, "File not found.");
  }
  const record = access.file;
  if (record.trashed) {
    return sendError(res, 410, "File is in trash.");
  }
  try {
    // Bytes live under the owner's user id path in storage
    const ownerId = record.userId || req.user.id;
    const buffer = await cloud.downloadFile(ownerId, record.storagePath);
    res.setHeader(
      "Content-Type",
      record.mimeType || "application/octet-stream",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="' +
        encodeURIComponent(record.name).replace(/['()]/g, "_") +
        '"',
    );
    res.setHeader("Content-Length", buffer.length);
    return res.send(buffer);
  } catch (err) {
    console.error("Download error:", err);
    return sendError(
      res,
      404,
      err.message || "File content is missing on the server.",
    );
  }
});

app.patch("/api/files/:id", requireAuth, (req, res) => {
  const record = db.getFileById(req.user.id, req.params.id);
  if (!record) return sendError(res, 404, "Item not found.");

  const body = req.body || {};
  const patch = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return sendError(res, 400, "Name cannot be empty.");
    patch.name = name;
  }
  if (Object.prototype.hasOwnProperty.call(body, "parentId")) {
    const parentId = body.parentId || null;
    if (parentId) {
      if (parentId === record.id) {
        return sendError(res, 400, "Cannot move an item into itself.");
      }
      const parent = db.getFileById(req.user.id, parentId);
      if (!parent || parent.kind !== "folder" || parent.trashed) {
        return sendError(res, 400, "Parent folder not found.");
      }
    }
    patch.parentId = parentId;
  }
  if (typeof body.starred === "boolean") patch.starred = body.starred;
  if (typeof body.shared === "boolean") patch.shared = body.shared;
  if (typeof body.trashed === "boolean") {
    patch.trashed = body.trashed;
    patch.trashedAt = body.trashed ? new Date().toISOString() : null;
  }

  const updated = db.updateFileRecord(req.user.id, record.id, patch);
  return res.json({ item: db.publicFile(updated) });
});

app.delete("/api/files/:id", requireAuth, async (req, res) => {
  const record = db.getFileById(req.user.id, req.params.id);
  if (!record) return sendError(res, 404, "Item not found.");

  const all = db.getUserFiles(req.user.id);
  const toDelete = new Set([record.id]);

  if (record.kind === "folder") {
    let changed = true;
    while (changed) {
      changed = false;
      for (const f of all) {
        if (f.parentId && toDelete.has(f.parentId) && !toDelete.has(f.id)) {
          toDelete.add(f.id);
          changed = true;
        }
      }
    }
  }

  const removed = db.deleteFileRecordsByIds(req.user.id, [...toDelete]);
  for (const r of removed) {
    if (r.kind === "file" && r.storagePath) {
      await cloud.deleteFile(req.user.id, r.storagePath);
    }
  }
  return res.json({ ok: true, deleted: removed.length });
});

app.post("/api/files/purge", requireAuth, async (req, res) => {
  const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids : [];
  if (!ids.length) return sendError(res, 400, "No ids provided.");

  const all = db.getUserFiles(req.user.id);
  const toDelete = new Set(ids.filter((id) => all.some((f) => f.id === id)));

  let changed = true;
  while (changed) {
    changed = false;
    for (const f of all) {
      if (f.parentId && toDelete.has(f.parentId) && !toDelete.has(f.id)) {
        toDelete.add(f.id);
        changed = true;
      }
    }
  }

  const removed = db.deleteFileRecordsByIds(req.user.id, [...toDelete]);
  for (const r of removed) {
    if (r.kind === "file" && r.storagePath) {
      await cloud.deleteFile(req.user.id, r.storagePath);
    }
  }
  return res.json({ ok: true, deleted: removed.length });
});

app.post("/api/files/empty-trash", requireAuth, async (req, res) => {
  const trashed = db.getUserFiles(req.user.id).filter((f) => f.trashed);
  const ids = trashed.map((f) => f.id);
  if (!ids.length) return res.json({ ok: true, deleted: 0 });

  const removed = db.deleteFileRecordsByIds(req.user.id, ids);
  for (const r of removed) {
    if (r.kind === "file" && r.storagePath) {
      await cloud.deleteFile(req.user.id, r.storagePath);
    }
  }
  return res.json({ ok: true, deleted: removed.length });
});


/* ========== PASSWORD RESET ========== */

app.post("/api/auth/forgot-password", async (req, res) => {
  const email = normalizeEmail(req.body && req.body.email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return sendError(res, 400, "Please enter a valid email address.");
  }

  const user = db.findUserByEmail(email);
  // Always return a generic message (do not reveal whether the email exists)
  const generic = {
    ok: true,
    message:
      "If an account exists for that email, a password reset link has been created. It expires in 1 hour.",
  };

  if (!user) {
    return res.json(generic);
  }
  if (!user.passwordHash) {
    // Google-only account — still generic, but no token
    return res.json({
      ...generic,
      message:
        "If an account exists for that email, a password reset link has been created. Google sign-in accounts should use Continue with Google.",
    });
  }

  const { token, expiresAt } = db.createPasswordResetToken(user.id);
  const base =
    (req.headers.origin && String(req.headers.origin).replace(/\/$/, "")) ||
    ("http://localhost:" + PORT);
  const resetLink = base + "/login.html?mode=reset&token=" + encodeURIComponent(token);

  console.log("\n========== PASSWORD RESET ==========");
  console.log("User:", user.email);
  console.log("Reset link:", resetLink);
  console.log("Expires:", expiresAt);
  console.log("====================================\n");

  // For local/dev projects: return the link so the UI can show it (no email server required)
  return res.json({
    ...generic,
    resetLink: resetLink,
    expiresAt: expiresAt,
  });
});

app.post("/api/auth/reset-password", async (req, res) => {
  const token = String((req.body && req.body.token) || "").trim();
  const password = String((req.body && req.body.password) || "");

  if (!token) return sendError(res, 400, "Reset token is missing.");
  if (password.length < 6) {
    return sendError(res, 400, "Password must be at least 6 characters.");
  }

  const record = db.findValidResetToken(token);
  if (!record) {
    return sendError(
      res,
      400,
      "This reset link is invalid or has expired. Please request a new one.",
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  db.updateUserPassword(record.userId, passwordHash);
  db.markResetTokenUsed(token);

  return res.json({
    ok: true,
    message: "Password updated. You can sign in with your new password.",
  });
});

app.get("/api/auth/reset-password/validate", (req, res) => {
  const token = String(req.query.token || "").trim();
  const record = db.findValidResetToken(token);
  if (!record) {
    return sendError(res, 400, "This reset link is invalid or has expired.");
  }
  return res.json({
    ok: true,
    email: record.email,
    name: record.name || "",
  });
});



/* ========== REPORT BUG ========== */
const REPORT_TO = process.env.REPORT_TO || "hamzakhancollege4@gmail.com";

function httpsJsonRequest(hostname, pathName, method, headers, bodyObj) {
  const https = require("https");
  const body = bodyObj ? JSON.stringify(bodyObj) : "";
  return new Promise(function (resolve, reject) {
    const reqHttps = https.request(
      {
        hostname: hostname,
        path: pathName,
        method: method || "POST",
        headers: Object.assign(
          {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
          },
          headers || {},
        ),
        timeout: 12000,
      },
      function (r) {
        let data = "";
        r.on("data", function (c) {
          data += c;
        });
        r.on("end", function () {
          resolve({ status: r.statusCode, data: data });
        });
      },
    );
    reqHttps.on("timeout", function () {
      reqHttps.destroy();
      reject(new Error("HTTPS request timed out"));
    });
    reqHttps.on("error", reject);
    if (body) reqHttps.write(body);
    reqHttps.end();
  });
}

/** Prefer Resend (HTTPS) — Render blocks SMTP ports. */
async function sendViaResend(report) {
  const key = process.env.RESEND_API_KEY || "";
  if (!key) return false;
  const from =
    process.env.RESEND_FROM || "MiniDrive <onboarding@resend.dev>";
  const result = await httpsJsonRequest(
    "api.resend.com",
    "/emails",
    "POST",
    { Authorization: "Bearer " + key },
    {
      from: from,
      to: [REPORT_TO],
      subject: "MiniDrive Bug Report",
      text:
        "From: " +
        (report.from || "unknown") +
        "\nUser id: " +
        (report.userId || "") +
        "\nPage: " +
        (report.page || "") +
        "\nTime: " +
        (report.at || "") +
        "\n\n" +
        (report.message || ""),
      reply_to: report.from || undefined,
    },
  );
  if (result.status >= 200 && result.status < 300) {
    console.log("[report-bug] Resend OK", result.data.slice(0, 120));
    return true;
  }
  console.warn("[report-bug] Resend failed", result.status, result.data.slice(0, 300));
  return false;
}

/** Optional: Web3Forms access key (HTTPS, free). */
async function sendViaWeb3Forms(report) {
  const accessKey = process.env.WEB3FORMS_ACCESS_KEY || "";
  if (!accessKey) return false;
  const result = await httpsJsonRequest(
    "api.web3forms.com",
    "/submit",
    "POST",
    {},
    {
      access_key: accessKey,
      subject: "MiniDrive Bug Report",
      from_name: "MiniDrive",
      email: report.from || "noreply@minidrive.app",
      message:
        (report.message || "") +
        "\n\nUser: " +
        (report.from || "unknown") +
        "\nPage: " +
        (report.page || ""),
    },
  );
  if (result.status >= 200 && result.status < 300) {
    console.log("[report-bug] Web3Forms OK");
    return true;
  }
  console.warn("[report-bug] Web3Forms failed", result.status, result.data.slice(0, 200));
  return false;
}

async function sendViaSmtp(report) {
  const user = process.env.REPORT_SMTP_USER || process.env.SMTP_USER || "";
  const pass = process.env.REPORT_SMTP_PASS || process.env.SMTP_PASS || "";
  if (!user || !pass) return false;
  let nodemailer;
  try {
    nodemailer = require("nodemailer");
  } catch (e) {
    return false;
  }
  const host = process.env.REPORT_SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.REPORT_SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: host,
    port: port,
    secure: port === 465,
    auth: { user: user, pass: pass },
    connectionTimeout: 6000,
    greetingTimeout: 6000,
    socketTimeout: 8000,
  });
  try {
    await Promise.race([
      transporter.sendMail({
        from: '"MiniDrive" <' + user + ">",
        to: REPORT_TO,
        replyTo: report.from || user,
        subject: "MiniDrive Bug Report",
        text:
          "From: " +
          (report.from || "unknown") +
          "\n\n" +
          (report.message || ""),
      }),
      new Promise(function (_, reject) {
        setTimeout(function () {
          reject(new Error("Connection timeout"));
        }, 8000);
      }),
    ]);
    console.log("[report-bug] SMTP email sent to", REPORT_TO);
    return true;
  } finally {
    try {
      transporter.close();
    } catch (_) {}
  }
}

async function sendBugReportEmail(report) {
  // 1) Resend HTTPS (works on Render)
  try {
    if (await sendViaResend(report)) return true;
  } catch (e) {
    console.warn("[report-bug] Resend error:", e && e.message);
  }
  // 2) Web3Forms HTTPS
  try {
    if (await sendViaWeb3Forms(report)) return true;
  } catch (e) {
    console.warn("[report-bug] Web3Forms error:", e && e.message);
  }
  // 3) SMTP (often blocked on Render free tier)
  try {
    if (await sendViaSmtp(report)) return true;
  } catch (e) {
    console.warn("[report-bug] SMTP failed:", e && e.message);
  }
  console.warn(
    "[report-bug] No email sent. On Render, SMTP is often blocked — set RESEND_API_KEY (https://resend.com) or WEB3FORMS_ACCESS_KEY.",
  );
  return false;
}

app.post("/api/report-bug", requireAuth, async (req, res) => {
  try {
    const message = String((req.body && req.body.message) || "").trim();
    if (!message || message.length < 3) {
      return sendError(res, 400, "Please describe the bug.");
    }
    if (message.length > 4000) {
      return sendError(res, 400, "Report is too long (max 4000 characters).");
    }
    const fromEmail =
      (req.user && req.user.email) || String((req.body && req.body.email) || "");
    const page = String((req.body && req.body.page) || "");
    const userAgent = String((req.body && req.body.userAgent) || "");
    const report = {
      at: new Date().toISOString(),
      from: fromEmail,
      userId: req.user && req.user.id,
      message: message,
      page: page,
      userAgent: userAgent,
    };
    try {
      const reportsDir = path.join(__dirname, "data");
      if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
      fs.appendFileSync(
        path.join(reportsDir, "bug-reports.jsonl"),
        JSON.stringify(report) + "\n",
        "utf8",
      );
    } catch (e) {
      console.warn("Could not save bug report file:", e && e.message);
    }

    let emailed = false;
    try {
      emailed = await sendBugReportEmail(report);
    } catch (e) {
      console.warn("[report-bug] send failed:", e && e.message);
    }

    return res.json({
      ok: true,
      emailed: emailed,
      message: emailed
        ? "Report emailed to support."
        : "Report saved. Email needs RESEND_API_KEY on Render (SMTP is blocked by Render).",
    });
  } catch (err) {
    console.error("report-bug:", err);
    return sendError(res, 500, (err && err.message) || "Could not send report.");
  }
});

/* ========== DELETE ACCOUNT ========== */
app.delete("/api/auth/account", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    // Remove cloud objects first
    try {
      const files = db.getUserFiles(userId) || [];
      for (const f of files) {
        if (f && f.kind === "file" && f.storagePath) {
          try {
            await cloud.deleteFile(userId, f.storagePath);
          } catch (_) {}
        }
      }
    } catch (_) {}
    const ok = db.deleteUserAccount(userId);
    if (!ok) return sendError(res, 500, "Could not delete account.");
    return res.json({ ok: true, message: "Account deleted." });
  } catch (err) {
    console.error("delete account:", err);
    return sendError(res, 500, (err && err.message) || "Could not delete account.");
  }
});

/* ---------- Start ---------- */

/* ========== SHARE ========== */

app.post("/api/files/:id/share", requireAuth, (req, res) => {
  const email = normalizeEmail(req.body && req.body.email);
  if (!email) return sendError(res, 400, "Enter the email of a Mini Drive user.");
  if (email === normalizeEmail(req.user.email)) {
    return sendError(res, 400, "You cannot share with yourself. Enter the other account email.");
  }
  const target = db.findUserByEmail(email);
  if (!target) {
    return sendError(
      res,
      404,
      "No Mini Drive account found for that email. They must sign up first.",
    );
  }
  const file = db.getFileById(req.user.id, req.params.id);
  if (!file || file.trashed) return sendError(res, 404, "File or folder not found.");

  const updated = (db.shareFileRecursive || db.shareFile)(req.user.id, req.params.id, target.id);
  if (!updated) return sendError(res, 400, "Could not share this item.");

  const who = req.user.name || req.user.email;
  const isFolder = file.kind === "folder";
  db.createNotification(target.id, {
    title: isFolder ? "Folder shared with you" : "Shared with you",
    message:
      who +
      (isFolder
        ? " shared the folder “" + file.name + "” (and its files) with you."
        : " shared “" + file.name + "” with you."),
    kind: "share",
    fileId: file.id,
  });

  const people = db.listSharesForFile(req.user.id, file.id);
  return res.json({
    item: db.publicFile(
      Object.assign({}, updated, {
        sharedWith: people,
        shared: true,
        ownerEmail: req.user.email,
        ownerName: req.user.name,
      }),
    ),
    sharedWith: people,
  });
});

app.delete("/api/files/:id/share", requireAuth, (req, res) => {
  const email = normalizeEmail(req.body && req.body.email);
  if (!email) return sendError(res, 400, "Email is required to remove access.");
  const target = db.findUserByEmail(email);
  if (!target) return sendError(res, 404, "User not found.");
  const file = db.getFileById(req.user.id, req.params.id);
  if (!file) return sendError(res, 404, "File not found.");
  (db.unshareFileRecursive || db.unshareFile)(req.user.id, req.params.id, target.id);
  db.createNotification(target.id, {
    title: "Sharing removed",
    message:
      (req.user.name || req.user.email) +
      " stopped sharing “" +
      file.name +
      "” with you.",
    kind: "share",
    fileId: file.id,
  });
  const people = db.listSharesForFile(req.user.id, file.id);
  return res.json({
    item: db.publicFile(
      Object.assign({}, db.getFileById(req.user.id, file.id), {
        sharedWith: people,
        shared: people.length > 0,
        ownerEmail: req.user.email,
      }),
    ),
    sharedWith: people,
  });
});

app.get("/api/files/:id/shares", requireAuth, (req, res) => {
  const file = db.getFileById(req.user.id, req.params.id);
  if (!file) return sendError(res, 404, "File not found.");
  return res.json({ sharedWith: db.listSharesForFile(req.user.id, req.params.id) });
});

/* ========== NOTIFICATIONS ========== */

app.get("/api/notifications", requireAuth, (req, res) => {
  const items = db.getUserNotifications(req.user.id, 50);
  const unread = db.unreadNotificationCount(req.user.id);
  return res.json({ items: items, unread: unread });
});

app.post("/api/notifications/read", requireAuth, (req, res) => {
  const ids = (req.body && req.body.ids) || null;
  db.markNotificationsRead(req.user.id, ids);
  return res.json({ ok: true, unread: db.unreadNotificationCount(req.user.id) });
});

app.post("/api/notifications/clear", requireAuth, (req, res) => {
  db.clearNotifications(req.user.id);
  return res.json({ ok: true });
});

app.get("/api/storage/status", (_req, res) => {
  return res.json(cloud.status());
});

app.listen(PORT, () => {
  db.ensureDirs();
  cloud.init();
  console.log("Mini Drive server running at http://localhost:" + PORT);
  console.log("  Auth + files API: /api/auth/*  /api/files/*");
  console.log("  Storage:", cloud.status().provider);
  console.log("  Open http://localhost:" + PORT + "/login.html");
});
