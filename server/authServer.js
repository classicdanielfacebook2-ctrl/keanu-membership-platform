import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const dataDir = join(rootDir, "data");
const dbPath = join(dataDir, "auth.sqlite");
const localEnvPath = join(rootDir, ".env.local");

if (existsSync(localEnvPath)) {
  const envFile = readFileSync(localEnvPath, "utf8");
  for (const line of envFile.split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
}

if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const db = new DatabaseSync(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    identifier TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    verified INTEGER NOT NULL DEFAULT 0,
    otp_hash TEXT,
    otp_expires_at TEXT,
    otp_attempts INTEGER NOT NULL DEFAULT 0,
    reset_code_hash TEXT,
    reset_expires_at TEXT,
    reset_attempts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const ensureColumn = (table, column, definition) => {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((item) => item.name);
  if (!columns.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
};

ensureColumn("users", "verified", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("users", "otp_hash", "TEXT");
ensureColumn("users", "otp_expires_at", "TEXT");
ensureColumn("users", "otp_attempts", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("users", "reset_code_hash", "TEXT");
ensureColumn("users", "reset_expires_at", "TEXT");
ensureColumn("users", "reset_attempts", "INTEGER NOT NULL DEFAULT 0");

const JWT_SECRET = process.env.AUTH_JWT_SECRET || "replace-this-secret-before-production";
const COOKIE_NAME = "kr_membership_session";
const PORT = Number(process.env.AUTH_API_PORT || 4174);
const isProduction = process.env.NODE_ENV === "production";
const OTP_EXPIRES_MINUTES = 10;
const RESET_EXPIRES_MINUTES = 15;
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const OTP_FROM_EMAIL = "verification@keanureeves.company";
const COMPANY_NAME = "Keanu Reeves Company";

if (isProduction && !process.env.AUTH_JWT_SECRET) {
  throw new Error("AUTH_JWT_SECRET must be set before running authentication in production.");
}

const app = express();
app.use(express.json());
app.use(cookieParser());

const normalizeIdentifier = (value = "") => value.trim().toLowerCase();
const isEmailIdentifier = (value = "") => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const publicUser = (user) =>
  user
    ? {
        id: user.id,
        fullName: user.full_name,
        identifier: user.identifier,
        role: user.role,
        verified: Boolean(user.verified)
      }
    : null;

const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, {
    expiresIn: "7d"
  });

const setSessionCookie = (res, token) => {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/"
  });
};

const clearSessionCookie = (res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/"
  });
};

const findUserByIdentifier = (identifier) =>
  db.prepare("SELECT * FROM users WHERE identifier = ?").get(identifier);

const findUserById = (id) => db.prepare("SELECT * FROM users WHERE id = ?").get(id);

const cleanupExpiredOtpUsers = () => {
  const result = db
    .prepare("DELETE FROM users WHERE verified = 0 AND otp_expires_at IS NOT NULL AND otp_expires_at < ?")
    .run(new Date().toISOString());

  if (result.changes > 0) {
    console.log(`Removed ${result.changes} expired unverified registration draft(s).`);
  }
};

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));
const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return entities[character];
  });

const createOtpForUser = async (userId) => {
  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 12);
  const expiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000).toISOString();

  db.prepare("UPDATE users SET otp_hash = ?, otp_expires_at = ?, otp_attempts = 0 WHERE id = ?").run(
    otpHash,
    expiresAt,
    userId
  );

  return { otp, expiresAt };
};

const createPasswordResetForUser = async (userId) => {
  const resetCode = generateOtp();
  const resetCodeHash = await bcrypt.hash(resetCode, 12);
  const expiresAt = new Date(Date.now() + RESET_EXPIRES_MINUTES * 60 * 1000).toISOString();

  db.prepare("UPDATE users SET reset_code_hash = ?, reset_expires_at = ?, reset_attempts = 0 WHERE id = ?").run(
    resetCodeHash,
    expiresAt,
    userId
  );

  return { resetCode, expiresAt };
};

