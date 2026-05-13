import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import SectionHeader from "../components/SectionHeader.jsx";
import { forgotPassword } from "../services/authApi.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function AuthPage({ mode }) {
  const isRegister = mode === "register";
  const isForgot = mode === "forgot";
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const [form, setForm] = useState({ fullName: "", identifier: "", password: "" });
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
      } else if (isRegister) {
        await auth.register(form);
        completeAuth();
      } else {
        await auth.login({ identifier: form.identifier, password: form.password });
        completeAuth();
      }
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
        title={isForgot ? "Reset account access." : isRegister ? "Create your membership account." : "Sign in to continue."}
        copy={
          isForgot
            ? "Request a secure reset link or verification code. Email/SMS delivery is a production integration placeholder."
            : "Authentication is handled through a backend API with bcrypt password hashing and a secure httpOnly session cookie."
        }
      />

      <form className="form-panel premium-panel auth-form" onSubmit={handleSubmit}>
        <div className="secure-box">
          {isForgot ? <ShieldCheck size={28} /> : <LockKeyhole size={28} />}
          <div>
            <h3>{isForgot ? "Verification placeholder" : "Protected login session"}</h3>
            <p>{isForgot ? "Reset delivery will connect to email or SMS." : "Passwords are never stored in plain text."}</p>
          </div>
        </div>

        {isRegister ? (
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

        <label htmlFor="identifier">
          Email or phone number
          <input
            id="identifier"
            required
            value={form.identifier}
            onChange={(event) => updateField("identifier", event.target.value)}
          />
        </label>

        {!isForgot ? (
          <label htmlFor="password">
            Password
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

        {error ? <div className="notice warning">{error}</div> : null}
        {message ? <div className="notice success">{message}</div> : null}

        <button className="button primary" type="submit" disabled={submitting}>
          {submitting ? "Please wait..." : isForgot ? "Request Reset" : isRegister ? "Create Account" : "Login"}
        </button>

        <div className="auth-links">
          {isRegister ? <Link to={`/login?returnTo=${encodeURIComponent(returnTo)}`}>Already have an account?</Link> : null}
          {!isRegister && !isForgot ? (
            <>
              <Link to={`/register?returnTo=${encodeURIComponent(returnTo)}`}>Create account</Link>
              <Link to="/forgot-password">Forgot password?</Link>
            </>
          ) : null}
          {isForgot ? <Link to="/login">Back to login</Link> : null}
        </div>
      </form>
    </section>
  );
}
