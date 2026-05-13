import CardType from "../components/CardType.jsx";
import SectionHeader from "../components/SectionHeader.jsx";
import { cardTypes } from "../data/cards.js";

export default function Cards() {
  return (
    <section className="page-section">
      <SectionHeader
        eyebrow="Membership Cards"
        title="Select the card level that matches the applicant's request."
        copy="Prices are placeholders until management approves final fees and payment provider rules."
      />
      <div className="cards-grid">
        {cardTypes.map((card, index) => (
          <CardType key={card.id} card={card} featured={index === 2} />
        ))}
      </div>
    </section>
  );
}
