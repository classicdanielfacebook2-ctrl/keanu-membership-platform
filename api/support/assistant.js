import { generateSupportAssistantReply } from "../../serverless/supportAssistant.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const reply = await generateSupportAssistantReply({ messages: req.body?.messages || [] });
    return res.status(200).json({ reply });
  } catch (error) {
    console.error("[support/assistant]", { message: error?.message, stack: error?.stack });
    return res.status(500).json({ reply: "A concierge specialist can assist further." });
  }
}
