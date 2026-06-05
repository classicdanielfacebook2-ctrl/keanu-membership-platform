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
import { useLanguage } from "../context/LanguageContext.jsx";
import { getBankTransferRegion } from "../data/bankTransferRegions.js";
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

const paymentMethodIcons = {
  card: CreditCard,
  sepa: BadgeCheck,
  bank_transfer: Building2,
  ideal: Globe2
};

function ReviewSummaryCard({ title, items, notProvided }) {
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
              <strong>{value || notProvided}</strong>
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}

export default function Apply() {
  const { t } = useLanguage();
  const copy = t.apply;
  const steps = copy.steps;
  const membershipExperienceFeatures = copy.features.map(([number, title, featureCopy]) => ({ number, title, copy: featureCopy }));
  const getLocalizedCard = (card) => {
    const localized = copy.cards[card?.id];
    return {
      ...card,
      displayName: localized?.[0] || card?.name,
      displayBenefits: localized?.[1] || card?.benefits || []
    };
  };
  const getLocalizedPaymentMethod = (method) => {
    const localized = copy.paymentMethods[method?.id];
    return {
      ...method,
      displayTitle: localized?.[0] || method?.title,
      displayDescription: localized?.[1] || method?.description
    };
  };
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
  const displaySelectedCard = selectedCard ? getLocalizedCard(selectedCard) : null;
  const selectedPaymentMethod = form.paymentMethod ? getLocalizedPaymentMethod(getPaymentMethod(form.paymentMethod)) : null;
  const bankTransferRegion = getBankTransferRegion(form.countryCode);
  const finalStateRegion = form.stateCode === "__manual_state__" ? form.manualStateRegion.trim() : form.stateRegion;
  const finalCity = form.city === "__manual__" ? form.manualCity.trim() : form.city;
  const selectedAmount = selectedCard ? convertEurCents(selectedCard.priceAmountCents, form.paymentCurrency) : 0;
  const formattedAmount = selectedCard ? formatPaymentAmount(selectedAmount, form.paymentCurrency) : "";
  const visibleCheckoutPaymentOptions = checkoutPaymentOptions
    .filter((method) => availablePaymentMethods.includes(method.id))
    .map(getLocalizedPaymentMethod);
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

    getAvailableCheckoutPaymentMethods(form.paymentCurrency, form.countryCode)
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
  }, [auth.isAuthenticated, form.countryCode, form.paymentCurrency, step]);

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
      if (field === "paymentMethod" && value === "bank_transfer") {
        const region = getBankTransferRegion(current.countryCode);
        return { ...current, paymentMethod: value, paymentCurrency: region?.currency?.toUpperCase() || current.paymentCurrency };
      }
      if (field === "countryCode") {
        const nextRegion = getBankTransferRegion(value.code);
        return {
          ...current,
          countryCode: value.code,
          country: value.name,
          stateCode: "",
          stateRegion: "",
          manualStateRegion: "",
          city: "",
          manualCity: "",
          paymentMethod: current.paymentMethod === "bank_transfer" && !nextRegion ? "card" : current.paymentMethod,
          paymentCurrency: current.paymentMethod === "bank_transfer" && nextRegion ? nextRegion.currency.toUpperCase() : current.paymentCurrency
        };
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
      setStepError(copy.completePrevious);
      return;
    }
    setStepError("");
    setStep(targetStep);
  };

  const nextStep = () => {
    if (step === 0 && !form.selectedCard) {
      setStepError(copy.selectCardError);
      return;
    }
    if (step === 0 && auth.loading) {
      setStepError(copy.preparingSession);
      return;
    }
    if (step === 0 && !auth.isAuthenticated) {
      sessionStorage.setItem("pendingMembershipCard", form.selectedCard);
      sessionStorage.setItem("pendingMembershipAction", "apply");
      navigate(`/login?returnTo=${encodeURIComponent(`/apply?card=${form.selectedCard}`)}`);
      return;
    }
    if (step === 1 && !applicationComplete) {
      setStepError(copy.completeDetails);
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
      setStepError(copy.selectPayment);
      return;
    }
    if (!availablePaymentMethods.includes(form.paymentMethod)) {
      setStepError("");
      setCheckoutError({
        title: copy.unavailableTitle,
        body: copy.unavailableBody
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
        countryCode: form.countryCode,
        country: form.country.trim(),
        stateRegion: finalStateRegion,
        city: finalCity,
        numberApplicants: form.numberApplicants,
        message: form.message.trim(),
        selectedCard: selectedCard.id,
        paymentMethod: form.paymentMethod,
        paymentMethodLabel: selectedPaymentMethod.displayTitle,
        paymentCurrency: form.paymentMethod === "bank_transfer" && bankTransferRegion ? bankTransferRegion.currency.toUpperCase() : form.paymentCurrency,
        paymentAmount: formattedAmount
      });

      sessionStorage.setItem("pendingStripeApplicationId", saved.id);
      sessionStorage.removeItem("pendingMembershipCard");
      sessionStorage.removeItem("pendingMembershipAction");
      const session = await createCheckoutSession(saved, form.paymentMethod, saved.paymentCurrency);
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
        title: copy.checkoutUnavailableTitle,
        body: copy.checkoutUnavailableBody
      });
    }
  };

  return (
    <section className="page-section application-page">
      <SectionHeader
        eyebrow={copy.pageEyebrow}
        title={copy.pageTitle}
        copy={copy.pageCopy}
      />

      <div className="conversion-flow">
        <div className="progress-header conversion-progress">
          <div>
            <span className="eyebrow">{copy.step} {step + 1} {copy.of} {steps.length}</span>
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
                    {card.id === "vip" ? <span className="vip-badge"><Crown size={14} /> {copy.popular}</span> : null}
                    <span className="vip-card-kicker">{copy.membershipKicker}</span>
                    <span className="vip-card-title">{getLocalizedCard(card).displayName}</span>
                    <span className="vip-card-price">
                      {card.price}
                      <small>{copy.perPerson}</small>
                    </span>
                    <span className="vip-benefit-list">
                      {getLocalizedCard(card).displayBenefits.map((benefit) => (
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
                <span className="eyebrow">{copy.formEyebrow}</span>
                <h3>{copy.formTitle}</h3>
                <p>{copy.formCopy}</p>
              </div>

              <div className="form-grid luxury-application-grid">
              <label htmlFor="firstName">
                {copy.firstName}
                <input
                  id="firstName"
                  required
                  placeholder={copy.firstNamePlaceholder}
                  value={form.firstName}
                  onChange={(e) => updateField("firstName", e.target.value)}
                />
              </label>
              <label htmlFor="lastName">
                {copy.lastName}
                <input
                  id="lastName"
                  required
                  placeholder={copy.lastNamePlaceholder}
                  value={form.lastName}
                  onChange={(e) => updateField("lastName", e.target.value)}
                />
              </label>
              <label htmlFor="email">
                {copy.email}
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
                {copy.phone}
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
                {copy.selectedCard}
                <div className="inline-choice-grid">
                  {cardTypes.map((card) => (
                    <button
                      key={card.id}
                      className={form.selectedCard === card.id ? "selected" : ""}
                      type="button"
                      onClick={() => updateField("selectedCard", card.id)}
                    >
                      <span>{getLocalizedCard(card).displayName}</span>
                      <small>{card.price}</small>
                    </button>
                  ))}
                </div>
              </label>
              <label id="countryField" htmlFor="countrySelector">
                {copy.country}
                <button
                  id="countrySelector"
                  className="selector-page-trigger"
                  type="button"
                  onClick={() => openSelector("/apply/select-country", "countryField")}
                >
                  <span>{form.country || copy.selectCountry}</span>
                </button>
              </label>
              <label id="stateField" htmlFor="stateSelector">
                {copy.state}
                <button
                  id="stateSelector"
                  className="selector-page-trigger"
                  type="button"
                  disabled={!form.countryCode}
                  onClick={() => openSelector("/apply/select-state", "stateField")}
                >
                  <span>{finalStateRegion || (form.countryCode ? copy.selectState : copy.selectCountryFirst)}</span>
                </button>
              </label>
              {form.stateCode === "__manual_state__" ? (
                <label htmlFor="manualStateRegion">
                  {copy.manualState}
                  <input
                    id="manualStateRegion"
                    required
                    placeholder={copy.manualStatePlaceholder}
                    value={form.manualStateRegion}
                    onChange={(e) => updateField("manualStateRegion", e.target.value)}
                  />
                </label>
              ) : null}
              <label id="cityField" htmlFor="citySelector">
                {copy.city}
                <button
                  id="citySelector"
                  className="selector-page-trigger"
                  type="button"
                  disabled={!form.stateCode}
                  onClick={() => openSelector("/apply/select-city", "cityField")}
                >
                  <span>{finalCity || (form.stateCode ? copy.selectCity : copy.selectStateFirst)}</span>
                </button>
              </label>
              {form.city === "__manual__" ? (
                <label htmlFor="manualCity">
                  {copy.manualCity}
                  <input
                    id="manualCity"
                    required
                    placeholder={copy.manualCityPlaceholder}
                    value={form.manualCity}
                    onChange={(e) => updateField("manualCity", e.target.value)}
                  />
                </label>
              ) : null}
              <label>
                {copy.applicants}
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
                {copy.message}
                <textarea
                  id="message"
                  rows="5"
                  placeholder={copy.messagePlaceholder}
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
                <span className="eyebrow">{copy.reviewEyebrow}</span>
                <h3>{copy.reviewTitle}</h3>
                <p>{copy.reviewCopy}</p>
              </div>

              <div className="review-membership-hero">
                <div className="review-membership-title">
                  <span>{copy.selectedMembership}</span>
                  <strong>{selectedCard?.name}</strong>
                  <small>{displaySelectedCard?.displayBenefits?.[0]}</small>
                </div>
                <div className="review-price-block">
                  <strong>{formattedAmount}</strong>
                  <span>
                    <BadgeCheck size={14} />
                    {copy.readyForPayment}
                  </span>
                </div>
              </div>

              <div className="review-summary-grid">
                <ReviewSummaryCard
                  title={copy.applicantDetails}
                  notProvided={copy.notProvided}
                  items={[
                    { label: copy.fullName, value: `${form.firstName} ${form.lastName}`.trim(), Icon: User },
                    { label: copy.email, value: form.email, Icon: Mail },
                    { label: copy.phone, value: form.phone, Icon: Phone }
                  ]}
                />
                <ReviewSummaryCard
                  title={copy.location}
                  notProvided={copy.notProvided}
                  items={[
                    { label: copy.country, value: form.country, Icon: Globe2 },
                    { label: copy.state, value: finalStateRegion, Icon: MapPinned },
                    { label: copy.city, value: finalCity, Icon: MapPin }
                  ]}
                />
                <ReviewSummaryCard
                  title={copy.membership}
                  notProvided={copy.notProvided}
                  items={[
                    { label: copy.selectedCard, value: displaySelectedCard?.displayName, Icon: CreditCard },
                    { label: copy.numberApplicants, value: form.numberApplicants, Icon: Users },
                    { label: copy.totalAmount, value: formattedAmount, Icon: Building2 }
                  ]}
                />
              </div>

              {form.message ? (
                <article className="review-message-card">
                  <span>{copy.message}</span>
                  <p>{form.message}</p>
                </article>
              ) : null}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="payment-step website-checkout application-step-anchor" ref={paymentRef}>
              <div className="checkout-membership-summary">
                <div>
                  <span className="eyebrow">{copy.selectedMembership}</span>
                  <h3>{displaySelectedCard?.displayName}</h3>
                  <strong>{formattedAmount}</strong>
                </div>
                <ul>
                  {displaySelectedCard?.displayBenefits.slice(0, 3).map((benefit) => (
                    <li key={benefit}>{benefit}</li>
                  ))}
                </ul>
              </div>

              <div className="checkout-method-section">
                <div className="checkout-section-head">
                  <span className="eyebrow">{copy.paymentEyebrow}</span>
                  <h3>{copy.paymentTitle}</h3>
                  <p>{copy.paymentCopy}</p>
                </div>

                {paymentAvailabilityLoading ? (
                  <div className="payment-method-loading">{copy.checkingPayments}</div>
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
                          <strong>{method.displayTitle}</strong>
                          <small>{method.displayDescription}</small>
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
                  <span>{copy.totalAmount}</span>
                  <strong>{formattedAmount}</strong>
                </div>
                <p>
                  <ShieldCheck size={17} />
                  {copy.secureCheckout}
                </p>
              </div>
            </div>
          ) : null}

          {stepError ? <div className="notice warning">{stepError}</div> : null}

          <div className="step-actions">
            <button className="button ghost" type="button" onClick={previousStep} disabled={step === 0 || checkoutLoading}>
              <ArrowLeft size={17} />
              {copy.back}
            </button>
            {step < 3 ? (
              <button className={step === 2 ? "button primary review-continue-button" : "button primary"} type="button" onClick={nextStep}>
                {step === 0 ? copy.continue : step === 1 ? copy.submit : copy.choosePayment}
                <ArrowRight size={17} />
              </button>
            ) : form.paymentMethod ? (
              <button className="button primary checkout-continue-button" type="button" onClick={handleContinueToPayment} disabled={checkoutLoading}>
                {checkoutLoading ? copy.openingCheckout : copy.secureCheckoutButton}
                <ArrowRight size={17} />
              </button>
            ) : (
              <span className="payment-method-required">{copy.paymentRequired}</span>
            )}
          </div>

          {step === 0 ? (
            <section className="why-join-section" aria-labelledby="membership-experience-title">
              <div className="why-join-heading">
                <span className="eyebrow">{copy.whyEyebrow}</span>
                <h3 id="membership-experience-title">{copy.whyTitle}</h3>
                <p>{copy.whyCopy}</p>
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
