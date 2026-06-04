import bcrypt from "bcryptjs";
import { isAllowedPhoneCountry, isAllowedPhoneNumber } from "../src/data/phoneCountries.js";
import {
  checkTwilioSmsOtp,
  cleanupExpiredOtpUsers,
  cleanupExpiredRegistrationIntents,
  clearSessionCookie,
  createOtpFields,
  getRegistrationIntentsCollection,
  getUsersCollection,
  getVerificationChannel,
  handleApiError,
  isEmailIdentifier,
  isPhoneIdentifier,
  isUserVerified,
  methodNotAllowed,
  normalizeAuthIdentifier,
  publicUser,
  requireAuth,
  sendJson,
  sendOtpEmail,
  sendTwilioSmsOtp,
  setSessionCookie,
  signToken
} from "../serverless/authCore.js";
import { sendSupabaseRecoveryResponse, syncSupabaseRecoveredPassword } from "../serverless/supabaseAuthCore.js";

const getAction = (req) => (Array.isArray(req.query?.action) ? req.query.action[0] : req.query?.action || "");

async function login(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);

  const identifier = normalizeAuthIdentifier(req.body?.identifier);
  const password = String(req.body?.password || "");
  if (!isEmailIdentifier(identifier) && (!isPhoneIdentifier(identifier) || !isAllowedPhoneNumber(identifier))) {
    return sendJson(res, 400, { error: "Enter an allowed email address or phone number." });
  }

  const users = await getUsersCollection();
  const user = await users.findOne({ $or: [{ identifier }, { email: identifier }, { phone: identifier }] });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return sendJson(res, 401, { error: "Invalid email/phone or password." });
  }

  if (!isUserVerified(user)) {
    return sendJson(res, 403, {
      error: "Please verify your email before logging in.",
      verificationRequired: true,
      identifier: user.identifier
    });
  }

  setSessionCookie(res, signToken(user));
  return sendJson(res, 200, { user: publicUser(user) });
}

async function logout(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);
  clearSessionCookie(res);
  return sendJson(res, 200, { ok: true });
}

async function logoutEverywhere(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);
  const user = await requireAuth(req);
  const users = await getUsersCollection();
  await users.updateOne({ _id: user._id }, { $set: { sessionRevokedAt: new Date(), updatedAt: new Date() } });
  clearSessionCookie(res);
  return sendJson(res, 200, { ok: true, message: "All active sessions have been signed out." });
}

async function changePassword(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);
  const currentPassword = String(req.body?.currentPassword || "");
  const newPassword = String(req.body?.newPassword || "");
  const confirmPassword = String(req.body?.confirmPassword || "");

  if (!currentPassword || newPassword.length < 8 || newPassword !== confirmPassword) {
    return sendJson(res, 400, { error: "Enter your current password and a matching new password of at least 8 characters." });
  }

  const user = await requireAuth(req);
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return sendJson(res, 401, { error: "Current password is incorrect." });
  }

  const users = await getUsersCollection();
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        passwordHash,
        updatedAt: new Date()
      }
    }
  );
  return sendJson(res, 200, { ok: true, message: "Password updated successfully." });
}

async function securitySettings(req, res) {
  const user = await requireAuth(req);
  const users = await getUsersCollection();

  if (req.method === "GET") {
    return sendJson(res, 200, {
      settings: {
        twoStepEnabled: Boolean(user.securitySettings?.twoStepEnabled),
        requirePasswordBeforePayment: Boolean(user.securitySettings?.requirePasswordBeforePayment),
        requireBankTransferConfirmation: user.securitySettings?.requireBankTransferConfirmation !== false,
        sessionTimeoutMinutes: user.securitySettings?.sessionTimeoutMinutes || 30
      }
    });
  }

  if (req.method !== "POST") return methodNotAllowed(res);

  const nextSettings = {
    twoStepEnabled: Boolean(req.body?.twoStepEnabled),
    requirePasswordBeforePayment: Boolean(req.body?.requirePasswordBeforePayment),
    requireBankTransferConfirmation: Boolean(req.body?.requireBankTransferConfirmation),
    sessionTimeoutMinutes: Math.min(240, Math.max(5, Number(req.body?.sessionTimeoutMinutes || 30)))
  };

  await users.updateOne({ _id: user._id }, { $set: { securitySettings: nextSettings, updatedAt: new Date() } });
  return sendJson(res, 200, { ok: true, settings: nextSettings, message: "Security settings updated." });
}

