import { getStripe, mapCheckoutStatus, markPaymentFromStripe } from "../serverless/stripeCore.js";

export const config = {
  api: {
    bodyParser: false
  }
};

const readRawBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

const getPaymentIntentId = (value) => (typeof value === "string" ? value : value?.id || "");

const checkoutLookup = (session) => ({
  checkoutSessionId: session.id
});

const intentLookup = (intent) => ({
  paymentIntentId: intent.id
});

const chargeLookup = (charge) => {
  const paymentIntentId = getPaymentIntentId(charge.payment_intent);
  return paymentIntentId ? { paymentIntentId } : { chargeId: charge.id || charge.charge || "" };
};

const baseMetadata = (object = {}) => ({
  applicationId: object.metadata?.applicationId || object.client_reference_id || "",
  referenceId: object.metadata?.referenceId || "",
  userId: object.metadata?.userId || "",
  selectedCard: object.metadata?.selectedCard || "",
  paymentMethod: object.metadata?.paymentMethod || "",
  paymentMethodLabel: object.metadata?.paymentMethodLabel || "",
  paymentCurrency: object.metadata?.paymentCurrency || "",
  delayedPayment: object.metadata?.delayedPayment === "true"
});

const handleStripeEvent = async (event) => {
  const object = event.data.object;

  switch (event.type) {
    case "checkout.session.completed": {
      const mapped = mapCheckoutStatus(object);
      await markPaymentFromStripe({
        lookup: checkoutLookup(object),
        updates: {
          ...baseMetadata(object),
          checkoutSessionId: object.id,
          paymentIntentId: getPaymentIntentId(object.payment_intent),
          stripeStatus: object.status,
          stripePaymentStatus: object.payment_status,
          ...mapped
        }
      });
      break;
    }
    case "checkout.session.expired": {
      await markPaymentFromStripe({
        lookup: checkoutLookup(object),
        updates: {
          ...baseMetadata(object),
          checkoutSessionId: object.id,
          paymentIntentId: getPaymentIntentId(object.payment_intent),
          stripeStatus: object.status,
          stripePaymentStatus: object.payment_status,
          status: "expired",
          paymentStatus: "Expired",
          membershipStatus: "Pending"
        }
      });
      break;
    }
    case "checkout.session.async_payment_succeeded": {
      await markPaymentFromStripe({
        lookup: checkoutLookup(object),
        updates: {
          ...baseMetadata(object),
          checkoutSessionId: object.id,
          paymentIntentId: getPaymentIntentId(object.payment_intent),
          stripeStatus: object.status,
          stripePaymentStatus: object.payment_status,
          status: "paid",
          paymentStatus: "Paid",
          membershipStatus: "Active"
        }
      });
      break;
    }
    case "checkout.session.async_payment_failed": {
      await markPaymentFromStripe({
        lookup: checkoutLookup(object),
        updates: {
          ...baseMetadata(object),
          checkoutSessionId: object.id,
          paymentIntentId: getPaymentIntentId(object.payment_intent),
          stripeStatus: object.status,
          stripePaymentStatus: object.payment_status,
          status: "payment_failed",
          paymentStatus: "Failed",
          membershipStatus: "Pending"
        }
      });
      break;
    }
    case "payment_intent.processing": {
      await markPaymentFromStripe({
        lookup: intentLookup(object),
        updates: {
          ...baseMetadata(object),
          paymentIntentId: object.id,
          status: baseMetadata(object).paymentMethod === "bank_transfer" ? "awaiting_bank_transfer" : "processing",
          paymentStatus: baseMetadata(object).paymentMethod === "bank_transfer" ? "Awaiting Bank Transfer" : "Processing",
          membershipStatus: "Pending",
          stripePaymentStatus: object.status
        }
      });
      break;
    }
    case "payment_intent.succeeded": {
      await markPaymentFromStripe({
        lookup: intentLookup(object),
        updates: {
          ...baseMetadata(object),
          paymentIntentId: object.id,
          status: "paid",
          paymentStatus: "Paid",
          membershipStatus: "Active",
          stripePaymentStatus: object.status
        }
      });
      break;
    }
    case "payment_intent.payment_failed": {
      await markPaymentFromStripe({
        lookup: intentLookup(object),
        updates: {
          ...baseMetadata(object),
          paymentIntentId: object.id,
          status: "payment_failed",
          paymentStatus: "Failed",
          membershipStatus: "Pending",
          stripePaymentStatus: object.status,
          failureMessage: object.last_payment_error?.message || ""
        }
      });
      break;
    }
    case "payment_intent.partially_funded": {
      await markPaymentFromStripe({
        lookup: intentLookup(object),
        updates: {
          ...baseMetadata(object),
          paymentIntentId: object.id,
          status: "partially_paid",
          paymentStatus: "Partially Paid",
          membershipStatus: "Pending",
          stripePaymentStatus: object.status
        }
      });
      break;
    }
    case "charge.refunded":
    case "refund.updated":
    case "charge.refund.updated": {
      await markPaymentFromStripe({
        lookup: chargeLookup(object),
        updates: {
          status: "refunded",
          paymentStatus: "Refunded",
          membershipStatus: "Refunded",
          refundStatus: object.status || "updated",
          chargeId: object.charge || object.id
        }
      });
      break;
    }
    case "charge.dispute.created": {
      await markPaymentFromStripe({
        lookup: chargeLookup(object),
        updates: {
          paymentStatus: "Disputed",
          membershipStatus: "Restricted",
          disputeId: object.id,
          disputeStatus: object.status
        }
      });
      break;
    }
    case "charge.dispute.closed": {
      await markPaymentFromStripe({
        lookup: chargeLookup(object),
        updates: {
          disputeId: object.id,
          disputeStatus: object.status,
          disputeOutcome: object.outcome?.reason || object.outcome?.type || ""
        }
      });
      break;
    }
    default:
      console.log("[stripe/webhook] Unhandled event", { type: event.type });
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  const signature = req.headers["stripe-signature"];
  if (!signature) return res.status(400).json({ error: "Missing Stripe signature." });
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return res.status(500).json({ error: "Stripe webhook secret is not configured." });

  let event;
  try {
    const rawBody = await readRawBody(req);
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("[stripe/webhook/verify]", { message: error?.message });
    return res.status(400).json({ error: "Invalid Stripe webhook signature." });
  }

  try {
    await handleStripeEvent(event);
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("[stripe/webhook]", { type: event.type, message: error?.message, stack: error?.stack });
    return res.status(500).json({ error: "Webhook handler failed." });
  }
}
