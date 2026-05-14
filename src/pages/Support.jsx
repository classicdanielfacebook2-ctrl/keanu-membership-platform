import { useState } from "react";
import { Clock, Mail, MessageCircle, Send, Signal } from "lucide-react";
import SectionHeader from "../components/SectionHeader.jsx";
import { saveSupportMessage } from "../services/storage.js";

const emptyMessage = { name: "", email: "", subject: "", message: "" };

const faqs = [
  ["How long does approval take?", "Management review timing depends on application volume and verification needs."],
  ["Can I pay on this review site?", "No. Payment buttons are placeholders until an approved provider is connected."],
  ["Where will official media go?", "Approved videos and photos can replace the placeholder media blocks before launch."]
];

export default function Support() {
  const [form, setForm] = useState(emptyMessage);
  const [sent, setSent] = useState(false);

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    // Backend later: route support inquiries to CRM, live chat, or email provider.
    saveSupportMessage(form);
    setForm(emptyMessage);
    setSent(true);
  };

  return (
    <section className="page-section support-page">
      <SectionHeader
        eyebrow="Support"
        title="Premium support for applicants and reviewers."
        copy="Live chat and email support are ready for approved production tools. Average response time: under 10 minutes during support hours."
      />
      <div className="support-layout">
        <aside className="chat-panel premium-panel">
          <div className="agent-status">
            <span className="status-dot" />
            <Signal size={17} />
            Agent status: Online placeholder
          </div>
          <MessageCircle size={38} />
          <h3>Speak with an Agent</h3>
          <p>Average response time: under 10 minutes during support hours.</p>
          <button className="button primary" type="button">
            Open Chat Placeholder
          </button>
          <div className="chat-preview" aria-label="Live chat preview placeholder">
            <div className="chat-preview-header">
              <span className="status-dot" />
              <strong>Support Desk</strong>
              <small>Online</small>
            </div>
            <div className="chat-bubble agent">Welcome. An approved live chat tool will connect here.</div>
            <div className="chat-bubble user">I need help with my membership card application.</div>
            <div className="typing-dots" aria-label="Agent typing">
              <span />
              <span />
              <span />
            </div>
          </div>
          <div className="support-meta">
            <span>
              <Clock size={16} />
              Priority review queue
            </span>
            <span>
              <Mail size={16} />
              support@keanureeves.company
            </span>
          </div>
        </aside>

        <form className="form-panel premium-panel" onSubmit={handleSubmit}>
          {sent ? <div className="notice success">Support message saved for review.</div> : null}
          <div className="form-grid">
            <label htmlFor="supportName">
              Name
              <input id="supportName" required value={form.name} onChange={(e) => updateField("name", e.target.value)} />
            </label>
            <label htmlFor="supportEmail">
              Email
              <input
                id="supportEmail"
                required
                inputMode="email"
                pattern="[^@\s]+@[^@\s]+\.[^@\s]+"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
              />
            </label>
            <label className="wide" htmlFor="supportSubject">
              Subject
              <input id="supportSubject" required value={form.subject} onChange={(e) => updateField("subject", e.target.value)} />
            </label>
            <label className="wide" htmlFor="supportMessage">
              Message
              <textarea id="supportMessage" required rows="6" value={form.message} onChange={(e) => updateField("message", e.target.value)} />
            </label>
          </div>
          <button className="button primary submit-button" type="submit">
            <Send size={17} />
            Send Message
          </button>
        </form>
      </div>

      <div className="faq-grid">
        {faqs.map(([question, answer]) => (
          <article className="faq-item" key={question}>
            <h3>{question}</h3>
            <p>{answer}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
