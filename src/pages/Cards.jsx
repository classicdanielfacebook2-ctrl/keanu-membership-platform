import CardType from "../components/CardType.jsx";
import SectionHeader from "../components/SectionHeader.jsx";
import { cardTypes } from "../data/cards.js";

export default function Cards() {
  return (
    <section className="page-section">
      <SectionHeader
        eyebrow="Membership Cards"
        title="Choose your membership level."
        copy="Review the available card tiers, select one card, then complete the guided application before secure Stripe Checkout."
      />
      <div className="cards-grid">
        {cardTypes.map((card, index) => (
          <CardType key={card.id} card={card} featured={index === 2} />
        ))}
      </div>
    </section>
  );
}
