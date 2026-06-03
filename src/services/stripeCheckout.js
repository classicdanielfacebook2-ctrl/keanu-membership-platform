import { authRequest } from "./authApi.js";

export const stripePublishableKey = import.meta.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

export const createCheckoutSession = (
  application,
  paymentMethod = application?.paymentMethod || "card",
  currency = application?.paymentCurrency || "EUR"
) =>
  authRequest("/api/create-checkout-session", {
    method: "POST",
    body: JSON.stringify({ application, paymentMethod, currency })
  });

export const getAvailableCheckoutPaymentMethods = (currency = "EUR", countryCode = "") =>
  authRequest(
    `/api/create-checkout-session?currency=${encodeURIComponent(currency)}&countryCode=${encodeURIComponent(countryCode)}`,
    {
      method: "GET"
    }
  );

export const getPaymentStatus = (applicationId) =>
  authRequest(`/api/create-checkout-session?action=status&applicationId=${encodeURIComponent(applicationId)}`, {
    method: "GET"
  });

export const getAdminPayments = () =>
  authRequest("/api/create-checkout-session?action=admin-payments", {
    method: "GET"
  });

export const getAccountPayments = () =>
  authRequest("/api/create-checkout-session?action=account-payments", {
    method: "GET"
  });

export const renewBankTransferInstructions = (applicationId) =>
  authRequest("/api/create-checkout-session", {
    method: "POST",
    body: JSON.stringify({ action: "renew-bank-transfer", applicationId })
  });
