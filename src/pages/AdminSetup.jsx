import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, ShieldCheck } from "lucide-react";
import { bootstrapAdmin } from "../services/authApi.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function AdminSetup() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [form, setForm] = useState({
    fullName: "Management Admin",
    email: "",
    password: "",
    setupToken: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
    setMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const data = await bootstrapAdmin(form);
      setMessage(data.message || "Admin account created.");
      await auth.refreshUser();
      window.setTimeout(() => navigate("/admin", { replace: true }), 900);
    } catch (requestError) {
      setError(requestError.message || "Admin setup failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-page admin-setup-page">
      <div className="auth-card admin-setup-card">
        <div className="auth-brand-mini" aria-hidden="true">
          <img src="/logo.svg" alt="" />
        </div>
        <div className="auth-heading">
          <span className="eyebrow">Admin Access</span>
          <h1>Create First Admin</h1>
          <p>Set up the first administrator account for the membership platform.</p>
        </div>

        <div className="admin-setup-notice">
          <ShieldCheck size={17} />
          <span>This setup works only before an admin account already exists.</span>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="adminFullName">
            Full name
            <input
              id="adminFullName"
              autoComplete="name"
              placeholder="Enter admin full name"
              value={form.fullName}
              onChange={(event) => updateField("fullName", event.target.value)}
            />
          </label>
          <label htmlFor="adminEmail">
            Admin email
            <input
              id="adminEmail"
              autoComplete="email"
              inputMode="email"
              placeholder="Enter admin email address"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
            />
          </label>
          <label htmlFor="adminPassword">
            Password
            <input
              id="adminPassword"
              autoComplete="new-password"
              minLength={12}
              placeholder="Create a strong admin password"
              type="password"
              value={form.password}
              onChange={(event) => updateField("password", event.target.value)}
            />
          </label>
          <label htmlFor="setupToken">
            Setup token
            <input
              id="setupToken"
              autoComplete="off"
              placeholder="Enter private setup token"
              type="password"
              value={form.setupToken}
              onChange={(event) => updateField("setupToken", event.target.value)}
            />
          </label>

          {error ? <div className="notice warning">{error}</div> : null}
          {message ? <div className="notice success">{message}</div> : null}

          <button className="button primary auth-submit" type="submit" disabled={submitting}>
            <Crown size={17} />
            {submitting ? "Creating admin..." : "Create Admin Account"}
          </button>
        </form>
      </div>
    </section>
  );
}
