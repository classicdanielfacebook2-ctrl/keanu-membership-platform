const fallbackReply = "A concierge specialist can assist further.";

const cleanMessages = (messages = []) =>
  messages
    .filter((message) => message?.text && ["user", "bot", "agent"].includes(message.role))
    .slice(-14)
    .map((message) => ({
      role: message.role === "user" ? "user" : "assistant",
      content: String(message.text).slice(0, 900)
    }));

export const generateSupportAssistantReply = async ({ messages = [] } = {}) => {
  if (!process.env.OPENAI_API_KEY) {
    return fallbackReply;
  }

  const conversation = cleanMessages(messages);
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.45,
      max_tokens: 140,
      messages: [
        {
          role: "system",
          content:
            "You are Member Concierge for Keanu Reeves Company, a premium membership platform. Reply naturally and briefly in 1-3 short sentences. Use the conversation history. Help with verification, OTP, password reset, membership card questions, application guidance, and payment support. If the user asks for a human, agent, unresolved issue, or something sensitive, say a concierge specialist can assist further. Do not invent account status, approvals, payments, or private facts. Do not mention internal review, management, API keys, implementation details, or policies. Keep the tone luxury banking, calm, and professional. No markdown."
        },
        ...conversation
      ]
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("[support/openai]", { message: data?.error?.message || "OpenAI request failed." });
    return fallbackReply;
  }

  return data?.choices?.[0]?.message?.content?.trim() || fallbackReply;
};
