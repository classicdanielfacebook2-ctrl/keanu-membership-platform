import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import QRCode from "qrcode";
import { ObjectId } from "mongodb";
import {
  checkTwilioSmsOtp,
  cleanupExpiredOtpUsers,
  cleanupExpiredRegistrationIntents,
  clearSessionCookie,
  createOtpFields,
  getRegistrationIntentsCollection,
  getUsersCollection,
  handleApiError,
  isEmailIdentifier,
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
import {
  sendSupabaseRecoveryResponse,
  syncSupabaseRecoveredPassword,
  upsertSupabaseUserProfile
} from "../serverless/supabaseAuthCore.js";

const getAction = (req) => (Array.isArray(req.query?.action) ? req.query.action[0] : req.query?.action || "");
const TOTP_ISSUER = "Keanu Reeves Company";
const TOTP_STEP_SECONDS = 30;
const TWO_FACTOR_LOCK_MINUTES = 10;

const base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const base32Encode = (buffer) => {
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  return bits.match(/.{1,5}/g)?.map((chunk) => base32Alphabet[parseInt(chunk.padEnd(5, "0"), 2)]).join("") || "";
};

const base32Decode = (value = "") => {
  const clean = value.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  let bits = "";
  for (const char of clean) {
    const index = base32Alphabet.indexOf(char);
    if (index < 0) continue;
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes = bits.match(/.{8}/g)?.map((byte) => parseInt(byte, 2)) || [];
  return Buffer.from(bytes);
};

const encryptionKey = () => crypto.createHash("sha256").update(process.env.AUTH_JWT_SECRET || "local-development-secret").digest();
const encryptSecret = (secret) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
};
const decryptSecret = (payload = "") => {
  const [ivRaw, tagRaw, encryptedRaw] = payload.split(".");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivRaw, "base64"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64")), decipher.final()]).toString("utf8");
};

const totpCode = (secret, offset = 0) => {
  const counter = Math.floor(Date.now() / 1000 / TOTP_STEP_SECONDS) + offset;
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", base32Decode(secret)).update(counterBuffer).digest();
  const start = hmac[hmac.length - 1] & 0x0f;
  const binary = ((hmac[start] & 0x7f) << 24) | ((hmac[start + 1] & 0xff) << 16) | ((hmac[start + 2] & 0xff) << 8) | (hmac[start + 3] & 0xff);
  return String(binary % 1000000).padStart(6, "0");
};

const verifyTotp = (secret, code) => /^\d{6}$/.test(code) && [-1, 0, 1].some((offset) => totpCode(secret, offset) === code);
const createRecoveryCodes = () => Array.from({ length: 10 }, () => crypto.randomBytes(5).toString("hex").toUpperCase().match(/.{1,5}/g).join("-"));
const hashRecoveryCodes = async (codes) => Promise.all(codes.map(async (code) => bcrypt.hash(code, 12)));
const isTwoFactorLocked = (user) => user.twoFactorLockUntil && new Date(user.twoFactorLockUntil).getTime() > Date.now();
const cleanOtp = (value = "") => String(value || "").replace(/\D/g, "").slice(0, 6);
const countriesWithoutPostalCodes = new Set([
  "Afghanistan",
  "Angola",
  "Bahamas",
  "Belize",
  "Benin",
  "Botswana",
  "Burundi",
  "Cameroon",
  "Central African Republic",
  "Chad",
  "Comoros",
  "Congo",
  "Democratic Republic of the Congo",
  "Djibouti",
  "Equatorial Guinea",
  "Eritrea",
  "Fiji",
  "Gambia",
  "Ghana",
  "Grenada",
  "Guyana",
  "Hong Kong",
  "Ireland",
  "Jamaica",
  "Kenya",
  "Kiribati",
  "Libya",
  "Macau",
  "Malawi",
  "Mali",
  "Mauritania",
  "Mauritius",
  "Nauru",
  "Nigeria",
  "Qatar",
  "Rwanda",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Sao Tome and Principe",
  "Seychelles",
  "Sierra Leone",
  "Solomon Islands",
  "Somalia",
  "South Sudan",
  "Suriname",
  "Syria",
  "Tanzania",
  "Timor-Leste",
  "Tonga",
  "Trinidad and Tobago",
  "Tuvalu",
  "Uganda",
  "United Arab Emirates",
  "Vanuatu",
  "Yemen",
  "Zimbabwe"
]);

const normalizeProfile = (body = {}) => ({
  fullName: String(body.fullName || "").trim(),
  email: normalizeAuthIdentifier(body.email || ""),
  phone: normalizeAuthIdentifier(body.phone || ""),
  country: String(body.country || "").trim(),
  countryCode: String(body.countryCode || "").trim(),
  stateRegion: String(body.stateRegion || body.state || "").trim(),
  stateCode: String(body.stateCode || "").trim(),
  city: String(body.city || "").trim(),
  streetAddress: String(body.streetAddress || "").trim(),
  apartmentUnit: String(body.apartmentUnit || "").trim(),
  postalCode: String(body.postalCode || "").trim(),
  dateOfBirth: String(body.dateOfBirth || "").trim(),
  preferredCurrency: String(body.preferredCurrency || "EUR").toUpperCase(),
  preferredLanguage: String(body.preferredLanguage || "English").trim()
});

const validateProfile = (profile) => {
  if (!profile.fullName) return "Full name is required.";
  if (!isEmailIdentifier(profile.email)) return "Enter a valid email address.";
  if (!profile.country) return "Country is required.";
  if (!profile.stateRegion) return "State / Region is required.";
  if (!profile.city) return "City is required.";
  if (!countriesWithoutPostalCodes.has(profile.country) && !profile.postalCode) {
    return "Postal code is required for the selected country.";
  }
  return "";
};

const signTwoFactorChallenge = (user) =>
  jwt.sign({ sub: String(user._id), purpose: "two_factor" }, process.env.AUTH_JWT_SECRET || "", { expiresIn: "5m" });

const getTwoFactorUserFromChallenge = async (challengeToken) => {
  const payload = jwt.verify(String(challengeToken || ""), process.env.AUTH_JWT_SECRET || "");
  if (payload?.purpose !== "two_factor" || !payload?.sub) {
    const error = new Error("Invalid verification challenge.");
    error.status = 401;
    throw error;
  }
  const users = await getUsersCollection();
  const user = await users.findOne({ _id: new ObjectId(payload.sub) });
  if (!user) {
    const error = new Error("Verification challenge account was not found.");
    error.status = 401;
    throw error;
  }
  return { users, user };
};

const buildOtpauthUri = ({ user, secret }) => {
  const accountName = encodeURIComponent(`${TOTP_ISSUER}:${user.email || user.identifier}`);
  return `otpauth://totp/${accountName}?secret=${secret}&issuer=${encodeURIComponent(TOTP_ISSUER)}&algorithm=SHA1&digits=6&period=${TOTP_STEP_SECONDS}`;
};

const verifyRecoveryCode = async (user, code) => {
  const input = String(code || "").trim().toUpperCase();
  if (!input || !Array.isArray(user.twoStep?.recoveryCodeHashes)) return { valid: false };
  for (let index = 0; index < user.twoStep.recoveryCodeHashes.length; index += 1) {
    if (await bcrypt.compare(input, user.twoStep.recoveryCodeHashes[index])) {
      return { valid: true, index };
    }
  }
  return { valid: false };
};

const verifyUserTwoFactorCode = async ({ users, user, code, allowRecovery = true }) => {
  if (isTwoFactorLocked(user)) {
    return { ok: false, status: 429, error: "Too many verification attempts. Please wait before trying again." };
  }

  const entered = String(code || "").trim();
  let ok = false;
  let usedRecoveryIndex = -1;
  try {
    const secret = decryptSecret(user.twoStep?.secretEncrypted || "");
    ok = verifyTotp(secret, cleanOtp(entered));
  } catch {
    ok = false;
  }

  if (!ok && allowRecovery) {
    const recovery = await verifyRecoveryCode(user, entered);
    ok = recovery.valid;
    usedRecoveryIndex = recovery.valid ? recovery.index : -1;
  }

  if (!ok) {
    const attempts = Number(user.twoStep?.failedAttempts || 0) + 1;
    const lockUntil = attempts >= 5 ? new Date(Date.now() + TWO_FACTOR_LOCK_MINUTES * 60 * 1000) : null;
    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          "twoStep.failedAttempts": attempts,
          ...(lockUntil ? { "twoStep.lockedUntil": lockUntil, twoFactorLockUntil: lockUntil } : {}),
          updatedAt: new Date()
        }
      }
    );
    return { ok: false, status: lockUntil ? 429 : 401, error: lockUntil ? "Too many verification attempts. Please wait before trying again." : "Invalid authenticator code." };
  }

  const update = {
    $set: {
      "twoStep.failedAttempts": 0,
      updatedAt: new Date()
    },
    $unset: {
      "twoStep.lockedUntil": "",
      twoFactorLockUntil: ""
    }
  };

  if (usedRecoveryIndex >= 0) {
    const nextHashes = [...(user.twoStep.recoveryCodeHashes || [])];
    nextHashes.splice(usedRecoveryIndex, 1);
    update.$set["twoStep.recoveryCodeHashes"] = nextHashes;
  }

  await users.updateOne({ _id: user._id }, update);
  return { ok: true };
};

