import { ArrowRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getApprovedHomeImages } from "../data/homeImages.js";
import { getApprovedHomeVideos } from "../data/homeVideos.js";

const introScenes = [
  { lead: "OFFICIAL", highlight: "MEMBERSHIP ACCESS" },
  { lead: "PRIVATE DIGITAL", highlight: "MEMBERSHIP CARDS" },
  { lead: "CREATED FOR", highlight: "DEDICATED SUPPORTERS" },
  { lead: "GRAB YOUR", highlight: "MEMBERSHIP NOW" }
];

export default function Welcome() {
  const navigate = useNavigate();
  const [entering, setEntering] = useState(false);
  const [introActive, setIntroActive] = useState(false);
  const [introScene, setIntroScene] = useState(0);
  const [introVideoFailed, setIntroVideoFailed] = useState(false);
  const introVideoRef = useRef(null);
  const timersRef = useRef([]);
  const introVideoSrc = "/intro/intro-video.mp4";
  const heroImage = getApprovedHomeImages().find((image) => image.id === "official-portrait" || image.id === "press-photo");
  const heroVideo = getApprovedHomeVideos().find((video) => video.isDirectVideo);

  const clearIntroTimers = () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  };

  useEffect(() => () => {
    clearIntroTimers();
  }, []);

  useEffect(() => {
    if (!introActive) return;

    setIntroScene(0);
    if (introVideoRef.current) {
      introVideoRef.current.currentTime = 0;
      introVideoRef.current.play().catch(() => setIntroVideoFailed(true));
    }

    introScenes.forEach((_, index) => {
      if (index === 0) return;
      timersRef.current.push(window.setTimeout(() => setIntroScene(index), index * 1450));
    });

    timersRef.current.push(
      window.setTimeout(() => {
        navigate("/home");
      }, 6500)
    );
  }, [introActive, navigate]);

  const enterPlatform = () => {
    if (entering) return;
    setEntering(true);

    timersRef.current.push(
      window.setTimeout(() => setIntroActive(true), 760)
    );
  };

  const skipIntro = () => {
    clearIntroTimers();
    navigate("/home");
  };

  return (
    <section className={entering ? "welcome-landing entering" : "welcome-landing"} aria-label="Official website welcome">
      <div className="welcome-media" aria-hidden="true">
        {heroVideo ? (
          <video src={heroVideo.videoUrl} autoPlay muted loop playsInline preload="auto" />
        ) : heroImage ? (
          <img src={heroImage.imageUrl} alt="" />
        ) : null}
      </div>
      <div className="welcome-overlay" aria-hidden="true" />
      <div className="welcome-particles" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="welcome-content">
        <span className="welcome-kicker">WELCOME TO THE OFFICIAL WEBSITE</span>
        <h1>KEANU REEVES</h1>
        <p>A premium membership experience for dedicated supporters worldwide.</p>
        <button className="button primary welcome-enter-button" type="button" onClick={enterPlatform} disabled={entering}>
          <span className="welcome-button-text">ENTER OFFICIAL PLATFORM</span>
          <ArrowRight className="welcome-button-arrow" size={18} />
        </button>
      </div>

      {introActive ? (
        <div className="official-intro" role="dialog" aria-label="Official platform introduction">
          <div className={introVideoFailed ? "official-intro-video failed" : "official-intro-video"} aria-hidden="true">
            {!introVideoFailed ? (
              <video
                ref={introVideoRef}
                src={introVideoSrc}
                playsInline
                muted
                loop
                preload="auto"
                onError={() => setIntroVideoFailed(true)}
              />
            ) : null}
          </div>
          <div className="official-intro-overlay" aria-hidden="true" />
          <div className="official-intro-bg" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <i />
            <i />
          </div>
          <button className="intro-skip-button" type="button" onClick={skipIntro}>
            Skip Intro
          </button>
          <div className="official-intro-content">
            <motion.div
              className="intro-logo-reveal"
              aria-hidden="true"
              initial={{ opacity: 0, scale: 0.82, filter: "blur(18px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={{ duration: 1.2, ease: [0.16, 0.78, 0.24, 1] }}
            >
              <span>KR</span>
            </motion.div>
            <div className="intro-scene-window">
              <AnimatePresence mode="wait">
                <motion.span
                  key={`${introScenes[introScene].lead}-${introScenes[introScene].highlight}`}
                  className="intro-scene-title"
                  initial={{ "--reveal": "0%", opacity: 0, y: 18 }}
                  animate={{ "--reveal": "100%", opacity: 1, y: 0 }}
                  exit={{ "--reveal": "100%", opacity: 0, y: -12 }}
                  transition={{ duration: 0.78, ease: [0.16, 0.78, 0.24, 1] }}
                >
                  <span>{introScenes[introScene].lead}</span>
                  <strong>{introScenes[introScene].highlight}</strong>
                </motion.span>
              </AnimatePresence>
            </div>
            <motion.strong
              className="intro-final-call"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: introScene >= 3 ? 1 : 0, y: introScene >= 3 ? 0 : 16 }}
              transition={{ duration: 0.75, ease: "easeOut" }}
            >
              Choose your membership. Grab yours now.
            </motion.strong>
          </div>
        </div>
      ) : null}
    </section>
  );
}
