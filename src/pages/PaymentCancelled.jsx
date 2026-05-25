import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, XCircle } from "lucide-react";
import SectionHeader from "../components/SectionHeader.jsx";
import { getApplications, updateApplication } from "../services/storage.js";
import { useEffect, useMemo } from "react";

export default function PaymentCancelled() {
  const [params] = useSearchParams();
  const applicationId = params.get("application") || "";
  const application = useMemo(
    () => getApplications().find((item) => item.id === applicationId || item.referenceId === applicationId),
    [applicationId]
  );

  useEffect(() => {
    if (application?.id) {
      updateApplication(application.id, { paymentStatus: "Pending", membershipStatus: "Pending" });
    }
  }, [application]);

  return (
    <section className="page-section payment-result-page">
      <SectionHeader
        eyebrow="Payment Cancelled"
        title="Checkout was not completed."
        copy="Your membership payment is still pending. You can return to the payment page whenever you are ready."
      />
      <div className="payment-empty premium-panel">
        <XCircle size={38} />
        <h3>Payment pending</h3>
        <p>No payment was completed for this checkout session.</p>
        <Link className="button primary" to={application ? `/payment?application=${application.id}` : "/payment"}>
          Return to Payment
          <ArrowRight size={17} />
        </Link>
      </div>
    </section>
  );
}
