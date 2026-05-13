import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const dataDir = join(rootDir, "data");
const dbPath = join(dataDir, "auth.sqlite");

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
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const JWT_SECRET = process.env.AUTH_JWT_SECRET || "replace-this-secret-before-production";
const COOKIE_NAME = "kr_membership_session";
const PORT = Number(process.env.AUTH_API_PORT || 4174);
const isProduction = process.env.NODE_ENV === "production";

if (isProduction && !process.env.AUTH_JWT_SECRET) {
  throw new Error("AUTH_JWT_SECRET must be set before running authentication in production.");
}

const app = express();
app.use(express.json());
app.use(cookieParser());

const normalizeIdentifier = (value = "") => value.trim().toLowerCase();
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
    db.prepare("UPDATE users SET full_name = ?, password_hash = ?, role = 'admin' WHERE id = ?").run(
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

  if (findUserByIdentifier(identifier)) {
    return res.status(409).json({ error: "An account already exists for that email or phone." });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const role = "user";

  const result = db
    .prepare("INSERT INTO users (full_name, identifier, password_hash, role) VALUES (?, ?, ?, ?)")
    .run(fullName, identifier, passwordHash, role);
  const user = findUserById(result.lastInsertRowid);
  const token = signToken(user);
  setSessionCookie(res, token);

  return res.status(201).json({ user: publicUser(user) });
});

app.post("/api/auth/login", async (req, res) => {
  const identifier = normalizeIdentifier(req.body.identifier);
  const password = String(req.body.password || "");
  const user = findUserByIdentifier(identifier);

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "Invalid email/phone or password." });
  }

  const token = signToken(user);
  setSessionCookie(res, token);
  return res.json({ user: publicUser(user) });
});

app.post("/api/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  return res.json({ ok: true });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  return res.json({ user: publicUser(req.user) });
});

app.post("/api/auth/forgot-password", (req, res) => {
  const identifier = normalizeIdentifier(req.body.identifier);
  // Production later: create reset token, store a hashed token, and send via email/SMS provider.
  return res.json({
    ok: true,
    message: identifier
      ? "If an account exists, a secure reset link or code will be sent."
      : "Enter an email or phone number to request a reset."
  });
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