async function updateProfile(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);
  const user = await requireAuth(req);
  const fullName = String(req.body?.fullName || "").trim();
  const email = normalizeAuthIdentifier(req.body?.email || "");
  const phone = normalizeAuthIdentifier(req.body?.phone || "");

  if (!fullName || !isEmailIdentifier(email) || (phone && !isPhoneIdentifier(phone))) {
    return sendJson(res, 400, { error: "Enter a valid full name, email address, and phone number." });
  }

  const users = await getUsersCollection();
  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        fullName,
        identifier: isEmailIdentifier(user.identifier) ? email : user.identifier,
        email,
        phone,
        updatedAt: new Date()
      }
    }
  );
  const updatedUser = await users.findOne({ _id: user._id });
  return sendJson(res, 200, { ok: true, user: publicUser(updatedUser), message: "Personal details updated." });
}

async function me(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  try {
    const user = await requireAuth(req);
    return sendJson(res, 200, { user: publicUser(user) });
  } catch (error) {
    clearSessionCookie(res);
    if (error.status === 401) return sendJson(res, 401, { error: error.message });
    throw error;
  }
}

async function register(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);

  const fullName = String(req.body?.fullName || "").trim();
  const email = normalizeAuthIdentifier(req.body?.email || req.body?.identifier);
  const phone = normalizeAuthIdentifier(req.body?.phone);
  const phoneCountry = String(req.body?.phoneCountry || "").toUpperCase();
  const verificationMethod = req.body?.verificationMethod === "sms" ? "sms" : "email";
  const identifier = verificationMethod === "sms" ? phone : email;
  const password = String(req.body?.password || "");

  if (!fullName || !email || !phone || password.length < 8) {
    return sendJson(res, 400, {
      error: "Full name, email address, phone number, and a password of at least 8 characters are required."
    });
  }

  if (!isEmailIdentifier(email) || !isPhoneIdentifier(phone) || !isAllowedPhoneCountry(phoneCountry) || !isAllowedPhoneNumber(phone)) {
    return sendJson(res, 400, { error: "Enter a valid email address and select an allowed phone country." });
  }

  const users = await getUsersCollection();
  const intents = await getRegistrationIntentsCollection();
  await cleanupExpiredOtpUsers(users);
  await cleanupExpiredRegistrationIntents(intents);

  const existing = await users.findOne({ $or: [{ identifier }, { email }, { phone }] });
  if (isUserVerified(existing)) {
    return sendJson(res, 409, { error: "An account already exists for that email or phone number." });
  }
  if (existing) await users.deleteOne({ _id: existing._id });

  const passwordHash = await bcrypt.hash(password, 12);
  const channel = verificationMethod === "sms" ? "sms" : getVerificationChannel(identifier);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const pendingRegistration = {
    fullName,
    identifier,
    email,
    phone,
    phoneCountry,
    passwordHash,
    role: "user",
    channel,
    otpAttempts: 0,
    expiresAt,
    createdAt: new Date()
  };

  if (channel === "email") {
    const otpFields = await createOtpFields();
    pendingRegistration.otpHash = otpFields.otpHash;
    pendingRegistration.expiresAt = otpFields.otpExpiresAt;

    await intents.replaceOne({ identifier }, pendingRegistration, { upsert: true });
    try {
      await sendOtpEmail({ to: identifier, fullName, otp: otpFields.otp });
    } catch (error) {
      await intents.deleteOne({ identifier });
      throw error;
    }
  } else {
    await intents.replaceOne({ identifier }, pendingRegistration, { upsert: true });
    try {
      await sendTwilioSmsOtp({ to: identifier });
    } catch (error) {
      await intents.deleteOne({ identifier });
      throw error;
    }
  }

  return sendJson(res, 201, {
    verificationRequired: true,
    identifier,
    channel,
    expiresAt: pendingRegistration.expiresAt.toISOString(),
    message:
      channel === "sms"
        ? "A verification code has been sent to your phone number."
        : "A verification code has been sent to your email."
  });
}

