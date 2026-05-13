import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Clapperboard, Film, Quote, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { getApprovedKeanuImages } from "../data/keanuImages.js";

const storySections = [
  {
    label: "Early Life / Childhood",
    mediaKeys: ["young-keanu"],
    title: "A quiet beginning shaped by movement, challenge, and imagination.",
    copy: [
      "Keanu Charles Reeves was born in Beirut, Lebanon, before growing up primarily in Toronto, Canada. His early years were marked by change: family transitions, moves across cities, and the ache of a father leaving when he was still young.",
      "School was not always easy. He moved through several schools and faced the daily difficulty of dyslexia, yet those challenges did not close his world. They sharpened his patience, his independence, and his ability to find meaning outside the ordinary path.",
      "As a young person, he found energy in hockey and expression in acting. The ice gave him discipline and motion; performance gave him a place to transform feeling into presence."
    ],
    fallback: "Approved image not available yet"
  },
  {
    label: "Beginning of Acting Career",
    mediaKeys: ["early-acting", "young-keanu"],
    title: "Before fame, there was discipline, small work, and steady belief.",
    copy: [
      "Reeves began with early stage work, commercials, television appearances, and smaller screen roles. The path was gradual, built from auditions, uncertainty, and the kind of persistence that rarely looks glamorous from the outside.",
      "His early film appearances helped him move from local promise into a wider industry. He did not arrive all at once; he kept showing up until Hollywood began to understand the calm intensity he carried."
    ],
    fallback: "Approved image not available yet"
  },
  {
    label: "Bill & Ted Era",
    mediaKeys: ["bill-ted-era"],
    title: "A warm, offbeat breakthrough that became part of pop culture.",
    copy: [
      "Bill & Ted's Excellent Adventure introduced a generation to his warmth and unusual comic rhythm. The role became a cultural marker: light, funny, generous, and unforgettable.",
      "It showed that Reeves could hold a screen with sincerity, timing, and a kind of innocence that audiences remembered long after the credits."
    ],
    fallback: "Approved image not available yet"
  },
  {
    label: "Speed Era",
    mediaKeys: ["speed-era", "young-keanu"],
    title: "Action stardom arrived with focus, discipline, and emotional clarity.",
    copy: [
      "Speed turned Reeves into a major action lead. The performance balanced urgency with restraint, showing a screen presence that could carry intensity without losing humanity.",
      "It helped move him from rising actor to international star, setting the stage for an even larger cinematic transformation."
    ],
    fallback: "Approved image not available yet"
  },
  {
    label: "The Matrix Era",
    mediaKeys: ["matrix-era"],
    title: "The Matrix made him a defining face of modern cinema.",
    copy: [
      "The Matrix gave cinema one of its defining modern heroes. As Neo, Reeves embodied uncertainty, awakening, discipline, and quiet power.",
      "The role became more than a performance. It became a cultural image of transformation, one that still shapes how audiences remember science fiction and action cinema."
    ],
    fallback: "Approved image not available yet"
  },
  {
    label: "John Wick Era",
    mediaKeys: ["john-wick-era"],
    title: "A modern legend built through precision, restraint, and myth.",
    copy: [
      "Years later, John Wick revealed a different kind of legend: disciplined, precise, physical, and restrained. Reeves' commitment to the role helped reshape modern action filmmaking.",
      "Fans responded not only to the performance, but to the professionalism and quiet respect he brought to the work."
    ],
    fallback: "Approved image not available yet"
  },
  {
    label: "Personal Struggles",
    mediaKeys: ["gallery-2013-premiere", "gallery-2013-qa"],
    title: "Through private loss and difficult seasons, he remained grounded.",
    copy: [
      "Reeves has lived through painful personal chapters and losses that became part of the public understanding of his journey. This page treats those moments with care, because they belong first to a human life, not to spectacle.",
      "What has inspired many fans is the way he continued forward without turning hardship into performance. His public image became associated with humility, reserve, and a quiet strength that never needed to announce itself."
    ],
    fallback: "Approved image not available yet"
  },
  {
    label: "Relationships",
    mediaKeys: ["gallery-2019-cropped", "homepage-hero"],
    title: "A private life protected with dignity.",
    copy: [
      "Over the years, Reeves has kept his personal relationships largely private. That discretion has become part of how many people understand him: respectful, careful, and unwilling to turn intimacy into publicity.",
      "Fans have often admired the way he carries himself around others, with gentleness and courtesy rather than spectacle. His private life remains private, and this review page honors that boundary."
    ],
    fallback: "Approved image not available yet"
  },
  {
    label: "Legacy and Inspiration",
    mediaKeys: ["red-carpet-legacy", "homepage-hero"],
    title: "A career remembered not only for roles, but for character.",
    copy: [
      "Keanu Reeves' legacy is built across decades of film, but also through a reputation for generosity, kindness, and humility. In an industry that often rewards noise, he became beloved for stillness.",
      "His journey from a complicated childhood to worldwide respect is not a simple success story. It is a story of endurance, craft, privacy, and grace. For many, that is why his work continues to feel personal: it reminds people that strength can be quiet and success can remain human."
    ],
    fallback: "Approved image not available yet"
  }
];

