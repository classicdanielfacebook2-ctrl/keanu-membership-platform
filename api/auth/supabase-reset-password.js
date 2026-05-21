import { handleApiError, methodNotAllowed, sendJson } from "../../serverless/authCore.js";
import { syncSupabaseRecoveredPassword } from "../../serverless/supabaseAuthCore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);

  try {
    const authorization = req.headers.authorization || "";
    const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const result = await syncSupabaseRecoveredPassword({ accessToken, password: req.body?.password });
    return sendJson(res, result.status, result.payload);
  } catch (error) {
    return handleApiError(res, "auth/supabase-reset-password", error);
  }
}
