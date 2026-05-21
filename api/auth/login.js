import bcrypt from "bcryptjs";
import { isAllowedPhoneNumber } from "../../src/data/phoneCountries.js";
import {
  getUsersCollection,
  handleApiError,
  isEmailIdentifier,
  isPhoneIdentifier,
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
    if (!isEmailIdentifier(identifier) && (!isPhoneIdentifier(identifier) || !isAllowedPhoneNumber(identifier))) {
      return sendJson(res, 400, { error: "Enter an allowed email address or phone number." });
    }
    const users = await getUsersCollection();
    const user = await users.findOne({ $or: [{ identifier }, { email: identifier }, { phone: identifier }] });

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