async function login(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);

  const identifier = normalizeAuthIdentifier(req.body?.identifier);
  const password = String(req.body?.password || "");
  if (!isEmailIdentifier(identifier)) {
    return sendJson(res, 400, { error: "Enter a valid email address." });
  }

  const users = await getUsersCollection();
  let user = await users.findOne({ $or: [{ identifier }, { email: identifier }] });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return sendJson(res, 401, { error: "Invalid email or password." });
  }

  if (!isUserVerified(user)) {
    const intents = await getRegistrationIntentsCollection();
    const otpFields = await createOtpFields();
    const pendingVerification = {
      fullName: user.fullName || "Member",
      identifier,
      email: user.email || identifier,
      phone: user.phone || "",
      phoneCountry: user.phoneCountry || "",
      passwordHash: user.passwordHash,
      role: user.role || "user",
      channel: "email",
      otpHash: otpFields.otpHash,
      otpAttempts: 0,
      expiresAt: otpFields.otpExpiresAt,
      createdAt: new Date()
    };

    await intents.replaceOne({ identifier }, pendingVerification, { upsert: true });
    try {
      await sendOtpEmail({
        to: identifier,
        fullName: pendingVerification.fullName,
        otp: otpFields.otp
      });
      console.info("[auth/login] verification email sent", {
        userId: String(user._id),
        recipientDomain: identifier.split("@")[1] || "unknown"
      });
    } catch (error) {
      await intents.deleteOne({ identifier });
      console.error("[auth/login] verification email failed", {
        userId: String(user._id),
        message: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }

    return sendJson(res, 403, {
      error: "Please verify your email before logging in. A new verification code has been sent.",
      verificationRequired: true,
      identifier,
      expiresAt: otpFields.otpExpiresAt.toISOString()
    });
  }

  if (user.twoStep?.enabled || user.securitySettings?.twoStepEnabled) {
    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          "twoStep.enabled": false,
          "securitySettings.twoStepEnabled": false,
          updatedAt: new Date()
        },
        $unset: {
          "twoStep.secretEncrypted": "",
          "twoStep.recoveryCodeHashes": "",
          "twoStep.pendingSecretEncrypted": "",
          "twoStep.pendingCreatedAt": "",
          "twoStep.lockedUntil": "",
          twoFactorLockUntil: ""
        }
      }
    );
    user = await users.findOne({ _id: user._id });
    console.info("[auth/login] legacy authenticator disabled", { userId: String(user._id) });
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
        requirePasswordBeforePayment: Boolean(user.securitySettings?.requirePasswordBeforePayment),
        requireBankTransferConfirmation: user.securitySettings?.requireBankTransferConfirmation !== false,
        sessionTimeoutMinutes: user.securitySettings?.sessionTimeoutMinutes || 30
      }
    });
  }

  if (req.method !== "POST") return methodNotAllowed(res);

  const nextSettings = {
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
  const profile = normalizeProfile(req.body || {});
  const validationError = validateProfile(profile);

  if (validationError) {
    return sendJson(res, 400, { error: validationError });
  }

  const users = await getUsersCollection();
  const emailChanged = profile.email && profile.email !== normalizeAuthIdentifier(user.email || "");
  if (emailChanged) {
    const existingEmailUser = await users.findOne({
      _id: { $ne: user._id },
      $or: [{ email: profile.email }, { identifier: profile.email }]
    });
    if (existingEmailUser) return sendJson(res, 409, { error: "That email address is already registered." });
  }

  const nextProfile = {
    ...(user.profile || {}),
    ...profile,
    email: emailChanged ? user.email || "" : profile.email,
    pendingEmail: emailChanged ? profile.email : user.pendingEmail || "",
    phone: profile.phone
  };

  const setFields = {
    fullName: profile.fullName,
    phone: profile.phone,
    profile: nextProfile,
    updatedAt: new Date()
  };

  if (emailChanged) {
    setFields.pendingEmail = profile.email;
    setFields.emailVerified = false;
  } else {
    setFields.email = profile.email;
    setFields.emailVerified = user.emailVerified !== false;
    if (isEmailIdentifier(user.identifier)) setFields.identifier = profile.email;
  }

  await users.updateOne(
    { _id: user._id },
    {
      $set: setFields,
      ...(emailChanged ? {} : { $unset: { pendingEmail: "" } })
    }
  );
  const updatedUser = await users.findOne({ _id: user._id });
  let supabaseSynced = false;
  try {
    await upsertSupabaseUserProfile({ user: updatedUser, profile: nextProfile });
    supabaseSynced = true;
  } catch (error) {
    console.error("[auth/update-profile]", {
      message: "Supabase profile sync failed",
      error: error?.message
    });
  }
  return sendJson(res, 200, {
    ok: true,
    user: publicUser(updatedUser),
    supabaseSynced,
    message: emailChanged
      ? "Profile saved. Verify the new email address before it replaces your current email."
      : "Personal details updated."
  });
}

