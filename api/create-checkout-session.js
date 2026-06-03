import { requireAuth, sendJson } from "../serverless/authCore.js";
import {
  createCheckoutSession,
  getAdminPaymentRecords,
  getEnabledCheckoutPaymentMethodIds,
  getPaymentRecordForUser,
  getPaymentRecordsForUser
} from "../serverless/stripeCore.js";

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  try {
    const user = await requireAuth(req);
    if (req.method === "GET") {
      const action = String(req.query?.action || "methods");
      if (action === "status") {
        const applicationId = req.query?.applicationId || req.query?.application_id || "";
        if (!applicationId) return sendJson(res, 400, { error: "Application reference is required." });
        const payment = await getPaymentRecordForUser({ user, applicationId });
        if (!payment) return sendJson(res, 404, { error: "Payment record was not found." });
        return sendJson(res, 200, { payment });
      }
      if (action === "admin-payments") {
        const payments = await getAdminPaymentRecords({ user });
        return sendJson(res, 200, { payments });
      }
      if (action === "account-payments") {
        const payments = await getPaymentRecordsForUser({ user });
        return sendJson(res, 200, { payments });
      }

      const currency = req.query?.currency || "EUR";
      const countryCode = req.query?.countryCode || "";
      const enabledPaymentMethods = await getEnabledCheckoutPaymentMethodIds({ currency, countryCode });
      return sendJson(res, 200, {
        enabledPaymentMethods: enabledPaymentMethods.length ? enabledPaymentMethods : ["card"]
      });
    }

    const application = req.body?.application || {};
    if (!application.id && !application.referenceId) {
      return sendJson(res, 400, { error: "Application reference is required." });
    }
    if (!application.selectedCard) {
      return sendJson(res, 400, { error: "Selected membership card is required." });
    }

    const session = await createCheckoutSession({
      user,
      application,
      paymentMethod: req.body?.paymentMethod,
      currency: req.body?.currency
    });
    return sendJson(res, 200, {
      id: session.id,
      url: session.url
    });
  } catch (error) {
    const status = error.status || 500;
    console.error("[stripe/create-checkout-session]", { message: error?.message, name: error?.name });
    if (status === 401) {
      return sendJson(res, 401, { error: "Please sign in before continuing to checkout." });
    }
    return sendJson(res, status, {
      error: error?.publicMessage || "This payment method is currently unavailable.",
      detail: "Please choose another payment method.",
      checkoutUnavailable: true
    });
  }
}
