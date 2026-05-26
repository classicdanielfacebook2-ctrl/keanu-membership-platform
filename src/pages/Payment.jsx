import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, BadgeCheck, Building2, CreditCard, LockKeyhole, ShieldCheck, Smartphone, Sparkles, Wallet } from "lucide-react";
import SectionHeader from "../components/SectionHeader.jsx";
import { cardTypes, getCardPrice } from "../data/cards.js";
import { getPaymentMethod, isDelayedPaymentMethod, paymentMethods } from "../data/paymentMethods.js";
import { getApplications, updateApplication } from "../services/storage.js";
import { createCheckoutSession, stripePublishableKey } from "../services/stripeCheckout.js";
import { useAuth } from "../context/AuthContext.jsx";

const cardName = (id) => cardTypes.find((card) => card.id === id)?.name || "Selected membership card";
const cardPrice = (id) => getCardPrice(id);
const paymentIcons = {
  card: CreditCard,
  sepa: Building2,
  google_pay: Smartphone,
  apple_pay: Wallet,
  amazon_pay: Wallet,
  link: BadgeCheck
};

export default function Payment() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const [applications, setApplications] = useState([]);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [selectedMethodId, setSelectedMethodId] = useState("card");
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
    if (!application) return;
    if (application.paymentStatus) setStatus(application.paymentStatus);
    setSelectedMethodId(getPaymentMethod(application.paymentMethod).id);
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

  const handleCheckout = async () => {
    if (!application) return;
    setCheckoutError("");
    setCheckoutLoading(true);
    try {
      if (!stripePublishableKey) {
        console.warn("[stripe/checkout]", {
          message: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not configured in the frontend environment."
        });
      }
      const updatedApplication = {
        ...application,
        paymentMethod: selectedMethodId,
        paymentMethodLabel: getPaymentMethod(selectedMethodId).title
      };
      const session = await createCheckoutSession(updatedApplication, selectedMethodId);
      if (!session.url) throw new Error("Stripe checkout URL was not returned.");
      updatePaymentStatus("Pending");
      setApplications(updateApplication(application.id, {
        paymentMethod: selectedMethodId,
        paymentMethodLabel: getPaymentMethod(selectedMethodId).title
      }));
      window.location.href = session.url;
    } catch (error) {
      setCheckoutError(error?.message || "Unable to start Stripe Checkout.");
      setCheckoutLoading(false);
    }
  };

  return (
    <section className="page-section payment-page">
      <SectionHeader
        eyebrow="Payment Method"
        title="Choose how you would like to pay."
        copy="Select a secure payment method, then continue to the hosted payment provider."
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
              <strong>{getPaymentMethod(selectedMethodId).title}</strong>
            </div>

            <div className="secure-box">
              <LockKeyhole size={30} />
              <div>
                <h3>Secure encrypted checkout</h3>
                <p>Payment details are entered only on the selected provider's hosted payment page.</p>
              </div>
            </div>

            <div className="payment-method-grid" role="radiogroup" aria-label="Choose payment method">
              {paymentMethods.map((method) => {
                const Icon = paymentIcons[method.id] || CreditCard;
                const selected = selectedMethodId === method.id;

                return (
                  <button
                    key={method.id}
                    className={selected ? "payment-method-card selected" : "payment-method-card"}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setSelectedMethodId(method.id)}
                  >
                    <span className="payment-method-icon">
                      <Icon size={20} />
                    </span>
                    <span>
                      <strong>{method.title}</strong>
                      <small>{method.description}</small>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="stripe-trust-grid" aria-label="Stripe payment trust indicators">
              <span>
                <ShieldCheck size={17} />
                TLS secured checkout
              </span>
              <span>
                <CreditCard size={17} />
                Stripe-hosted payment page
              </span>
              <span>
                <Sparkles size={17} />
                Instant membership payment record
              </span>
            </div>

            <div className="payment-actions">
              <button className="button primary" type="button" onClick={handleCheckout} disabled={checkoutLoading}>
                <CreditCard size={17} />
                {checkoutLoading ? (
                  <>
                    <span className="button-loader" aria-hidden="true" />
                    Opening checkout
                  </>
                ) : (
                  "Continue Securely"
                )}
              </button>
            </div>

            {checkoutError ? <div className="notice warning">{checkoutError}</div> : null}

            <div className="payment-badge">
              <ShieldCheck size={18} />
              {isDelayedPaymentMethod(selectedMethodId)
                ? "SEPA status remains pending until confirmed"
                : "Verified secure payment flow"}
            </div>
          </div>
        </div>
      ) : (
        <div className="payment-empty premium-panel">
          <CreditCard size={34} />
          <h3>No payment-ready application found</h3>
          <p>Select a card and complete the application details before opening payment.</p>
          <Link className="button primary" to="/cards">
            Choose Card
            <ArrowRight size={17} />
          </Link>
        </div>
      )}
    </section>
  );
}