async function sendProfileVerification(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);
  const user = await requireAuth(req);
  const users = await getUsersCollection();

  const targetEmail = normalizeAuthIdentifier(user.pendingEmail || user.email || "");
  if (!isEmailIdentifier(targetEmail)) return sendJson(res, 400, { error: "No valid email address is available for verification." });
  const otpFields = await createOtpFields();
  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        "profileVerification.emailOtpHash": otpFields.otpHash,
        "profileVerification.emailOtpExpiresAt": otpFields.otpExpiresAt,
        "profileVerification.emailOtpAttempts": 0,
        updatedAt: new Date()
      }
    }
  );
  await sendOtpEmail({ to: targetEmail, fullName: user.fullName || "Member", otp: otpFields.otp });
  return sendJson(res, 200, { ok: true, channel: "email", message: "A verification code has been sent to your email address." });
}

async function verifyProfileContact(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);
  const user = await requireAuth(req);
  const otp = cleanOtp(req.body?.otp);
  if (!/^\d{6}$/.test(otp)) return sendJson(res, 400, { error: "Enter the 6-digit verification code." });

  const users = await getUsersCollection();
  if (!user.profileVerification?.emailOtpHash || !user.profileVerification?.emailOtpExpiresAt) {
    return sendJson(res, 400, { error: "Request a new email verification code." });
  }
  if (Date.now() > new Date(user.profileVerification.emailOtpExpiresAt).getTime()) {
    await users.updateOne(
      { _id: user._id },
      {
        $unset: {
          "profileVerification.emailOtpHash": "",
          "profileVerification.emailOtpExpiresAt": ""
        },
        $set: { "profileVerification.emailOtpAttempts": 0 }
      }
    );
    return sendJson(res, 400, { error: "Verification code expired. Request a new code." });
  }
  if ((user.profileVerification.emailOtpAttempts || 0) >= 5) {
    return sendJson(res, 429, { error: "Too many verification attempts. Request a new code." });
  }
  const valid = await bcrypt.compare(otp, user.profileVerification.emailOtpHash);
  if (!valid) {
    await users.updateOne({ _id: user._id }, { $inc: { "profileVerification.emailOtpAttempts": 1 } });
    return sendJson(res, 401, { error: "Invalid verification code." });
  }

  const nextEmail = normalizeAuthIdentifier(user.pendingEmail || user.email || "");
  const nextProfile = {
    ...(user.profile || {}),
    email: nextEmail,
    pendingEmail: ""
  };
  const setFields = {
    email: nextEmail,
    emailVerified: true,
    profile: nextProfile,
    updatedAt: new Date()
  };
  if (isEmailIdentifier(user.identifier)) setFields.identifier = nextEmail;
  await users.updateOne(
    { _id: user._id },
    {
      $set: setFields,
      $unset: {
        pendingEmail: "",
        "profileVerification.emailOtpHash": "",
        "profileVerification.emailOtpExpiresAt": "",
        "profileVerification.emailOtpAttempts": ""
      }
    }
  );
  const updatedUser = await users.findOne({ _id: user._id });
  await upsertSupabaseUserProfile({ user: updatedUser, profile: nextProfile }).catch((error) => {
    console.error("[auth/profile-verify]", { message: "Supabase email profile sync failed", error: error?.message });
  });
  return sendJson(res, 200, { ok: true, user: publicUser(updatedUser), message: "Email address verified." });
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
  const identifier = email;
  const password = String(req.body?.password || "");

  if (!fullName || !email || password.length < 8) {
    return sendJson(res, 400, {
      error: "Full name, email address, and a password of at least 8 characters are required."
    });
  }

  if (!isEmailIdentifier(email)) {
    return sendJson(res, 400, { error: "Enter a valid email address." });
  }

  const users = await getUsersCollection();
  const intents = await getRegistrationIntentsCollection();
  await cleanupExpiredOtpUsers(users);
  await cleanupExpiredRegistrationIntents(intents);

  const existing = await users.findOne({ $or: [{ identifier }, { email }] });
  if (isUserVerified(existing)) {
    return sendJson(res, 409, { error: "An account already exists for that email address." });
  }
  if (existing) await users.deleteOne({ _id: existing._id });

  const passwordHash = await bcrypt.hash(password, 12);
  const channel = "email";
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const pendingRegistration = {
    fullName,
    identifier,
    email,
    phone: "",
    phoneCountry: "",
    passwordHash,
    role: "user",
    channel,
    otpAttempts: 0,
    expiresAt,
    createdAt: new Date()
  };

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

  return sendJson(res, 201, {
    verificationRequired: true,
    identifier,
    channel,
    expiresAt: pendingRegistration.expiresAt.toISOString(),
    message: "A verification code has been sent to your email."
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

  let verifiedUserId;
  if (user) {
    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          fullName: pending.fullName,
          identifier: pending.identifier,
          email: pending.email,
          phone: pending.phone,
          phoneCountry: pending.phoneCountry,
          passwordHash: pending.passwordHash,
          role: pending.role || user.role || "user",
          verified: true,
          isVerified: true,
          updatedAt: new Date()
        }
      }
    );
    verifiedUserId = user._id;
  } else {
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
    verifiedUserId = result.insertedId;
  }
  await intents.deleteOne({ _id: pending._id });
  const verifiedUser = await users.findOne({ _id: verifiedUserId });
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

