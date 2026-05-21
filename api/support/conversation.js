import { requireAuth } from "../../serverless/authCore.js";
import {
  assertSupportSessionAccess,
  createOrGetConversation,
  getConversationHistory,
  getOrCreateSupportSessionId,
  getSupportSessionId,
  handleSupportError,
  sendJson
} from "../../serverless/supportCore.js";

export default async function handler(req, res) {
  try {
    if (req.method === "POST") {
      const { visitorId } = req.body || {};
      const sessionId = getOrCreateSupportSessionId(req, res, visitorId);
      return sendJson(res, 200, await createOrGetConversation(sessionId));
    }

    if (req.method === "GET") {
      const { conversationId } = req.query || {};
      const data = await getConversationHistory(conversationId);
      let isAdmin = false;
      try {
        const user = await requireAuth(req);
        isAdmin = user?.role === "admin";
      } catch {
        isAdmin = false;
      }
      if (!isAdmin) assertSupportSessionAccess({ sessionId: getSupportSessionId(req), conversation: data.conversation });
      return sendJson(res, 200, data);
    }

    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { error: "Method not allowed." });
  } catch (error) {
    return handleSupportError(res, "support/conversation", error);
  }
}
