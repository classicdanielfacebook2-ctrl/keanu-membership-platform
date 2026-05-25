import { requireAuth, sendJson } from "../../../serverless/authCore.js";
import { getStripe, mapCheckoutStatus, markPaymentFromStripe } from "../../../serverless/stripeCore.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  try {
    await requireAuth(req);
    const sessionId = String(req.query?.session_id || "");
    if (!sessionId.startsWith("cs_")) return sendJson(res, 400, { error: "A valid Stripe session ID is required." });

    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    const mapped = mapCheckoutStatus(session);
    await markPaymentFromStripe({
      lookup: { checkoutSessionId: session.id },
      updates: {
        applicationId: session.metadata?.applicationId || session.client_reference_id || "",
        referenceId: session.metadata?.referenceId || "",
        userId: session.metadata?.userId || "",
        selectedCard: session.metadata?.selectedCard || "",
        checkoutSessionId: session.id,
        paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || "",
        stripeStatus: session.status,
        stripePaymentStatus: session.payment_status,
        ...mapped
      }
    });

    return sendJson(res, 200, {
      checkoutSessionId: session.id,
      stripeStatus: session.status,
      stripePaymentStatus: session.payment_status,
      ...mapped
    });
  } catch (error) {
    const status = error.status || 500;
    console.error("[stripe/session-status]", { message: error?.message, name: error?.name });
    return sendJson(res, status, { error: error?.message || "Unable to confirm checkout status." });
  }
}
