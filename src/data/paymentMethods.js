export const paymentMethods = [
  {
    id: "card",
    title: "Card",
    shortTitle: "Card",
    description: "Pay by credit or debit card through secure hosted checkout.",
    arrival: "Usually instant",
    feeNote: "Standard card processing applies.",
    stripeType: "card",
    currencies: ["EUR", "USD", "GBP", "AUD", "CAD", "BRL", "CHF", "CLP"]
  },
  {
    id: "apple_pay",
    title: "Apple Pay",
    shortTitle: "Apple Pay",
    description: "Use Apple Pay when available on your Apple device or Safari.",
    arrival: "Usually instant",
    feeNote: "No extra platform fee.",
    stripeType: "card",
    currencies: ["EUR", "USD", "GBP", "AUD", "CAD", "BRL", "CHF", "CLP"]
  },
  {
    id: "google_pay",
    title: "Google Pay",
    shortTitle: "Google Pay",
    description: "Use Google Pay when available on your device or browser.",
    arrival: "Usually instant",
    feeNote: "No extra platform fee.",
    stripeType: "card",
    currencies: ["EUR", "USD", "GBP", "AUD", "CAD", "BRL", "CHF", "CLP"]
  },
  {
    id: "link",
    title: "Link",
    shortTitle: "Link",
    description: "Use Link for a faster checkout experience with eligible saved details.",
    arrival: "Usually instant",
    feeNote: "No extra platform fee.",
    stripeType: "link",
    currencies: ["EUR", "USD", "GBP", "AUD", "CAD", "BRL", "CHF", "CLP"]
  },
  {
    id: "amazon_pay",
    title: "Amazon Pay",
    shortTitle: "Amazon Pay",
    description: "Pay with Amazon Pay where supported for your region and currency.",
    arrival: "Usually instant",
    feeNote: "Availability depends on Stripe and Amazon Pay support.",
    stripeType: "amazon_pay",
    currencies: ["EUR", "USD", "GBP"]
  },
  {
    id: "sepa",
    title: "SEPA Direct Debit",
    shortTitle: "SEPA",
    description: "Pay from a supported European bank account.",
    arrival: "3-7 business days",
    feeNote: "Payment remains pending until the bank confirms settlement.",
    stripeType: "sepa_debit",
    currencies: ["EUR"],
    delayed: true
  },
  {
    id: "bank_transfer",
    title: "Bank Transfer",
    shortTitle: "Bank Transfer",
    description: "Receive bank transfer instructions through hosted checkout.",
    arrival: "1-5 business days",
    feeNote: "Bank transfer support depends on currency and region.",
    stripeType: "customer_balance",
    currencies: ["EUR", "USD", "GBP"],
    delayed: true
  },
  {
    id: "ideal",
    title: "iDEAL",
    shortTitle: "iDEAL",
    description: "Pay through supported Dutch bank redirect checkout.",
    arrival: "Usually instant",
    feeNote: "Available for EUR payments where supported.",
    stripeType: "ideal",
    currencies: ["EUR"]
  },
  {
    id: "open_banking",
    title: "Open Banking",
    shortTitle: "Open Banking",
    description: "Pay directly from a supported bank where Open Banking is available.",
    arrival: "Usually instant",
    feeNote: "Availability depends on bank, region, and Stripe support.",
    stripeType: "pay_by_bank",
    currencies: ["GBP"]
  }
];

export const checkoutPaymentOptions = [
  {
    id: "card",
    title: "Card / Wallets",
    description: "Pay securely by card, Apple Pay, Google Pay, or Link when available."
  },
  {
    id: "sepa",
    title: "SEPA Direct Debit",
    description: "Pay from a supported European bank account. Confirmation may take longer."
  },
  {
    id: "bank_transfer",
    title: "Bank Transfer",
    description: "Continue to secure hosted checkout for bank transfer instructions."
  },
  {
    id: "ideal",
    title: "iDEAL / Local bank payment",
    description: "Use a supported local bank payment method through secure checkout."
  }
];

export const getPaymentMethod = (id) => paymentMethods.find((method) => method.id === id) || paymentMethods[0];

export const isDelayedPaymentMethod = (id) => Boolean(getPaymentMethod(id).delayed);

export const currencyOptions = [
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "GBP", symbol: "£", label: "British Pound" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar" },
  { code: "CAD", symbol: "C$", label: "Canadian Dollar" },
  { code: "BRL", symbol: "R$", label: "Brazilian Real" },
  { code: "CHF", symbol: "CHF", label: "Swiss Franc" },
  { code: "CLP", symbol: "CLP$", label: "Chilean Peso" }
];

export const currencyRatesFromEur = {
  EUR: 1,
  USD: 1.08,
  GBP: 0.86,
  AUD: 1.65,
  CAD: 1.48,
  BRL: 5.86,
  CHF: 0.96,
  CLP: 1010
};

export const getCurrency = (code) => currencyOptions.find((currency) => currency.code === code) || currencyOptions[0];

export const isPaymentMethodAvailable = (methodId, currency = "EUR") =>
  getPaymentMethod(methodId).currencies.includes(String(currency || "EUR").toUpperCase());

export const formatPaymentAmount = (amountCents, currency = "EUR") =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "CLP" ? 0 : 2
  }).format(amountCents / 100);

export const convertEurCents = (amountCents, currency = "EUR") => {
  const normalizedCurrency = String(currency || "EUR").toUpperCase();
  const rate = currencyRatesFromEur[normalizedCurrency] || 1;
  const converted = (amountCents || 0) * rate;
  return normalizedCurrency === "CLP" ? Math.round(converted / 100) * 100 : Math.round(converted);
};
