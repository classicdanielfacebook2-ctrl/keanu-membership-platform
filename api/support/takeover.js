import { handleSupportError, sendJson, takeoverConversation } from "../../serverless/supportCore.js";
import { requireAuth } from "../../serverless/authCore.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { error: "Method not allowed." });
    }
    const user = await requireAuth(req);
    if (user.role !== "admin") {
      return sendJson(res, 403, { error: "Admin support access required." });
    }
    return sendJson(res, 200, await takeoverConversation(req.body?.conversationId));
  } catch (error) {
    return handleSupportError(res, "support/takeover", error);
  }
}
