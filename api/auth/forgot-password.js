import { handleApiError, methodNotAllowed } from "../../serverless/authCore.js";
import { sendSupabaseRecoveryResponse } from "../../serverless/supabaseAuthCore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res);

  try {
    return await sendSupabaseRecoveryResponse(res, req.body?.identifier);
  } catch (error) {
    return handleApiError(res, "auth/forgot-password", error);
  }
}
