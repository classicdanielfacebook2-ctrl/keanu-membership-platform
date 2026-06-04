import { useState } from "react";
import { BadgeCheck, ChevronDown, Clock, CreditCard, Fingerprint, LockKeyhole, Mail, MessageCircle, RotateCcw, Send, ShieldAlert, Sparkles } from "lucide-react";
import SectionHeader from "../components/SectionHeader.jsx";
import { saveSupportMessage } from "../services/storage.js";

const emptyMessage = { name: "", email: "", subject: "", message: "" };

const supportItems = [
  ["OTP & Verification", "Receive calm guidance for verification codes and account confirmation."],
  ["Account Recovery", "Reset access with your registered email address."],
  ["Membership Assistance", "Get help choosing a card tier or continuing an application."],
  ["Payment Support", "Check payment status and next steps through secure payment channels."]
];

const trustItems = ["SSL Secured Communication", "Verified Support Channel", "Encrypted Case Handling", "Privacy Protected"];

const protectionCards = [
  ["Report Fraud", "Submit impersonation, scam, or unauthorized seller concerns.", ShieldAlert],
  ["Refund Support", "Request assistance for eligible payment-related cases.", RotateCcw],
  ["Identity Impersonation", "Report fake profiles or identity misuse connected to membership.", Fingerprint],
  ["Payment Investigation", "Share transaction details for secure handling.", CreditCard]
];

const responseTimes = [
  ["Live Support", "under 10 minutes"],
  ["Fraud Support", "24-72 hours"],
  ["Refund Investigation", "3-7 business days"]
];

export default function Support() {
  const [form, setForm] = useState(emptyMessage);
  const [submittedCase, setSubmittedCase] = useState(null);
  const [openItem, setOpenItem] = useState("OTP & Verification");

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    const saved = saveSupportMessage(form);
    setForm(emptyMessage);
    setSubmittedCase(saved);
  };

  return (
    <section className="page-section support-page support-center">
      <SectionHeader
        eyebrow="Support"
        title="Member Services"
        copy="Private assistance for membership, verification, and account support."
      />

      <div className="official-support-badge">
        <BadgeCheck size={17} />
        Official Member Support
      </div>

      <div className="support-trust-bar" aria-label="Security and trust indicators">
        {trustItems.map((item) => (
          <span key={item}>
            <LockKeyhole size={14} />
            {item}
          </span>
        ))}
      </div>

      <div className="support-center-grid">
        <aside className="member-support-card">
          <div className="support-status-bar">
            <span className="status-dot" />
            <strong>Concierge online</strong>
            <small>Priority assistance available.</small>
          </div>

          <div className="support-preview-mini">
            <MessageCircle size={20} />
            <div>
              <h3>Open Member Support</h3>
              <p>Start a private conversation with the concierge assistant.</p>
            </div>
          </div>

          <button className="button primary" type="button" onClick={() => window.dispatchEvent(new Event("open-live-chat"))}>
            <Sparkles size={16} />
            Open Member Support
          </button>

          <a className="support-email-link" href="mailto:support@keanureeves.company">
            <Mail size={15} />
            support@keanureeves.company
          </a>

          <div className="review-time-card">
            <Clock size={16} />
            <div>
              <strong>Estimated response times</strong>
              {responseTimes.map(([label, time]) => (
                <span key={label}>
                  {label}: {time}
                </span>
              ))}
            </div>
          </div>
        </aside>

        <div className="support-content-stack">
          <div className="support-accordion">
            {supportItems.map(([title, copy]) => {
              const active = openItem === title;
              return (
                <article className={active ? "support-accordion-item open" : "support-accordion-item"} key={title}>
                  <button type="button" onClick={() => setOpenItem(active ? "" : title)}>
                    <span>{title}</span>
                    <ChevronDown size={17} />
                  </button>
                  <div className="support-accordion-copy">
                    <p>{copy}</p>
                  </div>
                </article>
              );
            })}
          </div>

          <form className="support-request-form" onSubmit={handleSubmit}>
            <div className="support-form-head">
              <h3>Contact Member Services</h3>
              <p>Send a concise request and the support team will respond.</p>
            </div>
            {submittedCase ? (
              <div className="notice success case-notice">
                <strong>Request received.</strong>
                <span>Case ID: {submittedCase.caseId}</span>
              </div>
            ) : null}
            <div className="form-grid support-form-grid">
              <label htmlFor="supportName">
                Name
                <input
                  id="supportName"
                  required
                  placeholder="Your name"
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                />
              </label>
              <label htmlFor="supportEmail">
                Email
                <input
                  id="supportEmail"
                  required
                  inputMode="email"
                  pattern="[^@\s]+@[^@\s]+\.[^@\s]+"
                  placeholder="Email address"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                />
              </label>
              <label className="wide" htmlFor="supportSubject">
                Subject
                <input
                  id="supportSubject"
                  required
                  placeholder="How can we help?"
                  value={form.subject}
                  onChange={(event) => updateField("subject", event.target.value)}
                />
              </label>
              <label className="wide" htmlFor="supportMessage">
                Message
                <textarea
                  id="supportMessage"
                  required
                  rows="4"
                  placeholder="Share a brief note"
                  value={form.message}
                  onChange={(event) => updateField("message", event.target.value)}
                />
              </label>
            </div>
            <button className="button primary submit-button" type="submit">
              <Send size={16} />
              Submit Request
            </button>
          </form>
        </div>
      </div>

      <section className="security-protection-section" aria-labelledby="securityProtectionTitle">
        <div>
          <span className="mini-eyebrow">Security & Trust</span>
          <h2 id="securityProtectionTitle">Security & Fraud Protection</h2>
          <p>
            Eligible cases may qualify for reimbursement support following internal investigation and verification.
            Submitting a report does not guarantee compensation approval.
          </p>
        </div>
        <div className="security-card-grid">
          {protectionCards.map(([title, copy, Icon]) => (
            <article className="security-trust-card" key={title}>
              <Icon size={19} />
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
