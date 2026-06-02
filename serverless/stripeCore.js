import Stripe from "stripe";
import { ObjectId } from "mongodb";
import { cardTypes } from "../src/data/cards.js";
import { getMongoDatabase } from "./authCore.js";

let stripeClient;
let stripeAccountPromise;

const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
};

export const getStripe = () => {
  if (!stripeClient) {
    stripeClient = new Stripe(requiredEnv("STRIPE_SECRET_KEY"), {
      apiVersion: "2025-10-29.clover"
    });
  }
  return stripeClient;
};

export const getSiteUrl = () => requiredEnv("NEXT_PUBLIC_SITE_URL").replace(/\/$/, "");

export const getMembershipPaymentsCollection = async () => {
  const db = await getMongoDatabase();
  const collection = db.collection("membershipPayments");
  await collection.createIndex({ checkoutSessionId: 1 }, { unique: true, sparse: true });
  await collection.createIndex({ applicationId: 1 });
  await collection.createIndex({ userId: 1 });
  return collection;
};

export const getCardPlan = (cardId) => {
  const plan = cardTypes.find((card) => card.id === cardId);
  if (!plan) throw new Error("Selected membership card is not available.");
  if (!Number.isInteger(plan.priceAmountCents) || plan.priceAmountCents < 50) {
    throw new Error("Selected membership card amount is not configured.");
  }
  return plan;
};

const getStripePriceIdForPlan = (plan) => {
  if (!plan?.stripePriceEnv) return "";
  return process.env[plan.stripePriceEnv] || "";
};

const supportedCurrencies = ["eur", "usd", "gbp", "aud", "cad", "brl", "chf", "clp"];
const currencyRatesFromEur = {
  eur: 1,
  usd: 1.08,
  gbp: 0.86,
  aud: 1.65,
  cad: 1.48,
  brl: 5.86,
  chf: 0.96,
  clp: 1010
};

const paymentMethodConfig = {
  card: { label: "Credit/Debit Card", stripeTypes: ["card"], configKey: "card", delayed: false },
  google_pay: { label: "Google Pay", stripeTypes: ["card"], configKey: "google_pay", delayed: false },
  apple_pay: { label: "Apple Pay", stripeTypes: ["card"], configKey: "apple_pay", delayed: false },
  amazon_pay: { label: "Amazon Pay", stripeTypes: ["amazon_pay"], configKey: "amazon_pay", currencies: ["eur", "usd", "gbp"], delayed: false },
  link: { label: "Link by Stripe", stripeTypes: ["link", "card"], configKey: "link", delayed: false },
  sepa: { label: "SEPA Direct Debit", stripeTypes: ["sepa_debit"], configKey: "sepa_debit", currencies: ["eur"], delayed: true },
  bank_transfer: {
    label: "Bank Transfer",
    stripeTypes: ["customer_balance"],
    configKey: "customer_balance",
    currencies: ["eur", "usd", "gbp"],
    delayed: true
  },
  ideal: { label: "iDEAL", stripeTypes: ["ideal"], configKey: "ideal", currencies: ["eur"], delayed: false },
  open_banking: { label: "Open Banking", stripeTypes: ["pay_by_bank"], configKey: "pay_by_bank", currencies: ["gbp"], delayed: false }
};

const normalizePaymentMethod = (value = "") => {
  const id = String(value || "").trim().toLowerCase();
  return paymentMethodConfig[id] ? id : "card";
};

const normalizeCurrency = (value = "eur") => {
  const currency = String(value || "eur").trim().toLowerCase();
  return supportedCurrencies.includes(currency) ? currency : "eur";
};

const convertPlanAmount = (plan, currency) => {
  const rate = currencyRatesFromEur[currency] || 1;
  const converted = plan.priceAmountCents * rate;
  return currency === "clp" ? Math.max(500, Math.round(converted / 100) * 100) : Math.max(50, Math.round(converted));
};

const assertPaymentMethodAvailable = (paymentConfig, currency) => {
  if (paymentConfig.currencies && !paymentConfig.currencies.includes(currency)) {
    const error = new Error("This payment method is currently unavailable.");
    error.status = 400;
    error.publicMessage = "This payment method is currently unavailable.";
    throw error;
  }
};

const checkoutMethodIds = ["card", "sepa", "bank_transfer", "ideal"];
const sepaAccountCountries = new Set([
  "AT",
  "BE",
  "BG",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "ES",
  "FI",
  "FR",
  "GI",
  "GR",
  "HR",
  "HU",
  "IE",
  "IS",
  "IT",
  "LI",
  "LT",
  "LU",
  "LV",
  "MC",
  "MT",
  "NL",
  "NO",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK",
  "SM"
]);
const bankTransferAccountCountryByCurrency = {
  gbp: new Set(["GB"]),
  usd: new Set(["US"])
};

