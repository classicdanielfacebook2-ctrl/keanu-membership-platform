import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  Crown,
  CreditCard,
  Globe2,
  Mail,
  MapPin,
  MapPinned,
  Phone,
  ShieldCheck,
  User,
  Users
} from "lucide-react";
import SectionHeader from "../components/SectionHeader.jsx";
import { cardTypes } from "../data/cards.js";
import {
  checkoutPaymentOptions,
  convertEurCents,
  formatPaymentAmount,
  getPaymentMethod
} from "../data/paymentMethods.js";
import { saveApplication } from "../services/storage.js";
import { createCheckoutSession, getAvailableCheckoutPaymentMethods } from "../services/stripeCheckout.js";
import { useAuth } from "../context/AuthContext.jsx";
import {
  clearApplicationDraft,
  consumeApplicationReturn,
  getApplicationDraft,
  saveApplicationDraft,
  saveApplicationReturn
} from "../services/applicationDraft.js";

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  countryCode: "",
  country: "",
  stateCode: "",
  stateRegion: "",
  manualStateRegion: "",
  city: "",
  manualCity: "",
  numberApplicants: "1",
  message: "",
  selectedCard: "",
  paymentMethod: "",
  paymentCurrency: "EUR"
};

const steps = ["Membership", "Application", "Review", "Payment Method"];
const paymentMethodIcons = {
  card: CreditCard,
  sepa: BadgeCheck,
  bank_transfer: Building2,
  ideal: Globe2
};

const membershipExperienceFeatures = [
  {
    number: "01",
    title: "Official Recognition",
    copy: "Your membership card gives you a unique member identity and confirms your place within the official membership platform."
  },
  {
    number: "02",
    title: "Premium Digital Access",
    copy: "Receive access to a refined digital membership experience created for serious supporters worldwide."
  },
  {
    number: "03",
    title: "Priority Support",
    copy: "Members receive guided assistance, account support, and faster responses through the official support channel."
  },
  {
    number: "04",
    title: "Exclusive Updates",
    copy: "Stay connected with selected membership updates, announcements, and platform information before the general public."
  },
  {
    number: "05",
    title: "Member Identity",
    copy: "Each membership includes a unique reference/member ID, helping identify your selected access level clearly and professionally."
  },
  {
    number: "06",
    title: "Limited Membership Access",
    copy: "Membership availability may be limited by tier, review status, and platform approval. Choose your card while access is available."
  }
];

