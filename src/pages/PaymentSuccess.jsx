import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, CreditCard } from "lucide-react";
import SectionHeader from "../components/SectionHeader.jsx";
import { getApplications, updateApplication } from "../services/storage.js";
import { useEffect, useMemo, useState } from "react";
import { cardTypes } from "../data/cards.js";
import { getCheckoutSessionStatus } from "../services/stripeCheckout.js";

const cardName = (id) => cardTypes.find((card) => card.id === id)?.name || "Membership";

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id") || "";
  const applicationId = params.get("application") || sessionStorage.getItem("pendingStripeApplicationId") || "";
  const [status, setStatus] = useState({ paymentStatus: "Pending", membershipStatus: "Pending" });
  const [error, setError] = useState("");

  const application = useMemo(
    () => getApplications().find((item) => item.id === applicationId || item.referenceId === applicationId),
    [applicationId]
  );

  useEffect(() => {
    if (!sessionId) return;
    getCheckoutSessionStatus(sessionId)
      .then((data) => {
        setStatus({ paymentStatus: data.paymentStatus, membershipStatus: data.membershipStatus });
        const localApplication =
          application ||
          getApplications().find((item) => item.id === data.applicationId || item.referenceId === data.referenceId);
        if (localApplication?.id) {
          updateApplication(localApplication.id, {
            paymentStatus: data.paymentStatus,
            membershipStatus: data.membershipStatus
          });
          sessionStorage.removeItem("pendingStripeApplicationId");
        }
      })
      .catch((requestError) => setError(requestError.message));
  }, [application, sessionId]);

  return (
    <section className="page-section payment-result-page">
      <SectionHeader
        eyebrow="Payment Complete"
        title="Membership payment received."
        copy="Your Stripe checkout has completed. Membership access is activated once the payment is confirmed by Stripe."
      />
      <div className="payment-empty premium-panel">
        <CheckCircle2 size={38} />
        <h3>{application ? cardName(application.selectedCard) : "KR Global Membership"}</h3>
        <p>
          Status: <strong>{status.paymentStatus} / {status.membershipStatus}</strong>
        </p>
        {error ? <p>{error}</p> : null}
        {application ? <p>Application Reference: {application.referenceId || application.id}</p> : null}
        {sessionId ? <p>Stripe Session: {sessionId}</p> : null}
        <Link className="button primary" to="/support">
          Contact Member Services
          <CreditCard size={17} />
        </Link>
      </div>
    </section>
  );
}
