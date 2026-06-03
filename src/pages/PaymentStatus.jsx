import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowRight, Clock3, CreditCard, Landmark, RefreshCcw, ShieldCheck } from "lucide-react";
import SectionHeader from "../components/SectionHeader.jsx";
import { cardTypes } from "../data/cards.js";
import { formatPaymentAmount } from "../data/paymentMethods.js";
import { getPaymentStatus } from "../services/stripeCheckout.js";

const statusCopy = {
  "Awaiting Bank Transfer": {
    icon: Landmark,
    title: "Your bank transfer is awaiting confirmation.",
    copy: "Check your email for payment instructions. Your membership activates after Stripe confirms payment."
  },
  Processing: {
    icon: Clock3,
    title: "Your payment is processing.",
    copy: "Stripe is still confirming this payment. Membership access remains pending until confirmation is complete."
  },
  Paid: {
    icon: ShieldCheck,
    title: "Payment confirmed.",
    copy: "Your membership payment has been confirmed and your membership is active."
  },
  Failed: {
    icon: RefreshCcw,
    title: "Payment could not be confirmed.",
    copy: "Please retry checkout or contact Member Services for assistance."
  },
  Expired: {
    icon: RefreshCcw,
    title: "Checkout expired.",
    copy: "You can create a new secure checkout session when you are ready."
  },
  Refunded: {
    icon: CreditCard,
    title: "Payment refunded.",
    copy: "This payment has been refunded. Membership access is not active for this order."
  }
};

const cardName = (id, fallback = "") => cardTypes.find((card) => card.id === id)?.name || fallback || "Membership";

export default function PaymentStatus() {
  const { applicationId = "" } = useParams();
  const [params] = useSearchParams();
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const instructionsSaved = params.get("instructions") === "saved";

  const loadPayment = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getPaymentStatus(applicationId);
      setPayment(data.payment);
    } catch (err) {
      setError(err?.message || "Payment record could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayment();
  }, [applicationId]);

  const displayStatus = payment?.paymentStatus || "Processing";
  const current = statusCopy[displayStatus] || statusCopy.Processing;
  const Icon = current.icon;
  const amount = useMemo(
    () => (payment ? formatPaymentAmount(payment.amount || 0, String(payment.currency || "EUR").toUpperCase()) : ""),
    [payment]
  );

  return (
    <section className="page-section payment-result-page">
      <SectionHeader
        eyebrow={instructionsSaved ? "Payment Instructions Saved" : "Payment Status"}
        title={instructionsSaved ? "Bank transfer instructions generated." : current.title}
        copy={instructionsSaved ? "Your bank transfer is awaiting confirmation." : current.copy}
      />

      <div className="payment-empty premium-panel payment-status-panel">
        {loading ? (
          <>
            <span className="button-loader" aria-hidden="true" />
            <h3>Loading payment status...</h3>
          </>
        ) : error ? (
          <>
            <RefreshCcw size={38} />
            <h3>Payment record unavailable</h3>
            <p>{error}</p>
            <Link className="button primary" to="/apply">
              Return to Apply
              <ArrowRight size={17} />
            </Link>
          </>
        ) : (
          <>
            <Icon size={40} />
            <h3>{current.title}</h3>
            <p>{current.copy}</p>
            {payment?.paymentMethod === "bank_transfer" || payment?.payment_method === "bank_transfer" ? (
              <>
                <p>Please send the exact amount using the IBAN and reference shown by Stripe.</p>
                <p>Your membership will activate automatically after Stripe confirms the payment.</p>
              </>
            ) : null}
            <div className="checkout-total-bar payment-status-summary">
              <div>
                <span>Status</span>
                <strong>{displayStatus}</strong>
              </div>
              <div>
                <span>Amount</span>
                <strong>{amount}</strong>
              </div>
              <div>
                <span>Membership</span>
                <strong>{cardName(payment?.selectedCard, payment?.cardName)}</strong>
              </div>
              <div>
                <span>Reference</span>
                <strong>{payment?.referenceId || payment?.applicationId}</strong>
              </div>
            </div>
            {payment?.stripeCheckoutSessionId ? <p>Stripe Session: {payment.stripeCheckoutSessionId}</p> : null}
            <div className="payment-actions">
              <button className="button secondary" type="button" onClick={loadPayment}>
                <RefreshCcw size={17} />
                Refresh Status
              </button>
              {["Failed", "Expired"].includes(displayStatus) ? (
                <Link className="button primary" to="/apply">
                  Create New Checkout
                  <ArrowRight size={17} />
                </Link>
              ) : null}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