const getStripeAccount = async (stripe) => {
  if (!stripeAccountPromise) {
    stripeAccountPromise = stripe.accounts.retrieve();
  }
  return stripeAccountPromise;
};

const isBankTransferSupportedForAccount = (account, currency) => {
  const accountCountry = String(account?.country || "").toUpperCase();
  if (!accountCountry) return false;
  if (currency === "eur") return sepaAccountCountries.has(accountCountry);
  return Boolean(bankTransferAccountCountryByCurrency[currency]?.has(accountCountry));
};

const isConfigMethodEnabled = (configuration, methodId) => {
  if (methodId === "card") return true;
  const key = paymentMethodConfig[methodId]?.configKey;
  const method = key ? configuration?.[key] : null;
  const preference = method?.display_preference?.value || method?.display_preference?.preference || "";
  return Boolean(method?.available && preference !== "off");
};

const getDefaultPaymentMethodConfiguration = async (stripe) => {
  try {
    const configurations = await stripe.paymentMethodConfigurations.list({ limit: 10 });
    return configurations.data.find((configuration) => configuration.active && configuration.is_default) || configurations.data.find((configuration) => configuration.active) || null;
  } catch (error) {
    console.error("[stripe/payment-method-configurations]", {
      message: error?.message,
      name: error?.name
    });
    return null;
  }
};

export const getEnabledCheckoutPaymentMethodIds = async ({ currency = "eur" } = {}) => {
  const stripe = getStripe();
  const selectedCurrency = normalizeCurrency(currency);
  const configuration = await getDefaultPaymentMethodConfiguration(stripe);
  const account = await getStripeAccount(stripe).catch((error) => {
    console.error("[stripe/account]", { message: error?.message, name: error?.name });
    return null;
  });

  return checkoutMethodIds.filter((methodId) => {
    const config = paymentMethodConfig[methodId];
    if (!config) return false;
    if (config.currencies && !config.currencies.includes(selectedCurrency)) return false;
    if (methodId === "bank_transfer" && !isBankTransferSupportedForAccount(account, selectedCurrency)) return false;
    return isConfigMethodEnabled(configuration, methodId);
  });
};

const ensureStripeCustomer = async ({ stripe, user, application }) => {
  const existingCustomerId = String(user?.stripeCustomerId || "");
  if (existingCustomerId) {
    try {
      const existing = await stripe.customers.retrieve(existingCustomerId);
      if (!existing?.deleted) return existingCustomerId;
    } catch (error) {
      console.error("[stripe/customer/retrieve]", { message: error?.message, name: error?.name });
    }
  }

  const customer = await stripe.customers.create({
    email: application.email || user.email || undefined,
    name: application.fullName || user.fullName || undefined,
    metadata: {
      userId: String(user._id)
    }
  });
  const db = await getMongoDatabase();
  await db.collection("users").updateOne(
    { _id: user._id },
    {
      $set: {
        stripeCustomerId: customer.id,
        updatedAt: new Date()
      }
    }
  );
  return customer.id;
};

const getBankTransferOptions = (currency) => {
  const bankTransferTypes = {
    eur: "eu_bank_transfer",
    usd: "us_bank_transfer",
    gbp: "gb_bank_transfer"
  };
  return {
    customer_balance: {
      funding_type: "bank_transfer",
      bank_transfer: {
        type: bankTransferTypes[currency] || "eu_bank_transfer"
      }
    }
  };
};

