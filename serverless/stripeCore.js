import Stripe from "stripe";
import { ObjectId } from "mongodb";
import { getBankTransferRegion } from "../src/data/bankTransferRegions.js";
import { cardTypes } from "../src/data/cards.js";
import { getMongoDatabase } from "./authCore.js";

let stripeClient;

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

const paymentLifecycle = {
  awaitingBankTransfer: {
    status: "awaiting_bank_transfer",
    paymentStatus: "Awaiting Bank Transfer",
    membershipStatus: "Pending"
  },
  processing: {
    status: "processing",
    paymentStatus: "Processing",
    membershipStatus: "Pending"
  },
  partiallyPaid: {
    status: "partially_paid",
    paymentStatus: "Partially Paid",
    membershipStatus: "Pending"
  },
  paid: {
    status: "paid",
    paymentStatus: "Paid",
    membershipStatus: "Active"
  },
  failed: {
    status: "payment_failed",
    paymentStatus: "Failed",
    membershipStatus: "Inactive"
  },
  expired: {
    status: "expired",
    paymentStatus: "Expired",
    membershipStatus: "Inactive"
  },
  refunded: {
    status: "refunded",
    paymentStatus: "Refunded",
    membershipStatus: "Inactive"
  }
};

const normalizePaymentMethod = (value = "") => {
  const id = String(value || "").trim().toLowerCase();
  return paymentMethodConfig[id] ? id : "card";
};

const normalizeCurrency = (value = "eur") => {
  const currency = String(value || "eur").trim().toLowerCase();
  return supportedCurrencies.includes(currency) ? currency : "eur";
};

const getApplicationCountryCode = (application = {}) =>
  String(application.countryCode || application.countryIso || application.countryISO || "").trim().toUpperCase();

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

export const getEnabledCheckoutPaymentMethodIds = async ({ currency = "eur", countryCode = "" } = {}) => {
  const stripe = getStripe();
  const selectedCurrency = normalizeCurrency(currency);
  const configuration = await getDefaultPaymentMethodConfiguration(stripe);
  const bankTransferRegion = getBankTransferRegion(countryCode);

  return checkoutMethodIds.filter((methodId) => {
    const config = paymentMethodConfig[methodId];
    if (!config) return false;
    if (methodId === "bank_transfer") {
      if (!bankTransferRegion) return false;
      return true;
    }
    if (config.currencies && !config.currencies.includes(selectedCurrency)) return false;
    return isConfigMethodEnabled(configuration, methodId);
  });
};

const getCustomerEmail = ({ user, application }) => String(application.email || user.email || user.identifier || "").trim().toLowerCase();

const findStripeCustomerByEmail = async (stripe, email) => {
  if (!email) return "";
  try {
    const result = await stripe.customers.search({
      query: `email:'${email.replace(/'/g, "\\'")}'`,
      limit: 1
    });
    const customer = result.data.find((item) => !item.deleted);
    if (customer?.id) return customer.id;
  } catch (error) {
    console.error("[stripe/customer/search]", { message: error?.message, name: error?.name });
    const result = await stripe.customers.list({ email, limit: 1 });
    const customer = result.data.find((item) => !item.deleted);
    if (customer?.id) return customer.id;
  }
  return "";
};

