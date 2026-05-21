import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { LockKeyhole, MailCheck, ShieldCheck } from "lucide-react";
import { forgotPassword, resetPassword } from "../services/authApi.js";
import { useAuth } from "../context/AuthContext.jsx";

const countryCodes = [
  { label: "US +1", value: "+1" },
  { label: "UK +44", value: "+44" },
  { label: "NG +234", value: "+234" },
  { label: "CA +1", value: "+1" },
  { label: "AU +61", value: "+61" },
  { label: "FR +33", value: "+33" },
  { label: "DE +49", value: "+49" }
];

const cleanPhone = (value = "") => value.replace(/[^\d]/g, "");

export default function AuthPage({ mode }) {
  const isRegister = mode === "register";
  const isForgot = mode === "forgot";
  const isReset = mode === "reset";
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    countryCode: "+1",
    password: ""
  });
  const [method, setMethod] = useState("email");
  const [otp, setOtp] = useState("");
  const [verificationPending, setVerificationPending] = useState(false);
  const [verificationIdentifier, setVerificationIdentifier] = useState("");
  const [verificationChannel, setVerificationChannel] = useState("email");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const returnTo = useMemo(() => params.get("returnTo") || "/", [params]);
  const phoneIdentifier = `${form.countryCode}${cleanPhone(form.phone)}`;
  const selectedIdentifier = method === "sms" ? phoneIdentifier : form.email.trim();

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const completeAuth = () => {
    const pendingCard = sessionStorage.getItem("pendingMembershipCard");
    const pendingAction = sessionStorage.getItem("pendingMembershipAction");
    if (pendingCard && pendingAction) {
      sessionStorage.removeItem("pendingMembershipCard");
      sessionStorage.removeItem("pendingMembershipAction");
      navigate(`/${pendingAction}?card=${pendingCard}`, { replace: true });
      return;
    }
    navigate(returnTo || "/", { replace: true });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      if (isForgot) {
        const data = await forgotPassword({ identifier: selectedIdentifier });
        setMessage(data.message);
      } else if (isReset) {
        const data = await resetPassword({ identifier: selectedIdentifier, resetCode: otp, password: form.password });
        setMessage(data.message || "Password updated. You can now log in.");
        setOtp("");
        updateField("password", "");
      } else if (isRegister) {
        const data = await auth.register({
          fullName: form.fullName,
          email: form.email,
          phone: phoneIdentifier,
          password: form.password,
          verificationMethod: method
        });
        setVerificationPending(Boolean(data.verificationRequired));
        setVerificationIdentifier(data.identifier || selectedIdentifier);
        setVerificationChannel(data.channel || method);
        setMessage(data.message || "A verification code has been sent.");
      } else {
        await auth.login({ identifier: selectedIdentifier, password: form.password });
        completeAuth();
      }
    } catch (requestError) {
      if (requestError.verificationRequired) {
        setVerificationPending(true);
        setVerificationIdentifier(requestError.identifier || selectedIdentifier);
        setVerificationChannel(requestError.channel || method);
      }
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      await auth.verifyOtp({ identifier: verificationIdentifier || selectedIdentifier, otp });
      completeAuth();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const data = await auth.resendOtp({ identifier: verificationIdentifier || selectedIdentifier });
      setMessage(data.message || "A new verification code has been sent.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const title = isRegister
    ? "Create account"
    : isForgot
      ? "Request reset"
      : isReset
        ? "Reset password"
        : "Welcome back";

  const subtitle = isRegister
    ? "Apply with verified contact details before account activation."
    : isForgot
      ? "Choose where you want to receive your reset code."
      : isReset
        ? "Enter the code we sent and choose a new password."
        : "Sign in with your preferred verified contact method.";

  return (
    <section className="auth-page">
      <div className="auth-card">
        <div className="auth-brand-mini" aria-hidden="true">
          <span>KR</span>
        </div>
        <div className="auth-heading">
          <span className="eyebrow">Secure Account</span>
          <h1>{verificationPending ? "Verify code" : title}</h1>
          <p>{verificationPending ? codeDestinationText(verificationChannel) : subtitle}</p>
        </div>

        <form className="auth-form" onSubmit={verificationPending ? handleVerifyOtp : handleSubmit}>
          <div className="auth-security-note">
            {verificationPending ? <MailCheck size={17} /> : isForgot || isReset ? <ShieldCheck size={17} /> : <LockKeyhole size={17} />}
            <span>
              {verificationPending
                ? `Code sent to ${verificationIdentifier}.`
                : "Protected with encrypted passwords, secure sessions, and OTP verification."}
            </span>
          </div>

          {!verificationPending && isRegister ? (
            <>
              <label htmlFor="fullName">
                Full Name
                <input id="fullName" required value={form.fullName} onChange={(event) => updateField("fullName", event.target.value)} />
              </label>
              <label htmlFor="email">
                Email Address
                <input
                  id="email"
                  required
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                />
              </label>
              <PhoneField form={form} updateField={updateField} />
              <MethodTabs label="Verify account by" method={method} setMethod={setMethod} emailLabel="Email OTP" smsLabel="SMS OTP" />
            </>
          ) : null}

          {!verificationPending && !isRegister && !isReset && !isForgot ? (
            <MethodTabs label="Login method" method={method} setMethod={setMethod} emailLabel="Login with Email" smsLabel="Login with Phone" />
          ) : null}

          {!verificationPending && isForgot ? (
            <MethodTabs label="Reset method" method={method} setMethod={setMethod} emailLabel="Reset by Email" smsLabel="Reset by SMS" />
          ) : null}

          {!verificationPending && isReset ? (
            <MethodTabs label="Code method" method={method} setMethod={setMethod} emailLabel="Email Code" smsLabel="SMS Code" />
          ) : null}

          {!verificationPending && !isRegister && method === "email" ? (
            <label htmlFor="email">
              Email Address
              <input id="email" required type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} />
            </label>
          ) : null}

          {!verificationPending && !isRegister && method === "sms" ? <PhoneField form={form} updateField={updateField} /> : null}

          {!verificationPending && !isForgot ? (
            <label htmlFor="password">
              {isReset ? "New Password" : "Password"}
              <input
                id="password"
                required
                minLength="8"
                type="password"
                value={form.password}
                onChange={(event) => updateField("password", event.target.value)}
              />
            </label>
          ) : null}

          {verificationPending || isReset ? (
            <label htmlFor="otp">
              {isReset ? "Reset Code" : "Verification Code"}
              <input
                id="otp"
                required
                inputMode="numeric"
                maxLength="6"
                minLength="6"
                pattern="[0-9]{6}"
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </label>
          ) : null}

          {error ? <div className="notice warning">{error}</div> : null}
          {message ? <div className="notice success">{message}</div> : null}

          <button className="button primary auth-submit" type="submit" disabled={submitting}>
            {submitting
              ? "Please wait..."
              : verificationPending
                ? "Verify Account"
                : isForgot
                  ? "Request Reset"
                  : isReset
                    ? "Update Password"
                    : isRegister
                      ? "Create Account"
                      : "Login"}
          </button>

          {verificationPending ? (
            <button className="button secondary auth-submit" type="button" onClick={handleResendOtp} disabled={submitting}>
              Resend Code
            </button>
          ) : null}

          <div className="auth-links">
            {verificationPending ? <Link to="/login">Back to login</Link> : null}
            {!verificationPending && isRegister ? <Link to={`/login?returnTo=${encodeURIComponent(returnTo)}`}>Already have an account?</Link> : null}
            {!verificationPending && !isRegister && !isForgot && !isReset ? (
              <>
                <Link to={`/register?returnTo=${encodeURIComponent(returnTo)}`}>Create account</Link>
                <Link to="/forgot-password">Forgot password?</Link>
              </>
            ) : null}
            {!verificationPending && isForgot ? (
              <>
                <Link to="/reset-password">Enter reset code</Link>
                <Link to="/login">Back to login</Link>
              </>
            ) : null}
            {!verificationPending && isReset ? (
              <>
                <Link to="/forgot-password">Request a new code</Link>
                <Link to="/login">Back to login</Link>
              </>
            ) : null}
          </div>
        </form>
      </div>
    </section>
  );
}

