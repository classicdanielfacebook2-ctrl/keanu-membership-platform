import bcrypt from "bcryptjs";
import { isAllowedPhoneNumber } from "../../src/data/phoneCountries.js";
import {
  checkTwilioSmsOtp,
  getVerificationChannel,
  getUsersCollection,
  handleApiError,
  isEmailIdentifier,
  isPhoneIdentifier,
  methodNotAllowed,
  normalizeAuthIdentifier,
  sendJson
} from "../../serverless/authCore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);

  try {
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

    if (!user) {
      return sendJson(res, 400, { error: "Invalid or expired reset code." });
    }

    if (channel === "email") {
      if (!user.resetCodeHash || !user.resetExpiresAt) {
        return sendJson(res, 400, { error: "Invalid or expired reset code." });
      }

      if (Date.now() > new Date(user.resetExpiresAt).getTime()) {
        await users.updateOne(
          { _id: user._id },
          { $unset: { resetCodeHash: "", resetExpiresAt: "" }, $set: { resetAttempts: 0 } }
        );
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
      if (verification.status !== "approved") {
        return sendJson(res, 401, { error: "Invalid reset code." });
      }
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
  } catch (error) {
    return handleApiError(res, "auth/reset-password", error);
  }
}
