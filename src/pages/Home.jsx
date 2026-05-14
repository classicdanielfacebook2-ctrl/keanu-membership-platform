import { useRef, useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { PhotoPlaceholder, VideoPlaceholder } from "../components/MediaPlaceholder.jsx";
import SectionHeader from "../components/SectionHeader.jsx";
import { getApprovedHomeImages } from "../data/homeImages.js";
import { getApprovedHomeVideos } from "../data/homeVideos.js";

const advertCopy = {
  "top-video-advert-downloaded": {
    category: "Top Video Advert",
    copy: "Discover a premium membership experience designed for dedicated supporters and eligible applicants."
  },
  "main-video-banner-downloaded": {
    category: "Cinematic Membership Film",
    copy: "Explore the official membership card process, created to guide applicants through a secure and professional application journey."
  },
  "interview-preview-downloaded": {
    category: "Interview Feature",
    copy: "Explore selected media moments that highlight the story, personality, and career journey behind the platform."
  },
  "membership-campaign-preview-downloaded": {
    category: "Membership Campaign Film",
    copy: "Learn how each card tier is structured, what applicants receive, and how the premium membership experience works."
  }
};

const photoCopy = {
  "official-portrait": {
    title: "Official Portrait",
    caption:
      "A refined official portrait section presenting the face of the membership experience with a mature and premium visual tone."
  },
  "campaign-still": {
    title: "Campaign Still",
    caption:
      "A selected campaign image used to support the platform's official membership message and create a stronger visual identity."
  },
  "membership-lifestyle": {
    title: "Membership Card Lifestyle",
    caption:
      "A lifestyle visual showing the premium feeling of card ownership and the value of belonging to an elevated membership experience."
  },
  "press-photo": {
    title: "Press Photo",
    caption:
      "A refined press image used to strengthen trust, recognition, and professional presentation."
  }
};

function ApprovedVideoSlot({ video, label, soundEnabled, activeIframeId, onPlay, onEnableSound, registerVideo }) {
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
          <span>Video ready</span>
        </div>
      )}
      {!soundEnabled ? (
        <button className="sound-toggle" type="button" onClick={() => onEnableSound(video.id)}>
          Tap for Sound
        </button>
      ) : null}
    </div>
  );
}

function ApprovedPhotoSlot({ image, label }) {
  const [failed, setFailed] = useState(false);

  if (!image || failed) {
    return <PhotoPlaceholder label={failed ? "Media currently unavailable" : label} />;
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
    const heroVideo = getVideoForSlot("top-video-advert-downloaded", "Top video advert placeholder");
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
            video={getVideoForSlot("top-video-advert-downloaded", "Top video advert placeholder")}
            label="Top video advert placeholder"
            soundEnabled={soundVideoId === "top-video-advert-downloaded"}
            activeIframeId={activeIframeId}
            onPlay={handleVideoPlay}
            onEnableSound={enableSound}
            registerVideo={registerVideo}
          />
        </div>
        <div className="hero-content">
          <span className="eyebrow">A Premium Membership Experience</span>
          <h1>More than a card. A connection to a story that continues to inspire.</h1>
          <p>
            Behind every membership card is more than a name. It represents a journey, loyalty,
            recognition, and a connection to a legacy built through discipline, struggle, and
            worldwide admiration.
          </p>
          <p>
            Explore the story, the career, the defining moments, and the premium membership
            experience created for dedicated supporters.
          </p>
        </div>
      </section>

      <section className="application-ready-section">
        <div className="media-final-cta">
          <span className="eyebrow">Application Ready</span>
          <h3>Begin your membership application</h3>
          <p>
            Choose your preferred membership level and continue through a secure guided application
            experience designed for dedicated supporters.
          </p>
          <div className="hero-actions">
            <Link className="button primary large" to="/apply">
              Apply for Membership
              <ArrowRight size={18} />
            </Link>
            <Link className="button secondary large" to="/cards">
              View Membership Cards
            </Link>
          </div>
        </div>
      </section>

      <section className="content-section media-showcase">
        <SectionHeader
          eyebrow="Featured Story"
          title="A cinematic path through career, character, and cultural impact."
          copy="Each visual moment is presented like a premium documentary sequence, moving from career-defining roles to the enduring admiration that surrounds the story."
        />
        <div className="media-story-stack">
          {advertVideos.map((video) => {
            const meta = advertCopy[video.id] || {
              category: video.category,
              copy: "A cinematic media moment prepared for premium membership presentation."
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
            const meta = photoCopy[id];

            return (
              <article className={`photo-story-block ${index % 2 ? "reverse" : ""}`} key={id}>
                <ApprovedPhotoSlot image={image} label={`${meta.title} placeholder`} />
                <div className="media-story-copy photo-copy">
                  <span className="eyebrow">Visual Story</span>
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
