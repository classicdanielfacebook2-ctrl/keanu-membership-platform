import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, CreditCard, Landmark } from "lucide-react";
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
    const bankTransfer = application.paymentMethod === "bank_transfer";
    updateApplication(application.id, {
      paymentStatus: bankTransfer ? "Awaiting Bank Transfer" : delayedPayment ? "Processing" : "Paid",
      membershipStatus: delayedPayment ? "Pending" : "Active"
    });
    sessionStorage.removeItem("pendingStripeApplicationId");
  }, [application, sessionId]);

  const delayedPayment = isDelayedPaymentMethod(application?.paymentMethod);
  const bankTransfer = application?.paymentMethod === "bank_transfer";
  const statusText = bankTransfer ? "Awaiting Bank Transfer / Pending" : delayedPayment ? "Processing / Pending" : "Paid / Active";

  return (
    <section className="page-section payment-result-page">
      {bankTransfer ? (
        <SectionHeader
          eyebrow="Bank Transfer"
          title="Bank transfer instructions generated."
          copy="Your application is awaiting bank transfer confirmation."
        />
      ) : (
        <SectionHeader
          eyebrow={delayedPayment ? "Payment Processing" : "Payment Complete"}
          title={delayedPayment ? "Payment confirmation is processing." : "Membership payment received."}
          copy="Membership access is activated once the payment is confirmed by Stripe."
        />
      )}
      <div className="payment-empty premium-panel">
        {bankTransfer ? <Landmark size={38} /> : <CheckCircle2 size={38} />}
        <h3>{application ? cardName(application.selectedCard) : "KR Global Membership"}</h3>
        <p>
          Status: <strong>{statusText}</strong>
        </p>
        {bankTransfer ? (
          <>
            <p>Please send the exact amount using the IBAN and reference shown by Stripe.</p>
            <p>Your membership will activate automatically after Stripe confirms the payment.</p>
          </>
        ) : delayedPayment ? (
          <p>Delayed payment methods remain pending until Stripe confirms settlement.</p>
        ) : null}
        {application ? <p>Application Reference: {application.referenceId || application.id}</p> : null}
        {sessionId ? <p>Stripe Session: {sessionId}</p> : null}
        <Link className="button primary" to={application ? `/payment/status/${application.id}` : "/support"}>
          {bankTransfer ? "View Payment Status" : "Contact Member Services"}
          <CreditCard size={17} />
        </Link>
      </div>
    </section>
  );
}
