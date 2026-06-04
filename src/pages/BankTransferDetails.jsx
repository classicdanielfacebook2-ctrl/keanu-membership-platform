import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Copy, Landmark, RefreshCcw } from "lucide-react";
import SectionHeader from "../components/SectionHeader.jsx";
import { cardTypes } from "../data/cards.js";
import { formatPaymentAmount } from "../data/paymentMethods.js";
import { getPaymentStatus, renewBankTransferInstructions } from "../services/stripeCheckout.js";

const cardName = (id, fallback = "") => cardTypes.find((card) => card.id === id)?.name || fallback || "Membership";
const sessionExpired = (payment) => {
  const expiresAt = payment?.stripeSessionExpiresAt || payment?.stripe_session_expires_at || "";
  return expiresAt ? new Date(expiresAt).getTime() <= Date.now() : false;
};

export default function BankTransferDetails() {
  const { applicationId = "" } = useParams();
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [renewing, setRenewing] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const loadPayment = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getPaymentStatus(applicationId);
      setPayment(data.payment);
    } catch (err) {
      setError(err?.message || "Bank transfer record could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayment();
  }, [applicationId]);

  const amount = useMemo(
    () => (payment ? formatPaymentAmount(payment.amount || 0, String(payment.currency || "EUR").toUpperCase()) : ""),
    [payment]
  );
  const reference = payment?.referenceId || payment?.applicationId || "";
  const iban = payment?.iban || payment?.bankIban || payment?.stripeBankIban || payment?.stripe_bank_iban || "";

  const copyText = async (label, value) => {
    if (!value) return;
    await navigator.clipboard?.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1800);
  };

  const openOrRenewInstructions = async () => {
    if (!payment) return;
    const checkoutUrl = payment.stripeCheckoutUrl || payment.stripe_checkout_url || "";
    if (checkoutUrl && !sessionExpired(payment)) {
      window.location.href = checkoutUrl;
      return;
    }

    setRenewing(true);
    setError("");
    try {
      const session = await renewBankTransferInstructions(applicationId);
      if (!session.url) throw new Error("Transfer instructions could not be generated.");
      window.location.href = session.url;
    } catch (err) {
      setError(err?.message || "Transfer instructions could not be generated.");
      setRenewing(false);
    }
  };

  return (
    <section className="page-section wide-page banking-dashboard">
      <SectionHeader
        eyebrow="Bank Transfer"
        title="Transfer instructions."
        copy="Use the exact amount and reference shown below. Stripe confirms the transfer automatically after receipt."
      />

      <div className="payment-detail-shell banking-panel">
        {loading ? (
          <div className="account-empty-state">Loading bank transfer details...</div>
        ) : error ? (
          <div className="account-empty-state">
            <RefreshCcw size={34} />
            <h3>Bank details unavailable</h3>
            <p>{error}</p>
          </div>
        ) : (
          <>
            <div className="payment-detail-header">
              <span className="status-icon awaiting-bank-transfer">
                <Landmark size={22} />
              </span>
              <div>
                <span className="eyebrow">Awaiting Transfer</span>
                <h3>{cardName(payment.selectedCard, payment.cardName)}</h3>
                <p>
                  Send the exact amount using Stripe’s hosted bank instructions. If the session expires, generate new transfer
                  instructions before sending funds.
                </p>
              </div>
            </div>

            <div className="transfer-instruction-grid">
              <div>
                <span>Amount</span>
                <strong>{amount}</strong>
              </div>
              <div>
                <span>Currency</span>
                <strong>{String(payment.currency || "EUR").toUpperCase()}</strong>
              </div>
              <div>
                <span>Reference</span>
                <strong>{reference}</strong>
              </div>
              <div>
                <span>IBAN</span>
                <strong>{iban || "Shown securely by Stripe"}</strong>
              </div>
            </div>

            <div className="bank-transfer-message compact-transfer-note">
              <strong>Important</strong>
              <p>
                Membership activates only after Stripe confirms the transfer. Normal bank transfers may take 1-3 business days.
              </p>
            </div>

            <div className="payment-actions compact-actions">
              <button className="button primary" type="button" onClick={openOrRenewInstructions} disabled={renewing}>
                {sessionExpired(payment) || payment.paymentStatus === "Expired" ? "Generate New Transfer Instructions" : "Open Stripe Bank Details"}
                <ArrowRight size={17} />
              </button>
              <button className="button secondary" type="button" onClick={() => copyText("IBAN", iban)} disabled={!iban}>
                <Copy size={16} />
                Copy IBAN
              </button>
              <button className="button secondary" type="button" onClick={() => copyText("Reference", reference)} disabled={!reference}>
                <Copy size={16} />
                Copy Reference
              </button>
              <button className="button secondary" type="button" onClick={loadPayment}>
                <RefreshCcw size={17} />
                Refresh Status
              </button>
              <Link className="button secondary" to={`/account/payment/${applicationId}`}>
                Back to Details
              </Link>
            </div>
            {copied ? <div className="notice success">{copied} copied.</div> : null}
          </>
        )}
      </div>
    </section>
  );
}
