import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Upload } from "lucide-react";
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
  address: "",
  dateOfBirth: "",
  selectedCard: "silver",
  reason: "",
  documentName: ""
};

const steps = ["Select Card", "Personal Info", "Review", "Payment"];

export default function Apply() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const initialCard = useMemo(() => {
    const requested = params.get("card") || sessionStorage.getItem("pendingMembershipCard");
    return cardTypes.some((card) => card.id === requested) ? requested : "silver";
  }, [params]);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ ...emptyForm, selectedCard: initialCard });
  const [submitted, setSubmitted] = useState(null);
  const [stepError, setStepError] = useState("");

  const selectedCard = cardTypes.find((card) => card.id === form.selectedCard) || cardTypes[0];
  const progress = ((step + 1) / steps.length) * 100;
  const personalComplete =
    form.fullName && form.email && form.phone && form.country && form.address && form.dateOfBirth;
  const reviewComplete = personalComplete && form.selectedCard && form.reason;
  const canSubmit = reviewComplete;

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.isAuthenticated) {
      sessionStorage.setItem("pendingMembershipCard", form.selectedCard || initialCard);
      sessionStorage.setItem("pendingMembershipAction", "apply");
      navigate(`/login?returnTo=${encodeURIComponent(`/apply?card=${form.selectedCard || initialCard}`)}`, {
        replace: true
      });
    }
  }, [auth.loading, auth.isAuthenticated, form.selectedCard, initialCard, navigate]);

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
    if (targetStep <= 1) return true;
    if (targetStep === 2) return Boolean(personalComplete);
    return Boolean(reviewComplete);
  };

  const nextStep = () => {
    if (step === 1 && !personalComplete) {
      setStepError("Complete all personal information before continuing.");
      return;
    }
    if (step === 2 && !reviewComplete) {
      setStepError("Add the reason for applying before continuing to payment.");
      return;
    }
    setStepError("");
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const previousStep = () => {
    setStepError("");
    setStep((current) => Math.max(current - 1, 0));
  };

  const goToStep = (targetStep) => {
    if (!canEnterStep(targetStep)) {
      setStepError("Finish the required details before opening that step.");
      return;
    }
    setStepError("");
    setStep(targetStep);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canSubmit) {
      setStepError("Complete the required application details before submitting.");
      return;
    }
    // Backend later: send application data and document metadata to a secure API.
    const saved = saveApplication(form);
    setSubmitted(saved);
    sessionStorage.removeItem("pendingMembershipCard");
    sessionStorage.removeItem("pendingMembershipAction");
    setStep(0);
    setForm({ ...emptyForm, selectedCard: initialCard });
  };

  return (
    <section className="page-section application-page">
      <SectionHeader
        eyebrow="Application"
        title="Apply through a guided review process."
        copy="The application flow stores demo records locally for management review. Document upload and payment confirmation remain placeholders until secure backend services are connected."
      />

      {submitted ? (
        <div className="notice success">
          <CheckCircle2 size={18} />
          Application saved for {submitted.fullName}. Reference ID: <strong>{submitted.id}</strong>
        </div>
      ) : null}

      <div className="application-shell">
        <aside className="application-summary">
          <CardType card={selectedCard} compact />
        </aside>

        <form className="form-panel step-form" onSubmit={handleSubmit}>
          <div className="progress-header">
            <div>
              <span className="eyebrow">Step {step + 1} of {steps.length}</span>
              <h2>{steps[step]}</h2>
            </div>
            <div className="progress-track" aria-label="Application progress">
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="step-tabs" aria-label="Application steps">
            {steps.map((item, index) => (
              <button
                key={item}
                className={index === step ? "active" : ""}
                type="button"
                onClick={() => goToStep(index)}
                disabled={!canEnterStep(index)}
              >
                {index + 1}. {item}
              </button>
            ))}
          </div>

          {step === 0 ? (
            <div className="card-choice-grid">
              {cardTypes.map((card) => (
                <button
                  key={card.id}
                  className={form.selectedCard === card.id ? "card-choice selected" : "card-choice"}
                  type="button"
                  onClick={() => updateField("selectedCard", card.id)}
                >
                  <span>{card.name}</span>
                  <strong>{card.price}</strong>
                </button>
              ))}
            </div>
          ) : null}

          {step === 1 ? (
            <div className="form-grid">
              <label htmlFor="fullName">
                Full name
                <input id="fullName" required value={form.fullName} onChange={(e) => updateField("fullName", e.target.value)} />
              </label>
              <label htmlFor="email">
                Email
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
                Phone number
                <input id="phone" required value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
              </label>
              <label htmlFor="country">
                Country
                <input id="country" required value={form.country} onChange={(e) => updateField("country", e.target.value)} />
              </label>
              <label className="wide" htmlFor="address">
                Address
                <input id="address" required value={form.address} onChange={(e) => updateField("address", e.target.value)} />
              </label>
              <label htmlFor="dateOfBirth">
                Date of birth
                <input
                  id="dateOfBirth"
                  required
                  inputMode="numeric"
                  placeholder="YYYY-MM-DD"
                  pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}"
                  value={form.dateOfBirth}
                  onChange={(e) => updateField("dateOfBirth", e.target.value)}
                />
              </label>
              <label className="upload-control" htmlFor="documentUpload">
                <Upload size={19} />
                <span>{form.documentName || "Upload document placeholder"}</span>
                <input
                  id="documentUpload"
                  type="file"
                  onChange={(e) => updateField("documentName", e.target.files?.[0]?.name || "")}
                />
              </label>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="review-panel">
              <label htmlFor="selectedCard">
                Selected card type
                <select id="selectedCard" value={form.selectedCard} onChange={(e) => updateField("selectedCard", e.target.value)}>
                  {cardTypes.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.name}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="reason">
                Reason for applying
                <textarea id="reason" required rows="6" value={form.reason} onChange={(e) => updateField("reason", e.target.value)} />
              </label>
              <div className="review-details">
                <span>Applicant</span>
                <strong>{form.fullName || "Not entered"}</strong>
                <span>Document</span>
                <strong>{form.documentName || "Placeholder only"}</strong>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="payment-step">
              <div className="secure-box">
                <CheckCircle2 size={26} />
                <div>
                  <h3>{selectedCard.name}</h3>
                  <p>{selectedCard.price}</p>
                </div>
              </div>
              <p>
                Payments will be processed only through an approved secure payment provider. No card
                details are collected manually in this review build.
              </p>
              <Link className="button secondary" to={`/payment?card=${selectedCard.id}`}>
                Review Payment Page
              </Link>
            </div>
          ) : null}

          {stepError ? <div className="notice warning">{stepError}</div> : null}

          <div className="step-actions">
            <button className="button ghost" type="button" onClick={previousStep} disabled={step === 0}>
              <ArrowLeft size={17} />
              Back
            </button>
            {step < steps.length - 1 ? (
              <button className="button primary" type="button" onClick={nextStep}>
                Next
                <ArrowRight size={17} />
              </button>
            ) : (
              <button className="button primary" type="submit" disabled={!canSubmit}>
                Submit Application
              </button>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}
