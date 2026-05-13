import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import {
  BadgeCheck,
  CreditCard,
  FileText,
  Headset,
  Image,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Sparkles,
  ShieldCheck,
  X
} from "lucide-react";
import { useEffect, useState } from "react";
import Home from "./pages/Home.jsx";
import Cards from "./pages/Cards.jsx";
import Apply from "./pages/Apply.jsx";
import Payment from "./pages/Payment.jsx";
import Support from "./pages/Support.jsx";
import Admin from "./pages/Admin.jsx";
import PolicyPage from "./pages/PolicyPage.jsx";
import Journey from "./pages/Journey.jsx";
import MediaReview from "./pages/MediaReview.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { useAuth } from "./context/AuthContext.jsx";

const navItems = [
  { to: "/", label: "Home", icon: BadgeCheck },
  { to: "/journey", label: "Journey", icon: Sparkles },
  { to: "/cards", label: "Cards", icon: CreditCard },
  { to: "/apply", label: "Apply", icon: FileText },
  { to: "/payment", label: "Payment", icon: ShieldCheck },
  { to: "/support", label: "Support", icon: Headset }
];

const adminNavItems = [
  { to: "/admin", label: "Admin", icon: LayoutDashboard },
  { to: "/media-review", label: "Media", icon: Image }
];

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const auth = useAuth();

  const closeMenu = () => setMenuOpen(false);

  const handleLogout = async () => {
    await auth.logout();
    closeMenu();
  };

  useEffect(() => {
    setLoading(true);
    const timer = window.setTimeout(() => setLoading(false), 420);
    return () => window.clearTimeout(timer);
  }, [location.pathname]);

  return (
    <div className="app-shell">
      {loading ? (
        <div className="page-loader" aria-label="Loading page">
          <span />
          <span />
          <span />
        </div>
      ) : null}
      <header className="site-header">
        <NavLink to="/" className="brand" onClick={closeMenu}>
          <span className="brand-mark">KR</span>
          <span>
            <strong>Membership Review</strong>
            <small>Authorized platform draft</small>
          </span>
        </NavLink>
        <button
          className="icon-button menu-button"
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Toggle navigation"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <nav className={menuOpen ? "site-nav open" : "site-nav"} aria-label="Main navigation">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={closeMenu}>
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
          {auth.isAdmin
            ? adminNavItems.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} onClick={closeMenu}>
                  <Icon size={17} />
                  {label}
                </NavLink>
              ))
            : null}
          {auth.isAuthenticated ? (
            <button className="nav-auth-button" type="button" onClick={handleLogout}>
              <LogOut size={17} />
              Logout
            </button>
          ) : (
            <NavLink to="/login" onClick={closeMenu}>
              <LogIn size={17} />
              Login
            </NavLink>
          )}
        </nav>
      </header>

      <main className="page-transition" key={location.pathname}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/journey" element={<Journey />} />
          <Route path="/bio" element={<Journey />} />
          <Route path="/about" element={<Journey />} />
          <Route path="/cards" element={<Cards />} />
          <Route path="/apply" element={<Apply />} />
          <Route path="/payment" element={<Payment />} />
          <Route path="/support" element={<Support />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute adminOnly>
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/media-review"
            element={
              <ProtectedRoute adminOnly>
                <MediaReview />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/forgot-password" element={<AuthPage mode="forgot" />} />
          <Route path="/terms" element={<PolicyPage type="terms" />} />
          <Route path="/privacy" element={<PolicyPage type="privacy" />} />
          <Route path="/refund" element={<PolicyPage type="refund" />} />
        </Routes>
      </main>

      <footer className="site-footer">
        <div className="footer-brand">
          <span className="brand-mark">KR</span>
          <div>
            <strong>Membership Review</strong>
            <span>support@example.com</span>
            <small>Copyright 2026. Review version before publishing.</small>
          </div>
        </div>
        <div className="footer-stack">
          <div className="footer-links">
            <NavLink to="/journey">Keanu Reeves Journey</NavLink>
            <NavLink to="/terms">Terms</NavLink>
            <NavLink to="/privacy">Privacy Policy</NavLink>
            <NavLink to="/refund">Refund Policy</NavLink>
          </div>
          <div className="social-links" aria-label="Social media placeholders">
            <span>IG</span>
            <span>FB</span>
            <span>X</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