function ReviewSummaryCard({ title, items }) {
  return (
    <article className="review-summary-card">
      <h4>{title}</h4>
      <div className="review-summary-list">
        {items.map(({ label, value, Icon }) => (
          <div className="review-summary-row" key={label}>
            <span className="review-row-icon" aria-hidden="true">
              <Icon size={16} />
            </span>
            <span className="review-row-copy">
              <small>{label}</small>
              <strong>{value || "Not provided"}</strong>
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}

export default function Apply() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const membershipRef = useRef(null);
  const applicationRef = useRef(null);
  const reviewRef = useRef(null);
  const paymentRef = useRef(null);
  const previousStepRef = useRef(null);
  const skipStepScrollRef = useRef(false);
  const requestedCard = params.get("card") || sessionStorage.getItem("pendingMembershipCard") || "";
  const savedDraft = getApplicationDraft();
  const initialCard = cardTypes.some((card) => card.id === requestedCard) ? requestedCard : "";
  const [step, setStep] = useState(initialCard || savedDraft.selectedCard ? 1 : 0);
  const [form, setForm] = useState({ ...emptyForm, ...savedDraft, selectedCard: initialCard || savedDraft.selectedCard || "" });
  const [stepError, setStepError] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState(["card"]);
  const [paymentAvailabilityLoading, setPaymentAvailabilityLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);

  const selectedCard = cardTypes.find((card) => card.id === form.selectedCard) || null;
  const selectedPaymentMethod = form.paymentMethod ? getPaymentMethod(form.paymentMethod) : null;
  const finalStateRegion = form.stateCode === "__manual_state__" ? form.manualStateRegion.trim() : form.stateRegion;
  const finalCity = form.city === "__manual__" ? form.manualCity.trim() : form.city;
  const selectedAmount = selectedCard ? convertEurCents(selectedCard.priceAmountCents, form.paymentCurrency) : 0;
  const formattedAmount = selectedCard ? formatPaymentAmount(selectedAmount, form.paymentCurrency) : "";
  const visibleCheckoutPaymentOptions = checkoutPaymentOptions.filter((method) => availablePaymentMethods.includes(method.id));
  const progress = ((step + 1) / steps.length) * 100;
  const applicationComplete =
    form.firstName &&
    form.lastName &&
    form.email &&
    form.phone &&
    form.country &&
    finalStateRegion &&
    finalCity &&
    form.numberApplicants;

  useEffect(() => {
    saveApplicationDraft(form);
  }, [form]);

  useEffect(() => {
    const returnState = consumeApplicationReturn();
    if (!returnState?.targetId) return;

    skipStepScrollRef.current = true;
    window.requestAnimationFrame(() => {
      const target = document.getElementById(returnState.targetId);
      if (!target) {
        window.scrollTo({ top: returnState.scrollY || 0, behavior: "auto" });
        window.setTimeout(() => {
          skipStepScrollRef.current = false;
        }, 300);
        return;
      }

      target.scrollIntoView({ block: "center", behavior: "auto" });
      target.classList.add("field-return-highlight");
      window.setTimeout(() => {
        target.classList.remove("field-return-highlight");
        skipStepScrollRef.current = false;
      }, 900);
    });
  }, []);

  useEffect(() => {
    if (previousStepRef.current === null) {
      previousStepRef.current = step;
      return;
    }

    if (previousStepRef.current === step) return;
    previousStepRef.current = step;

    if (skipStepScrollRef.current) return;

    const stepRefs = [membershipRef, applicationRef, reviewRef, paymentRef];
    const activeRef = stepRefs[step];

    window.requestAnimationFrame(() => {
      activeRef?.current?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  }, [step]);

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
    if (step !== 3 || !auth.isAuthenticated) return;

    let active = true;
    setPaymentAvailabilityLoading(true);
    setCheckoutError(null);

    getAvailableCheckoutPaymentMethods(form.paymentCurrency)
      .then((data) => {
        if (!active) return;
        const enabled = Array.isArray(data.enabledPaymentMethods) && data.enabledPaymentMethods.length ? data.enabledPaymentMethods : ["card"];
        setAvailablePaymentMethods(enabled);
        setForm((current) => (enabled.includes(current.paymentMethod) ? current : { ...current, paymentMethod: "card" }));
      })
      .catch(() => {
        if (!active) return;
        setAvailablePaymentMethods(["card"]);
        setForm((current) => (current.paymentMethod === "card" ? current : { ...current, paymentMethod: "card" }));
      })
      .finally(() => {
        if (active) setPaymentAvailabilityLoading(false);
      });

    return () => {
      active = false;
    };
  }, [auth.isAuthenticated, form.paymentCurrency, step]);

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
    if (field === "paymentMethod") setCheckoutError(null);
    setForm((current) => {
      if (field === "countryCode") {
        return { ...current, countryCode: value.code, country: value.name, stateCode: "", stateRegion: "", manualStateRegion: "", city: "", manualCity: "" };
      }
      if (field === "stateCode") {
        return { ...current, stateCode: value.code, stateRegion: value.name, manualStateRegion: "", city: "", manualCity: "" };
      }
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

  const openSelector = (path, targetId) => {
    saveApplicationDraft(form);
    saveApplicationReturn(targetId);
    navigate(path);
  };

  const handleContinueToPayment = async () => {
    console.info("[checkout/start]", {
      source: "final-payment-button",
      selectedCard: selectedCard?.id || "",
      paymentMethod: form.paymentMethod,
      currency: form.paymentCurrency
    });

    if (!selectedCard || !applicationComplete || !selectedPaymentMethod) {
      console.info("[checkout/blocked]", {
        source: "final-payment-button",
        reason: !selectedPaymentMethod ? "missing_payment_method" : "missing_application_details",
        hasSelectedCard: Boolean(selectedCard),
        applicationComplete: Boolean(applicationComplete),
        hasPaymentMethod: Boolean(selectedPaymentMethod)
      });
      setStepError("Select a payment method before continuing to secure checkout.");
      return;
    }
    if (!availablePaymentMethods.includes(form.paymentMethod)) {
      setStepError("");
      setCheckoutError({
        title: "Payment method unavailable",
        body: "This payment method is currently unavailable. Please choose another payment method."
      });
      return;
    }
    setCheckoutLoading(true);
    setStepError("");
    setCheckoutError(null);

    try {
      const saved = saveApplication({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        fullName: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        country: form.country.trim(),
        stateRegion: finalStateRegion,
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
      clearApplicationDraft();
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
      setStepError("");
      if (form.paymentMethod === "bank_transfer") {
        setAvailablePaymentMethods(["card"]);
        setForm((current) => ({ ...current, paymentMethod: "card" }));
      }
      setCheckoutError({
        title: "Checkout unavailable",
        body: "This payment method is currently unavailable. Please choose another payment method."
      });
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
            <div className="select-card-step application-step-anchor" ref={membershipRef}>
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
            <div className="membership-application-form application-step-anchor" ref={applicationRef}>
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
              <label className="wide">
                Selected membership card
                <div className="inline-choice-grid">
                  {cardTypes.map((card) => (
                    <button
                      key={card.id}
                      className={form.selectedCard === card.id ? "selected" : ""}
                      type="button"
                      onClick={() => updateField("selectedCard", card.id)}
                    >
                      <span>{card.name}</span>
                      <small>{card.price}</small>
                    </button>
                  ))}
                </div>
              </label>
              <label id="countryField" htmlFor="countrySelector">
                Country
                <button
                  id="countrySelector"
                  className="selector-page-trigger"
                  type="button"
                  onClick={() => openSelector("/apply/select-country", "countryField")}
                >
                  <span>{form.country || "Select country"}</span>
                </button>
              </label>
              <label id="stateField" htmlFor="stateSelector">
                State / Region
                <button
                  id="stateSelector"
                  className="selector-page-trigger"
                  type="button"
                  disabled={!form.countryCode}
                  onClick={() => openSelector("/apply/select-state", "stateField")}
                >
                  <span>{finalStateRegion || (form.countryCode ? "Select state or region" : "Select country first")}</span>
                </button>
              </label>
              {form.stateCode === "__manual_state__" ? (
                <label htmlFor="manualStateRegion">
                  Type state / region manually
                  <input
                    id="manualStateRegion"
                    required
                    placeholder="Enter your state or region"
                    value={form.manualStateRegion}
                    onChange={(e) => updateField("manualStateRegion", e.target.value)}
                  />
                </label>
              ) : null}
              <label id="cityField" htmlFor="citySelector">
                City
                <button
                  id="citySelector"
                  className="selector-page-trigger"
                  type="button"
                  disabled={!form.stateCode}
                  onClick={() => openSelector("/apply/select-city", "cityField")}
                >
                  <span>{finalCity || (form.stateCode ? "Select city" : "Select state or region first")}</span>
                </button>
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
              <label>
                Number of applicants
                <div className="applicant-choice-row">
                  {["1", "2", "3", "4", "5", "6+"].map((count) => (
                    <button
                      key={count}
                      className={form.numberApplicants === count ? "selected" : ""}
                      type="button"
                      onClick={() => updateField("numberApplicants", count)}
                    >
                      {count}
                    </button>
                  ))}
                </div>
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
            <div className="review-premium-panel conversion-review application-step-anchor" ref={reviewRef}>
              <div className="review-premium-heading">
                <span className="eyebrow">Application Review</span>
                <h3>Review Your Application</h3>
                <p>Please confirm your details before secure payment.</p>
              </div>

              <div className="review-membership-hero">
                <div className="review-membership-title">
                  <span>Selected membership</span>
                  <strong>{selectedCard?.name}</strong>
                  <small>{selectedCard?.benefits?.[0]}</small>
                </div>
                <div className="review-price-block">
                  <strong>{formattedAmount}</strong>
                  <span>
                    <BadgeCheck size={14} />
                    Ready for payment
                  </span>
                </div>
              </div>

              <div className="review-summary-grid">
                <ReviewSummaryCard
                  title="Applicant details"
                  items={[
                    { label: "Full name", value: `${form.firstName} ${form.lastName}`.trim(), Icon: User },
                    { label: "Email", value: form.email, Icon: Mail },
                    { label: "Phone", value: form.phone, Icon: Phone }
                  ]}
                />
                <ReviewSummaryCard
                  title="Location"
                  items={[
                    { label: "Country", value: form.country, Icon: Globe2 },
                    { label: "State / Region", value: finalStateRegion, Icon: MapPinned },
                    { label: "City", value: finalCity, Icon: MapPin }
                  ]}
                />
                <ReviewSummaryCard
                  title="Membership"
                  items={[
                    { label: "Selected card", value: selectedCard?.name, Icon: CreditCard },
                    { label: "Number of applicants", value: form.numberApplicants, Icon: Users },
                    { label: "Total amount", value: formattedAmount, Icon: Building2 }
                  ]}
                />
              </div>

              {form.message ? (
                <article className="review-message-card">
                  <span>Message or special request</span>
                  <p>{form.message}</p>
                </article>
              ) : null}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="payment-step website-checkout application-step-anchor" ref={paymentRef}>
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

              <div className="checkout-method-section">
                <div className="checkout-section-head">
                  <span className="eyebrow">Payment Method</span>
                  <h3>Choose Payment Method</h3>
                  <p>Select how you would like to continue. Stripe Checkout securely collects all payment details on the next screen.</p>
                </div>

                {paymentAvailabilityLoading ? (
                  <div className="payment-method-loading">Checking available payment methods...</div>
                ) : null}

                <div className="payment-method-grid website-method-grid" aria-label="Payment method options">
                  {visibleCheckoutPaymentOptions.map((method) => {
                    const Icon = paymentMethodIcons[method.id] || CreditCard;
                    return (
                      <button
                        key={method.id}
                        className={form.paymentMethod === method.id ? "payment-method-card selected" : "payment-method-card"}
                        type="button"
                        onClick={() => updateField("paymentMethod", method.id)}
                      >
                        <span className="payment-method-icon" aria-hidden="true">
                          <Icon size={18} />
                        </span>
                        <span>
                          <strong>{method.title}</strong>
                          <small>{method.description}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {checkoutError ? (
                <div className="checkout-error-card" role="alert">
                  <strong>{checkoutError.title}</strong>
                  <p>{checkoutError.body}</p>
                </div>
              ) : null}

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
              <button className={step === 2 ? "button primary review-continue-button" : "button primary"} type="button" onClick={nextStep}>
                {step === 0 ? "Continue" : step === 1 ? "Submit Application" : "Choose Payment Method"}
                <ArrowRight size={17} />
              </button>
            ) : form.paymentMethod ? (
              <button className="button primary checkout-continue-button" type="button" onClick={handleContinueToPayment} disabled={checkoutLoading}>
                {checkoutLoading ? "Opening checkout..." : "Continue to Secure Checkout"}
                <ArrowRight size={17} />
              </button>
            ) : (
              <span className="payment-method-required">Select a payment method to continue.</span>
            )}
          </div>

          {step === 0 ? (
            <section className="why-join-section" aria-labelledby="membership-experience-title">
              <div className="why-join-heading">
                <span className="eyebrow">The Membership Experience</span>
                <h3 id="membership-experience-title">More Than a Card. A Private Membership Experience.</h3>
                <p>
                  This membership is designed for dedicated supporters who want a more personal, premium, and recognized connection
                  to the official platform. Each card represents access, identity, priority support, and a place within an exclusive
                  digital membership community.
                </p>
              </div>
              <div className="why-join-grid">
                {membershipExperienceFeatures.map((feature) => (
                  <article className="why-join-card" key={feature.number}>
                    <span className="why-join-number">{feature.number}</span>
                    <h4>{feature.title}</h4>
                    <p>{feature.copy}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </form>
      </div>

    </section>
  );
}
