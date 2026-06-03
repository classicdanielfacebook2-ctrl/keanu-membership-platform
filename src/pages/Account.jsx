import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock3, CreditCard, FileText, RefreshCcw, ShieldCheck } from "lucide-react";
import SectionHeader from "../components/SectionHeader.jsx";
import { cardTypes } from "../data/cards.js";
import { formatPaymentAmount } from "../data/paymentMethods.js";
import { getAccountPayments, renewBankTransferInstructions } from "../services/stripeCheckout.js";
import { useAuth } from "../context/AuthContext.jsx";

const statusSet = ["Awaiting Bank Transfer", "Processing", "Paid", "Failed", "Expired", "Refunded"];

const cardName = (id, fallback = "") => cardTypes.find((card) => card.id === id)?.name || fallback || id || "Membership";

const money = (payment) => formatPaymentAmount(payment.amount || 0, String(payment.currency || "EUR").toUpperCase());

const isBankTransfer = (payment) => payment?.paymentMethod === "bank_transfer" || payment?.payment_method === "bank_transfer";
const isAwaitingTransfer = (payment) => isBankTransfer(payment) && payment?.paymentStatus === "Awaiting Bank Transfer";
const canShowTransferAction = (payment) => isBankTransfer(payment) && ["Awaiting Bank Transfer", "Expired"].includes(payment?.paymentStatus);
const sessionExpired = (payment) => {
  const expiresAt = payment?.stripeSessionExpiresAt || payment?.stripe_session_expires_at || "";
  return expiresAt ? new Date(expiresAt).getTime() <= Date.now() : false;
};

function AccountRows({ payments, emptyText = "No payment records found.", onRenew, onRefresh, renewingId = "" }) {
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
          </div>

          {isAwaitingTransfer(payment) || (isBankTransfer(payment) && payment.paymentStatus === "Expired") ? (
            <div className="bank-transfer-message">
              <strong>{payment.paymentStatus === "Expired" ? "Transfer Instructions Expired" : "Awaiting Bank Transfer"}</strong>
              <p>
                Your bank transfer instructions have been generated. If you have already sent the transfer, please wait while
                Stripe confirms receipt. SEPA Instant may confirm quickly, while normal bank transfer may take 1-3 business days.
              </p>
              {sessionExpired(payment) || payment.paymentStatus === "Expired" ? (
                <span>This transfer instruction expired. Create a new bank transfer session.</span>
              ) : null}
            </div>
          ) : null}

          <div className="payment-actions">
            {canShowTransferAction(payment) ? (
              <button className="button primary" type="button" onClick={() => onRenew(payment)} disabled={renewingId === payment.applicationId}>
                {sessionExpired(payment) || payment.paymentStatus === "Expired" ? "Generate New Transfer Instructions" : "View Transfer Instructions"}
                <ArrowRight size={17} />
              </button>
            ) : null}
            <button className="button secondary" type="button" onClick={onRefresh}>
              <RefreshCcw size={17} />
              Refresh Payment Status
            </button>
            <Link className="button secondary" to={`/support?reference=${encodeURIComponent(payment.referenceId || payment.applicationId || "")}`}>
              Contact Support
            </Link>
            <Link className="button secondary" to={`/account/payment/${payment.applicationId}`}>
              View Details
              <ArrowRight size={17} />
            </Link>
          </div>

          <details className="technical-details">
            <summary>Technical details</summary>
            <div>
              <span>Stripe checkout session</span>
              <strong>{payment.stripeCheckoutSessionId || "Not available"}</strong>
            </div>
            <div>
              <span>Stripe payment intent</span>
              <strong>{payment.stripePaymentIntentId || "Not available"}</strong>
            </div>
          </details>
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
  const [renewingId, setRenewingId] = useState("");

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

  const handleTransferInstructions = async (payment) => {
    const checkoutUrl = payment.stripeCheckoutUrl || payment.stripe_checkout_url || "";
    if (checkoutUrl && !sessionExpired(payment)) {
      window.location.href = checkoutUrl;
      return;
    }

    setRenewingId(payment.applicationId);
    setError("");
    try {
      const session = await renewBankTransferInstructions(payment.applicationId);
      if (!session.url) throw new Error("Transfer instructions could not be generated.");
      window.location.href = session.url;
    } catch (err) {
      setError(err?.message || "Transfer instructions could not be generated.");
      setRenewingId("");
    }
  };

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
          onRenew={handleTransferInstructions}
          onRefresh={loadPayments}
          renewingId={renewingId}
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
