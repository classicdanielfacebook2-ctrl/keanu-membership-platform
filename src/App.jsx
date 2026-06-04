import { Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
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
  MessagesSquare,
  ShieldAlert,
  Sparkles,
  UserCircle,
  X
} from "lucide-react";
import { useEffect, useState } from "react";
import Welcome from "./pages/Welcome.jsx";
import Home from "./pages/Home.jsx";
import Apply from "./pages/Apply.jsx";
import Account from "./pages/Account.jsx";
import BankTransferDetails from "./pages/BankTransferDetails.jsx";
import Payment from "./pages/Payment.jsx";
import PaymentSuccess from "./pages/PaymentSuccess.jsx";
import PaymentCancelled from "./pages/PaymentCancelled.jsx";
import PaymentStatus from "./pages/PaymentStatus.jsx";
import Support from "./pages/Support.jsx";
import Admin from "./pages/Admin.jsx";
import AdminPayments from "./pages/AdminPayments.jsx";
import SupportAdmin from "./pages/SupportAdmin.jsx";
import AdminSetup from "./pages/AdminSetup.jsx";
import ProtectionCenter from "./pages/ProtectionCenter.jsx";
import ProtectionAdmin from "./pages/ProtectionAdmin.jsx";
import PolicyPage from "./pages/PolicyPage.jsx";
import Journey from "./pages/Journey.jsx";
import MediaReview from "./pages/MediaReview.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import LocationSelector from "./pages/LocationSelector.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import LiveChatWidget from "./components/LiveChatWidget.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { getApprovedHomeImages } from "./data/homeImages.js";

const navItems = [
  { to: "/home", label: "Home", icon: BadgeCheck },
  { to: "/journey", label: "Journey", icon: Sparkles },
  { to: "/apply", label: "Apply", icon: FileText },
  { to: "/support", label: "Support", icon: Headset },
  { to: "/protection", label: "Protection", icon: ShieldAlert }
];