const verificationEmailHtml = ({ fullName, otp }) => `
  <div style="margin:0;padding:32px;background:#050505;color:#f7f3ea;font-family:Inter,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;border:1px solid rgba(244,216,139,.34);background:#0d0d0d;padding:32px;">
      <p style="margin:0 0 12px;color:#f4d88b;font-size:12px;letter-spacing:.18em;text-transform:uppercase;">${COMPANY_NAME}</p>
      <h1 style="margin:0 0 18px;font-family:Georgia,serif;font-size:32px;line-height:1.1;color:#fff9ed;">Verify your account</h1>
      <p style="margin:0 0 20px;line-height:1.7;color:#cfc7ba;">Hello ${escapeHtml(fullName)}, use the verification code below to activate your membership account.</p>
      <div style="margin:24px 0;padding:18px 22px;border:1px solid rgba(244,216,139,.4);background:#060606;color:#f4d88b;font-size:34px;font-weight:800;letter-spacing:.28em;text-align:center;">${otp}</div>
      <p style="margin:0;color:#a9a197;line-height:1.7;">This code expires in ${OTP_EXPIRES_MINUTES} minutes. If you did not create this account, you can ignore this email.</p>
    </div>
  </div>
`;

const passwordResetEmailHtml = ({ fullName, resetCode }) => `
  <div style="margin:0;padding:32px;background:#050505;color:#f7f3ea;font-family:Inter,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;border:1px solid rgba(244,216,139,.34);background:#0d0d0d;padding:32px;">
      <p style="margin:0 0 12px;color:#f4d88b;font-size:12px;letter-spacing:.18em;text-transform:uppercase;">${COMPANY_NAME}</p>
      <h1 style="margin:0 0 18px;font-family:Georgia,serif;font-size:32px;line-height:1.1;color:#fff9ed;">Reset your password</h1>
      <p style="margin:0 0 20px;line-height:1.7;color:#cfc7ba;">Hello ${escapeHtml(fullName)}, use the reset code below to create a new password for your account.</p>
      <div style="margin:24px 0;padding:18px 22px;border:1px solid rgba(244,216,139,.4);background:#060606;color:#f4d88b;font-size:34px;font-weight:800;letter-spacing:.28em;text-align:center;">${resetCode}</div>
      <p style="margin:0;color:#a9a197;line-height:1.7;">This code expires in ${RESET_EXPIRES_MINUTES} minutes. If you did not request a password reset, you can ignore this email.</p>
    </div>
  </div>
`;

const sendOtpEmail = async ({ to, fullName, otp }) => {
  if (!RESEND_API_KEY) {
    if (isProduction) {
      throw new Error("RESEND_API_KEY must be configured to send verification emails.");
    }
    console.warn(`[development] OTP for ${to}: ${otp}`);
    return { id: "development-console-otp" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: `${COMPANY_NAME} <${OTP_FROM_EMAIL}>`,
      to,
      subject: `${COMPANY_NAME} verification code`,
      html: verificationEmailHtml({ fullName, otp })
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || "Verification email could not be sent.");
  }
  return data;
};

const sendPasswordResetEmail = async ({ to, fullName, resetCode }) => {
  if (!RESEND_API_KEY) {
    if (isProduction) {
      throw new Error("RESEND_API_KEY must be configured to send password reset emails.");
    }
    console.warn(`[development] Password reset code for ${to}: ${resetCode}`);
    return { id: "development-console-reset-code" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: `${COMPANY_NAME} <${OTP_FROM_EMAIL}>`,
      to,
      subject: `${COMPANY_NAME} password reset code`,
      html: passwordResetEmailHtml({ fullName, resetCode })
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || "Password reset email could not be sent.");
  }
  return data;
};

