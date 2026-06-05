import { useRef, useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { PhotoPlaceholder, VideoPlaceholder } from "../components/MediaPlaceholder.jsx";
import DirectContactButtons from "../components/DirectContactButtons.jsx";
import SectionHeader from "../components/SectionHeader.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { getApprovedHomeImages } from "../data/homeImages.js";
import { getApprovedHomeVideos } from "../data/homeVideos.js";

function ApprovedVideoSlot({ video, label, soundEnabled, activeIframeId, onPlay, onEnableSound, registerVideo, copy }) {
  if (!video) {
    return <VideoPlaceholder label={label} />;
  }

  return (
    <div className="approved-video-frame advert-video-frame">
      {video.isDirectVideo ? (
        <video
          ref={(element) => {
            if (element) {
              element.muted = !soundEnabled;
              element.defaultMuted = !soundEnabled;
              element.volume = soundEnabled ? 1 : 0;
            }
            registerVideo(video.id, element);
          }}
          src={video.videoUrl}
          onPlay={() => onPlay(video.id)}
          autoPlay
          loop
          controls
          preload="auto"
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
          <span>{copy.videoReady}</span>
        </div>
      )}
      {!soundEnabled ? (
        <button className="sound-toggle" type="button" onClick={() => onEnableSound(video.id)}>
          {copy.tapForSound}
        </button>
      ) : null}
    </div>
  );
}

function ApprovedPhotoSlot({ image, label, copy }) {
  const [failed, setFailed] = useState(false);

  if (!image || failed) {
    return <PhotoPlaceholder label={failed ? copy.unavailable : label} />;
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
  const { t } = useLanguage();
  const copy = t.home;
  const [approvedVideos, setApprovedVideos] = useState([]);
  const [approvedImages, setApprovedImages] = useState([]);
  const [activeIframeId, setActiveIframeId] = useState("");
  const [soundVideoId, setSoundVideoId] = useState("");
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

  const enableSound = (videoId) => {
    pauseOtherVideos(videoId);
    setSoundVideoId(videoId);
    setActiveIframeId(videoId);

    Object.entries(videoRefs.current).forEach(([id, element]) => {
      if (!element) return;
      const isActive = id === videoId;
      element.muted = !isActive;
      element.defaultMuted = !isActive;
      element.volume = isActive ? 1 : 0;
      if (isActive) {
        element.play().catch(() => {});
      }
    });
  };

  const playAdvertMuted = (video) => {
    if (!video) return;
    pauseOtherVideos(video.id);
    setActiveIframeId(video.id);

    const element = videoRefs.current[video.id];
    if (element) {
      const hasSound = soundVideoId === video.id;
      element.muted = !hasSound;
      element.defaultMuted = !hasSound;
      element.volume = hasSound ? 1 : 0;
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
    getVideoForSlot("main-video-banner-downloaded", "Main video banner"),
    getVideoForSlot("interview-preview-downloaded", "Interview preview"),
    getVideoForSlot("membership-campaign-preview-downloaded", "Membership campaign preview")
  ].filter(Boolean);

  useEffect(() => {
    const heroVideo = getVideoForSlot("top-video-advert-downloaded", "Top Video Advert");
    if (heroVideo) {
      window.setTimeout(() => playAdvertMuted(heroVideo), 120);
    }
  }, [approvedVideos]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visibleEntry) return;
        const videoId = visibleEntry.target.dataset.videoId;
        const video = approvedVideos.find((item) => item.id === videoId);
        if (video) {
          playAdvertMuted(video);
        }
      },
      { threshold: 0.58 }
    );

    Object.entries(videoRefs.current).forEach(([id, element]) => {
      if (element) {
        element.dataset.videoId = id;
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [approvedVideos, soundVideoId]);

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
            video={getVideoForSlot("top-video-advert-downloaded", "Top Video Advert")}
            label={copy.advert["top-video-advert-downloaded"].category}
            soundEnabled={soundVideoId === "top-video-advert-downloaded"}
            activeIframeId={activeIframeId}
            onPlay={handleVideoPlay}
            onEnableSound={enableSound}
            registerVideo={registerVideo}
            copy={copy}
          />
        </div>
        <div className="hero-content">
          <span className="eyebrow">{copy.heroEyebrow}</span>
          <h1>{copy.heroTitle}</h1>
          <p>{copy.heroCopy}</p>
          <div className="hero-actions discover-actions">
            <a className="button discover-button" href="#featured-story">
              {copy.discoverMore}
              <ArrowRight size={16} />
            </a>
          </div>
          <DirectContactButtons
            compact
            className="home-hero-contact"
            title={copy.contactTitle}
            subtext={copy.contactSubtext}
          />
        </div>
      </section>

      <section className="application-ready-section">
        <div className="media-final-cta">
          <span className="eyebrow">{copy.applicationEyebrow}</span>
          <h3>{copy.applicationTitle}</h3>
          <p>{copy.applicationCopy}</p>
          <div className="cinematic-trust-row" aria-label="Payment trust indicators">
            <span>{copy.encryptedSession}</span>
            <span>{copy.privateAccess}</span>
          </div>
          <div className="hero-actions">
            <Link className="button discover-button large" to="/apply">
              {copy.applyButton}
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      <section className="content-section media-showcase" id="featured-story">
        <SectionHeader
          eyebrow={copy.featuredEyebrow}
          title={copy.featuredTitle}
          copy={copy.featuredCopy}
        />
        <div className="media-story-stack">
          {advertVideos.map((video) => {
            const meta = copy.advert[video.id] || {
              category: video.category,
              copy: copy.defaultVideoCopy
            };

            return (
              <article className="media-story-block video-story-block" key={video.id}>
                <ApprovedVideoSlot
                  video={video}
                  label={meta.category}
                  soundEnabled={soundVideoId === video.id}
                  activeIframeId={activeIframeId}
                  onPlay={handleVideoPlay}
                  onEnableSound={enableSound}
                  registerVideo={registerVideo}
                  copy={copy}
                />
                <div className="media-story-copy">
                  <span className="eyebrow">{meta.category}</span>
                  <h3>{video.title}</h3>
                  <span className="video-source">{video.credit}</span>
                  <p>{meta.copy}</p>
                </div>
              </article>
            );
          })}
        </div>

        <div className="photo-story-stack">
          {["official-portrait", "campaign-still", "membership-lifestyle", "press-photo"].map((id, index) => {
            const image = imageById[id];
            const meta = copy.photos[id];

            return (
              <article className={`photo-story-block ${index % 2 ? "reverse" : ""}`} key={id}>
                <ApprovedPhotoSlot image={image} label={meta.title} copy={copy} />
                <div className="media-story-copy photo-copy">
                  <span className="eyebrow">{copy.visualStory}</span>
                  <h3>{meta.title}</h3>
                  <p>{meta.caption}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