function MethodTabs({ label, method, setMethod, emailLabel, smsLabel }) {
  return (
    <div className="auth-method-group">
      <span>{label}</span>
      <div className="auth-tabs" role="tablist" aria-label={label}>
        <button className={method === "email" ? "active" : ""} type="button" onClick={() => setMethod("email")}>
          {emailLabel}
        </button>
        <button className={method === "sms" ? "active" : ""} type="button" onClick={() => setMethod("sms")}>
          {smsLabel}
        </button>
      </div>
    </div>
  );
}

function PhoneField({ form, updateField }) {
  return (
    <label htmlFor="phone">
      Phone Number
      <div className="phone-input-row">
        <select value={form.countryCode} onChange={(event) => updateField("countryCode", event.target.value)} aria-label="Country code">
          {countryCodes.map((country) => (
            <option key={`${country.label}-${country.value}`} value={country.value}>
              {country.label}
            </option>
          ))}
        </select>
        <input
          id="phone"
          required
          inputMode="tel"
          placeholder="555 123 4567"
          value={form.phone}
          onChange={(event) => updateField("phone", event.target.value)}
        />
      </div>
    </label>
  );
}

function codeDestinationText(channel) {
  return channel === "sms"
    ? "A verification code was sent to your phone number."
    : "A verification code was sent to your email address.";
}
