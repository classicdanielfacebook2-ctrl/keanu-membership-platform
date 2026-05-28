import { ArrowRight, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getApprovedHomeImages } from "../data/homeImages.js";
import { getApprovedHomeVideos } from "../data/homeVideos.js";

export default function Welcome() {
  const navigate = useNavigate();
  const [entering, setEntering] = useState(false);
  const [introActive, setIntroActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [introVideoFailed, setIntroVideoFailed] = useState(false);
  const introVideoRef = useRef(null);
  const introAudioRef = useRef(null);
  const timersRef = useRef([]);
  const introVideoSrc = "/intro/keanu-intro.mp4";
  const introAudioSrc = "/audio/intro-sound.mp3";
  const heroImage = getApprovedHomeImages().find((image) => image.id === "official-portrait" || image.id === "press-photo");
  const heroVideo = getApprovedHomeVideos().find((video) => video.isDirectVideo);

  const clearIntroTimers = () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  };

  const stopIntroAudio = () => {
    if (introAudioRef.current) {
      introAudioRef.current.pause();
      introAudioRef.current.currentTime = 0;
    }
  };

  useEffect(() => () => {
    clearIntroTimers();
    stopIntroAudio();
  }, []);

  useEffect(() => {
    if (!introActive) return;

    if (introVideoRef.current) {
      introVideoRef.current.currentTime = 0;
      introVideoRef.current.play().catch(() => setIntroVideoFailed(true));
    }

    if (introAudioRef.current) {
      introAudioRef.current.volume = 0.55;
      introAudioRef.current.muted = muted;
      introAudioRef.current.play().catch(() => {});
    }
  }, [introActive, muted]);

  const playIntroAudio = () => {
    if (!introAudioRef.current) return;
    introAudioRef.current.currentTime = 0;
    introAudioRef.current.volume = 0.55;
    introAudioRef.current.muted = muted;
    introAudioRef.current.play().catch(() => {});
  };

  const enterPlatform = () => {
    if (entering) return;
    setEntering(true);
    playIntroAudio();

    timersRef.current.push(
      window.setTimeout(() => setIntroActive(true), 760),
      window.setTimeout(() => {
        stopIntroAudio();
        navigate("/home");
      }, 7200)
    );
  };

  const skipIntro = () => {
    clearIntroTimers();
    stopIntroAudio();
    navigate("/home");
  };

  const toggleMute = () => {
    setMuted((current) => {
      const next = !current;
      if (introAudioRef.current) {
        introAudioRef.current.muted = next;
        if (!next && introActive) {
          introAudioRef.current.play().catch(() => {});
        }
      }
      return next;
    });
  };

  return (
    <section className={entering ? "welcome-landing entering" : "welcome-landing"} aria-label="Official website welcome">
      <audio ref={introAudioRef} src={introAudioSrc} preload="auto" onError={() => {}} />
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
                preload="auto"
                onError={() => setIntroVideoFailed(true)}
              />
            ) : null}
          </div>
          <div className="official-intro-overlay" aria-hidden="true" />
          <div className="official-intro-bg" aria-hidden="true">
            <i />
            <i />
          </div>
          <button className="intro-audio-toggle" type="button" onClick={toggleMute} aria-label={muted ? "Unmute intro audio" : "Mute intro audio"}>
            {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>
          <button className="intro-skip-button" type="button" onClick={skipIntro}>
            Skip Intro
          </button>
          <div className="official-intro-content">
            <div className="intro-logo-reveal" aria-hidden="true">
              <span>KR</span>
            </div>
            <div className="intro-copy-sequence">
              <span>Premium Membership Access</span>
              <span>Digital Membership Cards</span>
              <span>Created for dedicated supporters worldwide</span>
            </div>
            <strong>Choose your membership. Grab yours now.</strong>
          </div>
        </div>
      ) : null}
    </section>
  );
}
