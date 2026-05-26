export const paymentMethods = [
  {
    id: "card",
    title: "Credit/Debit Card",
    shortTitle: "Card",
    description: "Pay with Visa, Mastercard, or another supported card through secure hosted checkout."
  },
  {
    id: "sepa",
    title: "SEPA Bank Transfer / Direct Debit",
    shortTitle: "SEPA",
    description: "Use a supported European bank payment method. Confirmation may take longer."
  },
  {
    id: "google_pay",
    title: "Google Pay",
    shortTitle: "Google Pay",
    description: "Continue to Stripe Checkout and use Google Pay when available on your device."
  },
  {
    id: "apple_pay",
    title: "Apple Pay",
    shortTitle: "Apple Pay",
    description: "Continue to Stripe Checkout and use Apple Pay when available in Safari or on Apple devices."
  },
  {
    id: "amazon_pay",
    title: "Amazon Pay",
    shortTitle: "Amazon Pay",
    description: "Use Amazon Pay through Stripe Checkout where supported for your region and currency."
  },
  {
    id: "link",
    title: "Link by Stripe",
    shortTitle: "Link",
    description: "Use Link for a faster Stripe checkout experience with eligible saved details."
  }
];

export const getPaymentMethod = (id) => paymentMethods.find((method) => method.id === id) || paymentMethods[0];

export const isDelayedPaymentMethod = (id) => id === "sepa";
