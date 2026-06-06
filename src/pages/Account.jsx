import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  CreditCard,
  History,
  LockKeyhole,
  LogOut,
  RefreshCcw,
  ShieldCheck,
  UserCircle,
  WalletCards,
  XCircle
} from "lucide-react";
import { City, Country, State } from "country-state-city";
import AccountPageHeader from "../components/AccountPageHeader.jsx";
import DirectContactButtons from "../components/DirectContactButtons.jsx";
import SectionHeader from "../components/SectionHeader.jsx";
import { cardTypes } from "../data/cards.js";
import { formatPaymentAmount } from "../data/paymentMethods.js";
import { getAccountPayments } from "../services/stripeCheckout.js";
import {
  changePassword,
  getSecuritySettings,
  logoutEverywhere,
  sendProfileVerification,
  updateProfile,
  updateSecuritySettings,
  verifyProfileContact
} from "../services/authApi.js";
import { useAuth } from "../context/AuthContext.jsx";

const historyStatuses = ["Paid", "Cancelled", "Expired", "Refunded"];
const pendingStatuses = ["Awaiting Bank Transfer", "Processing", "Partially Paid", "Pending"];

const cardName = (id, fallback = "") => cardTypes.find((card) => card.id === id)?.name || fallback || id || "Membership";
const money = (payment) => formatPaymentAmount(payment.amount || 0, String(payment.currency || "EUR").toUpperCase());
const paymentDate = (payment) => (payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : "Not available");

