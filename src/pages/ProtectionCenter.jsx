import { useState } from "react";
import { AlertTriangle, FileUp, LockKeyhole, ShieldCheck } from "lucide-react";
import SectionHeader from "../components/SectionHeader.jsx";
import { saveProtectionReport } from "../services/storage.js";

const incidentTypes = [
  "Impersonation Report",
  "Payment Fraud",
  "Unauthorized Membership Seller",
  "Fake Social Media Account",
  "Account Security Concern",
  "Refund Review Request"
];

const emptyReport = {
  fullName: "",
  email: "",
  phone: "",
  country: "",
  incidentType: incidentTypes[0],
  platformUsed: "",
  suspectProfile: "",
  amountLost: "",
  incidentDate: "",
  transactionReference: "",
  explanation: ""
};

const readEvidenceFiles = (files) =>
  Promise.all(
    [...files].slice(0, 6).map(
      (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve({
              name: file.name,
              type: file.type,
              size: file.size,
              dataUrl: reader.result
            });
          reader.onerror = reject;
          reader.readAsDataURL(file);
        })
    )
  );

export default function ProtectionCenter() {
  const [report, setReport] = useState(emptyReport);
  const [evidence, setEvidence] = useState([]);
  const [submittedCase, setSubmittedCase] = useState(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [emailStatus, setEmailStatus] = useState("");

  const updateField = (field, value) => setReport((current) => ({ ...current, [field]: value }));

  const handleEvidence = async (event) => {
    const files = event.target.files || [];
    if (!files.length) return;
    setLoadingFiles(true);
    try {
      const loaded = await readEvidenceFiles(files);
      setEvidence((current) => [...current, ...loaded].slice(0, 8));
    } finally {
      setLoadingFiles(false);
      event.target.value = "";
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const saved = saveProtectionReport({ ...report, evidence });
    setSubmittedCase(saved);
    setReport(emptyReport);
    setEvidence([]);
    setEmailStatus("Confirmation email pending.");

    try {
      const response = await fetch("/api/protection/confirmation-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: saved.email,
          fullName: saved.fullName,
          caseId: saved.caseId,
          timestamp: saved.createdAt,
          reportType: saved.incidentType,
          supportReference: "Member Protection Center"
        })
      });
      if (!response.ok) throw new Error("Confirmation email could not be sent.");
      setEmailStatus("Confirmation email sent.");
    } catch {
      setEmailStatus("Confirmation email could not be sent. Your case was still recorded.");
    }
  };

  return (
    <section className="page-section protection-page">
      <SectionHeader
        eyebrow="Security"
        title="Member Protection Center"
        copy="Report impersonation, fraudulent activity, unauthorized payment requests, or membership-related security concerns."
      />

      <div className="protection-shell">
        <aside className="protection-summary">
          <div className="protection-icon">
            <ShieldCheck size={24} />
          </div>
          <h2>Security review intake</h2>
          <p>Submit details clearly so the security team can review the report and request additional evidence if needed.</p>
          <div className="protection-note">
            <LockKeyhole size={17} />
            <span>Eligible cases may qualify for reimbursement review following internal investigation and verification.</span>
          </div>
          <div className="protection-note">
            <LockKeyhole size={17} />
            <span>Submitting a report does not guarantee compensation approval.</span>
          </div>
          <div className="protection-warning">
            <AlertTriangle size={17} />
            <span>False reports or manipulated evidence may result in account restrictions and legal escalation.</span>
          </div>
        </aside>

        <form className="protection-form" onSubmit={handleSubmit}>
          {submittedCase ? (
            <div className="case-confirmation">
              <strong>Your report has been received and will be reviewed by the security team.</strong>
              <span>Case ID: {submittedCase.caseId}</span>
              {emailStatus ? <small>{emailStatus}</small> : null}
            </div>
          ) : null}

          <div className="form-grid protection-form-grid">
            <label htmlFor="protectionName">
              Full Name
              <input id="protectionName" required value={report.fullName} onChange={(event) => updateField("fullName", event.target.value)} />
            </label>
            <label htmlFor="protectionEmail">
              Email Address
              <input
                id="protectionEmail"
                required
                inputMode="email"
                value={report.email}
                onChange={(event) => updateField("email", event.target.value)}
              />
            </label>
            <label htmlFor="protectionPhone">
              Phone Number
              <input id="protectionPhone" inputMode="tel" value={report.phone} onChange={(event) => updateField("phone", event.target.value)} />
            </label>
            <label htmlFor="protectionCountry">
              Country
              <input id="protectionCountry" required value={report.country} onChange={(event) => updateField("country", event.target.value)} />
            </label>
            <label htmlFor="incidentType">
              Incident Type
              <select id="incidentType" value={report.incidentType} onChange={(event) => updateField("incidentType", event.target.value)}>
                {incidentTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label htmlFor="platformUsed">
              Platform Used
              <input
                id="platformUsed"
                placeholder="Instagram, WhatsApp, email, website..."
                value={report.platformUsed}
                onChange={(event) => updateField("platformUsed", event.target.value)}
              />
            </label>
            <label className="wide" htmlFor="suspectProfile">
              Suspect Name or Profile Link
              <input id="suspectProfile" value={report.suspectProfile} onChange={(event) => updateField("suspectProfile", event.target.value)} />
            </label>
            <label htmlFor="amountLost">
              Amount Lost
              <input id="amountLost" placeholder="Optional" value={report.amountLost} onChange={(event) => updateField("amountLost", event.target.value)} />
            </label>
            <label htmlFor="incidentDate">
              Date of Incident
              <input id="incidentDate" type="date" value={report.incidentDate} onChange={(event) => updateField("incidentDate", event.target.value)} />
            </label>
            <label className="wide" htmlFor="transactionReference">
              Transaction Reference / Wallet Address / Payment Method
              <input
                id="transactionReference"
                value={report.transactionReference}
                onChange={(event) => updateField("transactionReference", event.target.value)}
              />
            </label>
            <label className="wide" htmlFor="explanation">
              Detailed Explanation
              <textarea
                id="explanation"
                required
                rows="6"
                value={report.explanation}
                onChange={(event) => updateField("explanation", event.target.value)}
              />
            </label>
          </div>

          <label className="evidence-upload" htmlFor="evidenceUpload">
            <FileUp size={20} />
            <span>
              <strong>Evidence Upload</strong>
              Screenshots, receipts, PDFs, transaction proof, or chat screenshots
            </span>
            <input
              id="evidenceUpload"
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx"
              hidden
              onChange={handleEvidence}
            />
          </label>

          {evidence.length ? (
            <div className="evidence-list">
              {evidence.map((file) => (
                <span key={`${file.name}-${file.size}`}>{file.name}</span>
              ))}
            </div>
          ) : null}

          <button className="button primary submit-button" type="submit" disabled={loadingFiles}>
            <ShieldCheck size={17} />
            Submit Security Report
          </button>
        </form>
      </div>
    </section>
  );
}
