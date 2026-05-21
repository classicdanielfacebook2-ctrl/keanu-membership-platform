import { handleSupportError, listConversations, sendJson } from "../../serverless/supportCore.js";
import { requireAuth } from "../../serverless/authCore.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return sendJson(res, 405, { error: "Method not allowed." });
    }
    const user = await requireAuth(req);
    if (user.role !== "admin") {
      return sendJson(res, 403, { error: "Admin support access required." });
    }
    return sendJson(res, 200, { conversations: await listConversations() });
  } catch (error) {
    return handleSupportError(res, "support/conversations", error);
  }
}
