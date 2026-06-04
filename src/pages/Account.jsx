import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Clock3,
  CreditCard,
  History,
  LockKeyhole,
  LogOut,
  RefreshCcw,
  ShieldCheck,
  Smartphone,
  UserCircle,
  WalletCards,
  XCircle
} from "lucide-react";
import SectionHeader from "../components/SectionHeader.jsx";
import { cardTypes } from "../data/cards.js";
import { formatPaymentAmount } from "../data/paymentMethods.js";
import { getAccountPayments } from "../services/stripeCheckout.js";
import { useAuth } from "../context/AuthContext.jsx";

const historyStatuses = ["Paid", "Cancelled", "Expired", "Refunded"];
const pendingStatuses = ["Awaiting Bank Transfer", "Processing", "Partially Paid", "Pending"];

const cardName = (id, fallback = "") => cardTypes.find((card) => card.id === id)?.name || fallback || id || "Membership";
const money = (payment) => formatPaymentAmount(payment.amount || 0, String(payment.currency || "EUR").toUpperCase());
const paymentDate = (payment) => (payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : "Not available");

function AccountMenu({ onLogout }) {
  const items = [
    { to: "/account/personal", label: "Personal Details", copy: "Name, email, and mobile number", icon: UserCircle },
    { to: "/account/security", label: "Security & Privacy", copy: "Password, devices, and verification", icon: LockKeyhole },
    { to: "/account/payments", label: "Payments", copy: "Open and pending payments", icon: CreditCard },
    { to: "/account/payment-history", label: "Payment History", copy: "Completed and closed transactions", icon: History },
    { to: "/account/memberships", label: "Memberships", copy: "Membership cards and activation status", icon: WalletCards }
  ];

  return (
    <div className="account-menu-list">
      {items.map(({ to, label, copy, icon: Icon }) => (
        <Link className="account-menu-item" to={to} key={to}>
          <span className="account-menu-icon">
            <Icon size={19} />
          </span>
          <span>
            <strong>{label}</strong>
            <small>{copy}</small>
          </span>
          <ArrowRight size={17} />
        </Link>
      ))}
      <button className="account-menu-item logout-menu-item" type="button" onClick={onLogout}>
        <span className="account-menu-icon">
          <LogOut size={19} />
        </span>
        <span>
          <strong>Logout</strong>
          <small>Sign out of this account</small>
        </span>
        <ArrowRight size={17} />
      </button>
    </div>
  );
}

