import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CreditCard, LockKeyhole, ShieldCheck } from "lucide-react";
import CardType from "../components/CardType.jsx";
import SectionHeader from "../components/SectionHeader.jsx";
import { cardTypes, paymentStatuses } from "../data/cards.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function Payment() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const selected = useMemo(() => {
    const requested = params.get("card") || sessionStorage.getItem("pendingMembershipCard");
    return cardTypes.find((card) => card.id === requested) || cardTypes[0];
  }, [params]);
  const [status, setStatus] = useState("Pending");

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.isAuthenticated) {
      sessionStorage.setItem("pendingMembershipCard", selected.id);
      sessionStorage.setItem("pendingMembershipAction", "payment");
      navigate(`/login?returnTo=${encodeURIComponent(`/payment?card=${selected.id}`)}`, { replace: true });
    }
  }, [auth.loading, auth.isAuthenticated, selected.id, navigate]);

  return (
    <section className="page-section payment-page">
      <SectionHeader
        eyebrow="Secure Payment"
        title="Payment provider placeholder."
        copy="This review version prepares the checkout experience without collecting card details or processing live transactions."
      />
      <div className="payment-layout">
        <CardType card={selected} compact />
        <div className="payment-panel premium-panel">
          <div className="payment-summary">
            <span className="eyebrow">Payment Summary</span>
            <h3>{selected.name}</h3>
            <p>{selected.price}</p>
            <div className={`status-pill ${status.toLowerCase()}`}>Payment Status: {status}</div>
          </div>

          <div className="secure-box">
            <LockKeyhole size={30} />
            <div>
              <h3>Approved provider required</h3>
              <p>Payments will be processed only through an approved secure payment provider.</p>
            </div>
          </div>

          <div className="payment-actions">
            <button className="button primary" type="button" onClick={() => setStatus("Pending")}>
              <CreditCard size={17} />
              Stripe Placeholder
            </button>
            <button className="button secondary" type="button" onClick={() => setStatus("Pending")}>
              PayPal Placeholder
            </button>
          </div>

          <label htmlFor="paymentStatus">
            Demo payment status
            <select id="paymentStatus" value={status} onChange={(e) => setStatus(e.target.value)}>
              {paymentStatuses.map((paymentStatus) => (
                <option key={paymentStatus}>{paymentStatus}</option>
              ))}
            </select>
          </label>

          <div className="payment-badge">
            <ShieldCheck size={18} />
            Secure payment badge placeholder
          </div>
          {/* Backend later: create Stripe/PayPal checkout sessions and reconcile provider webhooks here. */}
        </div>
      </div>
    </section>
  );
}