const ensureStripeCustomer = async ({ stripe, user, application }) => {
  const email = getCustomerEmail({ user, application });
  const existingCustomerId = String(user?.stripeCustomerId || "");
  if (existingCustomerId) {
    try {
      const existing = await stripe.customers.retrieve(existingCustomerId);
      if (!existing?.deleted && (!email || existing.email === email)) {
        console.log("[stripe/bank-transfer/customer]", {
          action: "retrieved_from_user",
          customerId: existingCustomerId
        });
        return existingCustomerId;
      }
    } catch (error) {
      console.error("[stripe/customer/retrieve]", { message: error?.message, name: error?.name });
    }
  }

  const customerByEmail = await findStripeCustomerByEmail(stripe, email);
  if (customerByEmail) {
    console.log("[stripe/bank-transfer/customer]", {
      action: "retrieved_by_email",
      customerId: customerByEmail
    });
    const db = await getMongoDatabase();
    await db.collection("users").updateOne(
      { _id: user._id },
      {
        $set: {
          stripeCustomerId: customerByEmail,
          updatedAt: new Date()
        }
      }
    );
    return customerByEmail;
  }

  const customer = await stripe.customers.create({
    email: email || undefined,
    name: application.fullName || user.fullName || undefined,
    metadata: {
      userId: String(user._id)
    }
  });
  console.log("[stripe/bank-transfer/customer]", {
    action: "created",
    customerId: customer.id
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

const getBankTransferOptions = (region) => ({
  customer_balance: {
    funding_type: "bank_transfer",
    bank_transfer: region.stripeOptions
  }
});

const buildInlineLineItem = ({ siteUrl, plan, currency, amount }) => ({
  quantity: 1,
  price_data: {
    currency,
    unit_amount: amount,
    product_data: {
      name: `KR Global Membership - ${plan.name}`,
      description: plan.benefits.slice(0, 3).join(" / "),
      images: [`${siteUrl}/brand/kr-stripe-icon.png`]
    }
  }
});

const buildSessionMetadata = ({ applicationId, application, user, plan, paymentMethodId, paymentConfig, selectedCurrency }) => ({
  applicationId,
  referenceId: String(application.referenceId || ""),
  userId: String(user._id),
  selectedCard: plan.id,
  applicantName: String(application.fullName || user.fullName || ""),
  paymentMethod: paymentMethodId,
  paymentMethodLabel: paymentConfig.label,
  paymentCurrency: selectedCurrency,
  delayedPayment: String(paymentConfig.delayed)
});

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return entities[character];
  });

const sendMembershipPaymentConfirmationEmail = async (payment = {}) => {
  const apiKey = process.env.RESEND_API_KEY || "";
  const to = payment.customerEmail || payment.applicant_email || "";
  if (!apiKey || !to) return;

  const reference = payment.referenceId || payment.applicationId || "Membership application";
  const html = `
    <div style="margin:0;padding:32px;background:#050505;color:#f7f3ea;font-family:Inter,Arial,sans-serif;">
      <div style="max-width:560px;margin:0 auto;border:1px solid rgba(244,216,139,.34);background:#0d0d0d;padding:32px;">
        <p style="margin:0 0 12px;color:#f4d88b;font-size:12px;letter-spacing:.18em;text-transform:uppercase;">KR Global Membership</p>
        <h1 style="margin:0 0 18px;font-family:Georgia,serif;font-size:30px;line-height:1.15;color:#fff9ed;">Payment confirmed</h1>
        <p style="margin:0 0 18px;line-height:1.7;color:#cfc7ba;">Your payment has been confirmed by Stripe and your membership is now active.</p>
        <div style="margin:22px 0;padding:16px;border:1px solid rgba(244,216,139,.28);background:#060606;">
          <p style="margin:0 0 8px;color:#a9a197;">Reference</p>
          <strong style="color:#f4d88b;">${escapeHtml(reference)}</strong>
        </div>
        <p style="margin:0;color:#a9a197;line-height:1.7;">For assistance, contact support@keanureeves.company.</p>
      </div>
    </div>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "KR Global Membership <support@keanureeves.company>",
        to,
        subject: "Membership payment confirmed",
        html
      })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      console.error("[stripe/payment-confirmation-email]", {
        message: data?.message || "Resend rejected the payment confirmation email.",
        reference
      });
    } else {
      console.log("[stripe/payment-confirmation-email]", { message: "Payment confirmation email sent", reference });
    }
  } catch (error) {
    console.error("[stripe/payment-confirmation-email]", { message: error?.message, reference });
  }
};

const sendMembershipPaymentFailureEmail = async (payment = {}) => {
  const apiKey = process.env.RESEND_API_KEY || "";
  const to = payment.customerEmail || payment.applicant_email || "";
  if (!apiKey || !to) return;

  const reference = payment.referenceId || payment.applicationId || "Membership application";
  const html = `
    <div style="margin:0;padding:32px;background:#050505;color:#f7f3ea;font-family:Inter,Arial,sans-serif;">
      <div style="max-width:560px;margin:0 auto;border:1px solid rgba(244,216,139,.34);background:#0d0d0d;padding:32px;">
        <p style="margin:0 0 12px;color:#f4d88b;font-size:12px;letter-spacing:.18em;text-transform:uppercase;">KR Global Membership</p>
        <h1 style="margin:0 0 18px;font-family:Georgia,serif;font-size:30px;line-height:1.15;color:#fff9ed;">Payment could not be confirmed</h1>
        <p style="margin:0 0 18px;line-height:1.7;color:#cfc7ba;">Stripe reported that your payment did not complete. You may retry checkout or contact Member Services for assistance.</p>
        <div style="margin:22px 0;padding:16px;border:1px solid rgba(244,216,139,.28);background:#060606;">
          <p style="margin:0 0 8px;color:#a9a197;">Reference</p>
          <strong style="color:#f4d88b;">${escapeHtml(reference)}</strong>
        </div>
        <p style="margin:0;color:#a9a197;line-height:1.7;">Support: support@keanureeves.company</p>
      </div>
    </div>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "KR Global Membership <support@keanureeves.company>",
        to,
        subject: "Membership payment requires attention",
        html
      })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      console.error("[stripe/payment-failure-email]", {
        message: data?.message || "Resend rejected the payment failure email.",
        reference
      });
    } else {
      console.log("[stripe/payment-failure-email]", { message: "Payment failure email sent", reference });
    }
  } catch (error) {
    console.error("[stripe/payment-failure-email]", { message: error?.message, reference });
  }
};