export const createCheckoutSession = async ({ user, application, paymentMethod, currency }) => {
  const stripe = getStripe();
  const siteUrl = getSiteUrl();
  const plan = getCardPlan(application.selectedCard);
  const payments = await getMembershipPaymentsCollection();
  const applicationId = String(application.id || application.referenceId || "");
  const paymentMethodId = normalizePaymentMethod(paymentMethod || application.paymentMethod);
  const paymentConfig = paymentMethodConfig[paymentMethodId];
  const selectedCurrency = normalizeCurrency(currency || application.paymentCurrency || plan.currency || "eur");
  assertPaymentMethodAvailable(paymentConfig, selectedCurrency);
  const enabledPaymentMethods = await getEnabledCheckoutPaymentMethodIds({ currency: selectedCurrency });
  if (!enabledPaymentMethods.includes(paymentMethodId)) {
    const error = new Error("This payment method is currently unavailable.");
    error.status = 400;
    error.publicMessage = "This payment method is currently unavailable.";
    throw error;
  }
  const selectedAmount = convertPlanAmount(plan, selectedCurrency);

  const stripePriceId = getStripePriceIdForPlan(plan);
  const canUseStripePriceId = stripePriceId && selectedCurrency === (plan.currency || "eur").toLowerCase();
  const lineItem = canUseStripePriceId
    ? { price: stripePriceId, quantity: 1 }
    : {
        // Temporary inline price_data fallback. Add STRIPE_PRICE_SILVER/GOLD/VIP/PREMIUM in Vercel to use live Stripe Price IDs.
        quantity: 1,
        price_data: {
          currency: selectedCurrency,
          unit_amount: selectedAmount,
          product_data: {
            name: `KR Global Membership - ${plan.name}`,
            description: plan.benefits.slice(0, 3).join(" / "),
            images: [`${siteUrl}/brand/kr-stripe-icon.png`]
          }
        }
      };

  const stripeCustomerId =
    paymentMethodId === "bank_transfer"
      ? await ensureStripeCustomer({ stripe, user, application })
      : "";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: paymentConfig.stripeTypes,
    ...(stripeCustomerId
      ? { customer: stripeCustomerId }
      : { customer_email: application.email || user.email || undefined }),
    client_reference_id: applicationId,
    success_url: `${siteUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/payment-cancelled`,
    metadata: {
      applicationId,
      referenceId: String(application.referenceId || ""),
      userId: String(user._id),
      selectedCard: plan.id,
      applicantName: String(application.fullName || user.fullName || ""),
      paymentMethod: paymentMethodId,
      paymentMethodLabel: paymentConfig.label,
      paymentCurrency: selectedCurrency,
      delayedPayment: String(paymentConfig.delayed)
    },
    payment_intent_data: {
      metadata: {
        applicationId,
        referenceId: String(application.referenceId || ""),
        userId: String(user._id),
        selectedCard: plan.id,
        paymentMethod: paymentMethodId,
        paymentMethodLabel: paymentConfig.label,
        paymentCurrency: selectedCurrency,
        delayedPayment: String(paymentConfig.delayed)
      }
    },
    ...(paymentMethodId === "bank_transfer"
      ? {
          payment_method_options: getBankTransferOptions(selectedCurrency)
        }
      : {}),
    line_items: [lineItem]
  });

  await payments.updateOne(
    { checkoutSessionId: session.id },
    {
      $set: {
        checkoutSessionId: session.id,
        paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : "",
        applicationId,
        referenceId: application.referenceId || "",
        userId: String(user._id),
        customerEmail: application.email || user.email || "",
        fullName: application.fullName || user.fullName || "",
        selectedCard: plan.id,
        cardName: plan.name,
        amount: selectedAmount,
        currency: selectedCurrency,
        paymentMethod: paymentMethodId,
        paymentMethodLabel: paymentConfig.label,
        delayedPayment: paymentConfig.delayed,
        paymentStatus: "Pending",
        membershipStatus: "Pending",
        stripeStatus: session.status,
        updatedAt: new Date()
      },
      $setOnInsert: {
        createdAt: new Date()
      }
    },
    { upsert: true }
  );

  return session;
};

export const markPaymentFromStripe = async ({ lookup = {}, updates = {} }) => {
  const payments = await getMembershipPaymentsCollection();
  const db = await getMongoDatabase();
  const query = Object.fromEntries(Object.entries(lookup).filter(([, value]) => value));
  if (!Object.keys(query).length) return null;

  await payments.updateOne(
    query,
    {
      $set: {
        ...updates,
        updatedAt: new Date()
      },
      $setOnInsert: {
        createdAt: new Date()
      }
    },
    { upsert: true }
  );

  const payment = await payments.findOne(query);
  const userId = updates.userId || payment?.userId;
  if (userId && ObjectId.isValid(userId) && updates.membershipStatus) {
    await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          membershipStatus: updates.membershipStatus,
          paymentStatus: updates.paymentStatus || payment?.paymentStatus || "Pending",
          activeMembershipCard: updates.selectedCard || payment?.selectedCard || "",
          membershipUpdatedAt: new Date()
        }
      }
    );
  }

  return payment;
};

export const mapCheckoutStatus = (session) => {
  if (session.payment_status === "paid") {
    return { paymentStatus: "Paid", membershipStatus: "Active" };
  }
  return { paymentStatus: "Pending", membershipStatus: "Pending" };
};
