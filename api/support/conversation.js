import { createOrGetConversation, getConversationHistory, handleSupportError, sendJson } from "../../serverless/supportCore.js";

export default async function handler(req, res) {
  try {
    if (req.method === "POST") {
      const { visitorId } = req.body || {};
      return sendJson(res, 200, await createOrGetConversation(visitorId));
    }

    if (req.method === "GET") {
      const { conversationId } = req.query || {};
      return sendJson(res, 200, await getConversationHistory(conversationId));
    }

    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { error: "Method not allowed." });
  } catch (error) {
    return handleSupportError(res, "support/conversation", error);
  }
}
