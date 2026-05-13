import { Check, CreditCard, FilePenLine } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const tierMeta = {
  silver: { member: "KR-SLV-0000", label: "Silver Access" },
  gold: { member: "KR-GLD-0000", label: "Gold Access" },
  vip: { member: "KR-VIP-0000", label: "VIP Access" },
  premium: { member: "KR-PRM-0000", label: "Premium Access" }
};

export default function CardType({ card, featured = false, compact = false }) {
  const meta = tierMeta[card.id] || tierMeta.silver;
  const auth = useAuth();
  const navigate = useNavigate();

  const handleProtectedAction = (action) => {
    if (!auth.isAuthenticated) {
      sessionStorage.setItem("pendingMembershipCard", card.id);
      sessionStorage.setItem("pendingMembershipAction", action);
      navigate(`/login?returnTo=${encodeURIComponent(`/${action}?card=${card.id}`)}`);
      return;
    }
    navigate(`/${action}?card=${card.id}`);
  };

  return (
    <article className={`membership-card ${card.id} ${featured ? "featured" : ""} ${compact ? "compact" : ""}`}>
      <div className="lux-card-preview" aria-label={`${card.name} preview`}>
        <div className="card-shine" />
        <div className="chip" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="preview-brand">Authorized Membership</div>
        <div className="preview-tier">{card.name}</div>
        <div className="preview-bottom">
          <span>{meta.member}</span>
          <strong>{meta.label}</strong>
        </div>
      </div>

      <div className="card-copy">
        <div className="card-topline">
          <span>{card.name}</span>
          {featured ? <strong>Management review pick</strong> : null}
        </div>
        <h3>{card.name}</h3>
        <p className="price">{card.price}</p>
        <ul>
          {card.benefits.map((benefit) => (
            <li key={benefit}>
              <Check size={16} />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
        <div className="card-actions">
          <button className="button primary" type="button" onClick={() => handleProtectedAction("apply")}>
            <FilePenLine size={17} />
            Apply
          </button>
          <button className="button secondary" type="button" onClick={() => handleProtectedAction("payment")}>
            <CreditCard size={17} />
            Purchase
          </button>
        </div>
      </div>
    </article>
  );
}
