import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { MongoClient, ObjectId } from "mongodb";

const COOKIE_NAME = "kr_membership_session";
const COMPANY_NAME = "Keanu Reeves Company";
const OTP_FROM_EMAIL = "verification@keanureeves.company";
const OTP_EXPIRES_MINUTES = 10;
const isProduction = process.env.NODE_ENV === "production";

let mongoClientPromise;
let mongoUriLogged = false;

export const normalizeIdentifier = (value = "") => value.trim().toLowerCase();
export const isEmailIdentifier = (value = "") => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
};

const getMongoClient = () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("[mongodb/config]", { message: "MONGODB_URI is missing from backend environment." });
    throw new Error("MONGODB_URI is missing. Add it in Vercel Project Settings > Environment Variables.");
  }

  if (!mongoUriLogged) {
    console.log("[mongodb/config]", {
      message: "MongoDB URI found",
      length: uri.length,
      scheme: uri.startsWith("mongodb+srv://") ? "mongodb+srv" : uri.startsWith("mongodb://") ? "mongodb" : "unknown"
    });
    mongoUriLogged = true;
  }

  if (!mongoClientPromise) {
    mongoClientPromise = new MongoClient(uri).connect();
  }
  return mongoClientPromise;
};

export const getUsersCollection = async () => {
  try {
    const client = await getMongoClient();
    const db = client.db(process.env.MONGODB_DB || "keanu_membership_platform");
    const users = db.collection("users");
    await users.createIndex({ identifier: 1 }, { unique: true });
    return users;
  } catch (error) {
    console.error("[mongodb/connect]", {
      message: error?.message,
      name: error?.name
    });
    throw error;
  }
};

export const logApiError = (scope, error) => {
  console.error(`[${scope}]`, {
    message: error?.message,
    name: error?.name,
    stack: error?.stack
  });
};

export const sendJson = (res, status, payload) => {
  res.status(status).json(payload);
};

export const handleApiError = (res, scope, error) => {
  logApiError(scope, error);
  sendJson(res, 500, {
    error: error?.message || "Backend error. Check Vercel function logs for details."
  });
};

export const methodNotAllowed = (res) => {
  res.setHeader("Allow", "POST");
  sendJson(res, 405, { error: "Method not allowed." });
};

export const publicUser = (user) =>
  user
    ? {
        id: String(user._id),
        fullName: user.fullName,
        identifier: user.identifier,
        role: user.role,
        verified: Boolean(user.verified)
      }
    : null;

export const signToken = (user) => {
  const secret = requiredEnv("AUTH_JWT_SECRET");
  return jwt.sign({ sub: String(user._id), role: user.role }, secret, {
    expiresIn: "7d"
  });
};

export const setSessionCookie = (res, token) => {
  const secure = isProduction ? " Secure;" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax;${secure} Path=/; Max-Age=${7 * 24 * 60 * 60}`
  );
};

export const clearSessionCookie = (res) => {
  const secure = isProduction ? " Secure;" : "";
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; SameSite=Lax;${secure} Path=/; Max-Age=0`);
};

export const getCookie = (req, name) => {
  const header = req.headers.cookie || "";
  return header
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`))
    ?.slice(name.length + 1);
};

export const requireAuth = async (req) => {
  const token = getCookie(req, COOKIE_NAME);
  if (!token) {
    const error = new Error("Not authenticated");
    error.status = 401;
    throw error;
  }

  try {
    const payload = jwt.verify(token, requiredEnv("AUTH_JWT_SECRET"));
    const users = await getUsersCollection();
    const user = await users.findOne({ _id: new ObjectId(payload.sub) });
    if (!user) {
      const error = new Error("Session user not found");
      error.status = 401;
      throw error;
    }
    return user;
  } catch (error) {
    if (!error.status) {
      error.status = 401;
      error.message = "Invalid or expired session";
    }
    throw error;
  }
};

export const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

export const createOtpFields = async () => {
  const otp = generateOtp();
  return {
    otp,
    otpHash: await bcrypt.hash(otp, 12),
    otpExpiresAt: new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000),
    otpAttempts: 0
  };
};

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

export const sendOtpEmail = async ({ to, fullName, otp }) => {
  const apiKey = requiredEnv("RESEND_API_KEY");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
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
    throw new Error(data?.message || "Resend rejected the verification email.");
  }
  return data;
};
