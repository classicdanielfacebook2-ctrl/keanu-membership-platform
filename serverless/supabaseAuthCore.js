import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";
import { getUsersCollection, isEmailIdentifier, normalizeAuthIdentifier, sendJson } from "./authCore.js";

const PASSWORD_RECOVERY_REDIRECT = "https://www.keanureeves.company/reset-password/update";
const COMPANY_NAME = "Keanu Reeves Company";
const RECOVERY_FROM_EMAIL = "verification@keanureeves.company";

const getSupabaseAuthClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!url || !anonKey) {
    throw new Error("Supabase Auth environment variables are not configured.");
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
};

const getSupabaseAdminClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
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

const createRecoveryPassword = () => `${crypto.randomUUID()}-${crypto.randomUUID()}-KR`;

const createFallbackRecoveryToken = ({ user, email }) => {
  const secret = process.env.AUTH_JWT_SECRET || "";
  if (!secret) {
    throw new Error("AUTH_JWT_SECRET is required for secure password recovery links.");
  }

  return jwt.sign(
    {
      sub: String(user._id || user.id || ""),
      email,
      purpose: "password_recovery"
    },
    secret,
    { expiresIn: "30m" }
  );
};

const fallbackRecoveryEmailHtml = ({ fullName, recoveryLink }) => `
  <div style="margin:0;padding:32px;background:#050505;color:#f7f3ea;font-family:Inter,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;border:1px solid rgba(244,216,139,.34);background:#0d0d0d;padding:32px;">
      <p style="margin:0 0 12px;color:#f4d88b;font-size:12px;letter-spacing:.18em;text-transform:uppercase;">${COMPANY_NAME}</p>
      <h1 style="margin:0 0 18px;font-family:Georgia,serif;font-size:30px;line-height:1.12;color:#fff9ed;">Reset your password</h1>
      <p style="margin:0 0 22px;line-height:1.7;color:#cfc7ba;">Hello ${escapeHtml(fullName || "there")}, use the secure recovery button below to create a new password for your membership account.</p>
      <a href="${escapeHtml(recoveryLink)}" style="display:inline-block;margin:4px 0 22px;padding:14px 22px;border-radius:10px;background:linear-gradient(135deg,#f4d88b,#c99d43);color:#090806;text-decoration:none;font-weight:800;">Reset Password</a>
      <p style="margin:0 0 12px;line-height:1.7;color:#a9a197;">Recovery link: <a href="${escapeHtml(recoveryLink)}" style="color:#f4d88b;">${escapeHtml(recoveryLink)}</a></p>
      <p style="margin:0 0 12px;line-height:1.7;color:#a9a197;">This recovery link expires in 30 minutes. If the link has expired, request a new password recovery email.</p>
      <p style="margin:0;color:#a9a197;line-height:1.7;">Support reference: Member Services Password Recovery.</p>
    </div>
  </div>
`;

