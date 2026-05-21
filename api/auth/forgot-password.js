import { methodNotAllowed, normalizeIdentifier, sendJson } from "../../serverless/authCore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);

  const identifier = normalizeIdentifier(req.body?.identifier);
  return sendJson(res, 200, {
    ok: true,
    message: identifier
      ? "If an account exists, a secure reset link or code will be sent."
      : "Enter an email or phone number to request a reset."
  });
}
