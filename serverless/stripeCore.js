import Stripe from "stripe";
import { ObjectId } from "mongodb";
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

export const createCheckoutSession = async ({ user, application }) => {
  const stripe = getStripe();
  const siteUrl = getSiteUrl();
  const plan = getCardPlan(application.selectedCard);
  const payments = await getMembershipPaymentsCollection();
  const applicationId = String(application.id || application.referenceId || "");

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: application.email || user.email || undefined,
    client_reference_id: applicationId,
    success_url: `${siteUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}&application=${encodeURIComponent(applicationId)}`,
    cancel_url: `${siteUrl}/payment-cancelled?application=${encodeURIComponent(applicationId)}`,
    metadata: {
      applicationId,
      referenceId: String(application.referenceId || ""),
      userId: String(user._id),
      selectedCard: plan.id,
      applicantName: String(application.fullName || user.fullName || "")
    },
    payment_intent_data: {
      metadata: {
        applicationId,
        referenceId: String(application.referenceId || ""),
        userId: String(user._id),
        selectedCard: plan.id
      }
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: plan.currency || "usd",
          unit_amount: plan.priceAmountCents,
          product_data: {
            name: `KR Global Membership - ${plan.name}`,
            description: plan.benefits.slice(0, 3).join(" / "),
            images: [`${siteUrl}/brand/kr-stripe-icon.png`]
          }
        }
      }
    ]
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
        amount: plan.priceAmountCents,
        currency: plan.currency || "usd",
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