async function twoStepStatus(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res);
  const user = await requireAuth(req);
  return sendJson(res, 200, {
    enabled: Boolean(user.twoStep?.enabled),
    recoveryCodeCount: Array.isArray(user.twoStep?.recoveryCodeHashes) ? user.twoStep.recoveryCodeHashes.length : 0,
    lockedUntil: user.twoStep?.lockedUntil || user.twoFactorLockUntil || null
  });
}

async function twoStepSetup(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);
  const user = await requireAuth(req);
  const users = await getUsersCollection();
  const secret = base32Encode(crypto.randomBytes(20));
  const otpauthUri = buildOtpauthUri({ user, secret });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUri, {
    errorCorrectionLevel: "M",
    margin: 1,
    scale: 6,
    color: {
      dark: "#0b0b0b",
      light: "#f8f1df"
    }
  });

  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        "twoStep.pendingSecretEncrypted": encryptSecret(secret),
        "twoStep.pendingCreatedAt": new Date(),
        updatedAt: new Date()
      }
    }
  );

  return sendJson(res, 200, {
    manualKey: secret,
    qrCodeDataUrl,
    issuer: TOTP_ISSUER,
    message: "Scan the QR code, then enter the 6-digit authenticator code."
  });
}

async function twoStepVerifySetup(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);
  const user = await requireAuth(req);
  const code = cleanOtp(req.body?.code);

  if (!/^\d{6}$/.test(code)) return sendJson(res, 400, { error: "Enter the 6-digit authenticator code." });
  if (!user.twoStep?.pendingSecretEncrypted) {
    return sendJson(res, 400, { error: "Start two-step verification setup before verifying a code." });
  }

  const secret = decryptSecret(user.twoStep.pendingSecretEncrypted);
  if (!verifyTotp(secret, code)) return sendJson(res, 401, { error: "Invalid authenticator code." });

  const recoveryCodes = createRecoveryCodes();
  const recoveryCodeHashes = await hashRecoveryCodes(recoveryCodes);
  const users = await getUsersCollection();
  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        "twoStep.enabled": true,
        "twoStep.secretEncrypted": encryptSecret(secret),
        "twoStep.recoveryCodeHashes": recoveryCodeHashes,
        "twoStep.failedAttempts": 0,
        "securitySettings.twoStepEnabled": true,
        updatedAt: new Date()
      },
      $unset: {
        "twoStep.pendingSecretEncrypted": "",
        "twoStep.pendingCreatedAt": "",
        "twoStep.lockedUntil": "",
        twoFactorLockUntil: ""
      }
    }
  );

  return sendJson(res, 200, {
    ok: true,
    enabled: true,
    recoveryCodes,
    message: "2-step verification is now enabled."
  });
}

