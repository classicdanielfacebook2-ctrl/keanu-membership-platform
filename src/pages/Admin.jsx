import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, CreditCard, PackageCheck, Users, XCircle } from "lucide-react";
import SectionHeader from "../components/SectionHeader.jsx";
import { cardTypes, paymentStatuses, reviewStatuses, shippingStatuses } from "../data/cards.js";
import { getApplications, updateApplication } from "../services/storage.js";

const cardName = (id) => cardTypes.find((card) => card.id === id)?.name || id;

export default function Admin() {
  const [applications, setApplications] = useState([]);

  useEffect(() => {
    setApplications(getApplications());
  }, []);

  const stats = useMemo(
    () => [
      { label: "Total applications", value: applications.length, icon: Users },
      {
        label: "Pending applications",
        value: applications.filter((item) => item.reviewStatus === "Pending Review").length,
        icon: Clock
      },
      {
        label: "Approved applications",
        value: applications.filter((item) => item.reviewStatus === "Approved").length,
        icon: CheckCircle2
      },
      {
        label: "Payments received",
        value: applications.filter((item) => item.paymentStatus === "Paid").length,
        icon: CreditCard
      }
    ],
    [applications]
  );

  const updateRecord = (id, field, value) => {
    setApplications(updateApplication(id, { [field]: value }));
  };

  return (
    <section className="page-section wide-page admin-page">
      <SectionHeader
        eyebrow="Admin Dashboard"
        title="Professional application control center."
        copy="Access is restricted to authenticated admin accounts. Application records still use local review storage until production application APIs and payment webhooks are connected."
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

      <div className="admin-table-wrap premium-panel">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Applicant</th>
              <th>Card Type</th>
              <th>Payment Status</th>
              <th>User Status</th>
              <th>Card Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {applications.length ? (
              applications.map((application) => (
                <tr key={application.id}>
                  <td>
                    <strong>{application.fullName}</strong>
                    <span>{application.email}</span>
                    <small>{new Date(application.createdAt).toLocaleDateString()}</small>
                  </td>
                  <td>{cardName(application.selectedCard)}</td>
                  <td>
                    <select
                      value={application.paymentStatus}
                      onChange={(e) => updateRecord(application.id, "paymentStatus", e.target.value)}
                    >
                      {paymentStatuses.map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={application.reviewStatus}
                      onChange={(e) => updateRecord(application.id, "reviewStatus", e.target.value)}
                    >
                      {reviewStatuses.map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={application.cardStatus}
                      onChange={(e) => updateRecord(application.id, "cardStatus", e.target.value)}
                    >
                      {shippingStatuses.map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="admin-actions">
                      <button type="button" onClick={() => updateRecord(application.id, "reviewStatus", "Approved")}>
                        <CheckCircle2 size={15} />
                        Approve
                      </button>
                      <button type="button" onClick={() => updateRecord(application.id, "reviewStatus", "Rejected")}>
                        <XCircle size={15} />
                        Reject
                      </button>
                      <button type="button" onClick={() => updateRecord(application.id, "cardStatus", "Processing")}>
                        <PackageCheck size={15} />
                        Processing
                      </button>
                      <button type="button" onClick={() => updateRecord(application.id, "cardStatus", "Delivered")}>
                        Delivered
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="empty-cell">
                  No applications yet. Submit a demo application to populate this dashboard.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
