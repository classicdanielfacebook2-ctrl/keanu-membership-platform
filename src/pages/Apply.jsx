import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Crown, ShieldCheck } from "lucide-react";
import SectionHeader from "../components/SectionHeader.jsx";
import { cardTypes } from "../data/cards.js";
import { getCountryByName, getRegionByName, locationCountries } from "../data/locations.js";
import {
  convertEurCents,
  formatPaymentAmount,
  getPaymentMethod
} from "../data/paymentMethods.js";
import { saveApplication } from "../services/storage.js";
import { createCheckoutSession } from "../services/stripeCheckout.js";
import { useAuth } from "../context/AuthContext.jsx";

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  country: "",
  stateRegion: "",
  city: "",
  manualCity: "",
  numberApplicants: "1",
  message: "",
  selectedCard: "",
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
  const selectedCountry = getCountryByName(form.country);
  const selectedRegion = getRegionByName(form.country, form.stateRegion);
  const cityOptions = selectedRegion?.cities || [];
  const finalCity = form.city === "__manual__" ? form.manualCity.trim() : form.city;
  const selectedAmount = selectedCard ? convertEurCents(selectedCard.priceAmountCents, form.paymentCurrency) : 0;
  const formattedAmount = selectedCard ? formatPaymentAmount(selectedAmount, form.paymentCurrency) : "";
  const progress = ((step + 1) / steps.length) * 100;
  const applicationComplete =
    form.firstName &&
    form.lastName &&
    form.email &&
    form.phone &&
    form.country &&
    form.stateRegion &&
    finalCity &&
    form.numberApplicants;

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
      firstName: current.firstName || auth.user.fullName?.split(" ")[0] || "",
      lastName: current.lastName || auth.user.fullName?.split(" ").slice(1).join(" ") || "",
      email: current.email || (identifierIsEmail ? identifier : ""),
      phone: current.phone || (!identifierIsEmail ? identifier : "")
    }));
  }, [auth.user]);

  const updateField = (field, value) => {
    setForm((current) => {
      if (field === "country") return { ...current, country: value, stateRegion: "", city: "", manualCity: "" };
      if (field === "stateRegion") return { ...current, stateRegion: value, city: "", manualCity: "" };
      if (field === "city" && value !== "__manual__") return { ...current, city: value, manualCity: "" };
      return { ...current, [field]: value };
    });
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
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        fullName: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        country: form.country.trim(),
        stateRegion: form.stateRegion.trim(),
        city: finalCity,
        numberApplicants: form.numberApplicants,
        message: form.message.trim(),
        selectedCard: selectedCard.id,
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
            <div className="membership-application-form">
              <div className="application-form-heading">
                <span className="eyebrow">Membership details</span>
                <h3>Complete Your Membership Application</h3>
                <p>Provide your details so we can review and prepare your selected membership.</p>
              </div>

              <div className="form-grid luxury-application-grid">
              <label htmlFor="firstName">
                First name
                <input
                  id="firstName"
                  required
                  placeholder="Enter first name"
                  value={form.firstName}
                  onChange={(e) => updateField("firstName", e.target.value)}
                />
              </label>
              <label htmlFor="lastName">
                Last name
                <input
                  id="lastName"
                  required
                  placeholder="Enter last name"
                  value={form.lastName}
                  onChange={(e) => updateField("lastName", e.target.value)}
                />
              </label>
              <label htmlFor="email">
                Email
                <input
                  id="email"
                  required
                  inputMode="email"
                  pattern="[^@\s]+@[^@\s]+\.[^@\s]+"
                  placeholder="name@example.com"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                />
              </label>
              <label htmlFor="phone">
                Phone number
                <input
                  id="phone"
                  required
                  inputMode="tel"
                  placeholder="+1 000 000 0000"
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                />
              </label>
              <label htmlFor="selectedCard">
                Selected membership card
                <select id="selectedCard" required value={form.selectedCard} onChange={(e) => updateField("selectedCard", e.target.value)}>
                  <option value="">Select a card</option>
                  {cardTypes.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.name}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="country">
                Country
                <select id="country" required value={form.country} onChange={(e) => updateField("country", e.target.value)}>
                  <option value="">Select country</option>
                  {locationCountries.map((country) => (
                    <option key={country.id} value={country.name}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="stateRegion">
                State / Region
                <select
                  id="stateRegion"
                  required
                  value={form.stateRegion}
                  onChange={(e) => updateField("stateRegion", e.target.value)}
                  disabled={!selectedCountry}
                >
                  <option value="">Select state or region</option>
                  {selectedCountry?.regions.map((region) => (
                    <option key={region.name} value={region.name}>
                      {region.name}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="city">
                City
                <select
                  id="city"
                  required
                  value={form.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  disabled={!selectedRegion}
                >
                  <option value="">Select a city</option>
                  {cityOptions.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                  <option value="__manual__">City not listed</option>
                </select>
              </label>
              {form.city === "__manual__" ? (
                <label htmlFor="manualCity">
                  Type city manually
                  <input
                    id="manualCity"
                    required
                    placeholder="Enter your city"
                    value={form.manualCity}
                    onChange={(e) => updateField("manualCity", e.target.value)}
                  />
                </label>
              ) : null}
              <label htmlFor="numberApplicants">
                Number of applicants
                <select
                  id="numberApplicants"
                  required
                  value={form.numberApplicants}
                  onChange={(e) => updateField("numberApplicants", e.target.value)}
                >
                  <option value="1">1 person</option>
                  <option value="2">2 people</option>
                  <option value="3">3 people</option>
                  <option value="4">4 people</option>
                  <option value="5">5 people</option>
                  <option value="6+">6 or more</option>
                </select>
              </label>
              <label className="wide" htmlFor="message">
                Message or special request
                <textarea
                  id="message"
                  rows="5"
                  placeholder="Share any request or detail you would like us to consider."
                  value={form.message}
                  onChange={(e) => updateField("message", e.target.value)}
                />
              </label>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="review-panel conversion-review">
              <div className="review-details">
                <span>Applicant</span>
                <strong>{`${form.firstName} ${form.lastName}`.trim()}</strong>
                <span>Email</span>
                <strong>{form.email}</strong>
                <span>Phone</span>
                <strong>{form.phone}</strong>
                <span>Country</span>
                <strong>{form.country}</strong>
                <span>State / Region</span>
                <strong>{form.stateRegion}</strong>
                <span>City</span>
                <strong>{finalCity}</strong>
                <span>Applicants</span>
                <strong>{form.numberApplicants}</strong>
                <span>Selected Card</span>
                <strong>{selectedCard?.name}</strong>
                {form.message ? (
                  <>
                    <span>Message</span>
                    <strong>{form.message}</strong>
                  </>
                ) : null}
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
                {step === 0 ? "Continue" : step === 1 ? "Submit Application" : "Next"}
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
