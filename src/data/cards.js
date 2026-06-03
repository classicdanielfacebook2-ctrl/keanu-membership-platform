export const cardTypes = [
  {
    id: "silver",
    name: "Silver Card",
    price: "\u20ac49.99",
    priceAmountCents: 4999,
    currency: "eur",
    stripePriceEnv: "STRIPE_PRICE_SILVER",
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
    price: "\u20ac99.99",
    priceAmountCents: 9999,
    currency: "eur",
    stripePriceEnv: "STRIPE_PRICE_GOLD",
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
    price: "\u20ac199.99",
    priceAmountCents: 19999,
    currency: "eur",
    stripePriceEnv: "STRIPE_PRICE_VIP",
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
    price: "\u20ac499.99",
    priceAmountCents: 49999,
    currency: "eur",
    stripePriceEnv: "STRIPE_PRICE_PREMIUM",
    benefits: [
      "Everything in VIP",
      "Premium recognition",
      "Priority email and live chat support",
      "Special access offers for eligible members"
    ]
  }
];

export const paymentStatuses = [
  "Pending",
  "Awaiting Bank Transfer",
  "Processing",
  "Partially Paid",
  "Paid",
  "Failed",
  "Expired",
  "Refunded",
  "Disputed"
];
export const reviewStatuses = ["Pending", "Approved", "Rejected"];
export const shippingStatuses = ["Not Started", "Processing", "Shipped", "Delivered"];

export const getCardById = (id) => cardTypes.find((card) => card.id === id);

export const getCardPrice = (id) => getCardById(id)?.price || "\u20ac0.00";
