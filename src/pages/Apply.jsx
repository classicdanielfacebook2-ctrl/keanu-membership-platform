import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Crown, ShieldCheck } from "lucide-react";
import SectionHeader from "../components/SectionHeader.jsx";
import { cardTypes } from "../data/cards.js";
import {
  convertEurCents,
  formatPaymentAmount,
  getPaymentMethod
} from "../data/paymentMethods.js";
import { saveApplication } from "../services/storage.js";
import { createCheckoutSession } from "../services/stripeCheckout.js";
import { useAuth } from "../context/AuthContext.jsx";

const emptyForm = {
  fullName: "",
  email: "",
  phone: "",
  country: "",
  selectedCard: "",
  preferredContactMethod: "Email",
  paymentMethod: "card",
  paymentCurrency: "EUR"
};

const steps = ["Membership", "Application", "Review", "Secure Payment"];

export default function Apply() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const requestedCard = params.get("card") || sessionStorage.getItem("pendingMembershipCard") || "";
  const initialCard = cardTypes.some((card) => card.id === requestedCard) ? requestedCard : "";
  const [step, setStep] = useState(initialCard ? 1 : 0);
  const [form, setForm] = useState({ ...emptyForm, selectedCard: initialCard });
  const [stepError, setStepError] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const selectedCard = cardTypes.find((card) => card.id === form.selectedCard) || null;
  const selectedPaymentMethod = getPaymentMethod(form.paymentMethod);
  const selectedAmount = selectedCard ? convertEurCents(selectedCard.priceAmountCents, form.paymentCurrency) : 0;
  const formattedAmount = selectedCard ? formatPaymentAmount(selectedAmount, form.paymentCurrency) : "";
  const progress = ((step + 1) / steps.length) * 100;
  const applicationComplete = form.fullName && form.email && form.phone && form.country && form.preferredContactMethod;

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.isAuthenticated && step > 0) {
      if (form.selectedCard) sessionStorage.setItem("pendingMembershipCard", form.selectedCard);
      sessionStorage.setItem("pendingMembershipAction", "apply");
      navigate(`/login?returnTo=${encodeURIComponent(form.selectedCard ? `/apply?card=${form.selectedCard}` : "/apply")}`, {
        replace: true
      });
    }
  }, [auth.loading, auth.isAuthenticated, form.selectedCard, navigate, step]);

  useEffect(() => {
    if (!auth.user) return;
    const identifier = auth.user.identifier || "";
    const identifierIsEmail = identifier.includes("@");

    setForm((current) => ({
      ...current,
      fullName: current.fullName || auth.user.fullName || "",
      email: current.email || (identifierIsEmail ? identifier : ""),
      phone: current.phone || (!identifierIsEmail ? identifier : "")
    }));
  }, [auth.user]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const canEnterStep = (targetStep) => {
    if (targetStep === 0) return true;
    if (targetStep === 1) return Boolean(form.selectedCard);
    if (targetStep === 2 || targetStep === 3) return Boolean(form.selectedCard && applicationComplete);
    return false;
  };

  const goToStep = (targetStep) => {
    if (!canEnterStep(targetStep)) {
      setStepError("Complete the previous step before continuing.");
      return;
    }
    setStepError("");
    setStep(targetStep);
  };

  const nextStep = () => {
    if (step === 0 && !form.selectedCard) {
      setStepError("Select a membership card to begin.");
      return;
    }
    if (step === 0 && auth.loading) {
      setStepError("Preparing your membership session. Please try again in a moment.");
      return;
    }
    if (step === 0 && !auth.isAuthenticated) {
      sessionStorage.setItem("pendingMembershipCard", form.selectedCard);
      sessionStorage.setItem("pendingMembershipAction", "apply");
      navigate(`/login?returnTo=${encodeURIComponent(`/apply?card=${form.selectedCard}`)}`);
      return;
    }
    if (step === 1 && !applicationComplete) {
      setStepError("Complete the required applicant details before continuing.");
      return;
    }
    setStepError("");
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const previousStep = () => {
    setStepError("");
    setStep((current) => Math.max(current - 1, 0));
  };

  const handleContinueToPayment = async () => {
    console.info("[checkout/start]", {
      source: "final-payment-button",
      selectedCard: selectedCard?.id || "",
      paymentMethod: form.paymentMethod,
      currency: form.paymentCurrency
    });

    if (!selectedCard || !applicationComplete) {
      console.info("[checkout/blocked]", {
        source: "final-payment-button",
        reason: "missing_application_details",
        hasSelectedCard: Boolean(selectedCard),
        applicationComplete: Boolean(applicationComplete)
      });
      setStepError("Review the selected card and applicant details before payment.");
      return;
    }
    setCheckoutLoading(true);
    setStepError("");

    try {
      const saved = saveApplication({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        country: form.country.trim(),
        selectedCard: selectedCard.id,
        preferredContactMethod: form.preferredContactMethod,
        paymentMethod: form.paymentMethod,
        paymentMethodLabel: selectedPaymentMethod.title,
        paymentCurrency: form.paymentCurrency,
        paymentAmount: formattedAmount
      });

      sessionStorage.setItem("pendingStripeApplicationId", saved.id);
      sessionStorage.removeItem("pendingMembershipCard");
      sessionStorage.removeItem("pendingMembershipAction");
      const session = await createCheckoutSession(saved, form.paymentMethod, form.paymentCurrency);
      if (!session.url) throw new Error("Stripe checkout URL was not returned.");
      console.info("[checkout/redirect]", {
        source: "final-payment-button",
        sessionId: session.id || "",
        selectedCard: saved.selectedCard,
        paymentMethod: saved.paymentMethod,
        currency: saved.paymentCurrency
      });
      window.location.href = session.url;
    } catch (error) {
      setCheckoutLoading(false);
      setStepError(error?.message || "Unable to open Stripe Checkout.");
    }
  };

  return (
    <section className="page-section application-page">
      <SectionHeader
        eyebrow="KR Global Membership"
        title="Select your private membership access."
        copy="Choose a membership level, complete your details, review your request, then continue to secure checkout."
      />

      <div className="conversion-flow">
        <div className="progress-header conversion-progress">
          <div>
            <span className="eyebrow">Step {step + 1} of {steps.length}</span>
            <h2>{steps[step]}</h2>
          </div>
          <div className="progress-track" aria-label="Application progress">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="step-tabs conversion-steps" aria-label="Application steps">
          {steps.map((item, index) => (
            <button
              key={item}
              className={index === step ? "active" : ""}
              type="button"
              onClick={() => goToStep(index)}
              disabled={!canEnterStep(index)}
            >
              <span>{index + 1}</span>
              {item}
            </button>
          ))}
        </div>

        <form className="form-panel step-form conversion-panel" onSubmit={(event) => event.preventDefault()}>
          {step === 0 ? (
            <div className="select-card-step">
              <div className="vip-membership-grid">
                {cardTypes.map((card) => (
                  <button
                    key={card.id}
                    className={form.selectedCard === card.id ? "vip-membership-option selected" : "vip-membership-option"}
                    type="button"
                    onClick={() => updateField("selectedCard", card.id)}
                  >
                    {card.id === "vip" ? <span className="vip-badge"><Crown size={14} /> Most Popular</span> : null}
                    <span className="vip-card-kicker">KR Global Membership</span>
                    <span className="vip-card-title">{card.name}</span>
                    <span className="vip-card-price">
                      {card.price}
                      <small>/person</small>
                    </span>
                    <span className="vip-benefit-list">
                      {card.benefits.map((benefit) => (
                        <span key={benefit}>
                          <Check size={15} />
                          {benefit}
                        </span>
                      ))}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="form-grid">
              <label htmlFor="fullName">
                Full Name
                <input id="fullName" required value={form.fullName} onChange={(e) => updateField("fullName", e.target.value)} />
              </label>
              <label htmlFor="email">
                Email Address
                <input
                  id="email"
                  required
                  inputMode="email"
                  pattern="[^@\s]+@[^@\s]+\.[^@\s]+"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                />
              </label>
              <label htmlFor="phone">
                Phone Number
                <input id="phone" required value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
              </label>
              <label htmlFor="country">
                Country
                <input id="country" required value={form.country} onChange={(e) => updateField("country", e.target.value)} />
              </label>
              <label htmlFor="selectedCard">
                Selected Membership Card
                <select id="selectedCard" required value={form.selectedCard} onChange={(e) => updateField("selectedCard", e.target.value)}>
                  <option value="">Select a card</option>
                  {cardTypes.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.name}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="preferredContactMethod">
                Preferred Contact Method
                <select
                  id="preferredContactMethod"
                  required
                  value={form.preferredContactMethod}
                  onChange={(e) => updateField("preferredContactMethod", e.target.value)}
                >
                  <option>Email</option>
                  <option>Phone</option>
                  <option>SMS</option>
                </select>
              </label>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="review-panel conversion-review">
              <div className="review-details">
                <span>Applicant</span>
                <strong>{form.fullName}</strong>
                <span>Email</span>
                <strong>{form.email}</strong>
                <span>Phone</span>
                <strong>{form.phone}</strong>
                <span>Country</span>
                <strong>{form.country}</strong>
                <span>Selected Card</span>
                <strong>{selectedCard?.name}</strong>
                <span>Contact Method</span>
                <strong>{form.preferredContactMethod}</strong>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="payment-step website-checkout">
              <div className="checkout-membership-summary">
                <div>
                  <span className="eyebrow">Selected membership</span>
                  <h3>{selectedCard?.name}</h3>
                  <strong>{formattedAmount}</strong>
                </div>
                <ul>
                  {selectedCard?.benefits.slice(0, 3).map((benefit) => (
                    <li key={benefit}>{benefit}</li>
                  ))}
                </ul>
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
            </div>
          ) : null}

          {stepError ? <div className="notice warning">{stepError}</div> : null}

          <div className="step-actions">
            <button className="button ghost" type="button" onClick={previousStep} disabled={step === 0 || checkoutLoading}>
              <ArrowLeft size={17} />
              Back
            </button>
            {step < 3 ? (
              <button className="button primary" type="button" onClick={nextStep}>
                {step === 0 ? "Continue" : "Next"}
                <ArrowRight size={17} />
              </button>
            ) : (
              <button className="button primary checkout-continue-button" type="button" onClick={handleContinueToPayment} disabled={checkoutLoading}>
                {checkoutLoading ? "Opening checkout..." : "Continue to Secure Payment"}
                <ArrowRight size={17} />
              </button>
            )}
          </div>
        </form>
      </div>

    </section>
  );
}
