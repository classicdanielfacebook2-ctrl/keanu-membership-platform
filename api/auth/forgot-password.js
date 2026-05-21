import { isAllowedPhoneNumber } from "../../src/data/phoneCountries.js";
import {
  createPasswordResetFields,
  getVerificationChannel,
  getUsersCollection,
  handleApiError,
  isEmailIdentifier,
  isPhoneIdentifier,
  methodNotAllowed,
  normalizeAuthIdentifier,
  sendJson,
  sendPasswordResetEmail,
  sendTwilioSmsOtp
} from "../../serverless/authCore.js";

const emailResetMessage = "If this email is registered, we sent a reset link/code to your email address.";
const phoneResetMessage = "If this phone number is registered, we sent a reset code by SMS.";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);

  try {
    const identifier = normalizeAuthIdentifier(req.body?.identifier);

    const isEmail = isEmailIdentifier(identifier);
    const isPhone = isPhoneIdentifier(identifier);

    if (identifier && (isEmail || (isPhone && isAllowedPhoneNumber(identifier)))) {
      const users = await getUsersCollection();
      const user = await users.findOne({ $or: [{ identifier }, { email: identifier }, { phone: identifier }] });

      if (user) {
        const channel = getVerificationChannel(identifier);

        try {
          if (channel === "sms") {
            await sendTwilioSmsOtp({ to: identifier });
          } else {
            const resetFields = await createPasswordResetFields();
            await users.updateOne(
              { _id: user._id },
              {
                $set: {
                  resetCodeHash: resetFields.resetCodeHash,
                  resetExpiresAt: resetFields.resetExpiresAt,
                  resetAttempts: 0
                }
              }
            );
            await sendPasswordResetEmail({
              to: user.identifier,
              fullName: user.fullName || "there",
              resetCode: resetFields.resetCode
            });
          }
          console.log("[auth/forgot-password]", { message: "Password reset email sent" });
        } catch (emailError) {
          console.error("[auth/forgot-password]", {
            message: "Password reset email failed",
            error: emailError?.message
          });
        }
      }
    }

    return sendJson(res, 200, { ok: true, message: isPhone ? phoneResetMessage : emailResetMessage });
  } catch (error) {
    return handleApiError(res, "auth/forgot-password", error);
  }
}
