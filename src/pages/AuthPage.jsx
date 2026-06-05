import { useEffect, useMemo, useState } from "react";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { forgotPassword, resetPassword } from "../services/authApi.js";
import { preparePasswordRecoverySession, updateRecoveredPassword } from "../services/supabasePasswordReset.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { getApprovedHomeImages } from "../data/homeImages.js";

const authTranslations = {
  en: {
    languageLabel: "Language",
    english: "English",
    german: "Deutsch",
    labels: {
      fullName: "Full Name",
      email: "Email Address",
      password: "Password",
      newPassword: "New Password",
      confirmPassword: "Confirm Password",
      verificationCode: "Verification Code",
      resetCode: "Reset Code",
      authenticatorCode: "Authenticator Code"
    },
    placeholders: {
      fullName: "Enter your full name",
      email: "Enter your email address",
      password: "Enter your password",
      createPassword: "Create a secure password",
      newPassword: "Enter your new password",
      confirmPassword: "Confirm your new password",
      verificationCode: "Enter verification code",
      authenticatorCode: "Enter 6-digit code"
    },
    buttons: {
      wait: "Please wait...",
      redirecting: "Redirecting...",
      verifySignIn: "Verify Sign In",
      verifyAccount: "Verify Account",
      continue: "Continue",
      updatePassword: "Update Password",
      createAccount: "Create Account",
      signIn: "Sign In",
      resendCode: "Resend Code"
    },
    links: {
      alreadyAccount: "Already have an account?",
      createAccount: "Create account",
      forgotPassword: "Forgot password?",
      backToSignIn: "Back to sign in",
      resetPassword: "Reset password"
    },
    copy: {
      twoFactor: {
        label: "ACCOUNT VERIFICATION",
        heading: "Verify sign in",
        subtitle: "Enter the code from your authenticator app to continue."
      },
      verification: {
        label: "ACCOUNT VERIFICATION",
        heading: "Verify your identity",
        subtitle: "Enter the verification code sent to your email address."
      },
      register: {
        label: "MEMBERSHIP REGISTRATION",
        heading: "Create your account",
        subtitle: "Complete your details to activate your membership access."
      },
      forgot: {
        label: "ACCOUNT RECOVERY",
        heading: "Reset your password",
        subtitle: "Enter your email address to receive a secure recovery link."
      },
      updatePassword: {
        label: "ACCOUNT SECURITY",
        heading: "Create New Password",
        subtitle: "For your security, choose a strong password to restore access to your membership account."
      },
      reset: {
        label: "ACCOUNT RECOVERY",
        heading: "Reset your password",
        subtitle: "Enter your verification code and new password."
      },
      login: {
        label: "MEMBER ACCESS",
        heading: "Welcome back",
        subtitle: "Sign in to continue to your account."
      }
    },
    password: {
      strength: "Password strength",
      mustInclude: "Password must include",
      weak: "Weak",
      medium: "Medium",
      strong: "Strong",
      updated: "Password updated successfully. Redirecting to sign in...",
      recoveryVerified: "Recovery link verified",
      mismatch: "Passwords do not match.",
      requirementsError: "Create a password that meets all requirements.",
      rules: [
        "Minimum 8 characters",
        "One uppercase letter",
        "One lowercase letter",
        "One number",
        "One special character"
      ]
    },
    resendPrompt: "Didn't receive the code?",
    otpSent: "A new verification code has been sent.",
    passwordUpdatedDefault: "Password updated successfully.",
    resetUpdatedDefault: "Password updated."
  },
  de: {
    languageLabel: "Sprache",
    english: "English",
    german: "Deutsch",
    labels: {
      fullName: "Vollständiger Name",
      email: "E-Mail-Adresse",
      password: "Passwort",
      newPassword: "Neues Passwort",
      confirmPassword: "Passwort bestätigen",
      verificationCode: "Bestätigungscode",
      resetCode: "Zurücksetzungscode",
      authenticatorCode: "Authenticator-Code"
    },
    placeholders: {
      fullName: "Geben Sie Ihren vollständigen Namen ein",
      email: "Geben Sie Ihre E-Mail-Adresse ein",
      password: "Geben Sie Ihr Passwort ein",
      createPassword: "Erstellen Sie ein sicheres Passwort",
      newPassword: "Geben Sie Ihr neues Passwort ein",
      confirmPassword: "Bestätigen Sie Ihr neues Passwort",
      verificationCode: "Bestätigungscode eingeben",
      authenticatorCode: "6-stelligen Code eingeben"
    },
    buttons: {
      wait: "Bitte warten...",
      redirecting: "Weiterleitung...",
      verifySignIn: "Anmeldung bestätigen",
      verifyAccount: "Konto bestätigen",
      continue: "Weiter",
      updatePassword: "Passwort aktualisieren",
      createAccount: "Konto erstellen",
      signIn: "Anmelden",
      resendCode: "Code erneut senden"
    },
    links: {
      alreadyAccount: "Sie haben bereits ein Konto?",
      createAccount: "Konto erstellen",
      forgotPassword: "Passwort vergessen?",
      backToSignIn: "Zur Anmeldung",
      resetPassword: "Passwort zurücksetzen"
    },
    copy: {
      twoFactor: {
        label: "KONTOBESTÄTIGUNG",
        heading: "Anmeldung bestätigen",
        subtitle: "Geben Sie den Code aus Ihrer Authenticator-App ein, um fortzufahren."
      },
      verification: {
        label: "KONTOBESTÄTIGUNG",
        heading: "Identität bestätigen",
        subtitle: "Geben Sie den Bestätigungscode ein, der an Ihre E-Mail-Adresse gesendet wurde."
      },
      register: {
        label: "MITGLIEDSCHAFTSREGISTRIERUNG",
        heading: "Konto erstellen",
        subtitle: "Vervollständigen Sie Ihre Angaben, um Ihren Mitgliedszugang zu aktivieren."
      },
      forgot: {
        label: "KONTOWIEDERHERSTELLUNG",
        heading: "Passwort zurücksetzen",
        subtitle: "Geben Sie Ihre E-Mail-Adresse ein, um einen sicheren Wiederherstellungslink zu erhalten."
      },
      updatePassword: {
        label: "KONTOSICHERHEIT",
        heading: "Neues Passwort erstellen",
        subtitle: "Wählen Sie ein starkes Passwort, um den Zugang zu Ihrem Mitgliedskonto wiederherzustellen."
      },
      reset: {
        label: "KONTOWIEDERHERSTELLUNG",
        heading: "Passwort zurücksetzen",
        subtitle: "Geben Sie Ihren Bestätigungscode und Ihr neues Passwort ein."
      },
      login: {
        label: "MITGLIEDSZUGANG",
        heading: "Willkommen zurück",
        subtitle: "Melden Sie sich an, um mit Ihrem Konto fortzufahren."
      }
    },
    password: {
      strength: "Passwortstärke",
      mustInclude: "Das Passwort muss enthalten",
      weak: "Schwach",
      medium: "Mittel",
      strong: "Stark",
      updated: "Passwort erfolgreich aktualisiert. Weiterleitung zur Anmeldung...",
      recoveryVerified: "Wiederherstellungslink bestätigt",
      mismatch: "Passwörter stimmen nicht überein.",
      requirementsError: "Erstellen Sie ein Passwort, das alle Anforderungen erfüllt.",
      rules: [
        "Mindestens 8 Zeichen",
        "Ein Großbuchstabe",
        "Ein Kleinbuchstabe",
        "Eine Zahl",
        "Ein Sonderzeichen"
      ]
    },
    resendPrompt: "Code nicht erhalten?",
    otpSent: "Ein neuer Bestätigungscode wurde gesendet.",
    passwordUpdatedDefault: "Passwort erfolgreich aktualisiert.",
    resetUpdatedDefault: "Passwort aktualisiert."
  }
};

