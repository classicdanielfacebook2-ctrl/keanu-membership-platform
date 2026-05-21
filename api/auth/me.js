import { clearSessionCookie, handleApiError, publicUser, requireAuth, sendJson } from "../../serverless/authCore.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  try {
    const user = await requireAuth(req);
    return sendJson(res, 200, { user: publicUser(user) });
  } catch (error) {
    clearSessionCookie(res);
    if (error.status === 401) {
      return sendJson(res, 401, { error: error.message });
    }
    return handleApiError(res, "auth/me", error);
  }
}
