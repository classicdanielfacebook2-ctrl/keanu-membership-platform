import { authRequest } from "./authApi.js";

export const stripePublishableKey = import.meta.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

export const createCheckoutSession = (application) =>
  authRequest("/api/create-checkout-session", {
    method: "POST",
    body: JSON.stringify({ application })
  });
