import {
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
    const identifier = normalizeIdentifier(req.body?.identifier);
    const users = await getUsersCollection();
    const user = await users.findOne({ identifier });

    if (!user) return sendJson(res, 404, { error: "Account not found." });
    if (isUserVerified(user)) return sendJson(res, 200, { ok: true, message: "Account is already verified." });
    if (!isEmailIdentifier(user.identifier)) {
      return sendJson(res, 400, { error: "A valid email address is required for verification." });
    }

    const otpFields = await createOtpFields();
    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          otpHash: otpFields.otpHash,
          otpExpiresAt: otpFields.otpExpiresAt,
          otpAttempts: 0
        }
      }
    );
    await sendOtpEmail({ to: user.identifier, fullName: user.fullName, otp: otpFields.otp });
    return sendJson(res, 200, {
      ok: true,
      expiresAt: otpFields.otpExpiresAt.toISOString(),
      message: "A new verification code has been sent."
    });
  } catch (error) {
    return handleApiError(res, "auth/resend-otp", error);
  }
}
