import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, ShieldAlert } from "lucide-react";
import SectionHeader from "../components/SectionHeader.jsx";
import { getProtectionReports, protectionStatuses, updateProtectionReport } from "../services/storage.js";

export default function ProtectionAdmin() {
  const [reports, setReports] = useState([]);

  useEffect(() => {
    setReports(getProtectionReports());
  }, []);

  const stats = useMemo(
    () => [
      { label: "Total reports", value: reports.length, icon: ShieldAlert },
      { label: "In progress", value: reports.filter((report) => report.status === "In Progress").length, icon: AlertTriangle },
      { label: "Evidence required", value: reports.filter((report) => report.status === "Evidence Required").length, icon: FileText },
      { label: "Resolved / closed", value: reports.filter((report) => ["Resolved", "Closed"].includes(report.status)).length, icon: CheckCircle2 }
    ],
    [reports]
  );

  const updateReport = (id, updates) => {
    setReports(updateProtectionReport(id, updates));
  };

  return (
    <section className="page-section wide-page protection-admin-page">
      <SectionHeader
        eyebrow="Protection Admin"
        title="Member protection case management."
        copy="Manage submitted security reports, evidence, case status, and internal investigation notes."
      />

      <div className="dashboard-stats">
        {stats.map(({ label, value, icon: Icon }) => (
          <article className="stat-card" key={label}>
            <Icon size={22} />
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>

      <div className="protection-case-list">
        {reports.length ? (
          reports.map((report) => (
            <article className="protection-case-card" key={report.id}>
              <div className="case-card-head">
                <div>
                  <span>{report.caseId}</span>
                  <h3>{report.incidentType}</h3>
                  <p>
                    {report.fullName} · {report.email}
                  </p>
                </div>
                <select value={report.status} onChange={(event) => updateReport(report.id, { status: event.target.value })}>
                  {protectionStatuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </div>

              <div className="case-detail-grid">
                <span>
                  <strong>Platform</strong>
                  {report.platformUsed || "Not provided"}
                </span>
                <span>
                  <strong>Amount Lost</strong>
                  {report.amountLost || "Not provided"}
                </span>
                <span>
                  <strong>Incident Date</strong>
                  {report.incidentDate || "Not provided"}
                </span>
                <span>
                  <strong>Payment / Reference</strong>
                  {report.transactionReference || "Not provided"}
                </span>
                <span className="wide">
                  <strong>Suspect / Profile</strong>
                  {report.suspectProfile || "Not provided"}
                </span>
                <span className="wide">
                  <strong>Detailed Explanation</strong>
                  {report.explanation}
                </span>
              </div>

              <div className="evidence-admin-list">
                <strong>Evidence</strong>
                {report.evidence?.length ? (
                  report.evidence.map((file) => (
                    <a href={file.dataUrl} target="_blank" rel="noreferrer" key={`${report.id}-${file.name}`}>
                      {file.name}
                    </a>
                  ))
                ) : (
                  <span>No evidence uploaded</span>
                )}
              </div>

              <label className="internal-notes" htmlFor={`notes-${report.id}`}>
                Internal Notes
                <textarea
                  id={`notes-${report.id}`}
                  rows="3"
                  value={report.internalNotes || ""}
                  onChange={(event) => updateReport(report.id, { internalNotes: event.target.value })}
                />
              </label>

              <div className="admin-actions">
                <button type="button" onClick={() => updateReport(report.id, { status: "Resolved" })}>
                  Mark Resolved
                </button>
                <button type="button" onClick={() => updateReport(report.id, { status: "Closed" })}>
                  Close Case
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-cell protection-empty">No protection reports have been submitted.</div>
        )}
      </div>
    </section>
  );
}
