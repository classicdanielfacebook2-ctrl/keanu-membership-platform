import { handleSupportError, listConversations, sendJson } from "../../serverless/supportCore.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return sendJson(res, 405, { error: "Method not allowed." });
    }
    return sendJson(res, 200, { conversations: await listConversations() });
  } catch (error) {
    return handleSupportError(res, "support/conversations", error);
  }
}
