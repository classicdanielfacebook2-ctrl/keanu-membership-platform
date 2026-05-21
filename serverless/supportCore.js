import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { MongoClient } from "mongodb";

let mongoClientPromise;
let mongoLogged = false;

const dbName = process.env.MONGODB_DB || "keanu_membership_platform";
const SUPPORT_COOKIE_NAME = "kr_support_session";
const isProduction = process.env.NODE_ENV === "production";

const getMongoClient = () => {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing. Support chat history requires MongoDB.");
  }

  if (!mongoLogged) {
    console.log("[support/mongodb]", { message: "MongoDB URI found" });
    mongoLogged = true;
  }

  if (!mongoClientPromise) {
    mongoClientPromise = new MongoClient(process.env.MONGODB_URI).connect();
  }
  return mongoClientPromise;
};

export const getSupportCollections = async () => {
  const client = await getMongoClient();
  const db = client.db(dbName);
  const conversations = db.collection("supportConversations");
  const messages = db.collection("supportMessages");
  await conversations.createIndex({ id: 1 }, { unique: true });
  await conversations.createIndex({ visitorId: 1 });
  await messages.createIndex({ conversationId: 1, createdAt: 1 });
  return { conversations, messages };
};

export const sendJson = (res, status, payload) => res.status(status).json(payload);

export const handleSupportError = (res, scope, error) => {
  console.error(`[${scope}]`, { message: error?.message, name: error?.name, stack: error?.stack });
  sendJson(res, error?.status || 500, { error: error?.message || "Support backend error." });
};

const now = () => new Date();

const supportSecret = () => process.env.AUTH_JWT_SECRET || process.env.SUPPORT_SESSION_SECRET || "local-support-session-secret";

