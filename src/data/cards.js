export const cardTypes = [
  {
    id: "silver",
    name: "Silver Card",
    price: "$25.00",
    priceAmountCents: 2500,
    currency: "usd",
    stripePriceId: "", // Replace with live Stripe Price ID, for example: price_123.
    benefits: [
      "Official membership registration",
      "Member ID number",
      "Email support",
      "Community updates"
    ]
  },
  {
    id: "gold",
    name: "Gold Card",
    price: "$50.00",
    priceAmountCents: 5000,
    currency: "usd",
    stripePriceId: "", // Replace with live Stripe Price ID, for example: price_123.
    benefits: [
      "Everything in Silver",
      "Priority support",
      "Digital certificate",
      "Special announcements"
    ]
  },
  {
    id: "vip",
    name: "VIP Card",
    price: "$100.00",
    priceAmountCents: 10000,
    currency: "usd",
    stripePriceId: "", // Replace with live Stripe Price ID, for example: price_123.
    benefits: [
      "Everything in Gold",
      "VIP badge",
      "Faster application processing",
      "Exclusive member updates"
    ]
  },
  {
    id: "premium",
    name: "Premium Card",
    price: "$200.00",
    priceAmountCents: 20000,
    currency: "usd",
    stripePriceId: "", // Replace with live Stripe Price ID, for example: price_123.
    benefits: [
      "Everything in VIP",
      "Premium recognition",
      "Priority email and live chat support",
      "Special access offers for eligible members"
    ]
  }
];

export const paymentStatuses = ["Pending", "Paid", "Failed", "Refunded", "Disputed"];
export const reviewStatuses = ["Pending", "Approved", "Rejected"];
export const shippingStatuses = ["Not Started", "Processing", "Shipped", "Delivered"];