function AccountMenu({ onLogout }) {
  const items = [
    { to: "/account/personal", label: "Personal Details", copy: "Name, email, and mobile number", icon: UserCircle },
    { to: "/account/security", label: "Security & Privacy", copy: "Password, app security, and verification", icon: LockKeyhole },
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

function CompactPayments({ payments, emptyText = "No payments found.", detailBase = "/account/payment" }) {
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
          <Link className="review-payment-button" to={`${detailBase}/${payment.applicationId}`}>
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

function InlineMessage({ message }) {
  if (!message?.text) return null;
  return <div className={message.type === "error" ? "notice warning" : "notice success"}>{message.text}</div>;
}

function PersonalDetails({ auth }) {
  const user = auth.user;
  const countries = Country.getAllCountries();
  const profile = user?.profile || {};
  const [form, setForm] = useState({
    fullName: profile.fullName || user?.fullName || "",
    email: user?.pendingEmail || profile.email || user?.email || (user?.identifier?.includes("@") ? user.identifier : ""),
    phone: profile.phone || user?.phone || "",
    country: profile.country || "",
    countryCode: profile.countryCode || "",
    stateRegion: profile.stateRegion || "",
    stateCode: profile.stateCode || "",
    city: profile.city || "",
    streetAddress: profile.streetAddress || "",
    apartmentUnit: profile.apartmentUnit || "",
    postalCode: profile.postalCode || "",
    dateOfBirth: profile.dateOfBirth || "",
    preferredCurrency: profile.preferredCurrency || "EUR",
    preferredLanguage: profile.preferredLanguage || "English"
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [verification, setVerification] = useState({ channel: "", otp: "", sending: false, verifying: false });
  const selectedCountry = countries.find((country) => country.isoCode === form.countryCode) || countries.find((country) => country.name === form.country);
  const states = selectedCountry ? State.getStatesOfCountry(selectedCountry.isoCode) : [];
  const selectedState = states.find((state) => state.isoCode === form.stateCode) || states.find((state) => state.name === form.stateRegion);
  const cities = selectedCountry && selectedState ? City.getCitiesOfState(selectedCountry.isoCode, selectedState.isoCode) : [];
  const countriesWithoutPostalCodes = new Set(["United Arab Emirates", "Hong Kong", "Qatar", "Ireland", "Jamaica", "Nigeria", "Ghana"]);

  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const emailPending = Boolean(user?.pendingEmail && user.pendingEmail === form.email);
  const emailVerified = user?.emailVerified !== false && !emailPending;

  const validate = () => {
    if (!form.fullName.trim()) return "Full name is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return "Enter a valid email address.";
    if (!form.country) return "Country is required.";
    if (!form.stateRegion) return "State / Region is required.";
    if (!form.city) return "City is required.";
    if (!countriesWithoutPostalCodes.has(form.country) && !form.postalCode.trim()) return "Postal code is required for the selected country.";
    return "";
  };

  const submit = async (event) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setMessage({ type: "error", text: validationError });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await updateProfile(form);
      await auth.refreshUser();
      setMessage({ type: "success", text: "Personal details saved." });
    } catch (error) {
      setMessage({ type: "error", text: error?.message || "Personal details could not be updated." });
    } finally {
      setSaving(false);
    }
  };

  const requestVerification = async (channel) => {
    setVerification((current) => ({ ...current, channel, otp: "", sending: true }));
    setMessage(null);
    try {
      const data = await sendProfileVerification({ channel });
      setMessage({ type: "success", text: data.message || "Verification code sent." });
    } catch (error) {
      setMessage({ type: "error", text: error?.message || "Verification code could not be sent." });
    } finally {
      setVerification((current) => ({ ...current, sending: false }));
    }
  };

  const confirmVerification = async (event) => {
    event.preventDefault();
    setVerification((current) => ({ ...current, verifying: true }));
    setMessage(null);
    try {
      const data = await verifyProfileContact({ channel: verification.channel, otp: verification.otp });
      await auth.refreshUser();
      setVerification({ channel: "", otp: "", sending: false, verifying: false });
      setMessage({ type: "success", text: data.message || "Email address verified." });
    } catch (error) {
      setMessage({ type: "error", text: error?.message || "Verification could not be completed." });
      setVerification((current) => ({ ...current, verifying: false }));
    }
  };

  return (
    <form className="banking-panel account-form-panel" onSubmit={submit}>
      <div className="profile-form-grid">
        <label>
          <span>Full Name</span>
          <input type="text" value={form.fullName} onChange={(event) => setField("fullName", event.target.value)} placeholder="Full name" />
        </label>
        <label>
          <span>Email Address</span>
          <input type="email" value={form.email} onChange={(event) => setField("email", event.target.value)} placeholder="Email address" />
          <small className={emailVerified ? "verification-chip verified" : "verification-chip"}>
            {emailVerified ? "Verified" : emailPending ? "Verification required before replacement" : "Verification required after change"}
          </small>
        </label>
        <label>
          <span>Mobile Number</span>
          <input type="tel" value={form.phone} onChange={(event) => setField("phone", event.target.value)} placeholder="+1 555 000 0000" />
        </label>
        <label>
          <span>Country</span>
          <select
            value={form.countryCode}
            onChange={(event) => {
              const country = countries.find((item) => item.isoCode === event.target.value);
              setForm((current) => ({
                ...current,
                country: country?.name || "",
                countryCode: country?.isoCode || "",
                stateRegion: "",
                stateCode: "",
                city: ""
              }));
            }}
          >
            <option value="">Select country</option>
            {countries.map((country) => (
              <option value={country.isoCode} key={country.isoCode}>{country.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>State / Region</span>
          <select
            value={form.stateCode}
            disabled={!selectedCountry}
            onChange={(event) => {
              const state = states.find((item) => item.isoCode === event.target.value);
              setForm((current) => ({
                ...current,
                stateRegion: state?.name || "",
                stateCode: state?.isoCode || "",
                city: ""
              }));
            }}
          >
            <option value="">Select state / region</option>
            {states.map((state) => (
              <option value={state.isoCode} key={state.isoCode}>{state.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>City</span>
          <input
            list="profile-cities"
            value={form.city}
            onChange={(event) => setField("city", event.target.value)}
            placeholder="City"
            disabled={!selectedState && states.length > 0}
          />
          <datalist id="profile-cities">
            {cities.map((city) => (
              <option value={city.name} key={`${city.name}-${city.latitude}-${city.longitude}`} />
            ))}
          </datalist>
        </label>
        <label>
          <span>Street Address</span>
          <input type="text" value={form.streetAddress} onChange={(event) => setField("streetAddress", event.target.value)} placeholder="Street address" />
        </label>
        <label>
          <span>Apartment / Unit</span>
          <input type="text" value={form.apartmentUnit} onChange={(event) => setField("apartmentUnit", event.target.value)} placeholder="Apartment, suite, unit" />
        </label>
        <label>
          <span>Postal Code</span>
          <input type="text" value={form.postalCode} onChange={(event) => setField("postalCode", event.target.value)} placeholder="Postal code" />
        </label>
        <label>
          <span>Date of Birth</span>
          <input type="date" value={form.dateOfBirth} onChange={(event) => setField("dateOfBirth", event.target.value)} />
        </label>
        <label>
          <span>Preferred Currency</span>
          <select value={form.preferredCurrency} onChange={(event) => setField("preferredCurrency", event.target.value)}>
            {["EUR", "USD", "GBP", "AUD", "CAD", "BRL", "CHF", "CLP"].map((currency) => (
              <option value={currency} key={currency}>{currency}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Preferred Language</span>
          <select value={form.preferredLanguage} onChange={(event) => setField("preferredLanguage", event.target.value)}>
            {["English", "French", "Spanish", "German", "Italian", "Portuguese", "Arabic"].map((language) => (
              <option value={language} key={language}>{language}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="contact-verification-panel">
        <div>
          <strong>Contact verification</strong>
          <small>Verify a changed email address before it replaces your current sign-in email.</small>
        </div>
        <div className="verification-actions">
          <button className="button secondary" type="button" disabled={verification.sending} onClick={() => requestVerification("email")}>
            {verification.sending && verification.channel === "email" ? "Sending..." : "Verify Email"}
          </button>
        </div>
        {verification.channel ? (
          <form className="inline-verification-form" onSubmit={confirmVerification}>
            <input
              inputMode="numeric"
              maxLength="6"
              placeholder="Enter 6-digit code"
              value={verification.otp}
              onChange={(event) => setVerification((current) => ({ ...current, otp: event.target.value.replace(/\D/g, "").slice(0, 6) }))}
            />
            <button className="button primary" type="submit" disabled={verification.verifying || verification.otp.length !== 6}>
              {verification.verifying ? "Verifying..." : "Confirm Code"}
            </button>
          </form>
        ) : null}
      </div>
      <InlineMessage message={message} />
      <button className="button primary" type="submit" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
    </form>
  );
}

function SecurityPrivacy() {
  const items = [
    ["/account/security/change-password", "Change Password", "Update the password used for member access.", LockKeyhole],
    ["/account/security/app-security", "App Security", "Manage account protection preferences.", LockKeyhole],
    ["/account/security/logout-everywhere", "Log Out Everywhere", "End active sessions on other devices.", LogOut]
  ];

  return (
    <div className="account-control-list security-control-list">
      {items.map(([to, title, copy, Icon]) => (
        <Link className="account-menu-item" to={to} key={title}>
          <span className="account-menu-icon">
            <Icon size={18} />
          </span>
          <span>
            <strong>{title}</strong>
            <small>{copy}</small>
          </span>
          <ArrowRight size={16} />
        </Link>
      ))}
    </div>
  );
}

function ChangePasswordPanel() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    setMessage(null);
    if (form.newPassword.length < 8) {
      setMessage({ type: "error", text: "New password must be at least 8 characters." });
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setMessage({ type: "error", text: "New password and confirmation do not match." });
      return;
    }
    setSaving(true);
    try {
      await changePassword(form);
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setMessage({ type: "success", text: "Password updated successfully." });
    } catch (error) {
      setMessage({ type: "error", text: error?.message || "Password could not be updated." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="banking-panel account-form-panel" onSubmit={submit}>
      <label>
        <span>Current Password</span>
        <input type="password" value={form.currentPassword} onChange={(event) => setForm((current) => ({ ...current, currentPassword: event.target.value }))} />
      </label>
      <label>
        <span>New Password</span>
        <input type="password" value={form.newPassword} onChange={(event) => setForm((current) => ({ ...current, newPassword: event.target.value }))} />
      </label>
      <label>
        <span>Confirm Password</span>
        <input type="password" value={form.confirmPassword} onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))} />
      </label>
      <InlineMessage message={message} />
      <button className="button primary" type="submit" disabled={saving}>{saving ? "Updating..." : "Update Password"}</button>
    </form>
  );
}

function SecuritySettingsPanel({ mode, onLogout }) {
  const [settings, setSettings] = useState({
    requirePasswordBeforePayment: false,
    requireBankTransferConfirmation: true,
    sessionTimeoutMinutes: 30
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let active = true;
    getSecuritySettings()
      .then((data) => {
        if (active) setSettings((current) => ({ ...current, ...(data.settings || {}) }));
      })
      .catch((error) => {
        if (active) setMessage({ type: "error", text: error?.message || "Security settings could not be loaded." });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const save = async (nextSettings) => {
    setSaving(true);
    setMessage(null);
    try {
      const data = await updateSecuritySettings(nextSettings);
      setSettings(data.settings || nextSettings);
      setMessage({ type: "success", text: "Security settings updated." });
    } catch (error) {
      setMessage({ type: "error", text: error?.message || "Security settings could not be updated." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="banking-panel account-empty-state">Loading security settings...</div>;

  if (mode === "logout-everywhere") {
    return (
      <div className="banking-panel account-form-panel">
        <p className="muted-copy">This will end active sessions for this account and redirect you to sign in.</p>
        <button className="button primary" type="button" onClick={onLogout}>Log Out Everywhere</button>
      </div>
    );
  }

  return (
    <div className="banking-panel account-form-panel">
      {[
        ["requirePasswordBeforePayment", "Require password before payment"],
        ["requireBankTransferConfirmation", "Require confirmation before bank transfer"]
      ].map(([key, label]) => (
        <label className="security-toggle-row" key={key}>
          <span>{label}</span>
          <input
            type="checkbox"
            checked={Boolean(settings[key])}
            onChange={(event) => save({ ...settings, [key]: event.target.checked })}
          />
        </label>
      ))}
      <label>
        <span>Session timeout after inactivity</span>
        <select
          value={settings.sessionTimeoutMinutes}
          onChange={(event) => save({ ...settings, sessionTimeoutMinutes: Number(event.target.value) })}
        >
          <option value="15">15 minutes</option>
          <option value="30">30 minutes</option>
          <option value="60">60 minutes</option>
          <option value="120">2 hours</option>
        </select>
      </label>
      <InlineMessage message={message} />
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

  const logoutAll = async () => {
    await logoutEverywhere();
    await auth.refreshUser();
    navigate("/login", { replace: true });
  };

  const openPayments = payments.filter((payment) => !historyStatuses.includes(payment.paymentStatus));
  const historyPayments = payments.filter((payment) => historyStatuses.includes(payment.paymentStatus));
  const activeMemberships = payments.filter((payment) => payment.membershipStatus === "Active" || payment.paymentStatus === "Paid");

  const headers = {
    home: ["Account Center", "Manage your profile, security, payments, and memberships."],
    personal: ["Personal Details", "Update contact information and verification settings."],
    security: ["Security & Privacy", "Protect your account and manage access."],
    "change-password": ["Change Password", "Update your member access password."],
    "app-security": ["App Security", "Manage payment and session security preferences."],
    "logout-everywhere": ["Log Out Everywhere", "End active sessions on this account."],
    payments: ["Payments", "Review pending and active payment requests."],
    history: ["Payment History", "Completed and closed transactions."],
    memberships: ["Memberships", "Your active and pending membership cards."]
  };
  const [title, copy] = headers[view] || headers.home;
  const breadcrumbsByView = {
    personal: [{ label: "My Account", to: "/account" }, { label: "Personal Details" }],
    security: [{ label: "My Account", to: "/account" }, { label: "Security & Privacy" }],
    "change-password": [
      { label: "My Account", to: "/account" },
      { label: "Security & Privacy", to: "/account/security" },
      { label: "Change Password" }
    ],
    "app-security": [
      { label: "My Account", to: "/account" },
      { label: "Security & Privacy", to: "/account/security" },
      { label: "App Security" }
    ],
    "logout-everywhere": [
      { label: "My Account", to: "/account" },
      { label: "Security & Privacy", to: "/account/security" },
      { label: "Log Out Everywhere" }
    ],
    payments: [{ label: "My Account", to: "/account" }, { label: "Payments" }],
    history: [{ label: "My Account", to: "/account" }, { label: "Payment History" }],
    memberships: [{ label: "My Account", to: "/account" }, { label: "Applications" }]
  };
  const fallbackByView = {
    "change-password": "/account/security",
    "app-security": "/account/security",
    "logout-everywhere": "/account/security",
    payments: "/account",
    history: "/account",
    memberships: "/account",
    personal: "/account",
    security: "/account"
  };

  return (
    <section className="page-section wide-page account-page banking-dashboard">
      {view === "home" ? (
        <SectionHeader eyebrow="My Account" title={title} copy={copy} />
      ) : (
        <AccountPageHeader
          title={title}
          copy={copy}
          breadcrumbs={breadcrumbsByView[view] || [{ label: "My Account", to: "/account" }, { label: title }]}
          fallbackTo={fallbackByView[view] || "/account"}
        />
      )}

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
      {view === "home" ? <DirectContactButtons className="account-dashboard-contact" /> : null}
      {view === "personal" ? <PersonalDetails auth={auth} /> : null}
      {view === "security" ? <SecurityPrivacy /> : null}
      {view === "change-password" ? <ChangePasswordPanel /> : null}
      {view === "app-security" ? <SecuritySettingsPanel mode="app-security" onLogout={logoutAll} /> : null}
      {view === "logout-everywhere" ? <SecuritySettingsPanel mode="logout-everywhere" onLogout={logoutAll} /> : null}
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
          <CompactPayments payments={activeMemberships} emptyText="No active memberships yet." detailBase="/account/applications" />
        )
      ) : null}
    </section>
  );
}
