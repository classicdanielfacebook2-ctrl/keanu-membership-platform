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
  <div style="margin:0;padding:0;background:#030303;color:#f7f3ea;font-family:Inter,Arial,sans-serif;">
    <div style="margin:0;padding:42px 18px;background:radial-gradient(circle at 50% -10%,rgba(244,216,139,.13),transparent 38%),linear-gradient(180deg,#070707,#030303);">
      <div style="max-width:580px;margin:0 auto;border:1px solid rgba(244,216,139,.22);border-radius:22px;background:linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.018)),#0c0c0b;box-shadow:0 24px 70px rgba(0,0,0,.42);overflow:hidden;">
        <div style="background-image:linear-gradient(rgba(5,5,5,.9),rgba(5,5,5,.94)),url('https://www.keanureeves.company/logo.svg');background-repeat:no-repeat;background-position:right -34px top -34px;background-size:180px;padding:36px 34px 30px;">
          <p style="margin:0 0 14px;color:#f4d88b;font-size:11px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;">${COMPANY_NAME}</p>
          <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.08;color:#fff9ed;font-weight:700;">Reset your password</h1>
          <p style="margin:0 0 26px;color:#cfc7ba;font-size:15px;line-height:1.75;">Hello ${escapeHtml(fullName || "there")}, use the secure recovery button below to create a new password for your membership account.</p>
          <a href="${escapeHtml(recoveryLink)}" style="display:inline-block;margin:0 0 26px;padding:15px 24px;border-radius:999px;background:linear-gradient(135deg,#f4d88b,#c99d43);color:#090806;text-decoration:none;font-size:14px;font-weight:900;letter-spacing:.02em;box-shadow:0 12px 30px rgba(201,157,67,.22);">Reset Password</a>
          <p style="margin:0 0 8px;color:#b6ad9d;font-size:12px;line-height:1.65;">If the button does not work, copy and paste the recovery link below.</p>
          <p style="margin:0 0 22px;color:#766f65;font-size:11px;line-height:1.6;word-break:break-all;"><a href="${escapeHtml(recoveryLink)}" style="color:#9f8d5c;text-decoration:underline;">${escapeHtml(recoveryLink)}</a></p>
          <div style="margin:0;padding:16px 0 0;border-top:1px solid rgba(244,216,139,.12);">
            <p style="margin:0 0 8px;color:#bdb4a5;font-size:13px;line-height:1.65;">This recovery link expires in 30 minutes.</p>
            <p style="margin:0;color:#8f877a;font-size:12px;line-height:1.65;">If you did not request this password reset, you can safely ignore this email.</p>
          </div>
        </div>
        <div style="padding:18px 34px 22px;background:#080807;border-top:1px solid rgba(244,216,139,.1);">
          <p style="margin:0 0 5px;color:#d8c78f;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">Keanu Reeves Company Member Services</p>
          <p style="margin:0;color:#8f877a;font-size:12px;line-height:1.6;">support@keanureeves.company</p>
        </div>
      </div>
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