const getPasswordRules = (password = "", language = "en") => {
  const rules = authTranslations[language]?.password.rules || authTranslations.en.password.rules;
  return [
    [rules[0], password.length >= 8],
    [rules[1], /[A-Z]/.test(password)],
    [rules[2], /[a-z]/.test(password)],
    [rules[3], /\d/.test(password)],
    [rules[4], /[^A-Za-z0-9]/.test(password)]
  ];
};

const getPasswordStrength = (password = "", language = "en") => {
  const labels = authTranslations[language]?.password || authTranslations.en.password;
  const score = getPasswordRules(password, language).filter(([, valid]) => valid).length;
  if (!password) return { label: labels.weak, className: "weak", score: 0 };
  if (score <= 2) return { label: labels.weak, className: "weak", score };
  if (score <= 4) return { label: labels.medium, className: "medium", score };
  return { label: labels.strong, className: "strong", score };
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
    recoveryIdentifier: "",
    password: "",
    confirmPassword: ""
  });
  const [otp, setOtp] = useState("");
  const [verificationPending, setVerificationPending] = useState(false);
  const [verificationIdentifier, setVerificationIdentifier] = useState("");
  const [twoFactorPending, setTwoFactorPending] = useState(false);
  const [twoFactorChallenge, setTwoFactorChallenge] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const { language, setLanguage } = useLanguage();

  const returnTo = useMemo(() => params.get("returnTo") || "/home", [params]);
  const authLogo = useMemo(
    () => getApprovedHomeImages().find((image) => image.id === "official-portrait")?.imageUrl || "/logo.svg",
    []
  );
  const copy = authTranslations[language] || authTranslations.en;
  const selectedIdentifier = isForgot ? form.recoveryIdentifier.trim() : form.email.trim();
  const passwordRules = getPasswordRules(form.password, language);
  const passwordStrength = getPasswordStrength(form.password, language);
  const showPasswordGuidance = isUpdatePassword && form.password.length > 0;

  useEffect(() => {
    if (!isUpdatePassword) return;
    let cancelled = false;
    setSubmitting(true);
    setError("");

    preparePasswordRecoverySession()
      .then(() => {
        if (!cancelled) setMessage("");
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
    navigate(returnTo || "/home", { replace: true });
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
        const currentPassword = form.password;
        const currentConfirmPassword = form.confirmPassword;
        const currentPasswordRules = getPasswordRules(currentPassword, language);
        const currentStrength = getPasswordStrength(currentPassword, language);
        const requirementsMet = currentPasswordRules.every(([, valid]) => valid);
        const passwordsMatch = currentPassword === currentConfirmPassword;

        console.info("[auth/reset-password/validation]", {
          passwordLength: currentPassword.length,
          confirmPasswordLength: currentConfirmPassword.length,
          requirementsMet,
          passwordsMatch,
          strength: currentStrength.label
        });

        if (!passwordsMatch) {
          throw new Error(copy.password.mismatch);
        }
        if (!requirementsMet) {
          throw new Error(copy.password.requirementsError);
        }
        const data = await updateRecoveredPassword({ password: currentPassword });
        setPasswordUpdated(true);
        setMessage(data.message || copy.passwordUpdatedDefault);
        updateField("password", "");
        updateField("confirmPassword", "");
        window.setTimeout(() => navigate("/login", { replace: true }), 3000);
      } else if (isReset) {
        const data = await resetPassword({ identifier: selectedIdentifier, resetCode: otp, password: form.password });
        setMessage(data.message || copy.resetUpdatedDefault);
        setOtp("");
        updateField("password", "");
      } else if (isRegister) {
        const data = await auth.register({
          fullName: form.fullName,
          email: form.email,
          password: form.password
        });
        setVerificationPending(Boolean(data.verificationRequired));
        setVerificationIdentifier(data.identifier || selectedIdentifier);
        setMessage("");
      } else {
        const data = await auth.login({ identifier: selectedIdentifier, password: form.password });
        if (data.twoFactorRequired) {
          setTwoFactorPending(true);
          setTwoFactorChallenge(data.challengeToken || "");
          setMessage(data.message || "");
          return;
        }
        completeAuth();
      }
    } catch (requestError) {
      if (requestError.verificationRequired) {
        setVerificationPending(true);
        setVerificationIdentifier(requestError.identifier || selectedIdentifier);
      }
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyTwoFactor = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      await auth.verifyLoginTwoStep({ challengeToken: twoFactorChallenge, code: twoFactorCode });
      completeAuth();
    } catch (requestError) {
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
      setMessage(data.message || copy.otpSent);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const pageCopy = getAuthCopy({ isRegister, isForgot, isReset, isUpdatePassword, verificationPending, twoFactorPending, language });

  return (
    <section className={isUpdatePassword ? "auth-page reset-password-page" : "auth-page"}>
      <div className={isUpdatePassword ? "auth-watermark" : ""} aria-hidden="true" />
      <div className={isUpdatePassword ? "auth-card reset-password-card" : "auth-card"}>
        <div className="auth-card-top">
          <div className="auth-brand-mini" aria-hidden="true">
            {logoFailed ? <img src="/logo.svg" alt="" /> : <img src={authLogo} alt="" onError={() => setLogoFailed(true)} />}
          </div>
          <label className="auth-language-switcher" htmlFor="authLanguage">
            <span>{copy.languageLabel}</span>
            <select id="authLanguage" value={language} onChange={(event) => setLanguage(event.target.value)}>
              <option value="en">{copy.english}</option>
              <option value="de">{copy.german}</option>
            </select>
          </label>
        </div>
        <div className="auth-heading">
          <span className="eyebrow">{pageCopy.label}</span>
          <h1>{pageCopy.heading}</h1>
          <p>{pageCopy.subtitle}</p>
        </div>

        <form className="auth-form" onSubmit={twoFactorPending ? handleVerifyTwoFactor : verificationPending ? handleVerifyOtp : handleSubmit}>
          {isUpdatePassword ? (
            <div className="recovery-verified-badge">
              <Check size={15} />
              {copy.password.recoveryVerified}
            </div>
          ) : null}

          {twoFactorPending ? (
            <label htmlFor="twoFactorCode">
              {copy.labels.authenticatorCode}
              <input
                id="twoFactorCode"
                required
                inputMode="numeric"
                maxLength="11"
                placeholder={copy.placeholders.authenticatorCode}
                value={twoFactorCode}
                onChange={(event) => setTwoFactorCode(event.target.value.replace(/[^\dA-Za-z-]/g, "").slice(0, 14))}
              />
            </label>
          ) : null}

          {!twoFactorPending && !verificationPending && isRegister ? (
            <>
              <label htmlFor="fullName">
                {copy.labels.fullName}
                <input
                  id="fullName"
                  required
                  placeholder={copy.placeholders.fullName}
                  value={form.fullName}
                  onChange={(event) => updateField("fullName", event.target.value)}
                />
              </label>
              <label htmlFor="email">
                {copy.labels.email}
                <input
                  id="email"
                  required
                  type="email"
                  placeholder={copy.placeholders.email}
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                />
              </label>
            </>
          ) : null}

          {!twoFactorPending && !verificationPending && isForgot ? (
            <label htmlFor="recoveryIdentifier">
              {copy.labels.email}
              <input
                id="recoveryIdentifier"
                required
                type="email"
                placeholder={copy.placeholders.email}
                value={form.recoveryIdentifier}
                onChange={(event) => updateField("recoveryIdentifier", event.target.value)}
              />
            </label>
          ) : null}

          {!twoFactorPending && !verificationPending && !isRegister && !isForgot && !isUpdatePassword ? (
            <label htmlFor="email">
              {copy.labels.email}
              <input
                id="email"
                required
                type="email"
                placeholder={copy.placeholders.email}
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
              />
            </label>
          ) : null}

          {!twoFactorPending && !verificationPending && isUpdatePassword ? (
            <>
              <label htmlFor="password">
                {copy.labels.newPassword}
                <div className="password-field-shell">
                  <input
                    id="password"
                    required
                    minLength="8"
                    type={showPassword ? "text" : "password"}
                    placeholder={copy.placeholders.newPassword}
                    value={form.password}
                    onChange={(event) => updateField("password", event.target.value)}
                  />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>
              <label htmlFor="confirmPassword">
                {copy.labels.confirmPassword}
                <div className="password-field-shell">
                  <input
                    id="confirmPassword"
                    required
                    minLength="8"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder={copy.placeholders.confirmPassword}
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
              <div className={showPasswordGuidance ? "password-strength-panel visible" : "password-strength-panel"}>
                <div className="strength-head">
                  <span>{copy.password.strength}</span>
                  <strong className={passwordStrength.className}>{passwordStrength.label}</strong>
                </div>
                <div className={`strength-meter ${passwordStrength.className}`} aria-hidden="true">
                  <span />
                </div>
                <div className="password-rules">
                  <strong>{copy.password.mustInclude}</strong>
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

          {!twoFactorPending && !verificationPending && !isForgot && !isUpdatePassword ? (
            <label htmlFor="password">
              {isReset ? copy.labels.newPassword : copy.labels.password}
              <input
                id="password"
                required
                minLength="8"
                type="password"
                placeholder={isRegister || isReset ? copy.placeholders.createPassword : copy.placeholders.password}
                value={form.password}
                onChange={(event) => updateField("password", event.target.value)}
              />
            </label>
          ) : null}

          {!twoFactorPending && (verificationPending || isReset) ? (
            <label htmlFor="otp">
              {isReset ? copy.labels.resetCode : copy.labels.verificationCode}
              <input
                id="otp"
                required
                inputMode="numeric"
                maxLength="6"
                minLength="6"
                pattern="[0-9]{6}"
                placeholder={copy.placeholders.verificationCode}
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </label>
          ) : null}

          {error ? <div className="notice warning">{error}</div> : null}
          {message ? (
            <div className={passwordUpdated ? "notice success password-success-notice" : "notice success"}>
              {passwordUpdated ? <Check size={18} /> : null}
              {passwordUpdated ? copy.password.updated : message}
            </div>
          ) : null}

          <button className="button primary auth-submit" type="submit" disabled={submitting || passwordUpdated}>
            {submitting
              ? copy.buttons.wait
              : passwordUpdated
                ? copy.buttons.redirecting
              : twoFactorPending
                ? copy.buttons.verifySignIn
              : verificationPending
                ? copy.buttons.verifyAccount
                : isForgot
                  ? copy.buttons.continue
                  : isUpdatePassword || isReset
                    ? copy.buttons.updatePassword
                    : isRegister
                      ? copy.buttons.createAccount
                      : copy.buttons.signIn}
          </button>

          {verificationPending ? (
            <div className="resend-code-row">
              <span>{copy.resendPrompt}</span>
              <button type="button" onClick={handleResendOtp} disabled={submitting}>
                {copy.buttons.resendCode}
              </button>
            </div>
          ) : null}

          {!twoFactorPending && !verificationPending && !isUpdatePassword ? (
            <div className="auth-links">
              {isRegister ? <Link to={`/login?returnTo=${encodeURIComponent(returnTo)}`}>{copy.links.alreadyAccount}</Link> : null}
              {!isRegister && !isForgot && !isReset && !isUpdatePassword ? (
                <>
                  <Link to={`/register?returnTo=${encodeURIComponent(returnTo)}`}>{copy.links.createAccount}</Link>
                  <Link to="/forgot-password">{copy.links.forgotPassword}</Link>
                </>
              ) : null}
              {isForgot ? (
                <Link to="/login">{copy.links.backToSignIn}</Link>
              ) : null}
              {isReset ? (
                <>
                  <Link to="/forgot-password">{copy.links.resetPassword}</Link>
                  <Link to="/login">{copy.links.backToSignIn}</Link>
                </>
              ) : null}
            </div>
          ) : null}
        </form>
      </div>
    </section>
  );
}

function getAuthCopy({ isRegister, isForgot, isReset, isUpdatePassword, verificationPending, twoFactorPending, language = "en" }) {
  const copy = authTranslations[language]?.copy || authTranslations.en.copy;

  if (twoFactorPending) {
    return copy.twoFactor;
  }

  if (verificationPending) {
    return copy.verification;
  }

  if (isRegister) {
    return copy.register;
  }

  if (isForgot) {
    return copy.forgot;
  }

  if (isUpdatePassword) {
    return copy.updatePassword;
  }

  if (isReset) {
    return copy.reset;
  }

  return copy.login;
}

