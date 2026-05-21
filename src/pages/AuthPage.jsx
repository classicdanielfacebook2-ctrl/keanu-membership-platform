import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { LockKeyhole, MailCheck, ShieldCheck } from "lucide-react";
import SectionHeader from "../components/SectionHeader.jsx";
import { forgotPassword, resetPassword } from "../services/authApi.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function AuthPage({ mode }) {
  const isRegister = mode === "register";
  const isForgot = mode === "forgot";
  const isReset = mode === "reset";
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const [form, setForm] = useState({ fullName: "", identifier: "", password: "" });
  const [otp, setOtp] = useState("");
  const [verificationPending, setVerificationPending] = useState(false);
  const [verificationIdentifier, setVerificationIdentifier] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const returnTo = useMemo(() => params.get("returnTo") || "/", [params]);

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
        const data = await forgotPassword({ identifier: form.identifier });
        setMessage(data.message);
      } else if (isReset) {
        const data = await resetPassword({ identifier: form.identifier, resetCode: otp, password: form.password });
        setMessage(data.message || "Password updated. You can now log in.");
        setOtp("");
        setForm((current) => ({ ...current, password: "" }));
      } else if (isRegister) {
        const data = await auth.register(form);
        setVerificationPending(Boolean(data.verificationRequired));
        setVerificationIdentifier(data.identifier || form.identifier);
        setMessage(data.message || "A verification code has been sent to your email.");
      } else {
        await auth.login({ identifier: form.identifier, password: form.password });
        completeAuth();
      }
    } catch (requestError) {
      if (requestError.verificationRequired) {
        setVerificationPending(true);
        setVerificationIdentifier(requestError.identifier || form.identifier);
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
      await auth.verifyOtp({ identifier: verificationIdentifier || form.identifier, otp });
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
      const data = await auth.resendOtp({ identifier: verificationIdentifier || form.identifier });
      setMessage(data.message || "A new verification code has been sent.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="page-section auth-page narrow-page">
      <SectionHeader
        eyebrow="Secure Account"
        title={
          isForgot
            ? "Reset account access."
            : isReset
              ? "Create a new password."
              : isRegister
                ? "Create your membership account."
                : "Sign in to continue."
        }
        copy={
          isForgot
            ? "Request a secure reset code by email or SMS."
            : isReset
              ? "Enter the reset code sent to your email or phone and choose a new password."
            : "Authentication uses bcrypt password hashing, httpOnly session cookies, and OTP verification before account access."
        }
      />

      <form className="form-panel premium-panel auth-form" onSubmit={verificationPending ? handleVerifyOtp : handleSubmit}>
        <div className="secure-box">
          {verificationPending ? <MailCheck size={28} /> : isForgot || isReset ? <ShieldCheck size={28} /> : <LockKeyhole size={28} />}
          <div>
            <h3>
              {verificationPending
                ? "Verify your email"
                : isForgot
                  ? "Secure reset request"
                  : isReset
                    ? "Reset password"
                    : "Protected login session"}
            </h3>
            <p>
              {verificationPending
                ? `Enter the 6-digit code sent to ${verificationIdentifier || form.identifier}.`
                : isForgot
                  ? "If the contact method is registered, a reset code will be delivered privately."
                  : isReset
                    ? "Use the 6-digit code from your email or phone to protect your account."
                  : "Passwords are never stored in plain text."}
            </p>
          </div>
        </div>

        {!verificationPending && isRegister ? (
          <label htmlFor="fullName">
            Full name
            <input
              id="fullName"
              required
              value={form.fullName}
              onChange={(event) => updateField("fullName", event.target.value)}
            />
          </label>
        ) : null}

        {!verificationPending ? (
          <label htmlFor="identifier">
            Email or phone number
            <input
              id="identifier"
              required
              type="text"
              placeholder="name@example.com or +15551234567"
              value={form.identifier}
              onChange={(event) => updateField("identifier", event.target.value)}
            />
          </label>
        ) : null}

        {!verificationPending && !isForgot ? (
          <label htmlFor="password">
            {isReset ? "New password" : "Password"}
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
            {isReset ? "Reset code" : "Verification code"}
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

        <button className="button primary" type="submit" disabled={submitting}>
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
          <button className="button secondary" type="button" onClick={handleResendOtp} disabled={submitting}>
            Resend Code
          </button>
        ) : null}

        <div className="auth-links">
          {verificationPending ? <Link to="/login">Back to login</Link> : null}
          {!verificationPending && isRegister ? (
            <Link to={`/login?returnTo=${encodeURIComponent(returnTo)}`}>Already have an account?</Link>
          ) : null}
          {!verificationPending && !isRegister && !isForgot ? (
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
    </section>
  );
}
