import bcrypt from "bcryptjs";
import {
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
    const password = String(req.body?.password || "");
    const users = await getUsersCollection();
    const user = await users.findOne({ identifier });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return sendJson(res, 401, { error: "Invalid email/phone or password." });
    }

    if (!isUserVerified(user)) {
      return sendJson(res, 403, {
        error: "Please verify your email before logging in.",
        verificationRequired: true,
        identifier: user.identifier
      });
    }

    setSessionCookie(res, signToken(user));
    return sendJson(res, 200, { user: publicUser(user) });
  } catch (error) {
    return handleApiError(res, "auth/login", error);
  }
}
