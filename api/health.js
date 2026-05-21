import { getUsersCollection, handleApiError, sendJson } from "../serverless/authCore.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  try {
    await getUsersCollection();
    return sendJson(res, 200, {
      ok: true,
      mongodb: "connected",
      resendConfigured: Boolean(process.env.RESEND_API_KEY),
      sender: "verification@keanureeves.company"
    });
  } catch (error) {
    return handleApiError(res, "health", error);
  }
}
