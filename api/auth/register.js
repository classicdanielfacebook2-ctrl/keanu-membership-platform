import bcrypt from "bcryptjs";
import { isAllowedPhoneCountry, isAllowedPhoneNumber } from "../../src/data/phoneCountries.js";
import {
  cleanupExpiredOtpUsers,
  cleanupExpiredRegistrationIntents,
  createOtpFields,
  getRegistrationIntentsCollection,
  getVerificationChannel,
  getUsersCollection,
  handleApiError,
  isEmailIdentifier,
  isPhoneIdentifier,
  isUserVerified,
  methodNotAllowed,
  normalizeAuthIdentifier,
  sendJson,
  sendOtpEmail,
  sendTwilioSmsOtp
} from "../../serverless/authCore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);

  try {
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
      return sendJson(res, 400, {
        error: "Enter a valid email address and select an allowed phone country."
      });
    }

    // Connect before registration work so deployment config problems surface clearly in Vercel logs.
    const users = await getUsersCollection();
    const intents = await getRegistrationIntentsCollection();
    await cleanupExpiredOtpUsers(users);
    await cleanupExpiredRegistrationIntents(intents);

    const existing = await users.findOne({ $or: [{ identifier }, { email }, { phone }] });
    if (isUserVerified(existing)) {
      return sendJson(res, 409, { error: "An account already exists for that email or phone number." });
    }
    if (existing) {
      await users.deleteOne({ _id: existing._id });
    }

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
      } catch (emailError) {
        await intents.deleteOne({ identifier });
        throw emailError;
      }
    } else {
      await intents.replaceOne({ identifier }, pendingRegistration, { upsert: true });
      try {
        await sendTwilioSmsOtp({ to: identifier });
      } catch (smsError) {
        await intents.deleteOne({ identifier });
        throw smsError;
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
  } catch (error) {
    return handleApiError(res, "auth/register", error);
  }
}