const seedAdminFromEnvironment = async () => {
  const fullName = String(process.env.ADMIN_FULL_NAME || "Management Admin").trim();
  const identifier = normalizeIdentifier(process.env.ADMIN_IDENTIFIER);
  const password = String(process.env.ADMIN_PASSWORD || "");

  if (!identifier && !password) {
    return;
  }

  if (!identifier || password.length < 12) {
    console.warn("Admin seed skipped. Set ADMIN_IDENTIFIER and ADMIN_PASSWORD with at least 12 characters.");
    return;
  }

  const existing = findUserByIdentifier(identifier);
  const passwordHash = await bcrypt.hash(password, 12);

  if (existing) {
    db.prepare("UPDATE users SET full_name = ?, password_hash = ?, role = 'admin', verified = 1 WHERE id = ?").run(
      fullName,
      passwordHash,
      existing.id
    );
    console.log(`Admin account updated for ${identifier}`);
    return;
  }

  db.prepare("INSERT INTO users (full_name, identifier, password_hash, role, verified) VALUES (?, ?, ?, 'admin', 1)").run(
    fullName,
    identifier,
    passwordHash
  );
  console.log(`Admin account created for ${identifier}`);
};

const requireAuth = (req, res, next) => {
  const token = req.cookies[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = findUserById(payload.sub);
    if (!user) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Session user not found" });
    }
    req.user = user;
    return next();
  } catch {
    clearSessionCookie(res);
    return res.status(401).json({ error: "Invalid or expired session" });
  }
};

app.post("/api/auth/register", async (req, res) => {
  const fullName = String(req.body.fullName || "").trim();
  const identifier = normalizeIdentifier(req.body.identifier);
  const password = String(req.body.password || "");

  if (!fullName || !identifier || password.length < 8) {
    return res.status(400).json({
      error: "Full name, email or phone, and a password of at least 8 characters are required."
    });
  }

  if (!isEmailIdentifier(identifier)) {
    return res.status(400).json({ error: "A valid email address is required for account verification." });
  }

  cleanupExpiredOtpUsers();
  const existing = findUserByIdentifier(identifier);
  if (existing?.verified) {
    return res.status(409).json({ error: "An account already exists for that email or phone." });
  }
  if (existing) {
    db.prepare("DELETE FROM users WHERE id = ?").run(existing.id);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const role = "user";

  const result = db
    .prepare("INSERT INTO users (full_name, identifier, password_hash, role, verified) VALUES (?, ?, ?, ?, 0)")
    .run(fullName, identifier, passwordHash, role);
  const user = findUserById(result.lastInsertRowid);
  const { otp, expiresAt } = await createOtpForUser(user.id);

  try {
    await sendOtpEmail({ to: identifier, fullName, otp });
  } catch (error) {
    db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
    return res.status(502).json({ error: error.message });
  }

  return res.status(201).json({
    verificationRequired: true,
    identifier,
    expiresAt,
    message: "A verification code has been sent to your email."
  });
});

app.post("/api/auth/login", async (req, res) => {
  const identifier = normalizeIdentifier(req.body.identifier);
  const password = String(req.body.password || "");
  const user = findUserByIdentifier(identifier);

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "Invalid email/phone or password." });
  }

  if (!user.verified) {
    return res.status(403).json({
      error: "Please verify your email before logging in.",
      verificationRequired: true,
      identifier: user.identifier
    });
  }

  const token = signToken(user);
  setSessionCookie(res, token);
  return res.json({ user: publicUser(user) });
});

app.post("/api/auth/verify-otp", async (req, res) => {
  const identifier = normalizeIdentifier(req.body.identifier);
  const otp = String(req.body.otp || "").trim();
  const user = findUserByIdentifier(identifier);

  if (!user) {
    return res.status(404).json({ error: "Account not found." });
  }

  if (user.verified) {
    const token = signToken(user);
    setSessionCookie(res, token);
    return res.json({ user: publicUser(user), message: "Account already verified." });
  }

  if (!/^\d{6}$/.test(otp) || !user.otp_hash || !user.otp_expires_at) {
    return res.status(400).json({ error: "Enter the 6-digit verification code sent to your email." });
  }

  if (Date.now() > Date.parse(user.otp_expires_at)) {
    db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
    return res.status(400).json({ error: "Verification code expired. Please register again to receive a new code." });
  }

  if (user.otp_attempts >= 5) {
    return res.status(429).json({ error: "Too many verification attempts. Request a new code." });
  }

  const validOtp = await bcrypt.compare(otp, user.otp_hash);
  if (!validOtp) {
    db.prepare("UPDATE users SET otp_attempts = otp_attempts + 1 WHERE id = ?").run(user.id);
    return res.status(401).json({ error: "Invalid verification code." });
  }

  db.prepare("UPDATE users SET verified = 1, otp_hash = NULL, otp_expires_at = NULL, otp_attempts = 0 WHERE id = ?").run(
    user.id
  );
  const verifiedUser = findUserById(user.id);
  const token = signToken(verifiedUser);
  setSessionCookie(res, token);
  return res.json({ user: publicUser(verifiedUser), message: "Account verified successfully." });
});

