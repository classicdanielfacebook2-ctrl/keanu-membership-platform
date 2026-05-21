import { handleSupportError, sendJson, takeoverConversation } from "../../serverless/supportCore.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { error: "Method not allowed." });
    }
    return sendJson(res, 200, await takeoverConversation(req.body?.conversationId));
  } catch (error) {
    return handleSupportError(res, "support/takeover", error);
  }
}
