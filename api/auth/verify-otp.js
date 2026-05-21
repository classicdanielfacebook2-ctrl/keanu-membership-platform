import bcrypt from "bcryptjs";
import {
  getUsersCollection,
  handleApiError,
  methodNotAllowed,
  normalizeIdentifier,
  publicUser,
  sendJson,
  setSessionCookie,
  signToken
} from "../../serverless/authCore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);

  try {
    const identifier = normalizeIdentifier(req.body?.identifier);
    const otp = String(req.body?.otp || "").trim();
    const users = await getUsersCollection();
    const user = await users.findOne({ identifier });

    if (!user) return sendJson(res, 404, { error: "Account not found." });

    if (user.verified) {
      setSessionCookie(res, signToken(user));
      return sendJson(res, 200, { user: publicUser(user), message: "Account already verified." });
    }

    if (!/^\d{6}$/.test(otp) || !user.otpHash || !user.otpExpiresAt) {
      return sendJson(res, 400, { error: "Enter the 6-digit verification code sent to your email." });
    }

    if (Date.now() > new Date(user.otpExpiresAt).getTime()) {
      return sendJson(res, 400, { error: "Verification code expired. Request a new code." });
    }

    if ((user.otpAttempts || 0) >= 5) {
      return sendJson(res, 429, { error: "Too many verification attempts. Request a new code." });
    }

    const validOtp = await bcrypt.compare(otp, user.otpHash);
    if (!validOtp) {
      await users.updateOne({ _id: user._id }, { $inc: { otpAttempts: 1 } });
      return sendJson(res, 401, { error: "Invalid verification code." });
    }

    await users.updateOne(
      { _id: user._id },
      { $set: { verified: true, otpAttempts: 0 }, $unset: { otpHash: "", otpExpiresAt: "" } }
    );
    const verifiedUser = await users.findOne({ _id: user._id });
    setSessionCookie(res, signToken(verifiedUser));
    return sendJson(res, 200, { user: publicUser(verifiedUser), message: "Account verified successfully." });
  } catch (error) {
    return handleApiError(res, "auth/verify-otp", error);
  }
}
