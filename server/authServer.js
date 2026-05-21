import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";
import { Server as SocketIOServer } from "socket.io";
import { isAllowedPhoneCountry, isAllowedPhoneNumber } from "../src/data/phoneCountries.js";

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
    email TEXT,
    phone TEXT,
    phone_country TEXT,
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

  CREATE TABLE IF NOT EXISTS registration_intents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    identifier TEXT NOT NULL UNIQUE,
    email TEXT,
    phone TEXT,
    phone_country TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    channel TEXT NOT NULL,
    otp_hash TEXT,
    otp_attempts INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT NOT NULL,
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
ensureColumn("users", "email", "TEXT");
ensureColumn("users", "phone", "TEXT");
ensureColumn("users", "phone_country", "TEXT");
ensureColumn("users", "otp_hash", "TEXT");
ensureColumn("users", "otp_expires_at", "TEXT");
ensureColumn("users", "otp_attempts", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("users", "reset_code_hash", "TEXT");
ensureColumn("users", "reset_expires_at", "TEXT");
ensureColumn("users", "reset_attempts", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("registration_intents", "email", "TEXT");
ensureColumn("registration_intents", "phone", "TEXT");
ensureColumn("registration_intents", "phone_country", "TEXT");

const JWT_SECRET = process.env.AUTH_JWT_SECRET || "replace-this-secret-before-production";
const COOKIE_NAME = "kr_membership_session";
const PORT = Number(process.env.AUTH_API_PORT || 4174);
const isProduction = process.env.NODE_ENV === "production";
const OTP_EXPIRES_MINUTES = 10;
const RESET_EXPIRES_MINUTES = 15;
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const OTP_FROM_EMAIL = "verification@keanureeves.company";
const COMPANY_NAME = "Keanu Reeves Company";
const SUPPORT_DB_NAME = process.env.MONGODB_DB || "keanu_membership_platform";

if (isProduction && !process.env.AUTH_JWT_SECRET) {
  throw new Error("AUTH_JWT_SECRET must be set before running authentication in production.");
}

const app = express();
app.use(express.json());
app.use(cookieParser());

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: [
      "http://127.0.0.1:4173",
      "http://localhost:4173",
      process.env.FRONTEND_ORIGIN || ""
    ].filter(Boolean),
    credentials: true
  }
});