app.post("/api/auth/resend-otp", async (req, res) => {
  const identifier = normalizeIdentifier(req.body.identifier);
  const user = findUserByIdentifier(identifier);

  if (!user) {
    return res.status(404).json({ error: "Account not found." });
  }

  if (user.verified) {
    return res.json({ ok: true, message: "Account is already verified." });
  }

  if (!isEmailIdentifier(user.identifier)) {
    return res.status(400).json({ error: "A valid email address is required for verification." });
  }

  const { otp, expiresAt } = await createOtpForUser(user.id);
  await sendOtpEmail({ to: user.identifier, fullName: user.full_name, otp });
  return res.json({ ok: true, expiresAt, message: "A new verification code has been sent." });
});

app.post("/api/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  return res.json({ ok: true });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  return res.json({ user: publicUser(req.user) });
});

app.post("/api/auth/forgot-password", async (req, res) => {
  const identifier = normalizeIdentifier(req.body.identifier);
  const neutralMessage = "If this email is registered, we sent a reset link/code to your email address.";

  if (identifier && isEmailIdentifier(identifier)) {
    const user = findUserByIdentifier(identifier);
    if (user) {
      const { resetCode } = await createPasswordResetForUser(user.id);
      try {
        await sendPasswordResetEmail({ to: user.identifier, fullName: user.full_name, resetCode });
        console.log("Password reset email sent");
      } catch (error) {
        console.error("Password reset email failed", { message: error.message });
      }
    }
  }

  return res.json({ ok: true, message: neutralMessage });
});

app.post("/api/auth/reset-password", async (req, res) => {
  const identifier = normalizeIdentifier(req.body.identifier);
  const resetCode = String(req.body.resetCode || "").trim();
  const password = String(req.body.password || "");

  if (!identifier || !/^\d{6}$/.test(resetCode) || password.length < 8) {
    return res.status(400).json({ error: "Email, 6-digit reset code, and a new password are required." });
  }

  const user = findUserByIdentifier(identifier);
  if (!user || !user.reset_code_hash || !user.reset_expires_at) {
    return res.status(400).json({ error: "Invalid or expired reset code." });
  }

  if (Date.now() > Date.parse(user.reset_expires_at)) {
    db.prepare("UPDATE users SET reset_code_hash = NULL, reset_expires_at = NULL, reset_attempts = 0 WHERE id = ?").run(
      user.id
    );
    return res.status(400).json({ error: "Reset code expired. Request a new code." });
  }

  if (user.reset_attempts >= 5) {
    return res.status(429).json({ error: "Too many reset attempts. Request a new code." });
  }

  const validCode = await bcrypt.compare(resetCode, user.reset_code_hash);
  if (!validCode) {
    db.prepare("UPDATE users SET reset_attempts = reset_attempts + 1 WHERE id = ?").run(user.id);
    return res.status(401).json({ error: "Invalid reset code." });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  db.prepare(
    "UPDATE users SET password_hash = ?, reset_code_hash = NULL, reset_expires_at = NULL, reset_attempts = 0 WHERE id = ?"
  ).run(passwordHash, user.id);

  return res.json({ ok: true, message: "Password updated. You can now log in." });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

await seedAdminFromEnvironment();

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Auth API running at http://127.0.0.1:${PORT}`);
  if (JWT_SECRET === "replace-this-secret-before-production") {
    console.warn("AUTH_JWT_SECRET is using the development fallback. Set a strong secret before production.");
  }
});
