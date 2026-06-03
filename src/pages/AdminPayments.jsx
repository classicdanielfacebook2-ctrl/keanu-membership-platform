import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, CreditCard, RefreshCcw, XCircle } from "lucide-react";
import SectionHeader from "../components/SectionHeader.jsx";
import { cardTypes } from "../data/cards.js";
import { formatPaymentAmount } from "../data/paymentMethods.js";
import { getAdminPayments } from "../services/stripeCheckout.js";

const statusIcons = {
  Paid: CheckCircle2,
  "Awaiting Bank Transfer": Clock3,
  Processing: Clock3,
  Failed: XCircle,
  Expired: XCircle,
  Refunded: CreditCard,
  "Partially Paid": Clock3
};

const statuses = ["All", "Paid", "Awaiting Bank Transfer", "Processing", "Partially Paid", "Failed", "Expired", "Refunded"];

const cardName = (id, fallback = "") => cardTypes.find((card) => card.id === id)?.name || fallback || id || "Membership";

export default function AdminPayments() {
  const [payments, setPayments] = useState([]);
  const [activeStatus, setActiveStatus] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [supportNotes, setSupportNotes] = useState({});

  const loadPayments = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAdminPayments();
      setPayments(Array.isArray(data.payments) ? data.payments : []);
    } catch (err) {
      setError(err?.message || "Payment records could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const filteredPayments = useMemo(
    () => (activeStatus === "All" ? payments : payments.filter((payment) => payment.paymentStatus === activeStatus)),
    [activeStatus, payments]
  );

  const stats = useMemo(
    () => [
      { status: "Total applications", count: payments.length, icon: CreditCard },
      ...statuses.slice(1).map((status) => ({
        status,
        count: payments.filter((payment) => payment.paymentStatus === status).length,
        icon: statusIcons[status] || CreditCard
      }))
    ],
    [payments]
  );

  const markSupportNote = (payment) => {
    const note = window.prompt("Add support note for this payment:", supportNotes[payment.id] || "");
    if (note === null) return;
    setSupportNotes((current) => ({ ...current, [payment.id]: note.trim() || "Support follow-up marked" }));
  };

  return (
    <section className="page-section wide-page admin-page">
      <SectionHeader
        eyebrow="Admin Payments"
        title="Payment tracking dashboard."
        copy="Monitor Stripe Checkout sessions, delayed bank transfers, and membership payment status."
      />

      <div className="dashboard-stats">
        {stats.map(({ status, count, icon: Icon }) => (
          <article className="stat-card" key={status}>
            <Icon size={22} />
            <span>{status}</span>
            <strong>{count}</strong>
          </article>
        ))}
      </div>

      <div className="admin-table-wrap premium-panel">
        <div className="checkout-section-head admin-payments-head">
          <div>
            <span className="eyebrow">Stripe Records</span>
            <h3>Applications and payment sessions</h3>
          </div>
          <button className="button secondary" type="button" onClick={loadPayments} disabled={loading}>
            <RefreshCcw size={17} />
            {loading ? "Refreshing" : "Refresh"}
          </button>
        </div>

        <div className="payment-status-tabs" aria-label="Payment status filter">
          {statuses.map((status) => (
            <button
              key={status}
              className={activeStatus === status ? "selected" : ""}
              type="button"
              onClick={() => setActiveStatus(status)}
            >
              {status}
            </button>
          ))}
        </div>

        {error ? <div className="notice warning">{error}</div> : null}

        <table className="admin-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Card</th>
              <th>Status</th>
              <th>Amount</th>
              <th>Stripe Session</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.length ? (
              filteredPayments.map((payment) => {
                const sessionId = payment.stripeCheckoutSessionId || payment.stripe_checkout_session_id || "";
                return (
                  <tr key={payment.id || sessionId || payment.applicationId}>
                    <td>
                      <strong>{payment.applicantName || "Applicant"}</strong>
                      <span>{payment.applicantEmail}</span>
                      <small>{payment.applicantPhone}</small>
                    </td>
                    <td>
                      <strong>{cardName(payment.selectedCard, payment.cardName)}</strong>
                      <span>{payment.referenceId || payment.applicationId}</span>
                    </td>
                    <td>
                      <span className={`status-pill ${(payment.paymentStatus || "Pending").toLowerCase().replace(/\s+/g, "-")}`}>
                        {payment.paymentStatus || "Pending"}
                      </span>
                    </td>
                    <td>
                      <strong>{formatPaymentAmount(payment.amount || 0, String(payment.currency || "EUR").toUpperCase())}</strong>
                      <span>{String(payment.currency || "EUR").toUpperCase()}</span>
                    </td>
                    <td>
                      <span>{sessionId || "Not available"}</span>
                      <small>{payment.stripePaymentIntentId || payment.stripe_payment_intent_id || ""}</small>
                    </td>
                    <td>
                      <span>{payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : "Not available"}</span>
                      <small>{payment.updatedAt ? new Date(payment.updatedAt).toLocaleString() : ""}</small>
                    </td>
                    <td>
                      <div className="admin-actions">
                        <a href={`/account/payment/${payment.applicationId}`} target="_blank" rel="noreferrer">
                          View Details
                        </a>
                        <button type="button" onClick={() => markSupportNote(payment)}>
                          Mark Support Note
                        </button>
                        <a href={`mailto:${payment.applicantEmail}?subject=KR Global Membership ${payment.referenceId || payment.applicationId}`}>
                          Contact User
                        </a>
                        {supportNotes[payment.id] ? <small>{supportNotes[payment.id]}</small> : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="7" className="empty-cell">
                  {loading ? "Loading payment records..." : "No payment records found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
