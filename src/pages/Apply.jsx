import { useEffect, useMemo, useState } from "react";
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
  paymentMethod: "card",
  paymentCurrency: "EUR"
};

const steps = ["Membership", "Application", "Review", "Secure Payment"];
const applicantOptions = [
  { value: "1", label: "1 person" },
  { value: "2", label: "2 people" },
  { value: "3", label: "3 people" },
  { value: "4", label: "4 people" },
  { value: "5", label: "5 people" },
  { value: "6+", label: "6 or more" }
];

function SearchableLocationSelect({
  id,
  label,
  value,
  options,
  placeholder,
  searchPlaceholder,
  emptyText = "No matching option found.",
  disabled = false,
  searchable = true,
  title,
  onSelect
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedOption = options.find((option) => option.value === value);
  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const manualOptions = options.filter((option) => String(option.value).startsWith("__"));
    const dataOptions = options.filter((option) => !String(option.value).startsWith("__"));
    if (!normalized) return [...dataOptions.slice(0, 219), ...manualOptions];

    return options
      .filter((option) => `${option.label} ${option.meta || ""}`.toLowerCase().includes(normalized))
      .slice(0, 220);
  }, [options, query]);

  const selectOption = (option) => {
    onSelect(option);
    setOpen(false);
    setQuery("");
  };

  useEffect(() => {
    if (!open) return undefined;

    const root = document.documentElement;
    const updateViewportMetrics = () => {
      const viewport = window.visualViewport;
      const viewportHeight = viewport?.height || window.innerHeight;
      const keyboardOffset = viewport
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0;

      root.style.setProperty("--visual-viewport-height", `${Math.ceil(viewportHeight)}px`);
      root.style.setProperty("--mobile-keyboard-offset", `${Math.ceil(keyboardOffset)}px`);
    };

    document.body.classList.add("location-sheet-open");
    updateViewportMetrics();
    window.visualViewport?.addEventListener("resize", updateViewportMetrics);
    window.visualViewport?.addEventListener("scroll", updateViewportMetrics);
    window.addEventListener("orientationchange", updateViewportMetrics);

    return () => {
      document.body.classList.remove("location-sheet-open");
      root.style.removeProperty("--visual-viewport-height");
      root.style.removeProperty("--mobile-keyboard-offset");
      window.visualViewport?.removeEventListener("resize", updateViewportMetrics);
      window.visualViewport?.removeEventListener("scroll", updateViewportMetrics);
      window.removeEventListener("orientationchange", updateViewportMetrics);
    };
  }, [open]);

  return (
    <label className="location-select-field" htmlFor={id}>
      {label}
      <button
        id={id}
        className={open ? "location-select-trigger open" : "location-select-trigger"}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selectedOption?.label || placeholder}</span>
        {selectedOption?.meta ? <small>{selectedOption.meta}</small> : null}
      </button>
      {open ? (
        <>
          <div className="location-select-backdrop" aria-hidden="true" onMouseDown={() => setOpen(false)} />
          <div className={searchable ? "location-select-menu" : "location-select-menu compact"} role="dialog" aria-label={label}>
            <div className="location-select-toolbar">
              <button className="location-select-close" type="button" onClick={() => setOpen(false)}>
                Back
              </button>
              <strong>{title || `Select ${label.toLowerCase()}`}</strong>
              {searchable ? (
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                />
              ) : null}
            </div>
            <div className="location-select-options" role="listbox">
              {filteredOptions.map((option) => (
                <button
                  key={option.value}
                  className={option.value === value ? "selected" : ""}
                  type="button"
                  onClick={() => selectOption(option)}
                >
                  <span>{option.label}</span>
                  {option.meta ? <small>{option.meta}</small> : null}
                </button>
              ))}
              {filteredOptions.length === 0 ? <p>{emptyText}</p> : null}
            </div>
          </div>
        </>
      ) : null}
    </label>
  );
}

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
  const [locationApi, setLocationApi] = useState(null);

  useEffect(() => {
    let active = true;
    import("country-state-city").then((module) => {
      if (!active) return;
      setLocationApi({ Country: module.Country, State: module.State, City: module.City });
    });

    return () => {
      active = false;
    };
  }, []);

  const selectedCard = cardTypes.find((card) => card.id === form.selectedCard) || null;
  const selectedPaymentMethod = getPaymentMethod(form.paymentMethod);
  const cardSelectOptions = useMemo(
    () => cardTypes.map((card) => ({ value: card.id, label: card.name, meta: card.price })),
    []
  );
  const countryOptions = useMemo(() => {
    if (!locationApi) return [];
    return locationApi.Country.getAllCountries().map((country) => ({
      value: country.isoCode,
      label: country.name,
      meta: country.flag || country.isoCode,
      country
    }));
  }, [locationApi]);
  const stateOptions = useMemo(() => {
    if (!locationApi || !form.countryCode) return [];
    const states = locationApi.State.getStatesOfCountry(form.countryCode);

    return states.map((state) => ({
      value: state.isoCode,
      label: state.name,
      meta: state.isoCode,
      state
    }));
  }, [form.countryCode, locationApi]);
  const stateSelectOptions = useMemo(
    () => [...stateOptions, { value: "__manual_state__", label: "State / region not listed", meta: "Type manually" }],
    [stateOptions]
  );
  const cityOptions = useMemo(() => {
    if (!locationApi || !form.countryCode || !form.stateCode) return [];
    if (form.stateCode === "__manual_state__") return [];
    return locationApi.City.getCitiesOfState(form.countryCode, form.stateCode).map((city) => ({
      value: city.name,
      label: city.name,
      meta: city.stateCode || form.stateCode,
      city
    }));
  }, [form.countryCode, form.stateCode, locationApi]);
  const citySelectOptions = useMemo(
    () => [...cityOptions, { value: "__manual__", label: "City not listed", meta: "Type manually" }],
    [cityOptions]
  );
  const finalStateRegion = form.stateCode === "__manual_state__" ? form.manualStateRegion.trim() : form.stateRegion;
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
    finalStateRegion &&
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
              <SearchableLocationSelect
                id="selectedCard"
                label="Selected membership card"
                value={form.selectedCard}
                options={cardSelectOptions}
                placeholder="Select a card"
                searchPlaceholder="Search membership card"
                searchable={false}
                title="Select membership card"
                onSelect={(option) => updateField("selectedCard", option.value)}
              />
              <SearchableLocationSelect
                id="country"
                label="Country"
                value={form.countryCode}
                options={countryOptions}
                placeholder={locationApi ? "Select country" : "Loading countries"}
                searchPlaceholder="Search country"
                disabled={!locationApi}
                title="Select country"
                onSelect={(option) => updateField("countryCode", { code: option.value, name: option.label })}
              />
              <SearchableLocationSelect
                id="stateRegion"
                label="State / Region"
                value={form.stateCode}
                options={stateSelectOptions}
                placeholder={form.countryCode ? "Select state or region" : "Select country first"}
                searchPlaceholder="Search state or region"
                disabled={!form.countryCode}
                emptyText="No state or region found for this country."
                title="Select state / region"
                onSelect={(option) => updateField("stateCode", { code: option.value, name: option.label })}
              />
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
              <SearchableLocationSelect
                id="city"
                label="City"
                value={form.city}
                options={citySelectOptions}
                placeholder={form.stateCode ? "Select a city" : "Select state or region first"}
                searchPlaceholder="Search city"
                disabled={!form.stateCode}
                emptyText="No city found. Choose manual entry."
                title="Select city"
                onSelect={(option) => updateField("city", option.value)}
              />
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
              <SearchableLocationSelect
                id="numberApplicants"
                label="Number of applicants"
                value={form.numberApplicants}
                options={applicantOptions}
                placeholder="Select number of applicants"
                searchPlaceholder="Search applicant count"
                searchable={false}
                title="Select applicants"
                onSelect={(option) => updateField("numberApplicants", option.value)}
              />
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
                <strong>{finalStateRegion}</strong>
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
