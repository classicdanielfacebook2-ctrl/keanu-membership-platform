import { useRef, useEffect, useMemo, useState } from "react";
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

const advertCopy = {
  "top-video-advert-downloaded": {
    category: "Top Video Advert",
    copy: "Discover a premium membership experience designed for dedicated supporters and approved applicants.",
    action: "Apply for Membership",
    to: "/apply"
  },
  "main-video-banner-downloaded": {
    category: "Main Approved Video Banner",
    copy: "Explore the official membership card process, created to guide applicants through a secure and professional application journey.",
    action: "View Cards",
    to: "/cards"
  },
  "interview-preview-downloaded": {
    category: "Interview Preview",
    copy: "Watch selected approved media moments that highlight the story, personality, and career journey behind the platform.",
    action: "Apply for Membership",
    to: "/apply"
  },
  "membership-campaign-preview-downloaded": {
    category: "Membership Campaign Preview",
    copy: "Learn how each card tier is structured, what applicants receive, and how the premium membership experience works.",
    action: "View Cards",
    to: "/cards"
  }
};

function ApprovedVideoSlot({ video, label, activeIframeId, onPlay, registerVideo }) {
  if (!video) {
    return <VideoPlaceholder label={label} />;
  }

  return (
    <div className="approved-video-frame advert-video-frame">
      {video.isDirectVideo ? (
        <video
          ref={(element) => {
            if (element) {
              element.muted = false;
              element.defaultMuted = false;
              element.volume = 1;
            }
            registerVideo(video.id, element);
          }}
          src={video.videoUrl}
          onPlay={() => onPlay(video.id)}
          controls
          preload="metadata"
          playsInline
        />
      ) : activeIframeId === video.id ? (
        <iframe
          src={video.embedUrl}
          title={video.title}
          loading="lazy"
          allow="autoplay; encrypted-media; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        <div className="video-waiting-state">
          <span className="ad-kicker">Approved media ad</span>
          <strong>{video.title}</strong>
        </div>
      )}
      <div className="approved-media-caption">
        <span className="ad-kicker">Approved media ad</span>
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
  const [activeIframeId, setActiveIframeId] = useState("");
  const videoRefs = useRef({});

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

  const pauseOtherVideos = (activeId) => {
    Object.entries(videoRefs.current).forEach(([id, element]) => {
      if (id !== activeId && element && !element.paused) {
        element.pause();
      }
    });
  };

  const handleVideoPlay = (videoId) => {
    pauseOtherVideos(videoId);
    setActiveIframeId(videoId);
  };

  const playAdvert = (video) => {
    if (!video) return;
    pauseOtherVideos(video.id);
    setActiveIframeId(video.id);

    const element = videoRefs.current[video.id];
    if (element) {
      element.muted = false;
      element.defaultMuted = false;
      element.volume = 1;
      element.play().catch(() => {});
    }
  };

  const registerVideo = (id, element) => {
    if (element) {
      videoRefs.current[id] = element;
    } else {
      delete videoRefs.current[id];
    }
  };

  const advertVideos = [
    getVideoForSlot("main-video-banner-downloaded", "Main approved video banner"),
    getVideoForSlot("interview-preview-downloaded", "Interview preview"),
    getVideoForSlot("membership-campaign-preview-downloaded", "Membership campaign preview")
  ].filter(Boolean);

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
            activeIframeId={activeIframeId}
            onPlay={handleVideoPlay}
            registerVideo={registerVideo}
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
            <button
              className="button secondary large"
              type="button"
              onClick={() => playAdvert(getVideoForSlot("top-video-advert-downloaded", "Top video advert placeholder"))}
            >
              Play Advert
            </button>
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
        <div className="advert-stack">
          {advertVideos.map((video) => {
            const meta = advertCopy[video.id] || {
              category: video.category,
              copy: "Approved media prepared for management review and premium membership presentation.",
              action: "View Cards",
              to: "/cards"
            };

            return (
              <article className="advert-block" key={video.id}>
                <ApprovedVideoSlot
                  video={video}
                  label={meta.category}
                  activeIframeId={activeIframeId}
                  onPlay={handleVideoPlay}
                  registerVideo={registerVideo}
                />
                <div className="advert-copy">
                  <span className="eyebrow">{meta.category}</span>
                  <h3>{video.title}</h3>
                  <p>{meta.copy}</p>
                  <div className="advert-actions">
                    <button className="button primary" type="button" onClick={() => playAdvert(video)}>
                      Play Advert
                    </button>
                    <Link className="button secondary" to={meta.to}>
                      {meta.action}
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
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