const sendFallbackRecoveryEmail = async ({ email, user }) => {
  const apiKey = process.env.RESEND_API_KEY || "";
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is required to send password recovery email.");
  }

  const token = createFallbackRecoveryToken({ user, email });
  const recoveryLink = `${PASSWORD_RECOVERY_REDIRECT}?recovery_token=${encodeURIComponent(token)}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: `${COMPANY_NAME} <${RECOVERY_FROM_EMAIL}>`,
      to: email,
      subject: `${COMPANY_NAME} password recovery`,
      html: fallbackRecoveryEmailHtml({ fullName: user.fullName || user.full_name, recoveryLink })
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || "Password recovery email could not be sent.");
  }
  return data;
};

const ensureSupabaseAuthUser = async ({ email, user }) => {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password: createRecoveryPassword(),
    email_confirm: true,
    user_metadata: {
      full_name: user.fullName || user.full_name || "",
      mongo_user_id: String(user._id || user.id || ""),
      source: "keanu-membership-platform"
    }
  });

  if (error && !/already|registered|exists|duplicate/i.test(error.message || "")) {
    throw error;
  }
};

const updateMongoPassword = async ({ email, password }) => {
  const users = await getUsersCollection();
  const user = await users.findOne({ $or: [{ identifier: email }, { email }] });

  if (!user) {
    return { status: 404, payload: { error: "Account not found for this recovery link." } };
  }

  const passwordHash = await bcrypt.hash(String(password), 12);
  await users.updateOne(
    { _id: user._id },
    {
      $set: { passwordHash, resetAttempts: 0 },
      $unset: { resetCodeHash: "", resetExpiresAt: "" }
    }
  );

  return { status: 200, payload: { ok: true, message: "Password updated. You can now sign in." } };
};

export const requestSupabasePasswordRecovery = async ({ identifier }) => {
  const email = normalizeAuthIdentifier(identifier);

  if (!isEmailIdentifier(email)) {
    return { status: 400, payload: { error: "Enter a valid email address." } };
  }

  const users = await getUsersCollection();
  const user = await users.findOne({ $or: [{ identifier: email }, { email }] });

  if (!user) {
    return { status: 404, payload: { error: "No account was found for that email address." } };
  }

  let supabaseRecoveryReady = true;
  try {
    await ensureSupabaseAuthUser({ email, user });
  } catch (error) {
    supabaseRecoveryReady = false;
    console.error("[auth/forgot-password]", {
      message: "Supabase Auth user provisioning failed; using secure email fallback",
      error: error?.message
    });
  }

  if (supabaseRecoveryReady) {
    const supabase = getSupabaseAuthClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: PASSWORD_RECOVERY_REDIRECT
    });

    if (!error) {
      console.log("[auth/forgot-password]", { message: "Password reset email sent" });
      return {
        status: 200,
        payload: {
          ok: true,
          message: "A secure password recovery link has been sent to your registered email address."
        }
      };
    }

    console.error("[auth/forgot-password]", {
      message: "Supabase password reset email failed; using secure email fallback",
      error: error.message
    });

    if (error.status === 429 || error.statusCode === 429) {
      return {
        status: 429,
        payload: { error: "Too many recovery requests. Please wait before trying again." }
      };
    }
  }

  try {
    await sendFallbackRecoveryEmail({ email, user });
    console.log("[auth/forgot-password]", { message: "Password reset email sent" });
  } catch (error) {
    console.error("[auth/forgot-password]", { message: "Password reset email failed", error: error?.message });
    return {
      status: 502,
      payload: {
        error: error?.message || "Password recovery email could not be sent."
      }
    };
  }

  return {
    status: 200,
    payload: {
      ok: true,
      message: "A secure password recovery link has been sent to your registered email address."
    }
  };
};

export const syncSupabaseRecoveredPassword = async ({ accessToken, password }) => {
  if (!accessToken) {
    return { status: 401, payload: { error: "Recovery session is missing or expired." } };
  }

  if (!password || String(password).length < 8) {
    return { status: 400, payload: { error: "Enter a new password with at least 8 characters." } };
  }

  const secret = process.env.AUTH_JWT_SECRET || "";
  if (secret) {
    try {
      const payload = jwt.verify(accessToken, secret);
      if (payload?.purpose === "password_recovery" && payload?.email) {
        return await updateMongoPassword({
          email: normalizeAuthIdentifier(payload.email),
          password
        });
      }
    } catch {
      // Not an application recovery token; continue with Supabase recovery session validation.
    }
  }

  const supabase = getSupabaseAuthClient();
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data?.user?.email) {
    return { status: 401, payload: { error: "Recovery link expired. Please request a new password recovery email." } };
  }

  return await updateMongoPassword({
    email: normalizeAuthIdentifier(data.user.email),
    password
  });
};

export const sendSupabaseRecoveryResponse = async (res, identifier) => {
  const result = await requestSupabasePasswordRecovery({ identifier });
  return sendJson(res, result.status, result.payload);
};