const recordCheckoutSession = async ({
  payments,
  session,
  application,
  applicationId,
  user,
  plan,
  selectedAmount,
  selectedCurrency,
  paymentMethodId,
  paymentConfig,
  stripeCustomerId = ""
}) => {
  const initialLifecycle = paymentMethodId === "bank_transfer" ? paymentLifecycle.awaitingBankTransfer : paymentLifecycle.processing;
  const stripePaymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || "";
  await payments.updateOne(
    { checkoutSessionId: session.id },
    {
      $set: {
        status: initialLifecycle.status,
        checkoutSessionId: session.id,
        stripe_checkout_session_id: session.id,
        paymentIntentId: stripePaymentIntentId,
        stripe_payment_intent_id: stripePaymentIntentId,
        stripeCustomerId,
        stripe_customer_id: stripeCustomerId,
        applicationId,
        application_id: applicationId,
        referenceId: application.referenceId || "",
        userId: String(user._id),
        customerEmail: application.email || user.email || "",
        applicant_email: application.email || user.email || "",
        applicantName: application.fullName || user.fullName || "",
        applicant_name: application.fullName || user.fullName || "",
        applicantPhone: application.phone || user.phone || "",
        applicant_phone: application.phone || user.phone || "",
        fullName: application.fullName || user.fullName || "",
        selectedCard: plan.id,
        selected_card: plan.id,
        cardName: plan.name,
        amount: selectedAmount,
        currency: selectedCurrency,
        paymentMethod: paymentMethodId,
        payment_method: paymentMethodId,
        paymentMethodLabel: paymentConfig.label,
        delayedPayment: paymentConfig.delayed,
        paymentStatus: initialLifecycle.paymentStatus,
        membershipStatus: initialLifecycle.membershipStatus,
        stripeStatus: session.status,
        updatedAt: new Date()
      },
      $setOnInsert: {
        createdAt: new Date()
      }
    },
    { upsert: true }
  );
};

const createBankTransferCheckoutSession = async ({ stripe, siteUrl, plan, payments, applicationId, user, application }) => {
  const paymentMethodId = "bank_transfer";
  const paymentConfig = paymentMethodConfig[paymentMethodId];
  const bankTransferRegion = getBankTransferRegion(getApplicationCountryCode(application));
  if (!bankTransferRegion) {
    const error = new Error("This payment method is currently unavailable.");
    error.status = 400;
    error.publicMessage = "This payment method is currently unavailable.";
    throw error;
  }

  const selectedCurrency = bankTransferRegion.currency;
  const selectedAmount = convertPlanAmount(plan, selectedCurrency);
  const stripeCustomerId = await ensureStripeCustomer({ stripe, user, application });
  console.log("[stripe/bank-transfer/customer]", {
    action: "ready_for_checkout",
    customerId: stripeCustomerId
  });

  if (!stripeCustomerId) {
    const error = new Error("This payment method is currently unavailable.");
    error.status = 400;
    error.publicMessage = "This payment method is currently unavailable.";
    throw error;
  }

  const sessionMetadata = buildSessionMetadata({
    applicationId,
    application,
    user,
    plan,
    paymentMethodId,
    paymentConfig,
    selectedCurrency
  });

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "payment",
      payment_method_types: ["customer_balance"],
      payment_method_options: getBankTransferOptions(bankTransferRegion),
      client_reference_id: applicationId,
      success_url: `${siteUrl}/payment/status/${encodeURIComponent(applicationId)}?session_id={CHECKOUT_SESSION_ID}&instructions=saved`,
      cancel_url: `${siteUrl}/payment-cancelled`,
      metadata: sessionMetadata,
      line_items: [
        buildInlineLineItem({
          siteUrl,
          plan,
          currency: selectedCurrency,
          amount: selectedAmount
        })
      ]
    });
  } catch (error) {
    console.error("[stripe/bank-transfer/checkout-error]", {
      message: error?.message,
      type: error?.type,
      code: error?.code,
      param: error?.param,
      countryCode: bankTransferRegion.countryCode,
      transferType: bankTransferRegion.transferType,
      currency: selectedCurrency
    });
    throw error;
  }
  console.log("[stripe/bank-transfer/session]", {
    sessionId: session.id,
    customerId: stripeCustomerId,
    countryCode: bankTransferRegion.countryCode,
    transferType: bankTransferRegion.transferType,
    currency: selectedCurrency
  });

  await recordCheckoutSession({
    payments,
    session,
    application,
    applicationId,
    user,
    plan,
    selectedAmount,
    selectedCurrency,
    paymentMethodId,
    paymentConfig,
    stripeCustomerId
  });

  return session;
};