const normalizeIdentifier = (value = "") => value.trim().toLowerCase();
const isEmailIdentifier = (value = "") => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const normalizePhoneIdentifier = (value = "") => {
  const trimmed = String(value).trim();
  if (!trimmed.startsWith("+")) return trimmed.replace(/[\s().-]/g, "");
  return `+${trimmed.slice(1).replace(/[^\d]/g, "")}`;
};
const isPhoneIdentifier = (value = "") => /^\+[1-9]\d{7,14}$/.test(normalizePhoneIdentifier(value));
const normalizeAuthIdentifier = (value = "") => {
  const trimmed = String(value).trim();
  return isEmailIdentifier(trimmed) ? normalizeIdentifier(trimmed) : normalizePhoneIdentifier(trimmed);
};
const getVerificationChannel = (identifier = "") => (isEmailIdentifier(identifier) ? "email" : "sms");
const publicUser = (user) =>
  user
    ? {
        id: user.id,
        fullName: user.full_name,
        identifier: user.identifier,
        email: user.email,
        phone: user.phone,
        phoneCountry: user.phone_country,
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
  db.prepare("SELECT * FROM users WHERE identifier = ? OR email = ? OR phone = ?").get(identifier, identifier, identifier);

const findUserById = (id) => db.prepare("SELECT * FROM users WHERE id = ?").get(id);
const findRegistrationIntent = (identifier) =>
  db.prepare("SELECT * FROM registration_intents WHERE identifier = ?").get(identifier);

const cleanupExpiredOtpUsers = () => {
  const result = db
    .prepare("DELETE FROM users WHERE verified = 0 AND otp_expires_at IS NOT NULL AND otp_expires_at < ?")
    .run(new Date().toISOString());

  if (result.changes > 0) {
    console.log(`Removed ${result.changes} expired unverified registration draft(s).`);
  }
};

const cleanupExpiredRegistrationIntents = () => {
  const result = db.prepare("DELETE FROM registration_intents WHERE expires_at < ?").run(new Date().toISOString());
  if (result.changes > 0) {
    console.log(`Removed ${result.changes} expired registration intent(s).`);
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

const twilioRequest = async (path, body) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID || "";
  const authToken = process.env.TWILIO_AUTH_TOKEN || "";
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID || "";

  if (!accountSid || !authToken || !serviceSid) {
    throw new Error("Twilio Verify environment variables are not configured.");
  }

  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const response = await fetch(`https://verify.twilio.com/v2/Services/${serviceSid}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams(body).toString()
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || "Twilio Verify request failed.");
  }
  return data;
};

const sendTwilioSmsOtp = ({ to }) =>
  twilioRequest("/Verifications", {
    To: normalizePhoneIdentifier(to),
    Channel: "sms"
  });

const checkTwilioSmsOtp = ({ to, code }) =>
  twilioRequest("/VerificationCheck", {
    To: normalizePhoneIdentifier(to),
    Code: code
  });

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

let supportMongoClientPromise = null;
let supportMongoWarningShown = false;
const onlineAgents = new Map();
const supportMemory = {
  conversations: new Map(),
  messages: new Map()
};

const supportCollections = async () => {
  if (!process.env.MONGODB_URI) {
    if (!supportMongoWarningShown) {
      console.warn("MONGODB_URI missing. Support chat will use temporary memory storage in local development.");
      supportMongoWarningShown = true;
    }
    return null;
  }

  if (!supportMongoClientPromise) {
    console.log("MongoDB URI found for support chat.");
    supportMongoClientPromise = new MongoClient(process.env.MONGODB_URI).connect();
  }

  const client = await supportMongoClientPromise;
  const database = client.db(SUPPORT_DB_NAME);
  return {
    conversations: database.collection("supportConversations"),
    messages: database.collection("supportMessages")
  };
};

const supportNow = () => new Date().toISOString();

const defaultConversation = (visitorId) => ({
  id: randomUUID(),
  visitorId,
  status: "bot",
  assignedAgent: "",
  agentRequested: false,
  unreadForAgent: 0,
  unreadForVisitor: 0,
  lastMessage: "Conversation opened",
  createdAt: supportNow(),
  updatedAt: supportNow()
});

const normalizeConversation = (conversation) =>
  conversation
    ? {
        id: conversation.id,
        visitorId: conversation.visitorId,
        status: conversation.status || "bot",
        assignedAgent: conversation.assignedAgent || "",
        agentRequested: Boolean(conversation.agentRequested),
        unreadForAgent: Number(conversation.unreadForAgent || 0),
        unreadForVisitor: Number(conversation.unreadForVisitor || 0),
        lastMessage: conversation.lastMessage || "",
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt
      }
    : null;

const getSupportConversationByVisitor = async (visitorId) => {
  const collections = await supportCollections();
  if (collections) {
    const existing = await collections.conversations.findOne({ visitorId });
    if (existing) return normalizeConversation(existing);
  } else {
    const existing = [...supportMemory.conversations.values()].find((item) => item.visitorId === visitorId);
    if (existing) return normalizeConversation(existing);
  }

  const conversation = defaultConversation(visitorId);
  await saveSupportConversation(conversation);
  return conversation;
};

const getSupportConversationById = async (id) => {
  const collections = await supportCollections();
  if (collections) {
    return normalizeConversation(await collections.conversations.findOne({ id }));
  }
  return normalizeConversation(supportMemory.conversations.get(id));
};

const saveSupportConversation = async (conversation) => {
  const normalized = normalizeConversation({ ...conversation, updatedAt: supportNow() });
  const collections = await supportCollections();
  if (collections) {
    await collections.conversations.updateOne({ id: normalized.id }, { $set: normalized }, { upsert: true });
  } else {
    supportMemory.conversations.set(normalized.id, normalized);
  }
  return normalized;
};

const listSupportConversations = async () => {
  const collections = await supportCollections();
  if (collections) {
    const items = await collections.conversations.find({}).sort({ updatedAt: -1 }).limit(100).toArray();
    return items.map(normalizeConversation);
  }
  return [...supportMemory.conversations.values()].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
};

const getSupportMessages = async (conversationId) => {
  const collections = await supportCollections();
  if (collections) {
    return collections.messages.find({ conversationId }).sort({ createdAt: 1 }).limit(250).toArray();
  }
  return supportMemory.messages.get(conversationId) || [];
};

const saveSupportMessage = async ({ conversationId, role, text, attachments = [], status = "delivered", author = "" }) => {
  const message = {
    id: randomUUID(),
    conversationId,
    role,
    author,
    text: String(text || "").trim(),
    attachments,
    status,
    createdAt: supportNow()
  };
  const collections = await supportCollections();
  if (collections) {
    await collections.messages.insertOne(message);
  } else {
    supportMemory.messages.set(conversationId, [...(supportMemory.messages.get(conversationId) || []), message]);
  }
  return message;
};

const markConversationMessagesSeen = async (conversationId, viewerRole) => {
  const rolesToUpdate = viewerRole === "agent" ? ["user"] : ["agent", "bot"];
  const collections = await supportCollections();
  if (collections) {
    await collections.messages.updateMany({ conversationId, role: { $in: rolesToUpdate } }, { $set: { status: "seen" } });
  } else {
    const messages = supportMemory.messages.get(conversationId) || [];
    supportMemory.messages.set(
      conversationId,
      messages.map((message) => (rolesToUpdate.includes(message.role) ? { ...message, status: "seen" } : message))
    );
  }
};

const needsHumanAgent = (text = "") =>
  /\b(human|agent|support|representative|person|staff|unresolved)\b/i.test(text) ||
  /\b(still|cannot|can't|failed|broken|not working|no code|no otp)\b/i.test(text);

const ruleBasedSupportReply = (text = "") => {
  const normalized = text.toLowerCase();
  if (/\botp|verification|code\b/.test(normalized)) {
    return "For verification code issues, confirm the selected email or phone number, then use Resend Code. If the code still does not arrive, I can connect you with support.";
  }
  if (/password|reset|login|sign in/.test(normalized)) {
    return "For password recovery, open Forgot password, choose email or SMS, enter the code you receive, and set a new password. I can transfer this chat if the reset is not working.";
  }
  if (/membership|card|silver|gold|vip|premium|apply/.test(normalized)) {
    return "Membership applications begin from the Apply page. Choose a card level, complete your details, then continue through the guided application flow.";
  }
  if (/payment|pay|stripe|paypal|purchase|paid/.test(normalized)) {
    return "Payments should only be completed through an approved secure payment provider. The current review site will not collect card details manually.";
  }
  return "I can help with verification, password recovery, membership cards, and payment questions. If this needs a person, type agent and I will transfer the conversation.";
};

const openAiSupportReply = async (text) => {
  if (!process.env.OPENAI_API_KEY) return "";

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content:
              "You are the premium support assistant for Keanu Reeves Company membership platform. Be concise, professional, and helpful. Help only with OTP, password reset, membership questions, and payment support. If a human is needed, say you will transfer the conversation."
          },
          { role: "user", content: text }
        ]
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error?.message || "OpenAI support reply failed.");
    }
    return data?.choices?.[0]?.message?.content?.trim() || "";
  } catch (error) {
    console.error("OpenAI support reply failed", { message: error.message });
    return "";
  }
};

const sendAdminState = async () => {
  io.to("support:agents").emit("support:admin-state", {
    conversations: await listSupportConversations(),
    agentOnline: onlineAgents.size > 0
  });
};

const broadcastConversationUpdate = async (conversationId) => {
  const conversation = await getSupportConversationById(conversationId);
  io.to("support:agents").emit("support:conversation-updated", conversation);
  io.to(`support:${conversationId}`).emit("support:conversation", conversation);
};

io.on("connection", (socket) => {
  const role = socket.handshake.query.role === "agent" ? "agent" : "visitor";

  if (role === "agent") {
    onlineAgents.set(socket.id, true);
    socket.join("support:agents");
    io.emit("support:agent-status", { online: true, count: onlineAgents.size });
    sendAdminState();
  }

  socket.on("support:join", async ({ visitorId } = {}) => {
    try {
      if (role === "agent") {
        await sendAdminState();
        return;
      }

      const safeVisitorId = String(visitorId || randomUUID()).slice(0, 120);
      const conversation = await getSupportConversationByVisitor(safeVisitorId);
      socket.join(`support:${conversation.id}`);
      socket.emit("support:history", {
        conversation,
        messages: await getSupportMessages(conversation.id),
        agentOnline: onlineAgents.size > 0
      });
    } catch (error) {
      socket.emit("support:error", { error: error.message });
    }
  });

  socket.on("support:open-conversation", async ({ conversationId } = {}) => {
    if (role !== "agent" || !conversationId) return;
    socket.join(`support:${conversationId}`);
    socket.emit("support:history", {
      conversation: await getSupportConversationById(conversationId),
      messages: await getSupportMessages(conversationId),
      agentOnline: onlineAgents.size > 0
    });
  });

  socket.on("support:typing", ({ conversationId, typing }) => {
    if (!conversationId) return;
    socket.to(`support:${conversationId}`).emit("support:typing", { role, typing: Boolean(typing) });
  });

  socket.on("support:seen", async ({ conversationId } = {}) => {
    if (!conversationId) return;
    await markConversationMessagesSeen(conversationId, role);
    const conversation = await getSupportConversationById(conversationId);
    const patch =
      role === "agent" ? { ...conversation, unreadForAgent: 0 } : { ...conversation, unreadForVisitor: 0 };
    await saveSupportConversation(patch);
    await broadcastConversationUpdate(conversationId);
  });

  socket.on("support:agent-takeover", async ({ conversationId } = {}) => {
    if (role !== "agent" || !conversationId) return;
    const conversation = await getSupportConversationById(conversationId);
    if (!conversation) return;
    const updated = await saveSupportConversation({
      ...conversation,
      status: "agent",
      assignedAgent: socket.id,
      agentRequested: false
    });
    const message = await saveSupportMessage({
      conversationId,
      role: "system",
      text: "A support agent has joined the conversation.",
      status: "delivered"
    });
    io.to(`support:${conversationId}`).emit("support:message", message);
    io.to(`support:${conversationId}`).emit("support:conversation", updated);
    await sendAdminState();
  });

  socket.on("support:message", async ({ conversationId, visitorId, text, attachments = [] } = {}) => {
    try {
      const conversation = conversationId
        ? await getSupportConversationById(conversationId)
        : await getSupportConversationByVisitor(String(visitorId || randomUUID()).slice(0, 120));

      if (!conversation) return;
      socket.join(`support:${conversation.id}`);

      const messageRole = role === "agent" ? "agent" : "user";
      const message = await saveSupportMessage({
        conversationId: conversation.id,
        role: messageRole,
        author: role === "agent" ? "Support Agent" : "Visitor",
        text,
        // Production should move file payloads to Vercel Blob/S3 and store only signed URLs here.
        attachments: Array.isArray(attachments) ? attachments.slice(0, 4) : []
      });
      io.to(`support:${conversation.id}`).emit("support:message", message);

      const transferNeeded = messageRole === "user" && needsHumanAgent(text);
      const updatedConversation = await saveSupportConversation({
        ...conversation,
        status: messageRole === "agent" ? "agent" : transferNeeded ? "waiting_agent" : conversation.status,
        agentRequested: transferNeeded || conversation.agentRequested,
        unreadForAgent: messageRole === "user" ? conversation.unreadForAgent + 1 : conversation.unreadForAgent,
        unreadForVisitor: messageRole === "agent" ? conversation.unreadForVisitor + 1 : conversation.unreadForVisitor,
        lastMessage: message.text || (message.attachments?.length ? "File attachment" : ""),
        assignedAgent: messageRole === "agent" ? socket.id : conversation.assignedAgent
      });
      io.to(`support:${conversation.id}`).emit("support:conversation", updatedConversation);
      await sendAdminState();

      if (messageRole === "user" && updatedConversation.status !== "agent") {
        io.to(`support:${conversation.id}`).emit("support:typing", { role: "bot", typing: true });
        const aiReply =
          transferNeeded
            ? "I will connect you with a support agent. Please keep this chat open while the team reviews your message."
            : (await openAiSupportReply(message.text)) || ruleBasedSupportReply(message.text);
        const botMessage = await saveSupportMessage({
          conversationId: conversation.id,
          role: "bot",
          author: "AI Support",
          text: aiReply
        });
        const afterBot = await saveSupportConversation({
          ...updatedConversation,
          unreadForVisitor: updatedConversation.unreadForVisitor + 1,
          lastMessage: aiReply
        });
        io.to(`support:${conversation.id}`).emit("support:typing", { role: "bot", typing: false });
        io.to(`support:${conversation.id}`).emit("support:message", botMessage);
        io.to(`support:${conversation.id}`).emit("support:conversation", afterBot);
        await sendAdminState();
      }
    } catch (error) {
      socket.emit("support:error", { error: error.message });
    }
  });

  socket.on("disconnect", () => {
    if (role === "agent") {
      onlineAgents.delete(socket.id);
      io.emit("support:agent-status", { online: onlineAgents.size > 0, count: onlineAgents.size });
      sendAdminState();
    }
  });
});

app.post("/api/auth/register", async (req, res) => {
  const fullName = String(req.body.fullName || "").trim();
  const email = normalizeAuthIdentifier(req.body.email || req.body.identifier);
  const phone = normalizeAuthIdentifier(req.body.phone);
  const phoneCountry = String(req.body.phoneCountry || "").toUpperCase();
  const verificationMethod = req.body.verificationMethod === "sms" ? "sms" : "email";
  const identifier = verificationMethod === "sms" ? phone : email;
  const password = String(req.body.password || "");

  if (!fullName || !email || !phone || password.length < 8) {
    return res.status(400).json({
      error: "Full name, email address, phone number, and a password of at least 8 characters are required."
    });
  }

  if (!isEmailIdentifier(email) || !isPhoneIdentifier(phone) || !isAllowedPhoneCountry(phoneCountry) || !isAllowedPhoneNumber(phone)) {
    return res.status(400).json({
      error: "Enter a valid email address and select an allowed phone country."
    });
  }

  cleanupExpiredOtpUsers();
  cleanupExpiredRegistrationIntents();
  const existing = findUserByIdentifier(identifier);
  if (existing?.verified) {
    return res.status(409).json({ error: "An account already exists for that email or phone." });
  }
  if (existing) {
    db.prepare("DELETE FROM users WHERE id = ?").run(existing.id);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const channel = verificationMethod === "sms" ? "sms" : getVerificationChannel(identifier);
  let expiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000).toISOString();
  let otpHash = null;
  let otp = "";

  if (channel === "email") {
    otp = generateOtp();
    otpHash = await bcrypt.hash(otp, 12);
  }

  db.prepare("DELETE FROM registration_intents WHERE identifier = ?").run(identifier);
  db.prepare(
    "INSERT INTO registration_intents (full_name, identifier, email, phone, phone_country, password_hash, role, channel, otp_hash, otp_attempts, expires_at) VALUES (?, ?, ?, ?, ?, ?, 'user', ?, ?, 0, ?)"
  ).run(fullName, identifier, email, phone, phoneCountry, passwordHash, channel, otpHash, expiresAt);

  try {
    if (channel === "sms") {
      await sendTwilioSmsOtp({ to: identifier });
    } else {
      await sendOtpEmail({ to: identifier, fullName, otp });
    }
  } catch (error) {
    db.prepare("DELETE FROM registration_intents WHERE identifier = ?").run(identifier);
    return res.status(502).json({ error: error.message });
  }

  return res.status(201).json({
    verificationRequired: true,
    identifier,
    channel,
    expiresAt,
    message:
      channel === "sms"
        ? "A verification code has been sent to your phone number."
        : "A verification code has been sent to your email."
  });
});

app.post("/api/auth/login", async (req, res) => {
  const identifier = normalizeAuthIdentifier(req.body.identifier);
  const password = String(req.body.password || "");
  if (!isEmailIdentifier(identifier) && (!isPhoneIdentifier(identifier) || !isAllowedPhoneNumber(identifier))) {
    return res.status(400).json({ error: "Enter an allowed email address or phone number." });
  }
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
  const identifier = normalizeAuthIdentifier(req.body.identifier);
  const otp = String(req.body.otp || "").trim();
  const user = findUserByIdentifier(identifier);

  if (user?.verified) {
    const token = signToken(user);
    setSessionCookie(res, token);
    return res.json({ user: publicUser(user), message: "Account already verified." });
  }

  const pending = findRegistrationIntent(identifier);
  if (!pending) {
    return res.status(404).json({ error: "No pending verification found. Please register again." });
  }

  if (!/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: "Enter the 6-digit verification code sent to you." });
  }

  if (Date.now() > Date.parse(pending.expires_at)) {
    db.prepare("DELETE FROM registration_intents WHERE id = ?").run(pending.id);
    return res.status(400).json({ error: "Verification code expired. Please register again to receive a new code." });
  }

  if (pending.otp_attempts >= 5) {
    return res.status(429).json({ error: "Too many verification attempts. Request a new code." });
  }

  const validOtp =
    pending.channel === "sms"
      ? (await checkTwilioSmsOtp({ to: pending.identifier, code: otp })).status === "approved"
      : pending.otp_hash && (await bcrypt.compare(otp, pending.otp_hash));

  if (!validOtp) {
    db.prepare("UPDATE registration_intents SET otp_attempts = otp_attempts + 1 WHERE id = ?").run(pending.id);
    return res.status(401).json({ error: "Invalid verification code." });
  }

  const result = db
    .prepare("INSERT INTO users (full_name, identifier, email, phone, phone_country, password_hash, role, verified) VALUES (?, ?, ?, ?, ?, ?, ?, 1)")
    .run(
      pending.full_name,
      pending.identifier,
      pending.email,
      pending.phone,
      pending.phone_country,
      pending.password_hash,
      pending.role || "user"
    );
  db.prepare("DELETE FROM registration_intents WHERE id = ?").run(pending.id);
  const verifiedUser = findUserById(result.lastInsertRowid);
  const token = signToken(verifiedUser);
  setSessionCookie(res, token);
  return res.json({ user: publicUser(verifiedUser), message: "Account verified successfully." });
});

app.post("/api/auth/resend-otp", async (req, res) => {
  const identifier = normalizeAuthIdentifier(req.body.identifier);
  const pending = findRegistrationIntent(identifier);

  if (!pending) {
    return res.status(404).json({ error: "No pending verification found. Please register again." });
  }

  if (pending.channel === "sms") {
    await sendTwilioSmsOtp({ to: pending.identifier });
    return res.json({ ok: true, message: "A new verification code has been sent to your phone number." });
  }

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 12);
  const expiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000).toISOString();
  db.prepare("UPDATE registration_intents SET otp_hash = ?, expires_at = ?, otp_attempts = 0 WHERE id = ?").run(
    otpHash,
    expiresAt,
    pending.id
  );
  await sendOtpEmail({ to: pending.identifier, fullName: pending.full_name, otp });
  return res.json({ ok: true, expiresAt, message: "A new verification code has been sent to your email." });
});

app.post("/api/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  return res.json({ ok: true });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  return res.json({ user: publicUser(req.user) });
});

app.post("/api/auth/forgot-password", async (req, res) => {
  const identifier = normalizeAuthIdentifier(req.body.identifier);
  const isEmail = isEmailIdentifier(identifier);
  const isPhone = isPhoneIdentifier(identifier);
  const neutralMessage = isPhone
    ? "If this phone number is registered, we sent a reset code by SMS."
    : "If this email is registered, we sent a reset link/code to your email address.";

  if (identifier && (isEmail || (isPhone && isAllowedPhoneNumber(identifier)))) {
    const user = findUserByIdentifier(identifier);
    if (user) {
      const channel = getVerificationChannel(identifier);
      try {
        if (channel === "sms") {
          await sendTwilioSmsOtp({ to: identifier });
        } else {
          const { resetCode } = await createPasswordResetForUser(user.id);
          await sendPasswordResetEmail({ to: user.identifier, fullName: user.full_name, resetCode });
        }
        console.log("Password reset email sent");
      } catch (error) {
        console.error("Password reset email failed", { message: error.message });
      }
    }
  }

  return res.json({ ok: true, message: neutralMessage });
});

app.post("/api/auth/reset-password", async (req, res) => {
  const identifier = normalizeAuthIdentifier(req.body.identifier);
  const resetCode = String(req.body.resetCode || "").trim();
  const password = String(req.body.password || "");

  if (!identifier || !/^\d{6}$/.test(resetCode) || password.length < 8) {
    return res.status(400).json({ error: "Email, 6-digit reset code, and a new password are required." });
  }

  if (!isEmailIdentifier(identifier) && (!isPhoneIdentifier(identifier) || !isAllowedPhoneNumber(identifier))) {
    return res.status(400).json({ error: "Enter an allowed email address or phone number." });
  }

  const user = findUserByIdentifier(identifier);
  if (!user) {
    return res.status(400).json({ error: "Invalid or expired reset code." });
  }

  const channel = getVerificationChannel(identifier);
  if (channel === "email") {
    if (!user.reset_code_hash || !user.reset_expires_at) {
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
  } else {
    const verification = await checkTwilioSmsOtp({ to: identifier, code: resetCode });
    if (verification.status !== "approved") {
      return res.status(401).json({ error: "Invalid reset code." });
    }
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

httpServer.listen(PORT, "127.0.0.1", () => {
  console.log(`Auth and support API running at http://127.0.0.1:${PORT}`);
  if (JWT_SECRET === "replace-this-secret-before-production") {
    console.warn("AUTH_JWT_SECRET is using the development fallback. Set a strong secret before production.");
  }
});
