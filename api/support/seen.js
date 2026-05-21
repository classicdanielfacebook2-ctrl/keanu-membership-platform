import { requireAuth } from "../../serverless/authCore.js";
import {
  assertSupportSessionAccess,
  getConversationHistory,
  getSupportSessionId,
  handleSupportError,
  markSeen,
  sendJson
} from "../../serverless/supportCore.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { error: "Method not allowed." });
    }
    const body = req.body || {};
    if (body.viewerRole === "agent") {
      const user = await requireAuth(req);
      if (user.role !== "admin") return sendJson(res, 403, { error: "Admin support access required." });
      return sendJson(res, 200, await markSeen(body));
    }
    const history = await getConversationHistory(body.conversationId);
    assertSupportSessionAccess({ sessionId: getSupportSessionId(req), conversation: history.conversation });
    return sendJson(res, 200, await markSeen({ ...body, viewerRole: "visitor" }));
  } catch (error) {
    return handleSupportError(res, "support/seen", error);
  }
}
