import { sendProtectionConfirmationEmail } from "../../serverless/protectionEmail.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const result = await sendProtectionConfirmationEmail({
      to: req.body?.to,
      fullName: req.body?.fullName,
      caseId: req.body?.caseId,
      timestamp: req.body?.timestamp,
      reportType: req.body?.reportType,
      supportReference: req.body?.supportReference
    });
    console.log("[protection/confirmation-email]", { message: "Protection confirmation email sent", caseId: req.body?.caseId });
    return res.status(200).json({ ok: true, id: result?.id });
  } catch (error) {
    console.error("[protection/confirmation-email]", {
      message: "Protection confirmation email failed",
      error: error?.message
    });
    return res.status(500).json({ error: error?.message || "Confirmation email failed." });
  }
}
