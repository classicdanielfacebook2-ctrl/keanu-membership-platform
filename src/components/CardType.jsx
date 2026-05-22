import { Check, FilePenLine } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const tierMeta = {
  silver: { member: "KR-SLV-0000", label: "Silver Access" },
  gold: { member: "KR-GLD-0000", label: "Gold Access" },
  vip: { member: "KR-VIP-0000", label: "VIP Access" },
  premium: { member: "KR-PRM-0000", label: "Premium Access" }
};

export default function CardType({ card, featured = false, compact = false, hideActions = false }) {
  const meta = tierMeta[card.id] || tierMeta.silver;
  const auth = useAuth();
  const navigate = useNavigate();

  const handleSelectCard = () => {
    if (!auth.isAuthenticated) {
      sessionStorage.setItem("pendingMembershipCard", card.id);
      sessionStorage.setItem("pendingMembershipAction", "apply");
      navigate(`/login?returnTo=${encodeURIComponent(`/apply?card=${card.id}`)}`);
      return;
    }
    navigate(`/apply?card=${card.id}`);
  };

  return (
    <article className={`membership-card ${card.id} ${featured ? "featured" : ""} ${compact ? "compact" : ""}`}>
      <div className="lux-card-preview" aria-label={`${card.name} card design`}>
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
          {featured ? <strong>Featured tier</strong> : null}
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
        {!hideActions ? (
          <div className="card-actions">
            <button className="button primary" type="button" onClick={handleSelectCard}>
              <FilePenLine size={17} />
              Select Card
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
