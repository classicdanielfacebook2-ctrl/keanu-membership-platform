import { clearSessionCookie, methodNotAllowed, sendJson } from "../../serverless/authCore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);
  clearSessionCookie(res);
  return sendJson(res, 200, { ok: true });
}
