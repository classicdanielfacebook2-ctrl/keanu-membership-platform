import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, CreditCard } from "lucide-react";
import SectionHeader from "../components/SectionHeader.jsx";
import { getApplications, updateApplication } from "../services/storage.js";
import { useEffect, useMemo } from "react";
import { cardTypes } from "../data/cards.js";
import { isDelayedPaymentMethod } from "../data/paymentMethods.js";

const cardName = (id) => cardTypes.find((card) => card.id === id)?.name || "Membership";

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id") || "";
  const applicationId = params.get("application") || sessionStorage.getItem("pendingStripeApplicationId") || "";

  const application = useMemo(
    () => getApplications().find((item) => item.id === applicationId || item.referenceId === applicationId),
    [applicationId]
  );

  useEffect(() => {
    if (!sessionId || !application?.id) return;
    const delayedPayment = isDelayedPaymentMethod(application.paymentMethod);
    updateApplication(application.id, {
      paymentStatus: delayedPayment ? "Pending" : "Paid",
      membershipStatus: delayedPayment ? "Pending" : "Active"
    });
    sessionStorage.removeItem("pendingStripeApplicationId");
  }, [application, sessionId]);

  const delayedPayment = isDelayedPaymentMethod(application?.paymentMethod);
  const statusText = delayedPayment ? "Pending / Pending" : "Paid / Active";

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
          Status: <strong>{statusText}</strong>
        </p>
        {delayedPayment ? <p>SEPA payments remain pending until Stripe confirms settlement.</p> : null}
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
