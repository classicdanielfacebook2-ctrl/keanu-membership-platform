const COMPANY_NAME = "Keanu Reeves Company";
const SUPPORT_FROM_EMAIL = "support@keanureeves.company";

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return entities[character];
  });

const protectionConfirmationHtml = ({ fullName, caseId, timestamp, reportType, supportReference }) => `
  <div style="margin:0;padding:32px;background:#050505;color:#f7f3ea;font-family:Inter,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;border:1px solid rgba(244,216,139,.34);background:#0d0d0d;padding:32px;">
      <p style="margin:0 0 12px;color:#f4d88b;font-size:12px;letter-spacing:.18em;text-transform:uppercase;">${COMPANY_NAME}</p>
      <h1 style="margin:0 0 18px;font-family:Georgia,serif;font-size:30px;line-height:1.12;color:#fff9ed;">Security report received</h1>
      <p style="margin:0 0 18px;line-height:1.7;color:#cfc7ba;">Hello ${escapeHtml(fullName || "there")}, your report has been received and will be reviewed by the security team.</p>
      <div style="margin:22px 0;padding:18px;border:1px solid rgba(244,216,139,.26);background:#070707;color:#f4ead5;">
        <p style="margin:0 0 8px;"><strong>Case ID:</strong> ${escapeHtml(caseId)}</p>
        <p style="margin:0 0 8px;"><strong>Timestamp:</strong> ${escapeHtml(timestamp)}</p>
        <p style="margin:0 0 8px;"><strong>Report type:</strong> ${escapeHtml(reportType)}</p>
        <p style="margin:0;"><strong>Support reference:</strong> ${escapeHtml(supportReference)}</p>
      </div>
      <p style="margin:0;color:#a9a197;line-height:1.7;">Eligible cases may qualify for reimbursement review following internal investigation and verification. Submitting a report does not guarantee compensation approval.</p>
    </div>
  </div>
`;

export const sendProtectionConfirmationEmail = async ({ to, fullName, caseId, timestamp, reportType, supportReference }) => {
  if (!to || !caseId) {
    throw new Error("A recipient email and case ID are required.");
  }

  const apiKey = process.env.RESEND_API_KEY || "";
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY must be configured to send protection confirmations.");
    }
    console.warn("[development] Protection confirmation email skipped", { to, caseId });
    return { id: "development-protection-confirmation" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: `${COMPANY_NAME} <${SUPPORT_FROM_EMAIL}>`,
      to,
      subject: `${COMPANY_NAME} security report ${caseId}`,
      html: protectionConfirmationHtml({ fullName, caseId, timestamp, reportType, supportReference })
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || "Resend rejected the protection confirmation email.");
  }
  return data;
};
