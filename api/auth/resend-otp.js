import {
  createOtpFields,
  getRegistrationIntentsCollection,
  handleApiError,
  methodNotAllowed,
  normalizeAuthIdentifier,
  sendJson,
  sendOtpEmail,
  sendTwilioSmsOtp
} from "../../serverless/authCore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);

  try {
    const identifier = normalizeAuthIdentifier(req.body?.identifier);
    const intents = await getRegistrationIntentsCollection();
    const pending = await intents.findOne({ identifier });

    if (!pending) return sendJson(res, 404, { error: "No pending verification found. Please register again." });

    if (pending.channel === "sms") {
      await sendTwilioSmsOtp({ to: pending.identifier });
      return sendJson(res, 200, {
        ok: true,
        message: "A new verification code has been sent to your phone number."
      });
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
  } catch (error) {
    return handleApiError(res, "auth/resend-otp", error);
  }
}