async function twoStepDisable(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);
  const user = await requireAuth(req);
  const currentPassword = String(req.body?.currentPassword || "");
  const code = cleanOtp(req.body?.code);

  if (!user.twoStep?.enabled) return sendJson(res, 400, { error: "2-step verification is not enabled." });
  if (!currentPassword || !/^\d{6}$/.test(code)) {
    return sendJson(res, 400, { error: "Enter your current password and authenticator code." });
  }
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return sendJson(res, 401, { error: "Current password is incorrect." });
  }

  const users = await getUsersCollection();
  const verification = await verifyUserTwoFactorCode({ users, user, code, allowRecovery: false });
  if (!verification.ok) return sendJson(res, verification.status, { error: verification.error });

  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        "twoStep.enabled": false,
        "securitySettings.twoStepEnabled": false,
        updatedAt: new Date()
      },
      $unset: {
        "twoStep.secretEncrypted": "",
        "twoStep.recoveryCodeHashes": "",
        "twoStep.pendingSecretEncrypted": "",
        "twoStep.lockedUntil": "",
        twoFactorLockUntil: ""
      }
    }
  );
  return sendJson(res, 200, { ok: true, enabled: false, message: "2-step verification has been disabled." });
}

async function twoStepRegenerateRecovery(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);
  const user = await requireAuth(req);
  const currentPassword = String(req.body?.currentPassword || "");
  const code = cleanOtp(req.body?.code);

  if (!user.twoStep?.enabled) return sendJson(res, 400, { error: "Enable 2-step verification first." });
  if (!currentPassword || !/^\d{6}$/.test(code)) {
    return sendJson(res, 400, { error: "Enter your current password and authenticator code." });
  }
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return sendJson(res, 401, { error: "Current password is incorrect." });
  }

  const users = await getUsersCollection();
  const verification = await verifyUserTwoFactorCode({ users, user, code, allowRecovery: false });
  if (!verification.ok) return sendJson(res, verification.status, { error: verification.error });

  const recoveryCodes = createRecoveryCodes();
  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        "twoStep.recoveryCodeHashes": await hashRecoveryCodes(recoveryCodes),
        updatedAt: new Date()
      }
    }
  );
  return sendJson(res, 200, { ok: true, recoveryCodes, message: "New recovery codes generated." });
}

async function verifyLoginTwoStep(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);
  const { users, user } = await getTwoFactorUserFromChallenge(req.body?.challengeToken);
  if (!user.twoStep?.enabled) return sendJson(res, 400, { error: "2-step verification is not enabled for this account." });

  const verification = await verifyUserTwoFactorCode({
    users,
    user,
    code: req.body?.code,
    allowRecovery: true
  });

  if (!verification.ok) return sendJson(res, verification.status, { error: verification.error });

  const refreshedUser = await users.findOne({ _id: user._id });
  setSessionCookie(res, signToken(refreshedUser));
  return sendJson(res, 200, { user: publicUser(refreshedUser), message: "Sign in verified." });
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

  if (!isEmailIdentifier(identifier)) {
    return sendJson(res, 400, { error: "Enter a valid email address." });
  }

  const users = await getUsersCollection();
  const user = await users.findOne({ $or: [{ identifier }, { email: identifier }] });

  if (!user) return sendJson(res, 400, { error: "Invalid or expired reset code." });

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
  "send-profile-verification": sendProfileVerification,
  "supabase-reset-password": supabaseResetPassword,
  "update-profile": updateProfile,
  "verify-otp": verifyOtp,
  "verify-profile-contact": verifyProfileContact
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
