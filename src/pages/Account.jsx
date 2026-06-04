import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock3, RefreshCcw, ShieldCheck, XCircle } from "lucide-react";
import SectionHeader from "../components/SectionHeader.jsx";
import { cardTypes } from "../data/cards.js";
import { formatPaymentAmount } from "../data/paymentMethods.js";
import { getAccountPayments } from "../services/stripeCheckout.js";
import { useAuth } from "../context/AuthContext.jsx";

const cardName = (id, fallback = "") => cardTypes.find((card) => card.id === id)?.name || fallback || id || "Membership";

const money = (payment) => formatPaymentAmount(payment.amount || 0, String(payment.currency || "EUR").toUpperCase());

function PaymentList({ payments, emptyText = "No payment records found." }) {
  if (!payments.length) {
    return <div className="empty-cell account-empty-state">{emptyText}</div>;
  }

  return (
    <div className="banking-payment-list">
      {payments.map((payment) => (
        <article className="banking-payment-card" key={payment.id || payment.applicationId}>
          <div className="banking-payment-main">
            <div>
              <span>Membership</span>
              <strong>{cardName(payment.selectedCard, payment.cardName)}</strong>
            </div>
            <div>
              <span>Amount</span>
              <strong>{money(payment)}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong className={`mini-status ${(payment.paymentStatus || "Pending").toLowerCase().replace(/\s+/g, "-")}`}>
                {payment.paymentStatus || "Pending"}
              </strong>
            </div>
            <div>
              <span>Date</span>
              <strong>{payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : "Not available"}</strong>
            </div>
          </div>
          <Link className="review-payment-button" to={`/account/payment/${payment.applicationId}`}>
            Review
            <ArrowRight size={15} />
          </Link>
        </article>
      ))}
    </div>
  );
}

function AccountSummary({ payments }) {
  const pendingCount = payments.filter((payment) =>
    ["Awaiting Bank Transfer", "Processing", "Partially Paid", "Pending"].includes(payment.paymentStatus || "Pending")
  ).length;
  const paidCount = payments.filter((payment) => payment.paymentStatus === "Paid").length;
  const failedCount = payments.filter((payment) => ["Failed", "Expired", "Refunded"].includes(payment.paymentStatus)).length;

  return (
    <div className="banking-summary-grid">
      {[
        { label: "Pending", value: pendingCount, icon: Clock3 },
        { label: "Paid", value: paidCount, icon: ShieldCheck },
        { label: "Failed", value: failedCount, icon: XCircle }
      ].map(({ label, value, icon: Icon }) => (
        <article className="banking-summary-card" key={label}>
          <Icon size={18} />
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </div>
  );
}

export default function Account({ view = "dashboard" }) {
  const auth = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPayments = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAccountPayments();
      setPayments(Array.isArray(data.payments) ? data.payments : []);
    } catch (err) {
      setError(err?.message || "Account records could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const title =
    view === "applications"
      ? "Your applications."
      : view === "payments"
        ? "Your payments."
        : "Your account dashboard.";

  const copy =
    view === "applications"
      ? "Review submitted membership applications and their current membership status."
      : view === "payments"
        ? "Track every Stripe checkout session and delayed bank transfer from your account."
        : "Manage your applications, payment records, and membership status from one secure account area.";

  const visiblePayments = view === "dashboard" ? payments.slice(0, 3) : payments;

  return (
    <section className="page-section wide-page account-page banking-dashboard">
      <SectionHeader eyebrow="My Account" title={title} copy={copy} />

      <div className="account-welcome banking-panel">
        <div>
          <span className="eyebrow">Member Profile</span>
          <h3>{auth.user?.fullName || "Member"}</h3>
          <p>{auth.user?.email || auth.user?.identifier || "Signed in account"}</p>
        </div>
        <div className="payment-actions">
          <Link className="button secondary" to="/account/applications">
            Applications
          </Link>
          <Link className="button secondary" to="/account/payments">
            Payments
          </Link>
          <button className="button secondary" type="button" onClick={loadPayments} disabled={loading}>
            <RefreshCcw size={17} />
            Refresh
          </button>
        </div>
      </div>

      {view === "dashboard" ? (
        <AccountSummary payments={payments} />
      ) : null}

      {error ? <div className="notice warning">{error}</div> : null}

      {loading ? (
        <div className="banking-panel account-empty-state">Loading account records...</div>
      ) : (
        <PaymentList
          payments={visiblePayments}
          emptyText={view === "applications" ? "No applications have been submitted yet." : "No payment records found."}
        />
      )}

      {view === "dashboard" && payments.length > 3 ? (
        <div className="payment-actions centered-actions">
          <Link className="button primary" to="/account/payments">
            View All Payments
            <ArrowRight size={17} />
          </Link>
        </div>
      ) : null}
    </section>
  );
}