function PaymentCounts({ payments }) {
  const pending = payments.filter((payment) => pendingStatuses.includes(payment.paymentStatus || "Pending")).length;
  const paid = payments.filter((payment) => payment.paymentStatus === "Paid").length;
  const failed = payments.filter((payment) => ["Failed", "Expired"].includes(payment.paymentStatus)).length;

  return (
    <div className="banking-summary-grid">
      {[
        { label: "Pending", value: pending, icon: Clock3 },
        { label: "Paid", value: paid, icon: ShieldCheck },
        { label: "Failed", value: failed, icon: XCircle }
      ].map(({ label, value, icon: Icon }) => (
        <article className="banking-summary-card" key={label}>
          <Icon size={18} />
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </div>
  );
}

function CompactPayments({ payments, emptyText = "No payments found." }) {
  if (!payments.length) return <div className="banking-panel account-empty-state">{emptyText}</div>;

  return (
    <div className="banking-payment-list">
      {payments.map((payment) => (
        <article className="banking-payment-card" key={payment.id || payment.applicationId}>
          <div className="banking-payment-main">
            <div>
              <span>Membership</span>
              <strong>{cardName(payment.selectedCard, payment.cardName)}</strong>
            </div>
            <div>
              <span>Amount</span>
              <strong>{money(payment)}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong className={`mini-status ${(payment.paymentStatus || "Pending").toLowerCase().replace(/\s+/g, "-")}`}>
                {payment.paymentStatus || "Pending"}
              </strong>
            </div>
            <div>
              <span>Date</span>
              <strong>{paymentDate(payment)}</strong>
            </div>
          </div>
          <Link className="review-payment-button" to={`/account/payment/${payment.applicationId}`}>
            Review
            <ArrowRight size={15} />
          </Link>
        </article>
      ))}
    </div>
  );
}

function PaymentHistory({ payments }) {
  if (!payments.length) return <div className="banking-panel account-empty-state">No payment history yet.</div>;

  return (
    <div className="transaction-list">
      {payments.map((payment) => (
        <Link className="transaction-row" to={`/account/payment/${payment.applicationId}`} key={payment.id || payment.applicationId}>
          <span className="transaction-icon">
            <CreditCard size={17} />
          </span>
          <span>
            <strong>{cardName(payment.selectedCard, payment.cardName)}</strong>
            <small>{paymentDate(payment)} • {payment.paymentStatus}</small>
          </span>
          <strong>{money(payment)}</strong>
        </Link>
      ))}
    </div>
  );
}

function PersonalDetails({ user }) {
  return (
    <div className="banking-panel account-form-panel">
      <label>
        <span>Full Name</span>
        <input type="text" defaultValue={user?.fullName || ""} placeholder="Full name" />
      </label>
      <label>
        <span>Email Address</span>
        <input type="email" defaultValue={user?.email || (user?.identifier?.includes("@") ? user.identifier : "")} placeholder="Email address" />
      </label>
      <label>
        <span>Mobile Number</span>
        <input type="tel" defaultValue={user?.phone || ""} placeholder="Mobile number" />
      </label>
      <div className="account-control-list">
        <button type="button">Verify Email <ArrowRight size={16} /></button>
        <button type="button">Verify Phone <ArrowRight size={16} /></button>
      </div>
      <button className="button primary" type="button">Save Changes</button>
    </div>
  );
}

function SecurityPrivacy({ onLogout }) {
  const items = [
    ["Change Password", "Update the password used for member access.", LockKeyhole],
    ["2-Step Verification", "Add an extra verification step to sign in.", ShieldCheck],
    ["Device Management", "Review devices connected to this account.", Smartphone],
    ["App Security", "Manage account protection preferences.", LockKeyhole],
    ["Log Out Everywhere", "End active sessions on other devices.", LogOut]
  ];

  return (
    <div className="account-control-list security-control-list">
      {items.map(([title, copy, Icon]) => (
        <button type="button" key={title} onClick={title === "Log Out Everywhere" ? onLogout : undefined}>
          <span className="account-menu-icon">
            <Icon size={18} />
          </span>
          <span>
            <strong>{title}</strong>
            <small>{copy}</small>
          </span>
          <ArrowRight size={16} />
        </button>
      ))}
    </div>
  );
}

export default function Account({ view = "home" }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPayments = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAccountPayments();
      setPayments(Array.isArray(data.payments) ? data.payments : []);
    } catch (err) {
      setError(err?.message || "Account records could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const logout = async () => {
    await auth.logout();
    navigate("/home", { replace: true });
  };

  const openPayments = payments.filter((payment) => !historyStatuses.includes(payment.paymentStatus));
  const historyPayments = payments.filter((payment) => historyStatuses.includes(payment.paymentStatus));
  const activeMemberships = payments.filter((payment) => payment.membershipStatus === "Active" || payment.paymentStatus === "Paid");

  const headers = {
    home: ["Account Center", "Manage your profile, security, payments, and memberships."],
    personal: ["Personal Details", "Update contact information and verification settings."],
    security: ["Security & Privacy", "Protect your account and manage access."],
    payments: ["Payments", "Review pending and active payment requests."],
    history: ["Payment History", "Completed and closed transactions."],
    memberships: ["Memberships", "Your active and pending membership cards."]
  };
  const [title, copy] = headers[view] || headers.home;

  return (
    <section className="page-section wide-page account-page banking-dashboard">
      <SectionHeader eyebrow="My Account" title={title} copy={copy} />

      <div className="account-welcome banking-panel">
        <div>
          <span className="eyebrow">Signed In</span>
          <h3>{auth.user?.fullName || "Member"}</h3>
          <p>{auth.user?.email || auth.user?.identifier || "Member account"}</p>
        </div>
        {view !== "home" ? (
          <Link className="button secondary" to="/account">
            Account Center
          </Link>
        ) : null}
      </div>

      {error ? <div className="notice warning">{error}</div> : null}

      {view === "home" ? <AccountMenu onLogout={logout} /> : null}
      {view === "personal" ? <PersonalDetails user={auth.user} /> : null}
      {view === "security" ? <SecurityPrivacy onLogout={logout} /> : null}
      {view === "payments" ? (
        <>
          <PaymentCounts payments={payments} />
          {loading ? <div className="banking-panel account-empty-state">Loading payments...</div> : <CompactPayments payments={openPayments} />}
        </>
      ) : null}
      {view === "history" ? (
        loading ? <div className="banking-panel account-empty-state">Loading payment history...</div> : <PaymentHistory payments={historyPayments} />
      ) : null}
      {view === "memberships" ? (
        loading ? (
          <div className="banking-panel account-empty-state">Loading memberships...</div>
        ) : (
          <CompactPayments payments={activeMemberships} emptyText="No active memberships yet." />
        )
      ) : null}
    </section>
  );
}