const movieTimeline = [
  ["1980s", "Early movies", "Youngblood, River's Edge, and the first steps into feature film work.", ["early-acting"]],
  ["1989", "Breakthrough", "Bill & Ted's Excellent Adventure became a defining early role.", ["bill-ted-era"]],
  ["1994-1999", "Major success", "Speed and The Matrix lifted him into global Hollywood recognition.", ["speed-era", "matrix-era"]],
  ["2003-2021", "Matrix legacy", "The Matrix sequels and return to Neo expanded a cultural phenomenon.", ["matrix-era"]],
  ["2014 onward", "Modern legend", "John Wick reshaped his action legacy with discipline, style, and mythic restraint.", ["john-wick-era"]]
];

const quoteCards = [
  "A life of strength can still be gentle.",
  "The journey matters when it is carried with humility.",
  "Some legends are built quietly, one generous act at a time."
];

function findApprovedImage(approvedImages, keys) {
  return keys.map((key) => approvedImages.find((image) => image.id === key)).find(Boolean);
}

function StoryImage({ image, label, poster = false }) {
  const [failed, setFailed] = useState(false);

  if (image && !failed) {
    return (
      <figure className={poster ? "journey-media approved-media poster-placeholder" : "journey-media approved-media"}>
        <img src={image.imageUrl} alt={image.alt} onError={() => setFailed(true)} />
        <figcaption>
          <strong>{image.title}</strong>
          <span>{image.credit}</span>
        </figcaption>
      </figure>
    );
  }

  return (
    <div className={poster ? "journey-media poster-placeholder" : "journey-media"}>
      <div className="journey-media-glow" />
      <Film size={poster ? 34 : 42} />
      <span>{label}</span>
    </div>
  );
}

export default function Journey() {
  const [approvedImages, setApprovedImages] = useState([]);

  useEffect(() => {
    setApprovedImages(getApprovedKeanuImages());
  }, []);

  const storyWithImages = useMemo(
    () =>
      storySections.map((section) => ({
        ...section,
        image: findApprovedImage(approvedImages, section.mediaKeys)
      })),
    [approvedImages]
  );

  return (
    <section className="journey-page">
      <div className="journey-hero">
        <div className="hero-ambient" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="journey-hero-copy">
          <span className="eyebrow">Keanu Reeves Journey</span>
          <h1>A cinematic story of resilience, humility, and lasting impact.</h1>
          <p>
            A premium biography experience for review, honoring the path from a difficult childhood
            to a career defined by discipline, kindness, and worldwide respect.
          </p>
          <Link className="button primary large" to="/cards">
            Explore Membership Cards
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>

      <div className="journey-intro-quote">
        <Quote size={30} />
        <p>
          This page only displays images approved through the private media review page. Rejected
          and pending photos remain hidden from the public biography experience.
        </p>
      </div>

      <div className="story-timeline">
        {storyWithImages.map((section, index) => (
          <article className="story-section" key={section.label}>
            <div className="story-marker">
              <span>{String(index + 1).padStart(2, "0")}</span>
            </div>
            <div className="story-copy">
              <span className="eyebrow">{section.label}</span>
              <h2>{section.title}</h2>
              {section.copy.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <StoryImage image={section.image} label={section.fallback} />
          </article>
        ))}
      </div>

      <section className="movie-timeline-section">
        <div className="section-header">
          <span className="eyebrow">Movie Timeline</span>
          <h2>From early work to modern legendary roles.</h2>
          <p>
            A review-ready timeline showing the shape of a long career across comedy, action,
            science fiction, drama, and modern franchise cinema.
          </p>
        </div>
        <div className="movie-timeline">
          {movieTimeline.map(([year, title, copy]) => (
            <article key={`${year}-${title}`}>
              <span>{year}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
        <div className="poster-grid">
          {movieTimeline.slice(0, 4).map(([year, title, , keys]) => (
            <StoryImage
              key={`${year}-${title}-poster`}
              poster
              image={findApprovedImage(approvedImages, keys)}
              label="Approved image not available yet"
            />
          ))}
        </div>
      </section>

      <section className="quote-section">
        <div className="section-header">
          <span className="eyebrow">Inspiration</span>
          <h2>Quote placeholders for an approved official campaign.</h2>
        </div>
        <div className="quote-grid">
          {quoteCards.map((quote) => (
            <blockquote key={quote}>
              <Star size={20} />
              <p>{quote}</p>
              <cite>Approved quote placeholder</cite>
            </blockquote>
          ))}
        </div>
      </section>

      <section className="journey-closing">
        <Clapperboard size={34} />
        <h2>From struggle to craft, from craft to legacy.</h2>
        <p>
          Keanu Reeves' story endures because it feels deeply human. It is a reminder that a life
          can carry loss without losing kindness, and that success can be powerful without becoming
          loud.
        </p>
      </section>
    </section>
  );
}
