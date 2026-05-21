import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import { getUsersCollection, isEmailIdentifier, normalizeAuthIdentifier, sendJson } from "./authCore.js";

const PASSWORD_RECOVERY_REDIRECT = "https://www.keanureeves.company/reset-password/update";

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

  const supabase = getSupabaseAuthClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: PASSWORD_RECOVERY_REDIRECT
  });

  if (error) {
    console.error("[auth/forgot-password]", { message: "Password reset email failed", error: error.message });
    const status = error.status === 429 || error.statusCode === 429 ? 429 : 400;
    return {
      status,
      payload: {
        error:
          status === 429
            ? "Too many recovery requests. Please wait before trying again."
            : error.message || "Password recovery could not be started."
      }
    };
  }

  console.log("[auth/forgot-password]", { message: "Password reset email sent" });

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

  const supabase = getSupabaseAuthClient();
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data?.user?.email) {
    return { status: 401, payload: { error: "Recovery link expired. Please request a new password recovery email." } };
  }

  const email = normalizeAuthIdentifier(data.user.email);
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

export const sendSupabaseRecoveryResponse = async (res, identifier) => {
  const result = await requestSupabasePasswordRecovery({ identifier });
  return sendJson(res, result.status, result.payload);
};