const adminNavItems = [
  { to: "/admin", label: "Admin", icon: LayoutDashboard },
  { to: "/admin/payments", label: "Payments", icon: CreditCard },
  { to: "/admin/support", label: "Support Desk", icon: MessagesSquare },
  { to: "/admin/protection", label: "Protection", icon: ShieldAlert },
  { to: "/media-review", label: "Media", icon: Image }
];

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [brandImage, setBrandImage] = useState("");
  const [brandImageFailed, setBrandImageFailed] = useState(false);
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

  useEffect(() => {
    const portrait = getApprovedHomeImages().find((image) => image.id === "official-portrait");
    setBrandImage(portrait?.imageUrl || "");
  }, []);

  const showBrandImage = brandImage && !brandImageFailed;
  const isWelcomePage = location.pathname === "/";
  const isSelectorPage = location.pathname.startsWith("/apply/select-");
  const showLiveChat = !isWelcomePage && !isSelectorPage && !location.pathname.startsWith("/admin") && location.pathname !== "/media-review";
  const simpleAuthFooter = location.pathname === "/reset-password/update";

  return (
    <div className="app-shell">
      {loading ? (
        <div className="page-loader" aria-label="Loading page">
          <span />
          <span />
          <span />
        </div>
      ) : null}
      {isWelcomePage || isSelectorPage ? null : (
      <header className="site-header">
        <NavLink to="/home" className="brand" onClick={closeMenu}>
          <span className="brand-mark brand-portrait" aria-hidden="true">
            {showBrandImage ? (
              <img src={brandImage} alt="" onError={() => setBrandImageFailed(true)} />
            ) : (
              <span>KR</span>
            )}
          </span>
          <span className="brand-copy">
            <span className="brand-name">Keanu Reeves</span>
            <span className="brand-company">Company</span>
          </span>
        </NavLink>
        {menuOpen ? <button className="menu-overlay" type="button" aria-label="Close navigation" onClick={closeMenu} /> : null}
        <button
          className={menuOpen ? "icon-button menu-button active" : "icon-button menu-button"}
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
            <>
              <NavLink to="/account" onClick={closeMenu}>
                <UserCircle size={17} />
                My Account
              </NavLink>
              <button className="nav-auth-button" type="button" onClick={handleLogout}>
                <LogOut size={17} />
                Logout
              </button>
            </>
          ) : (
            <NavLink to="/login" onClick={closeMenu}>
              <LogIn size={17} />
              Login
            </NavLink>
          )}
        </nav>
      </header>
      )}

      <main className="page-transition" key={location.pathname}>
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/home" element={<Home />} />
          <Route path="/journey" element={<Journey />} />
          <Route path="/bio" element={<Journey />} />
          <Route path="/about" element={<Journey />} />
          <Route path="/apply" element={<Apply />} />
          <Route path="/apply/select-country" element={<LocationSelector type="country" />} />
          <Route path="/apply/select-state" element={<LocationSelector type="state" />} />
          <Route path="/apply/select-city" element={<LocationSelector type="city" />} />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <Account />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account/applications"
            element={
              <ProtectedRoute>
                <Account view="memberships" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account/applications/:applicationId"
            element={
              <ProtectedRoute>
                <PaymentStatus />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account/personal"
            element={
              <ProtectedRoute>
                <Account view="personal" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account/security"
            element={
              <ProtectedRoute>
                <Account view="security" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account/security/change-password"
            element={
              <ProtectedRoute>
                <Account view="change-password" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account/security/two-step"
            element={
              <ProtectedRoute>
                <Account view="two-step" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account/security/devices"
            element={
              <ProtectedRoute>
                <Navigate to="/account/security" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account/security/app-security"
            element={
              <ProtectedRoute>
                <Account view="app-security" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account/security/logout-everywhere"
            element={
              <ProtectedRoute>
                <Account view="logout-everywhere" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account/payments"
            element={
              <ProtectedRoute>
                <Account view="payments" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account/payment-history"
            element={
              <ProtectedRoute>
                <Account view="history" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account/memberships"
            element={
              <ProtectedRoute>
                <Account view="memberships" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account/payment/:applicationId"
            element={
              <ProtectedRoute>
                <PaymentStatus />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account/payment/:applicationId/bank-details"
            element={
              <ProtectedRoute>
                <BankTransferDetails />
              </ProtectedRoute>
            }
          />
          <Route path="/payment" element={<Payment />} />
          <Route
            path="/payment/status/:applicationId"
            element={
              <ProtectedRoute>
                <PaymentStatus />
              </ProtectedRoute>
            }
          />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/payment-cancelled" element={<PaymentCancelled />} />
          <Route path="/support" element={<Support />} />
          <Route path="/protection" element={<ProtectionCenter />} />
          <Route path="/admin/setup" element={<AdminSetup />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute adminOnly>
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/support"
            element={
              <ProtectedRoute adminOnly>
                <SupportAdmin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/payments"
            element={
              <ProtectedRoute adminOnly>
                <AdminPayments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/protection"
            element={
              <ProtectedRoute adminOnly>
                <ProtectionAdmin />
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
          <Route path="/reset-password" element={<AuthPage mode="reset" />} />
          <Route path="/reset-password/update" element={<AuthPage mode="updatePassword" />} />
          <Route path="/terms" element={<PolicyPage type="terms" />} />
          <Route path="/privacy" element={<PolicyPage type="privacy" />} />
          <Route path="/refund" element={<PolicyPage type="refund" />} />
        </Routes>
      </main>

      {showLiveChat ? <LiveChatWidget /> : null}

      {isWelcomePage || isSelectorPage ? null : (
      <footer className={simpleAuthFooter ? "site-footer reset-auth-footer" : "site-footer"}>
        <div className="footer-brand">
          <span className="brand-mark brand-portrait" aria-hidden="true">
            {showBrandImage ? <img src={brandImage} alt="" /> : <span>KR</span>}
          </span>
          <div>
            <strong>Keanu Reeves Company</strong>
            <span>support@keanureeves.company</span>
            {simpleAuthFooter ? null : <small>Copyright 2026. All rights reserved.</small>}
          </div>
        </div>
        {simpleAuthFooter ? null : (
          <div className="footer-stack">
            <div className="footer-links">
              <NavLink to="/terms">Terms</NavLink>
              <NavLink to="/privacy">Privacy</NavLink>
              <NavLink to="/refund">Refund Policy</NavLink>
              <NavLink to="/protection">Security Policy</NavLink>
            </div>
            <div className="social-links" aria-label="Social media links">
              <span>IG</span>
              <span>FB</span>
              <span>X</span>
            </div>
          </div>
        )}
      </footer>
      )}
    </div>
  );
}
