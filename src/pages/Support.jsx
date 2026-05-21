import { useState } from "react";
import { ChevronDown, Mail, MessageCircle, Send, Sparkles } from "lucide-react";
import SectionHeader from "../components/SectionHeader.jsx";
import { saveSupportMessage } from "../services/storage.js";

const emptyMessage = { name: "", email: "", subject: "", message: "" };

const supportItems = [
  ["OTP & Verification", "Receive calm guidance for verification codes and account confirmation."],
  ["Account Recovery", "Reset access with a registered email address or phone number."],
  ["Membership Assistance", "Get help choosing a card tier or continuing an application."],
  ["Payment Support", "Review payment status and next steps through approved payment channels."]
];

export default function Support() {
  const [form, setForm] = useState(emptyMessage);
  const [sent, setSent] = useState(false);
  const [openItem, setOpenItem] = useState("OTP & Verification");

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    saveSupportMessage(form);
    setForm(emptyMessage);
    setSent(true);
  };

  return (
    <section className="page-section support-page support-center">
      <SectionHeader
        eyebrow="Support"
        title="Member Services"
        copy="Private assistance for membership, verification, and account support."
      />

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
              <p>Send a concise request and the support team will review it.</p>
            </div>
            {sent ? <div className="notice success">Request received.</div> : null}
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
    </section>
  );
}