async function bootstrapAdmin(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);

  const expectedToken = process.env.ADMIN_SETUP_TOKEN;
  if (!expectedToken) {
    console.error("[auth/bootstrap-admin]", { message: "ADMIN_SETUP_TOKEN is not configured." });
    return sendJson(res, 500, {
      error: "Admin setup is not configured. Add ADMIN_SETUP_TOKEN in Vercel environment variables."
    });
  }

  const setupToken = String(req.body?.setupToken || "");
  if (setupToken !== expectedToken) {
    return sendJson(res, 403, { error: "Invalid admin setup token." });
  }

  const fullName = String(req.body?.fullName || "Management Admin").trim();
  const email = normalizeAuthIdentifier(req.body?.email);
  const password = String(req.body?.password || "");

  if (!fullName || !isEmailIdentifier(email) || password.length < 12) {
    return sendJson(res, 400, {
      error: "Full name, a valid email address, and a password of at least 12 characters are required."
    });
  }

  const users = await getUsersCollection();
  const existingAdmin = await users.findOne({ role: "admin" });
  if (existingAdmin) {
    return sendJson(res, 409, { error: "An admin account already exists. Sign in with that account." });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const existingUser = await users.findOne({ $or: [{ identifier: email }, { email }] });

  if (existingUser) {
    await users.updateOne(
      { _id: existingUser._id },
      {
        $set: {
          fullName,
          identifier: email,
          email,
          passwordHash,
          role: "admin",
          verified: true,
          isVerified: true,
          updatedAt: new Date()
        }
      }
    );
    const adminUser = await users.findOne({ _id: existingUser._id });
    setSessionCookie(res, signToken(adminUser));
    return sendJson(res, 200, { user: publicUser(adminUser), message: "Admin account activated." });
  }

  const result = await users.insertOne({
    fullName,
    identifier: email,
    email,
    phone: "",
    phoneCountry: "",
    passwordHash,
    role: "admin",
    verified: true,
    isVerified: true,
    createdAt: new Date()
  });
  const adminUser = await users.findOne({ _id: result.insertedId });
  setSessionCookie(res, signToken(adminUser));
  return sendJson(res, 201, { user: publicUser(adminUser), message: "Admin account created." });
}

async function verifyOtp(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);

  const identifier = normalizeAuthIdentifier(req.body?.identifier);
  const otp = String(req.body?.otp || "").trim();
  const users = await getUsersCollection();
  const intents = await getRegistrationIntentsCollection();
  const user = await users.findOne({ identifier });

  if (isUserVerified(user)) {
    setSessionCookie(res, signToken(user));
    return sendJson(res, 200, { user: publicUser(user), message: "Account already verified." });
  }

  const pending = await intents.findOne({ identifier });
  if (!pending) return sendJson(res, 404, { error: "No pending verification found. Please register again." });

  if (!/^\d{6}$/.test(otp)) return sendJson(res, 400, { error: "Enter the 6-digit verification code sent to you." });

  if (Date.now() > new Date(pending.expiresAt).getTime()) {
    await intents.deleteOne({ _id: pending._id });
    return sendJson(res, 400, { error: "Verification code expired. Please register again to receive a new code." });
  }

  if ((pending.otpAttempts || 0) >= 5) {
    return sendJson(res, 429, { error: "Too many verification attempts. Request a new code." });
  }

  const validOtp =
    pending.channel === "sms"
      ? (await checkTwilioSmsOtp({ to: pending.identifier, code: otp })).status === "approved"
      : pending.otpHash && (await bcrypt.compare(otp, pending.otpHash));

  if (!validOtp) {
    await intents.updateOne({ _id: pending._id }, { $inc: { otpAttempts: 1 } });
    return sendJson(res, 401, { error: "Invalid verification code." });
  }

  const result = await users.insertOne({
    fullName: pending.fullName,
    identifier: pending.identifier,
    email: pending.email,
    phone: pending.phone,
    phoneCountry: pending.phoneCountry,
    passwordHash: pending.passwordHash,
    role: pending.role || "user",
    verified: true,
    isVerified: true,
    createdAt: new Date()
  });
  await intents.deleteOne({ _id: pending._id });
  const verifiedUser = await users.findOne({ _id: result.insertedId });
  setSessionCookie(res, signToken(verifiedUser));
  return sendJson(res, 200, { user: publicUser(verifiedUser), message: "Account verified successfully." });
}

