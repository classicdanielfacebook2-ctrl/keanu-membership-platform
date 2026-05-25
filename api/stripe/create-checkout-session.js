import { requireAuth, sendJson } from "../../../serverless/authCore.js";
import { createCheckoutSession } from "../../../serverless/stripeCore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  try {
    const user = await requireAuth(req);
    const application = req.body?.application || {};
    if (!application.id && !application.referenceId) {
      return sendJson(res, 400, { error: "Application reference is required." });
    }
    if (!application.selectedCard) {
      return sendJson(res, 400, { error: "Selected membership card is required." });
    }

    const session = await createCheckoutSession({ user, application });
    return sendJson(res, 200, {
      id: session.id,
      url: session.url
    });
  } catch (error) {
    const status = error.status || 500;
    console.error("[stripe/create-checkout-session]", { message: error?.message, name: error?.name });
    return sendJson(res, status, {
      error: error?.message || "Unable to create checkout session."
    });
  }
}
