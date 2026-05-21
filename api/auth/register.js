import bcrypt from "bcryptjs";
import {
  cleanupExpiredOtpUsers,
  createOtpFields,
  getUsersCollection,
  handleApiError,
  isEmailIdentifier,
  isUserVerified,
  methodNotAllowed,
  normalizeIdentifier,
  sendJson,
  sendOtpEmail
} from "../../serverless/authCore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);

  try {
    const fullName = String(req.body?.fullName || "").trim();
    const identifier = normalizeIdentifier(req.body?.identifier);
    const password = String(req.body?.password || "");

    if (!fullName || !identifier || password.length < 8) {
      return sendJson(res, 400, {
        error: "Full name, email, and a password of at least 8 characters are required."
      });
    }

    if (!isEmailIdentifier(identifier)) {
      return sendJson(res, 400, { error: "A valid email address is required for account verification." });
    }

    // Connect before registration work so deployment config problems surface clearly in Vercel logs.
    const users = await getUsersCollection();
    await cleanupExpiredOtpUsers(users);

    const existing = await users.findOne({ identifier });
    if (isUserVerified(existing)) {
      return sendJson(res, 409, { error: "An account already exists for that email." });
    }
    if (existing) {
      await users.deleteOne({ _id: existing._id });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const otpFields = await createOtpFields();
    const user = {
      fullName,
      identifier,
      passwordHash,
      role: "user",
      verified: false,
      isVerified: false,
      otpHash: otpFields.otpHash,
      otpExpiresAt: otpFields.otpExpiresAt,
      otpAttempts: 0,
      createdAt: new Date()
    };

    const result = await users.insertOne(user);

    try {
      await sendOtpEmail({ to: identifier, fullName, otp: otpFields.otp });
    } catch (emailError) {
      await users.deleteOne({ _id: result.insertedId });
      throw emailError;
    }

    return sendJson(res, 201, {
      verificationRequired: true,
      identifier,
      expiresAt: otpFields.otpExpiresAt.toISOString(),
      message: "A verification code has been sent to your email."
    });
  } catch (error) {
    return handleApiError(res, "auth/register", error);
  }
}
