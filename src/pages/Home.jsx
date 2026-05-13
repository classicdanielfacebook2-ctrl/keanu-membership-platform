import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BadgeCheck, Headset, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { PhotoPlaceholder, VideoPlaceholder } from "../components/MediaPlaceholder.jsx";
import SectionHeader from "../components/SectionHeader.jsx";
import CardType from "../components/CardType.jsx";
import { cardTypes } from "../data/cards.js";
import { getApprovedHomeImages } from "../data/homeImages.js";
import { getApprovedHomeVideos } from "../data/homeVideos.js";

const trustBadges = [
  { label: "Secure Application", icon: ShieldCheck },
  { label: "Management Review", icon: BadgeCheck },
  { label: "Premium Membership Cards", icon: Sparkles }
];

function ApprovedVideoSlot({ video, label, compact = false }) {
  if (!video) {
    return <VideoPlaceholder compact={compact} label={label} />;
  }

  return (
    <div className={compact ? "approved-video-frame compact" : "approved-video-frame"}>
      {video.isDirectVideo ? (
        <video src={video.videoUrl} controls preload="metadata" playsInline />
      ) : (
        <iframe
          src={video.embedUrl}
          title={video.title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      )}
      <div className="approved-media-caption">
        <strong>{video.title}</strong>
        <span>{video.credit}</span>
      </div>
    </div>
  );
}

function ApprovedPhotoSlot({ image, label }) {
  const [failed, setFailed] = useState(false);

  if (!image || failed) {
    return <PhotoPlaceholder label={failed ? "Media unavailable — replace URL" : label} />;
  }

  return (
    <figure className="approved-photo-frame">
      <img src={image.imageUrl} alt={image.alt} loading="lazy" onError={() => setFailed(true)} />
      <figcaption>
        <strong>{image.title}</strong>
        <span>{image.credit}</span>
      </figcaption>
    </figure>
  );
}

export default function Home() {
  const [approvedVideos, setApprovedVideos] = useState([]);
  const [approvedImages, setApprovedImages] = useState([]);

  useEffect(() => {
    setApprovedVideos(getApprovedHomeVideos());
    setApprovedImages(getApprovedHomeImages());
  }, []);

  const videoById = useMemo(
    () => Object.fromEntries(approvedVideos.map((video) => [video.id, video])),
    [approvedVideos]
  );
  const imageById = useMemo(
    () => Object.fromEntries(approvedImages.map((image) => [image.id, image])),
    [approvedImages]
  );
  const getVideoForSlot = (preferredId, category) =>
    videoById[preferredId] || approvedVideos.find((video) => video.category === category);

  return (
    <>
      <section className="hero-section cinematic-hero">
        <div className="hero-ambient" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="hero-video-banner">
          <ApprovedVideoSlot
            video={getVideoForSlot("top-video-advert-downloaded", "Top video advert placeholder")}
            label="Top video advert placeholder"
          />
        </div>
        <div className="hero-content">
          <span className="eyebrow">Private management review</span>
          <h1>Official membership cards with a premium application experience.</h1>
          <p>
            A mature review platform for applicants to select a card tier, submit their details,
            prepare for secure payment, and receive guided support.
          </p>
          <div className="hero-actions">
            <Link className="button primary large" to="/apply">
              Apply for Membership
              <ArrowRight size={18} />
            </Link>
            <Link className="button secondary large" to="/cards">
              View Cards
            </Link>
            <Link className="button ghost large" to="/support">
              <Headset size={18} />
              Contact Support
            </Link>
          </div>
          <div className="trust-strip" aria-label="Platform trust badges">
            {trustBadges.map(({ label, icon: Icon }) => (
              <span key={label}>
                <Icon size={17} />
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="content-section media-showcase">
        <SectionHeader
          eyebrow="Official Media"
          title="Premium placeholders for approved videos and photos."
          copy="All media areas remain private placeholders until management approves the collected video and photo URLs in the Media Review page."
        />
        <div className="media-layout">
          <ApprovedVideoSlot
            video={getVideoForSlot("main-video-banner-downloaded", "Main approved video banner")}
            label="Main approved video banner"
          />
          <div className="video-card-grid">
            <ApprovedVideoSlot
              compact
              video={getVideoForSlot("interview-preview-downloaded", "Interview preview")}
              label="Interview preview"
            />
            <ApprovedVideoSlot
              compact
              video={getVideoForSlot("membership-campaign-preview-downloaded", "Membership campaign preview")}
              label="Membership campaign preview"
            />
          </div>
        </div>
        <div className="gallery-grid premium-gallery">
          <ApprovedPhotoSlot image={imageById["official-portrait"]} label="Official portrait placeholder" />
          <ApprovedPhotoSlot image={imageById["campaign-still"]} label="Campaign still placeholder" />
          <ApprovedPhotoSlot image={imageById["membership-lifestyle"]} label="Membership card lifestyle placeholder" />
          <ApprovedPhotoSlot image={imageById["press-photo"]} label="Approved press photo placeholder" />
        </div>
      </section>

      <section className="content-section dark-band">
        <SectionHeader
          eyebrow="Membership Cards"
          title="Luxury card tiers prepared for review."
          copy="Each card includes a realistic preview, placeholder pricing, benefits, and clear application and purchase actions."
        />
        <div className="cards-grid">
          {cardTypes.map((card, index) => (
            <CardType key={card.id} card={card} featured={index === 2} compact />
          ))}
        </div>
      </section>
    </>
  );
}
