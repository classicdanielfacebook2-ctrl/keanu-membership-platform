import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock3, CreditCard, FileText, RefreshCcw, ShieldCheck } from "lucide-react";
import SectionHeader from "../components/SectionHeader.jsx";
import { cardTypes } from "../data/cards.js";
import { formatPaymentAmount } from "../data/paymentMethods.js";
import { getAccountPayments } from "../services/stripeCheckout.js";
import { useAuth } from "../context/AuthContext.jsx";

const statusSet = ["Awaiting Bank Transfer", "Processing", "Paid", "Failed", "Expired", "Refunded"];

const cardName = (id, fallback = "") => cardTypes.find((card) => card.id === id)?.name || fallback || id || "Membership";

const money = (payment) => formatPaymentAmount(payment.amount || 0, String(payment.currency || "EUR").toUpperCase());

function AccountRows({ payments, emptyText = "No payment records found." }) {
  if (!payments.length) {
    return <div className="empty-cell account-empty-state">{emptyText}</div>;
  }

  return (
    <div className="account-record-grid">
      {payments.map((payment) => (
        <article className="premium-panel account-record-card" key={payment.id || payment.applicationId}>
          <div className="account-record-top">
            <div>
              <span className="eyebrow">Application Reference</span>
              <h3>{payment.referenceId || payment.applicationId}</h3>
            </div>
            <span className={`status-pill ${(payment.paymentStatus || "Pending").toLowerCase().replace(/\s+/g, "-")}`}>
              {payment.paymentStatus || "Pending"}
            </span>
          </div>

          <div className="account-detail-grid">
            <div>
              <span>Selected card</span>
              <strong>{cardName(payment.selectedCard, payment.cardName)}</strong>
            </div>
            <div>
              <span>Amount</span>
              <strong>{money(payment)}</strong>
            </div>
            <div>
              <span>Currency</span>
              <strong>{String(payment.currency || "EUR").toUpperCase()}</strong>
            </div>
            <div>
              <span>Payment method</span>
              <strong>{payment.paymentMethodLabel || payment.paymentMethod || "Checkout"}</strong>
            </div>
            <div>
              <span>Submitted date</span>
              <strong>{payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : "Not available"}</strong>
            </div>
            <div>
              <span>Membership status</span>
              <strong>{payment.membershipStatus || "Pending"}</strong>
            </div>
            <div>
              <span>Stripe checkout session</span>
              <strong>{payment.stripeCheckoutSessionId || "Not available"}</strong>
            </div>
            <div>
              <span>Stripe payment intent</span>
              <strong>{payment.stripePaymentIntentId || "Not available"}</strong>
            </div>
          </div>

          <div className="payment-actions">
            <Link className="button secondary" to={`/account/payment/${payment.applicationId}`}>
              View Details
              <ArrowRight size={17} />
            </Link>
          </div>
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

  const stats = useMemo(
    () => [
      { label: "Applications", value: payments.length, icon: FileText },
      { label: "Awaiting", value: payments.filter((payment) => payment.paymentStatus === "Awaiting Bank Transfer").length, icon: Clock3 },
      { label: "Paid", value: payments.filter((payment) => payment.paymentStatus === "Paid").length, icon: ShieldCheck },
      { label: "Open payments", value: payments.filter((payment) => statusSet.includes(payment.paymentStatus) && payment.paymentStatus !== "Paid").length, icon: CreditCard }
    ],
    [payments]
  );

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
    <section className="page-section wide-page account-page">
      <SectionHeader eyebrow="My Account" title={title} copy={copy} />

      <div className="account-welcome premium-panel">
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
        <div className="dashboard-stats">
          {stats.map(({ label, value, icon: Icon }) => (
            <article className="stat-card" key={label}>
              <Icon size={22} />
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>
      ) : null}

      {error ? <div className="notice warning">{error}</div> : null}

      {loading ? (
        <div className="premium-panel account-empty-state">Loading account records...</div>
      ) : (
        <AccountRows
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