async function resendOtp(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);

  const identifier = normalizeAuthIdentifier(req.body?.identifier);
  const intents = await getRegistrationIntentsCollection();
  const pending = await intents.findOne({ identifier });

  if (!pending) return sendJson(res, 404, { error: "No pending verification found. Please register again." });

  if (pending.channel === "sms") {
    await sendTwilioSmsOtp({ to: pending.identifier });
    return sendJson(res, 200, { ok: true, message: "A new verification code has been sent to your phone number." });
  }

  const otpFields = await createOtpFields();
  await intents.updateOne(
    { _id: pending._id },
    {
      $set: {
        otpHash: otpFields.otpHash,
        expiresAt: otpFields.otpExpiresAt,
        otpAttempts: 0
      }
    }
  );
  await sendOtpEmail({ to: pending.identifier, fullName: pending.fullName, otp: otpFields.otp });
  return sendJson(res, 200, {
    ok: true,
    expiresAt: otpFields.otpExpiresAt.toISOString(),
    message: "A new verification code has been sent to your email."
  });
}

async function forgotPassword(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);
  return sendSupabaseRecoveryResponse(res, req.body?.identifier);
}

async function resetPassword(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);

  const identifier = normalizeAuthIdentifier(req.body?.identifier);
  const resetCode = String(req.body?.resetCode || "").trim();
  const password = String(req.body?.password || "");

  if (!identifier || !/^\d{6}$/.test(resetCode) || password.length < 8) {
    return sendJson(res, 400, { error: "Email, 6-digit reset code, and a new password are required." });
  }

  if (!isEmailIdentifier(identifier) && (!isPhoneIdentifier(identifier) || !isAllowedPhoneNumber(identifier))) {
    return sendJson(res, 400, { error: "Enter an allowed email address or phone number." });
  }

  const users = await getUsersCollection();
  const user = await users.findOne({ $or: [{ identifier }, { email: identifier }, { phone: identifier }] });
  const channel = getVerificationChannel(identifier);

  if (!user) return sendJson(res, 400, { error: "Invalid or expired reset code." });

  if (channel === "email") {
    if (!user.resetCodeHash || !user.resetExpiresAt) {
      return sendJson(res, 400, { error: "Invalid or expired reset code." });
    }

    if (Date.now() > new Date(user.resetExpiresAt).getTime()) {
      await users.updateOne({ _id: user._id }, { $unset: { resetCodeHash: "", resetExpiresAt: "" }, $set: { resetAttempts: 0 } });
      return sendJson(res, 400, { error: "Reset code expired. Request a new code." });
    }

    if ((user.resetAttempts || 0) >= 5) {
      return sendJson(res, 429, { error: "Too many reset attempts. Request a new code." });
    }

    const validCode = await bcrypt.compare(resetCode, user.resetCodeHash);
    if (!validCode) {
      await users.updateOne({ _id: user._id }, { $inc: { resetAttempts: 1 } });
      return sendJson(res, 401, { error: "Invalid reset code." });
    }
  } else {
    const verification = await checkTwilioSmsOtp({ to: identifier, code: resetCode });
    if (verification.status !== "approved") return sendJson(res, 401, { error: "Invalid reset code." });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await users.updateOne(
    { _id: user._id },
    {
      $set: { passwordHash, resetAttempts: 0 },
      $unset: { resetCodeHash: "", resetExpiresAt: "" }
    }
  );

  return sendJson(res, 200, { ok: true, message: "Password updated. You can now log in." });
}

async function supabaseResetPassword(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);

  const authorization = req.headers.authorization || "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const result = await syncSupabaseRecoveredPassword({ accessToken, password: req.body?.password });
  return sendJson(res, result.status, result.payload);
}

const handlers = {
  "bootstrap-admin": bootstrapAdmin,
  "forgot-password": forgotPassword,
  "change-password": changePassword,
  "logout-everywhere": logoutEverywhere,
  login,
  logout,
  me,
  register,
  "resend-otp": resendOtp,
  "reset-password": resetPassword,
  "security-settings": securitySettings,
  "supabase-reset-password": supabaseResetPassword,
  "update-profile": updateProfile,
  "verify-otp": verifyOtp
};

export default async function handler(req, res) {
  const action = getAction(req);
  const routeHandler = handlers[action];

  if (!routeHandler) {
    return sendJson(res, 404, { error: "Authentication route not found." });
  }

  try {
    return await routeHandler(req, res);
  } catch (error) {
    return handleApiError(res, `auth/${action}`, error);
  }
}