export const createCheckoutSession = async ({ user, application, paymentMethod, currency }) => {
  const stripe = getStripe();
  const siteUrl = getSiteUrl();
  const plan = getCardPlan(application.selectedCard);
  const payments = await getMembershipPaymentsCollection();
  const applicationId = String(application.id || application.referenceId || "");
  const paymentMethodId = normalizePaymentMethod(paymentMethod || application.paymentMethod);
  const paymentConfig = paymentMethodConfig[paymentMethodId];
  const selectedCurrency =
    paymentMethodId === "bank_transfer"
      ? getBankTransferRegion(getApplicationCountryCode(application))?.currency || "eur"
      : normalizeCurrency(currency || application.paymentCurrency || plan.currency || "eur");
  assertPaymentMethodAvailable(paymentConfig, selectedCurrency);
  const enabledPaymentMethods = await getEnabledCheckoutPaymentMethodIds({
    currency: selectedCurrency,
    countryCode: getApplicationCountryCode(application)
  });
  if (!enabledPaymentMethods.includes(paymentMethodId)) {
    const error = new Error("This payment method is currently unavailable.");
    error.status = 400;
    error.publicMessage = "This payment method is currently unavailable.";
    throw error;
  }
  const selectedAmount = convertPlanAmount(plan, selectedCurrency);

  if (paymentMethodId === "bank_transfer") {
    return createBankTransferCheckoutSession({
      stripe,
      siteUrl,
      plan,
      payments,
      applicationId,
      user,
      application
    });
  }

  const stripePriceId = getStripePriceIdForPlan(plan);
  const canUseStripePriceId = stripePriceId && selectedCurrency === (plan.currency || "eur").toLowerCase();
  const lineItem = canUseStripePriceId
    ? { price: stripePriceId, quantity: 1 }
    : buildInlineLineItem({
        siteUrl,
        plan,
        currency: selectedCurrency,
        amount: selectedAmount
      });

  const sessionMetadata = buildSessionMetadata({
    applicationId,
    application,
    user,
    plan,
    paymentMethodId,
    paymentConfig,
    selectedCurrency
  });
  const checkoutParams = {
    mode: "payment",
    payment_method_types: paymentConfig.stripeTypes,
    customer_email: application.email || user.email || undefined,
    client_reference_id: applicationId,
    success_url: `${siteUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/payment-cancelled`,
    metadata: sessionMetadata,
    payment_intent_data: { metadata: sessionMetadata },
    line_items: [lineItem]
  };
  const session = await stripe.checkout.sessions.create(checkoutParams);

  await recordCheckoutSession({
    payments,
    session,
    application,
    applicationId,
    user,
    plan,
    selectedAmount,
    selectedCurrency,
    paymentMethodId,
    paymentConfig
  });

  return session;
};