const getCookie = (req, name) => {
  const header = req.headers.cookie || "";
  return header
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`))
    ?.slice(name.length + 1);
};

const signSessionId = (sessionId) => createHmac("sha256", supportSecret()).update(sessionId).digest("base64url");

const signedSessionValue = (sessionId) => `${sessionId}.${signSessionId(sessionId)}`;

const verifySignedSession = (value = "") => {
  const [sessionId, signature] = value.split(".");
  if (!sessionId || !signature) return "";
  const expected = signSessionId(sessionId);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) return "";
  return timingSafeEqual(signatureBuffer, expectedBuffer) ? sessionId : "";
};

const setSupportCookie = (res, sessionId) => {
  const secure = isProduction ? " Secure;" : "";
  res.setHeader(
    "Set-Cookie",
    `${SUPPORT_COOKIE_NAME}=${signedSessionValue(sessionId)}; HttpOnly; SameSite=Lax;${secure} Path=/; Max-Age=${60 * 60 * 24 * 30}`
  );
};

export const getSupportSessionId = (req) => verifySignedSession(getCookie(req, SUPPORT_COOKIE_NAME));

export const getOrCreateSupportSessionId = (req, res, fallbackId = "") => {
  const existing = getSupportSessionId(req);
  if (existing) return existing;
  const cleanFallback = String(fallbackId || "").replace(/[^\w-]/g, "").slice(0, 120);
  const sessionId = cleanFallback || randomUUID();
  setSupportCookie(res, sessionId);
  return sessionId;
};

const cleanConversation = (conversation) =>
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
        createdAt: conversation.createdAt instanceof Date ? conversation.createdAt.toISOString() : conversation.createdAt,
        updatedAt: conversation.updatedAt instanceof Date ? conversation.updatedAt.toISOString() : conversation.updatedAt
      }
    : null;

export const createOrGetConversation = async (visitorId) => {
  const { conversations, messages } = await getSupportCollections();
  const safeVisitorId = String(visitorId || randomUUID()).slice(0, 120);
  const existing = await conversations.findOne({ visitorId: safeVisitorId });
  if (existing) {
    const history = await messages.find({ conversationId: existing.id }).sort({ createdAt: 1 }).limit(250).toArray();
    return { conversation: cleanConversation(existing), messages: history.map(cleanMessage) };
  }

  const conversation = {
    id: randomUUID(),
    visitorId: safeVisitorId,
    status: "bot",
    assignedAgent: "",
    agentRequested: false,
    unreadForAgent: 0,
    unreadForVisitor: 0,
    lastMessage: "Conversation opened",
    createdAt: now(),
    updatedAt: now()
  };
  await conversations.insertOne(conversation);
  return { conversation: cleanConversation(conversation), messages: [] };
};

export const listConversations = async () => {
  const { conversations } = await getSupportCollections();
  const items = await conversations.find({}).sort({ updatedAt: -1 }).limit(120).toArray();
  return items.map(cleanConversation);
};

export const getConversationHistory = async (conversationId) => {
  const { conversations, messages } = await getSupportCollections();
  const conversation = await conversations.findOne({ id: conversationId });
  const history = await messages.find({ conversationId }).sort({ createdAt: 1 }).limit(250).toArray();
  return { conversation: cleanConversation(conversation), messages: history.map(cleanMessage) };
};

export const assertSupportSessionAccess = ({ sessionId, conversation }) => {
  if (!conversation) {
    const error = new Error("Support conversation not found.");
    error.status = 404;
    throw error;
  }
  if (!sessionId || conversation.visitorId !== sessionId) {
    const error = new Error("Support session does not have access to this conversation.");
    error.status = 403;
    throw error;
  }
};

const cleanMessage = (message) => ({
  id: message.id,
  conversationId: message.conversationId,
  role: message.role,
  author: message.author || "",
  text: message.text || "",
  attachments: message.attachments || [],
  status: message.status || "delivered",
  createdAt: message.createdAt instanceof Date ? message.createdAt.toISOString() : message.createdAt
});

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
    if (!response.ok) throw new Error(data?.error?.message || "OpenAI support reply failed.");
    return data?.choices?.[0]?.message?.content?.trim() || "";
  } catch (error) {
    console.error("[support/openai]", { message: error.message });
    return "";
  }
};

export const saveSupportMessage = async ({ conversationId, visitorId, role, text, attachments = [] }) => {
  const { conversations, messages } = await getSupportCollections();
  let conversation = conversationId ? await conversations.findOne({ id: conversationId }) : null;
  if (!conversation) {
    const created = await createOrGetConversation(visitorId);
    conversation = { ...created.conversation, createdAt: new Date(created.conversation.createdAt), updatedAt: new Date() };
  }

  const message = {
    id: randomUUID(),
    conversationId: conversation.id,
    role,
    author: role === "agent" ? "Support Agent" : role === "bot" ? "AI Support" : "Visitor",
    text: String(text || "").trim(),
    attachments: Array.isArray(attachments) ? attachments.slice(0, 4) : [],
    status: "delivered",
    createdAt: now()
  };
  await messages.insertOne(message);

  const transferNeeded = role === "user" && needsHumanAgent(text);
  const patch = {
    updatedAt: now(),
    lastMessage: message.text || (message.attachments.length ? "File attachment" : ""),
    status: role === "agent" ? "agent" : transferNeeded ? "waiting_agent" : conversation.status || "bot",
    agentRequested: Boolean(transferNeeded || conversation.agentRequested),
    unreadForAgent: role === "user" ? Number(conversation.unreadForAgent || 0) + 1 : Number(conversation.unreadForAgent || 0),
    unreadForVisitor:
      role === "agent" || role === "bot" ? Number(conversation.unreadForVisitor || 0) + 1 : Number(conversation.unreadForVisitor || 0)
  };
  await conversations.updateOne({ id: conversation.id }, { $set: patch });
  const updatedConversation = cleanConversation(await conversations.findOne({ id: conversation.id }));

  let botMessage = null;
  if (role === "user" && updatedConversation.status !== "agent") {
    const reply = transferNeeded
      ? "I will connect you with a support agent. Please keep this chat open while the team reviews your message."
      : (await openAiSupportReply(message.text)) || ruleBasedSupportReply(message.text);
    botMessage = {
      id: randomUUID(),
      conversationId: conversation.id,
      role: "bot",
      author: "AI Support",
      text: reply,
      attachments: [],
      status: "delivered",
      createdAt: now()
    };
    await messages.insertOne(botMessage);
    await conversations.updateOne(
      { id: conversation.id },
      {
        $set: {
          updatedAt: now(),
          lastMessage: reply,
          unreadForVisitor: Number(updatedConversation.unreadForVisitor || 0) + 1
        }
      }
    );
  }

  return {
    conversation: cleanConversation(await conversations.findOne({ id: conversation.id })),
    message: cleanMessage(message),
    botMessage: botMessage ? cleanMessage(botMessage) : null
  };
};

export const markSeen = async ({ conversationId, viewerRole }) => {
  const { conversations, messages } = await getSupportCollections();
  const roles = viewerRole === "agent" ? ["user"] : ["agent", "bot"];
  await messages.updateMany({ conversationId, role: { $in: roles } }, { $set: { status: "seen" } });
  const patch = viewerRole === "agent" ? { unreadForAgent: 0 } : { unreadForVisitor: 0 };
  await conversations.updateOne({ id: conversationId }, { $set: { ...patch, updatedAt: now() } });
  return getConversationHistory(conversationId);
};

export const takeoverConversation = async (conversationId) => {
  const { conversations, messages } = await getSupportCollections();
  await conversations.updateOne(
    { id: conversationId },
    { $set: { status: "agent", agentRequested: false, assignedAgent: "admin", updatedAt: now() } }
  );
  const systemMessage = {
    id: randomUUID(),
    conversationId,
    role: "system",
    author: "System",
    text: "A support agent has joined the conversation.",
    attachments: [],
    status: "delivered",
    createdAt: now()
  };
  await messages.insertOne(systemMessage);
  return { ...(await getConversationHistory(conversationId)), systemMessage: cleanMessage(systemMessage) };
};
