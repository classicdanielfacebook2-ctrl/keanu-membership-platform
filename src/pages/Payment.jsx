import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, CreditCard, LockKeyhole, ShieldCheck } from "lucide-react";
import SectionHeader from "../components/SectionHeader.jsx";
import { cardTypes, getCardPrice } from "../data/cards.js";
import {
  convertEurCents,
  formatPaymentAmount
} from "../data/paymentMethods.js";
import { getApplications, updateApplication } from "../services/storage.js";
import { createCheckoutSession, stripePublishableKey } from "../services/stripeCheckout.js";
import { useAuth } from "../context/AuthContext.jsx";

const cardName = (id) => cardTypes.find((card) => card.id === id)?.name || "Selected membership card";
const cardPrice = (id) => getCardPrice(id);

export default function Payment() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const [applications, setApplications] = useState([]);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState("EUR");
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
    setSelectedCurrency(application.paymentCurrency || "EUR");
  }, [application]);

  const selectedCard = cardTypes.find((card) => card.id === application?.selectedCard) || null;
  const selectedAmount = selectedCard ? convertEurCents(selectedCard.priceAmountCents, selectedCurrency) : 0;
  const formattedAmount = selectedCard ? formatPaymentAmount(selectedAmount, selectedCurrency) : cardPrice(application?.selectedCard);

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

  const handleContinueToPayment = async () => {
    console.info("[checkout/start]", {
      source: "final-payment-button",
      applicationId: application?.id || application?.referenceId || "",
      selectedCard: application?.selectedCard || "",
      paymentMethod: "card",
      currency: selectedCurrency
    });

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
        paymentMethod: "card",
        paymentMethodLabel: "Card / Wallets",
        paymentCurrency: selectedCurrency,
        paymentAmount: formattedAmount
      };
      const session = await createCheckoutSession(updatedApplication, "card", selectedCurrency);
      if (!session.url) throw new Error("Stripe checkout URL was not returned.");
      updatePaymentStatus("Pending");
      setApplications(updateApplication(application.id, {
        paymentMethod: "card",
        paymentMethodLabel: "Card / Wallets",
        paymentCurrency: selectedCurrency,
        paymentAmount: formattedAmount
      }));
      console.info("[checkout/redirect]", {
        source: "final-payment-button",
        sessionId: session.id || "",
        applicationId: application.id || application.referenceId || "",
        paymentMethod: "card",
        currency: selectedCurrency
      });
      window.location.href = session.url;
    } catch (error) {
      setCheckoutError(error?.message || "Unable to start Stripe Checkout.");
      setCheckoutLoading(false);
    }
  };

  return (
    <section className="page-section payment-page">
      <SectionHeader
        eyebrow="Secure Payment"
        title="Continue to secure checkout."
        copy="Review your selected membership, then continue to Stripe's hosted payment page."
      />

      {application ? (
        <div className="payment-layout single-payment-layout">
          <div className="payment-panel premium-panel">
            <div className="checkout-membership-summary">
              <div>
                <span className="eyebrow">Selected membership</span>
                <h3>{cardName(application.selectedCard)}</h3>
                <strong>{formattedAmount}</strong>
                <small>Application {application.referenceId || application.id}</small>
              </div>
              <ul>
                {selectedCard?.benefits.slice(0, 3).map((benefit) => (
                  <li key={benefit}>{benefit}</li>
                ))}
              </ul>
              <div className={`status-pill ${status.toLowerCase()}`}>Payment Status: {status}</div>
            </div>

            <div className="secure-box">
              <LockKeyhole size={30} />
              <div>
                <h3>Secure encrypted checkout</h3>
                <p>Payment details are entered only on the selected provider's hosted payment page.</p>
              </div>
            </div>

            <div className="checkout-total-bar">
              <div>
                <span>Total amount</span>
                <strong>{formattedAmount}</strong>
              </div>
              <p>
                <ShieldCheck size={17} />
                Secure encrypted checkout. Payment details are collected only by Stripe after you continue.
              </p>
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
            </div>

            <div className="payment-actions">
              <button className="button primary" type="button" onClick={handleContinueToPayment} disabled={checkoutLoading}>
                <CreditCard size={17} />
                {checkoutLoading ? (
                  <>
                    <span className="button-loader" aria-hidden="true" />
                    Opening checkout
                  </>
                ) : (
                  "Continue to Secure Payment"
                )}
              </button>
            </div>

            {checkoutError ? <div className="notice warning">{checkoutError}</div> : null}

            <div className="payment-badge">
              <ShieldCheck size={18} />
              Verified secure payment flow
            </div>
          </div>
        </div>
      ) : (
        <div className="payment-empty premium-panel">
          <CreditCard size={34} />
          <h3>No payment-ready application found</h3>
          <p>Select a card and complete the application details before opening payment.</p>
          <Link className="button primary" to="/apply">
            Apply
            <ArrowRight size={17} />
          </Link>
        </div>
      )}
    </section>
  );
}
