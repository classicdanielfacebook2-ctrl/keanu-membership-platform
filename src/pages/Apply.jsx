import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, CreditCard, ShieldCheck } from "lucide-react";
import CardType from "../components/CardType.jsx";
import SectionHeader from "../components/SectionHeader.jsx";
import { cardTypes } from "../data/cards.js";
import { saveApplication } from "../services/storage.js";
import { useAuth } from "../context/AuthContext.jsx";

const emptyForm = {
  fullName: "",
  email: "",
  phone: "",
  country: "",
  selectedCard: "",
  preferredContactMethod: "Email",
  paymentMethod: "Stripe Checkout"
};

const steps = ["Choose Card", "Apply", "Review", "Payment", "Confirmation"];

export default function Apply() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const requestedCard = params.get("card") || sessionStorage.getItem("pendingMembershipCard") || "";
  const initialCard = cardTypes.some((card) => card.id === requestedCard) ? requestedCard : "";
  const [step, setStep] = useState(initialCard ? 1 : 0);
  const [form, setForm] = useState({ ...emptyForm, selectedCard: initialCard });
  const [submitted, setSubmitted] = useState(null);
  const [stepError, setStepError] = useState("");

  const selectedCard = cardTypes.find((card) => card.id === form.selectedCard) || null;
  const progress = ((step + 1) / steps.length) * 100;
  const applicationComplete = form.fullName && form.email && form.phone && form.country && form.preferredContactMethod;

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.isAuthenticated) {
      if (form.selectedCard) sessionStorage.setItem("pendingMembershipCard", form.selectedCard);
      sessionStorage.setItem("pendingMembershipAction", "apply");
      navigate(`/login?returnTo=${encodeURIComponent(form.selectedCard ? `/apply?card=${form.selectedCard}` : "/apply")}`, {
        replace: true
      });
    }
  }, [auth.loading, auth.isAuthenticated, form.selectedCard, navigate]);

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
    return Boolean(submitted);
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

  const handleContinueToPayment = (event) => {
    event.preventDefault();
    if (!selectedCard || !applicationComplete) {
      setStepError("Review the selected card and applicant details before payment.");
      return;
    }

    // Backend later: replace local storage with a secure application API and database write.
    const saved = saveApplication({
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      country: form.country.trim(),
      selectedCard: selectedCard.id,
      preferredContactMethod: form.preferredContactMethod,
      paymentMethod: "Stripe Checkout"
    });

    setSubmitted(saved);
    sessionStorage.removeItem("pendingMembershipCard");
    sessionStorage.removeItem("pendingMembershipAction");
    setStepError("");
    setStep(4);
  };

  return (
    <section className="page-section application-page">
      <SectionHeader
        eyebrow="Membership Application"
        title="A clear application path from card selection to confirmation."
        copy="Choose a membership level, complete applicant details, confirm the information, then continue to the secure payment stage."
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

        <form className="form-panel step-form conversion-panel" onSubmit={handleContinueToPayment}>
          {step === 0 ? (
            <div className="select-card-step">
              <div className="compact-card-grid">
                {cardTypes.map((card) => (
                  <button
                    key={card.id}
                    className={form.selectedCard === card.id ? "card-choice selected" : "card-choice"}
                    type="button"
                    onClick={() => updateField("selectedCard", card.id)}
                  >
                    <span>{card.name}</span>
                    <strong>{card.price}</strong>
                    <small>{card.benefits.slice(0, 2).join(" / ")}</small>
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
            <div className="payment-step conversion-payment">
              <div className="secure-box payment-summary-box">
                <CreditCard size={28} />
                <div>
                  <span className="eyebrow">Payment Summary</span>
                  <h3>{selectedCard?.name}</h3>
                  <p>{selectedCard?.price}</p>
                </div>
              </div>
              <div className="review-details">
                <span>Selected Card</span>
                <strong>{selectedCard?.name}</strong>
                <span>Amount Due</span>
                <strong>{selectedCard?.price}</strong>
                <span>Applicant Name</span>
                <strong>{form.fullName}</strong>
                <span>Payment Method</span>
                <strong>{form.paymentMethod}</strong>
              </div>
              <div className="payment-note">
                <ShieldCheck size={18} />
                  <span>Payment continues through Stripe Checkout. Card details are entered only on Stripe's secure payment page.</span>
              </div>
            </div>
          ) : null}

          {step === 4 && submitted ? (
            <div className="confirmation-panel">
              <CheckCircle2 size={36} />
              <span className="eyebrow">Confirmation</span>
              <h3>Application received</h3>
              <div className="review-details">
                <span>Application Reference ID</span>
                <strong>{submitted.referenceId || submitted.id}</strong>
                <span>Selected Membership Card</span>
                <strong>{selectedCard?.name || cardTypes.find((card) => card.id === submitted.selectedCard)?.name}</strong>
                <span>Status</span>
                <strong>Pending</strong>
              </div>
              <p>
                Your application has been received and is pending. The next step is payment
                provider confirmation for your selected membership.
              </p>
              <div className="hero-actions">
                <Link className="button primary" to={`/payment?application=${submitted.id}`}>
                  Pay Securely with Stripe
                  <ArrowRight size={17} />
                </Link>
                <Link className="button secondary" to="/cards">
                  View Card Options
                </Link>
                <Link className="button ghost" to="/support">
                  Contact Support
                </Link>
              </div>
            </div>
          ) : null}

          {stepError ? <div className="notice warning">{stepError}</div> : null}

          {step < 4 ? (
            <div className="step-actions">
              <button className="button ghost" type="button" onClick={previousStep} disabled={step === 0}>
                <ArrowLeft size={17} />
                Back
              </button>
              {step < 3 ? (
                <button className="button primary" type="button" onClick={nextStep}>
                  Next
                  <ArrowRight size={17} />
                </button>
              ) : (
                <button className="button primary" type="submit">
                  Confirm Application
                  <ArrowRight size={17} />
                </button>
              )}
            </div>
          ) : null}
        </form>
      </div>

      {selectedCard && step < 4 ? (
        <aside className="selected-card-preview">
          <CardType card={selectedCard} compact hideActions />
        </aside>
      ) : null}
    </section>
  );
}
