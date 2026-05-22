import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { forgotPassword, resetPassword } from "../services/authApi.js";
import { preparePasswordRecoverySession, updateRecoveredPassword } from "../services/supabasePasswordReset.js";
import { useAuth } from "../context/AuthContext.jsx";
import { allowedPhoneCountries, getAllowedPhoneCountry, getCountryFlag } from "../data/phoneCountries.js";
import { getApprovedHomeImages } from "../data/homeImages.js";

const cleanPhone = (value = "") => value.replace(/[^\d]/g, "");

const getPasswordRules = (password = "") => [
  ["Minimum 8 characters", password.length >= 8],
  ["One uppercase letter", /[A-Z]/.test(password)],
  ["One lowercase letter", /[a-z]/.test(password)],
  ["One number", /\d/.test(password)],
  ["One special character", /[^A-Za-z0-9]/.test(password)]
];

const getPasswordStrength = (password = "") => {
  const score = getPasswordRules(password).filter(([, valid]) => valid).length;
  if (!password) return { label: "Weak", className: "weak", score: 0 };
  if (score <= 2) return { label: "Weak", className: "weak", score };
  if (score <= 4) return { label: "Medium", className: "medium", score };
  return { label: "Strong", className: "strong", score };
};

export default function AuthPage({ mode }) {
  const isRegister = mode === "register";
  const isForgot = mode === "forgot";
  const isReset = mode === "reset";
  const isUpdatePassword = mode === "updatePassword";
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    countryIso: "US",
    recoveryIdentifier: "",
    password: "",
    confirmPassword: ""
  });
  const [method, setMethod] = useState("email");
  const [otp, setOtp] = useState("");
  const [verificationPending, setVerificationPending] = useState(false);
  const [verificationIdentifier, setVerificationIdentifier] = useState("");
  const [verificationChannel, setVerificationChannel] = useState("email");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);

  const returnTo = useMemo(() => params.get("returnTo") || "/", [params]);
  const authLogo = useMemo(
    () => getApprovedHomeImages().find((image) => image.id === "official-portrait")?.imageUrl || "/logo.svg",
    []
  );
  const selectedCountry = getAllowedPhoneCountry(form.countryIso);
  const phoneIdentifier = `${selectedCountry.callingCode}${cleanPhone(form.phone)}`;
  const selectedIdentifier = isForgot ? form.recoveryIdentifier.trim() : method === "sms" ? phoneIdentifier : form.email.trim();
  const passwordRules = getPasswordRules(form.password);
  const passwordStrength = getPasswordStrength(form.password);

  useEffect(() => {
    if (!isUpdatePassword) return;
    let cancelled = false;
    setSubmitting(true);
    setError("");

    preparePasswordRecoverySession()
      .then(() => {
        if (!cancelled) setMessage("Recovery link verified. Enter a new password to continue.");
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message);
      })
      .finally(() => {
        if (!cancelled) setSubmitting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isUpdatePassword]);

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
      } else if (isUpdatePassword) {
        if (form.password !== form.confirmPassword) {
          throw new Error("Passwords do not match.");
        }
        if (!passwordRules.every(([, valid]) => valid)) {
          throw new Error("Create a password that meets all requirements.");
        }
        const data = await updateRecoveredPassword({ password: form.password });
        setPasswordUpdated(true);
        setMessage(data.message || "Password updated successfully.");
        updateField("password", "");
        updateField("confirmPassword", "");
        window.setTimeout(() => navigate("/login", { replace: true }), 3000);
      } else if (isReset) {
        const data = await resetPassword({ identifier: selectedIdentifier, resetCode: otp, password: form.password });
        setMessage(data.message || "Password updated.");
        setOtp("");
        updateField("password", "");
      } else if (isRegister) {
        const data = await auth.register({
          fullName: form.fullName,
          email: form.email,
          phone: phoneIdentifier,
          phoneCountry: selectedCountry.iso,
          password: form.password,
          verificationMethod: method
        });
        setVerificationPending(Boolean(data.verificationRequired));
        setVerificationIdentifier(data.identifier || selectedIdentifier);
        setVerificationChannel(data.channel || method);
        setMessage("");
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

  const pageCopy = getAuthCopy({ isRegister, isForgot, isReset, isUpdatePassword, verificationPending });

  return (
    <section className={isUpdatePassword ? "auth-page reset-password-page" : "auth-page"}>
      <div className={isUpdatePassword ? "auth-watermark" : ""} aria-hidden="true" />
      <div className={isUpdatePassword ? "auth-card reset-password-card" : "auth-card"}>
        <div className="auth-brand-mini" aria-hidden="true">
          {logoFailed ? <img src="/logo.svg" alt="" /> : <img src={authLogo} alt="" onError={() => setLogoFailed(true)} />}
        </div>
        <div className="auth-heading">
          <span className="eyebrow">{pageCopy.label}</span>
          <h1>{pageCopy.heading}</h1>
          <p>{pageCopy.subtitle}</p>
        </div>

        <form className="auth-form" onSubmit={verificationPending ? handleVerifyOtp : handleSubmit}>
          {!verificationPending && isRegister ? (
            <>
              <label htmlFor="fullName">
                Full Name
                <input
                  id="fullName"
                  required
                  placeholder="Enter your full name"
                  value={form.fullName}
                  onChange={(event) => updateField("fullName", event.target.value)}
                />
              </label>
              <label htmlFor="email">
                Email Address
                <input
                  id="email"
                  required
                  type="email"
                  placeholder="Enter your email address"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                />
              </label>
              <PhoneField form={form} updateField={updateField} placeholder="Enter your phone number" />
              <MethodTabs label="Verification method" method={method} setMethod={setMethod} emailLabel="Email OTP" smsLabel="SMS OTP" />
            </>
          ) : null}

          {!verificationPending && !isRegister && !isReset && !isForgot ? (
            <MethodTabs label="Continue with" method={method} setMethod={setMethod} emailLabel="Email" smsLabel="Phone" />
          ) : null}

          {!verificationPending && isReset ? (
            <MethodTabs label="Continue with" method={method} setMethod={setMethod} emailLabel="Email" smsLabel="Phone" />
          ) : null}

          {!verificationPending && isForgot ? (
            <label htmlFor="recoveryIdentifier">
              Email Address
              <input
                id="recoveryIdentifier"
                required
                type="email"
                placeholder="Enter your email address"
                value={form.recoveryIdentifier}
                onChange={(event) => updateField("recoveryIdentifier", event.target.value)}
              />
            </label>
          ) : null}

          {!verificationPending && !isRegister && !isForgot && method === "email" ? (
            <label htmlFor="email">
              Email Address
              <input
                id="email"
                required
                type="email"
                placeholder="Enter your email address"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
              />
            </label>
          ) : null}

          {!verificationPending && !isRegister && !isForgot && method === "sms" ? (
            <PhoneField form={form} updateField={updateField} placeholder="Enter your phone number" />
          ) : null}

          {!verificationPending && isUpdatePassword ? (
            <>
              <label htmlFor="password">
                New Password
                <div className="password-field-shell">
                  <input
                    id="password"
                    required
                    minLength="8"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your new password"
                    value={form.password}
                    onChange={(event) => updateField("password", event.target.value)}
                  />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>
              <label htmlFor="confirmPassword">
                Confirm Password
                <div className="password-field-shell">
                  <input
                    id="confirmPassword"
                    required
                    minLength="8"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your new password"
                    value={form.confirmPassword}
                    onChange={(event) => updateField("confirmPassword", event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    aria-label={showConfirmPassword ? "Hide password confirmation" : "Show password confirmation"}
                  >
                    {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>
              <div className="password-strength-panel">
                <div className="strength-head">
                  <span>Password strength</span>
                  <strong className={passwordStrength.className}>{passwordStrength.label}</strong>
                </div>
                <div className={`strength-meter ${passwordStrength.className}`} aria-hidden="true">
                  <span />
                </div>
                <div className="password-rules">
                  <strong>Password must include</strong>
                  {passwordRules.map(([rule, valid]) => (
                    <span className={valid ? "valid" : ""} key={rule}>
                      {valid ? <Check size={14} /> : <X size={14} />}
                      {rule}
                    </span>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          {!verificationPending && !isForgot && !isUpdatePassword ? (
            <label htmlFor="password">
              {isReset ? "New Password" : "Password"}
              <input
                id="password"
                required
                minLength="8"
                type="password"
                placeholder={isRegister || isReset ? "Create a secure password" : "Enter your password"}
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
                placeholder="Enter verification code"
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </label>
          ) : null}

          {error ? <div className="notice warning">{error}</div> : null}
          {message ? (
            <div className={passwordUpdated ? "notice success password-success-notice" : "notice success"}>
              {passwordUpdated ? <Check size={18} /> : null}
              {passwordUpdated ? "Password updated successfully. Redirecting to sign in..." : message}
            </div>
          ) : null}

          <button className="button primary auth-submit" type="submit" disabled={submitting || passwordUpdated}>
            {submitting
              ? "Please wait..."
              : passwordUpdated
                ? "Redirecting..."
              : verificationPending
                ? "Verify Account"
                : isForgot
                  ? "Continue"
                  : isUpdatePassword || isReset
                    ? "Update Password"
                    : isRegister
                      ? "Create Account"
                      : "Sign In"}
          </button>

          {verificationPending ? (
            <div className="resend-code-row">
              <span>Didn't receive the code?</span>
              <button type="button" onClick={handleResendOtp} disabled={submitting}>
                Resend Code
              </button>
            </div>
          ) : null}

          {!verificationPending && !isUpdatePassword ? (
            <div className="auth-links">
              {isRegister ? <Link to={`/login?returnTo=${encodeURIComponent(returnTo)}`}>Already have an account?</Link> : null}
              {!isRegister && !isForgot && !isReset && !isUpdatePassword ? (
                <>
                  <Link to={`/register?returnTo=${encodeURIComponent(returnTo)}`}>Create account</Link>
                  <Link to="/forgot-password">Forgot password?</Link>
                </>
              ) : null}
              {isForgot ? (
                <Link to="/login">Back to sign in</Link>
              ) : null}
              {isReset ? (
                <>
                  <Link to="/forgot-password">Reset password</Link>
                  <Link to="/login">Back to sign in</Link>
                </>
              ) : null}
            </div>
          ) : null}
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
        <button
          className={method === "email" ? "active" : ""}
          type="button"
          onClick={() => setMethod("email")}
          aria-pressed={method === "email"}
        >
          {emailLabel}
        </button>
        <button
          className={method === "sms" ? "active" : ""}
          type="button"
          onClick={() => setMethod("sms")}
          aria-pressed={method === "sms"}
        >
          {smsLabel}
        </button>
      </div>
    </div>
  );
}

function PhoneField({ form, updateField, placeholder = "Phone number" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef(null);
  const selectedCountry = getAllowedPhoneCountry(form.countryIso);
  const countries = allowedPhoneCountries.filter((country) => {
    const searchText = `${country.name} ${country.callingCode} ${country.iso}`.toLowerCase();
    return searchText.includes(query.trim().toLowerCase());
  });

  const chooseCountry = (country) => {
    updateField("countryIso", country.iso);
    setQuery("");
    setOpen(false);
  };

  const handleBlur = (event) => {
    if (!wrapperRef.current?.contains(event.relatedTarget)) {
      setOpen(false);
    }
  };

  return (
    <label htmlFor="phone">
      Phone Number
      <div className="phone-input-row" ref={wrapperRef} onBlur={handleBlur}>
        <div className="country-select">
          <button
            className="country-select-trigger"
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label="Select country code"
            aria-expanded={open}
          >
            <span>{getCountryFlag(selectedCountry.iso)}</span>
            <strong>{selectedCountry.callingCode}</strong>
            <small aria-hidden="true">⌄</small>
          </button>
          {open ? (
            <div className="country-menu-backdrop" aria-hidden="true" onMouseDown={() => setOpen(false)} />
          ) : null}
          {open ? (
            <div className="country-menu" role="dialog" aria-label="Select country code">
              <div className="country-menu-handle" aria-hidden="true" />
              <input
                aria-label="Search country"
                placeholder="Search country or code"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoFocus
              />
              <div className="country-options" role="listbox">
                {countries.map((country) => (
                  <button
                    key={country.iso}
                    type="button"
                    className={country.iso === selectedCountry.iso ? "selected" : ""}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => chooseCountry(country)}
                  >
                    <span>{getCountryFlag(country.iso)}</span>
                    <span>{country.name}</span>
                    <strong>{country.callingCode}</strong>
                  </button>
                ))}
                {countries.length === 0 ? <p>No matching country available.</p> : null}
              </div>
            </div>
          ) : null}
        </div>
        <input
          id="phone"
          required
          inputMode="tel"
          placeholder={placeholder}
          value={form.phone}
          onChange={(event) => updateField("phone", event.target.value)}
        />
      </div>
    </label>
  );
}

function getAuthCopy({ isRegister, isForgot, isReset, isUpdatePassword, verificationPending }) {
  if (verificationPending) {
    return {
      label: "ACCOUNT VERIFICATION",
      heading: "Verify your identity",
      subtitle: "Enter the verification code sent to your contact method."
    };
  }

  if (isRegister) {
    return {
      label: "MEMBERSHIP REGISTRATION",
      heading: "Create your account",
      subtitle: "Complete your details to activate your membership access."
    };
  }

  if (isForgot) {
    return {
      label: "ACCOUNT RECOVERY",
      heading: "Reset your password",
      subtitle: "Enter your email address to receive a secure recovery link."
    };
  }

  if (isUpdatePassword) {
    return {
      label: "ACCOUNT SECURITY",
      heading: "Create New Password",
      subtitle: "Choose a secure password to restore access to your membership account."
    };
  }

  if (isReset) {
    return {
      label: "ACCOUNT RECOVERY",
      heading: "Reset your password",
      subtitle: "Enter your verification code and new password."
    };
  }

  return {
    label: "MEMBER ACCESS",
    heading: "Welcome back",
    subtitle: "Sign in to continue to your account."
  };
}