export const markPaymentFromStripe = async ({ lookup = {}, updates = {} }) => {
  const payments = await getMembershipPaymentsCollection();
  const db = await getMongoDatabase();
  const query = Object.fromEntries(Object.entries(lookup).filter(([, value]) => value));
  if (!Object.keys(query).length) return null;

  const existingPayment = await payments.findOne(query);
  const normalizedUpdates = {
    ...updates,
    ...(updates.checkoutSessionId ? { stripe_checkout_session_id: updates.checkoutSessionId } : {}),
    ...(updates.paymentIntentId ? { stripe_payment_intent_id: updates.paymentIntentId } : {}),
    ...(updates.customerEmail ? { applicant_email: updates.customerEmail } : {}),
    ...(updates.selectedCard ? { selected_card: updates.selectedCard } : {}),
    ...(updates.paymentMethod ? { payment_method: updates.paymentMethod } : {})
  };

  await payments.updateOne(
    query,
    {
      $set: {
        ...normalizedUpdates,
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

  if (updates.status === paymentLifecycle.paid.status && existingPayment?.status !== paymentLifecycle.paid.status) {
    await sendMembershipPaymentConfirmationEmail(payment);
  }
  if (updates.status === paymentLifecycle.failed.status && existingPayment?.status !== paymentLifecycle.failed.status) {
    await sendMembershipPaymentFailureEmail(payment);
  }

  return payment;
};

const publicPaymentRecord = (payment = {}) => ({
  id: String(payment._id || ""),
  status: payment.status || "",
  paymentStatus: payment.paymentStatus || "Pending",
  membershipStatus: payment.membershipStatus || "Pending",
  applicationId: payment.applicationId || payment.application_id || "",
  application_id: payment.applicationId || payment.application_id || "",
  referenceId: payment.referenceId || "",
  applicantName: payment.applicantName || payment.applicant_name || payment.fullName || "",
  applicantEmail: payment.customerEmail || payment.applicant_email || "",
  applicantPhone: payment.applicantPhone || payment.applicant_phone || "",
  selectedCard: payment.selectedCard || payment.selected_card || "",
  selected_card: payment.selectedCard || payment.selected_card || "",
  cardName: payment.cardName || "",
  amount: payment.amount || 0,
  currency: payment.currency || "eur",
  paymentMethod: payment.paymentMethod || payment.payment_method || "",
  payment_method: payment.paymentMethod || payment.payment_method || "",
  paymentMethodLabel: payment.paymentMethodLabel || "",
  stripeCustomerId: payment.stripeCustomerId || payment.stripe_customer_id || "",
  stripe_customer_id: payment.stripeCustomerId || payment.stripe_customer_id || "",
  stripeCheckoutSessionId: payment.checkoutSessionId || payment.stripe_checkout_session_id || "",
  stripe_checkout_session_id: payment.checkoutSessionId || payment.stripe_checkout_session_id || "",
  stripePaymentIntentId: payment.paymentIntentId || payment.stripe_payment_intent_id || "",
  stripe_payment_intent_id: payment.paymentIntentId || payment.stripe_payment_intent_id || "",
  stripeStatus: payment.stripeStatus || "",
  stripePaymentStatus: payment.stripePaymentStatus || "",
  refundStatus: payment.refundStatus || "",
  failureMessage: payment.failureMessage || "",
  createdAt: payment.createdAt || "",
  updatedAt: payment.updatedAt || ""
});

export const getPaymentRecordForUser = async ({ user, applicationId }) => {
  const payments = await getMembershipPaymentsCollection();
  const id = String(applicationId || "").trim();
  const payment = await payments.findOne({
    userId: String(user._id),
    $or: [
      { applicationId: id },
      { application_id: id },
      { referenceId: id },
      { checkoutSessionId: id },
      { stripe_checkout_session_id: id }
    ]
  });
  return payment ? publicPaymentRecord(payment) : null;
};

export const getAdminPaymentRecords = async ({ user }) => {
  if (user.role !== "admin") {
    const error = new Error("Admin access is required.");
    error.status = 403;
    throw error;
  }
  const payments = await getMembershipPaymentsCollection();
  const rows = await payments.find({}).sort({ createdAt: -1, updatedAt: -1 }).limit(250).toArray();
  return rows.map(publicPaymentRecord);
};

export const mapCheckoutStatus = (session) => {
  if (session.payment_status === "paid") {
    return paymentLifecycle.paid;
  }
  if (session.payment_status === "unpaid" && session.metadata?.paymentMethod === "bank_transfer") {
    return paymentLifecycle.awaitingBankTransfer;
  }
  return paymentLifecycle.processing;
};
