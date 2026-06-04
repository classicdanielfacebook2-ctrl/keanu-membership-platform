import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { ArrowRight, Clock3, CreditCard, Landmark, RefreshCcw, ShieldCheck } from "lucide-react";
import AccountPageHeader from "../components/AccountPageHeader.jsx";
import { cardTypes } from "../data/cards.js";
import { formatPaymentAmount } from "../data/paymentMethods.js";
import { getPaymentStatus } from "../services/stripeCheckout.js";

const cardName = (id, fallback = "") => cardTypes.find((card) => card.id === id)?.name || fallback || "Membership";
const isBankTransfer = (payment) => payment?.paymentMethod === "bank_transfer" || payment?.payment_method === "bank_transfer";

const statusMeta = {
  "Awaiting Bank Transfer": {
    icon: Landmark,
    title: "Awaiting Transfer",
    copy: "Your transfer instructions are ready. Membership activates after Stripe confirms receipt."
  },
  Processing: {
    icon: Clock3,
    title: "Processing",
    copy: "Stripe is confirming this payment. Your membership remains pending until confirmation is complete."
  },
  Paid: {
    icon: ShieldCheck,
    title: "Membership Activated",
    copy: "Your payment has been confirmed and your membership is active."
  },
  Failed: {
    icon: RefreshCcw,
    title: "Payment Failed",
    copy: "This payment could not be confirmed. You may create a new checkout or contact support."
  },
  Expired: {
    icon: RefreshCcw,
    title: "Instructions Expired",
    copy: "This checkout session expired. Generate new transfer instructions when you are ready."
  },
  Refunded: {
    icon: CreditCard,
    title: "Refunded",
    copy: "This payment has been refunded."
  }
};

export default function PaymentStatus() {
  const { applicationId = "" } = useParams();
  const [params] = useSearchParams();
  const location = useLocation();
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const instructionsSaved = params.get("instructions") === "saved";
  const isApplicationDetails = location.pathname.startsWith("/account/applications/");

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
  const current = statusMeta[displayStatus] || statusMeta.Processing;
  const Icon = current.icon;
  const amount = useMemo(
    () => (payment ? formatPaymentAmount(payment.amount || 0, String(payment.currency || "EUR").toUpperCase()) : ""),
    [payment]
  );

  return (
    <section className="page-section wide-page banking-dashboard">
      <AccountPageHeader
        title={instructionsSaved ? "Bank transfer instructions generated." : current.title}
        copy={instructionsSaved ? "Your bank transfer is awaiting confirmation." : current.copy}
        fallbackTo={isApplicationDetails ? "/account/applications" : "/account/payments"}
        breadcrumbs={
          isApplicationDetails
            ? [
                { label: "My Account", to: "/account" },
                { label: "Applications", to: "/account/applications" },
                { label: "Application Details" }
              ]
            : [
                { label: "My Account", to: "/account" },
                { label: "Payments", to: "/account/payments" },
                { label: instructionsSaved ? "Instructions Saved" : "Payment Details" }
              ]
        }
      />

      <div className="payment-detail-shell banking-panel">
        {loading ? (
          <div className="account-empty-state">Loading payment details...</div>
        ) : error ? (
          <div className="account-empty-state">
            <RefreshCcw size={34} />
            <h3>Payment record unavailable</h3>
            <p>{error}</p>
          </div>
        ) : (
          <>
            <div className="payment-detail-header">
              <span className={`status-icon ${(displayStatus || "Pending").toLowerCase().replace(/\s+/g, "-")}`}>
                <Icon size={22} />
              </span>
              <div>
                <span className="eyebrow">Status</span>
                <h3>{displayStatus}</h3>
                <p>{payment.membershipStatus === "Active" ? "Membership Activated" : current.copy}</p>
              </div>
            </div>

            <div className="payment-detail-grid">
              <div>
                <span>Reference Number</span>
                <strong>{payment.referenceId || payment.applicationId}</strong>
              </div>
              <div>
                <span>Membership Card</span>
                <strong>{cardName(payment.selectedCard, payment.cardName)}</strong>
              </div>
              <div>
                <span>Amount</span>
                <strong>{amount}</strong>
              </div>
              <div>
                <span>Payment Method</span>
                <strong>{payment.paymentMethodLabel || payment.paymentMethod || "Checkout"}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{displayStatus}</strong>
              </div>
              <div>
                <span>Submitted Date</span>
                <strong>{payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : "Not available"}</strong>
              </div>
            </div>

            <div className="payment-actions compact-actions">
              {isBankTransfer(payment) ? (
                <Link className="button primary" to={`/account/payment/${payment.applicationId}/bank-details`}>
                  View Transfer Instructions
                  <ArrowRight size={17} />
                </Link>
              ) : null}
              <button className="button secondary" type="button" onClick={loadPayment}>
                <RefreshCcw size={17} />
                Refresh Status
              </button>
              <Link className="button secondary" to={`/support?reference=${encodeURIComponent(payment.referenceId || payment.applicationId || "")}`}>
                Contact Support
              </Link>
              {displayStatus !== "Paid" && displayStatus !== "Refunded" ? (
                <Link className="button secondary" to={`/support?reference=${encodeURIComponent(payment.referenceId || payment.applicationId || "")}&request=cancel-payment`}>
                  Cancel Payment
                </Link>
              ) : null}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
