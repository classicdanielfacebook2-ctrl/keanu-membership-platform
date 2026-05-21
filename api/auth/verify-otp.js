import bcrypt from "bcryptjs";
import {
  checkTwilioSmsOtp,
  getRegistrationIntentsCollection,
  getUsersCollection,
  handleApiError,
  isUserVerified,
  methodNotAllowed,
  normalizeAuthIdentifier,
  publicUser,
  sendJson,
  setSessionCookie,
  signToken
} from "../../serverless/authCore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);

  try {
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

    if (!/^\d{6}$/.test(otp)) {
      return sendJson(res, 400, { error: "Enter the 6-digit verification code sent to you." });
    }

    if (Date.now() > new Date(pending.expiresAt).getTime()) {
      await intents.deleteOne({ _id: pending._id });
      return sendJson(res, 400, {
        error: "Verification code expired. Please register again to receive a new code."
      });
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
  } catch (error) {
    return handleApiError(res, "auth/verify-otp", error);
  }
}
