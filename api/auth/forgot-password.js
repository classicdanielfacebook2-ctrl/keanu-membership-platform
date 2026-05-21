import {
  createPasswordResetFields,
  getUsersCollection,
  handleApiError,
  isEmailIdentifier,
  methodNotAllowed,
  normalizeIdentifier,
  sendJson,
  sendPasswordResetEmail
} from "../../serverless/authCore.js";

const RESET_MESSAGE = "If this email is registered, we sent a reset link/code to your email address.";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);

  try {
    const identifier = normalizeIdentifier(req.body?.identifier);

    if (identifier && isEmailIdentifier(identifier)) {
      const users = await getUsersCollection();
      const user = await users.findOne({ identifier });

      if (user) {
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

        try {
          await sendPasswordResetEmail({
            to: user.identifier,
            fullName: user.fullName || "there",
            resetCode: resetFields.resetCode
          });
          console.log("[auth/forgot-password]", { message: "Password reset email sent" });
        } catch (emailError) {
          console.error("[auth/forgot-password]", {
            message: "Password reset email failed",
            error: emailError?.message
          });
        }
      }
    }

    return sendJson(res, 200, { ok: true, message: RESET_MESSAGE });
  } catch (error) {
    return handleApiError(res, "auth/forgot-password", error);
  }
}
