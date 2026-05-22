import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, CreditCard, LockKeyhole, ShieldCheck } from "lucide-react";
import SectionHeader from "../components/SectionHeader.jsx";
import { cardTypes, paymentStatuses } from "../data/cards.js";
import { getApplications, updateApplication } from "../services/storage.js";
import { useAuth } from "../context/AuthContext.jsx";

const cardName = (id) => cardTypes.find((card) => card.id === id)?.name || "Selected membership card";
const cardPrice = (id) => cardTypes.find((card) => card.id === id)?.price || "Pricing available soon";

export default function Payment() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const [applications, setApplications] = useState([]);
  const applicationId = params.get("application");

  useEffect(() => {
    setApplications(getApplications());
  }, []);

  const application = useMemo(() => {
    if (!applications.length) return null;
    if (applicationId) return applications.find((item) => item.id === applicationId || item.referenceId === applicationId) || null;
    return applications[0];
  }, [applications, applicationId]);

  const [status, setStatus] = useState("Pending");

  useEffect(() => {
    if (application?.paymentStatus) setStatus(application.paymentStatus);
  }, [application]);

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.isAuthenticated) {
      navigate(`/login?returnTo=${encodeURIComponent(applicationId ? `/payment?application=${applicationId}` : "/payment")}`, {
        replace: true
      });
    }
  }, [auth.loading, auth.isAuthenticated, applicationId, navigate]);

  const updatePaymentStatus = (nextStatus) => {
    setStatus(nextStatus);
    if (application) setApplications(updateApplication(application.id, { paymentStatus: nextStatus }));
  };

  return (
    <section className="page-section payment-page">
      <SectionHeader
        eyebrow="Payment"
        title="Final payment summary."
        copy="Payment appears after the application details have been reviewed. This review build does not collect card details manually."
      />

      {application ? (
        <div className="payment-layout single-payment-layout">
          <div className="payment-panel premium-panel">
            <div className="payment-summary">
              <span className="eyebrow">Application {application.referenceId || application.id}</span>
              <h3>{cardName(application.selectedCard)}</h3>
              <p>{cardPrice(application.selectedCard)}</p>
              <div className={`status-pill ${status.toLowerCase()}`}>Payment Status: {status}</div>
            </div>

            <div className="review-details">
              <span>Selected Card</span>
              <strong>{cardName(application.selectedCard)}</strong>
              <span>Amount Due</span>
              <strong>{cardPrice(application.selectedCard)}</strong>
              <span>Applicant Name</span>
              <strong>{application.fullName}</strong>
              <span>Payment Method</span>
              <strong>{application.paymentMethod || "Secure provider checkout"}</strong>
            </div>

            <div className="secure-box">
              <LockKeyhole size={30} />
              <div>
                <h3>Secure provider checkout</h3>
                <p>Checkout will continue only through an approved provider such as Stripe or PayPal.</p>
              </div>
            </div>

            <div className="payment-actions">
              <button className="button primary" type="button" onClick={() => updatePaymentStatus("Pending")}>
                <CreditCard size={17} />
                Continue to Payment
              </button>
            </div>

            <label htmlFor="paymentStatus">
              Admin review payment status
              <select id="paymentStatus" value={status} onChange={(e) => updatePaymentStatus(e.target.value)}>
                {paymentStatuses.map((paymentStatus) => (
                  <option key={paymentStatus}>{paymentStatus}</option>
                ))}
              </select>
            </label>

            <div className="payment-badge">
              <ShieldCheck size={18} />
              Provider integration placeholder
            </div>
            {/* Backend later: create Stripe/PayPal checkout sessions and reconcile provider webhooks here. */}
          </div>
        </div>
      ) : (
        <div className="payment-empty premium-panel">
          <CreditCard size={34} />
          <h3>No payment-ready application found</h3>
          <p>Select a card and complete the application review before opening payment.</p>
          <Link className="button primary" to="/cards">
            Choose Card
            <ArrowRight size={17} />
          </Link>
        </div>
      )}
    </section>
  );
}
