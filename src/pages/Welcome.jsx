import { ArrowRight, Volume2, VolumeX } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getApprovedHomeImages } from "../data/homeImages.js";
import { getApprovedHomeVideos } from "../data/homeVideos.js";

const introScenes = [
  "WELCOME TO THE OFFICIAL PLATFORM",
  "A PRIVATE EXPERIENCE FOR TRUE SUPPORTERS",
  "EXCLUSIVE MEMBERSHIP ACCESS",
  "LIVE EVENTS • VIP BENEFITS • PREMIUM EXPERIENCE",
  "CONNECT • SUPPORT • EXPERIENCE",
  "THIS IS MORE THAN A MEMBERSHIP",
  "WELCOME TO KR GLOBAL"
];

export default function Welcome() {
  const navigate = useNavigate();
  const [entering, setEntering] = useState(false);
  const [introActive, setIntroActive] = useState(false);
  const [introScene, setIntroScene] = useState(0);
  const [muted, setMuted] = useState(false);
  const [introVideoFailed, setIntroVideoFailed] = useState(false);
  const introVideoRef = useRef(null);
  const introAudioRef = useRef(null);
  const voiceRef = useRef(null);
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

  const stopNarration = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    voiceRef.current = null;
  };

  useEffect(() => () => {
    clearIntroTimers();
    stopIntroAudio();
    stopNarration();
  }, []);

  useEffect(() => {
    if (!introActive) return;

    setIntroScene(0);
    if (introVideoRef.current) {
      introVideoRef.current.currentTime = 0;
      introVideoRef.current.play().catch(() => setIntroVideoFailed(true));
    }

    if (introAudioRef.current) {
      introAudioRef.current.volume = 0.55;
      introAudioRef.current.muted = muted;
      introAudioRef.current.play().catch(() => {});
    }

    introScenes.forEach((_, index) => {
      if (index === 0) return;
      timersRef.current.push(window.setTimeout(() => setIntroScene(index), index * 3600));
    });

    timersRef.current.push(
      window.setTimeout(() => {
        stopIntroAudio();
        stopNarration();
        navigate("/home");
      }, 28600)
    );
  }, [introActive, navigate]);

  useEffect(() => {
    if (introAudioRef.current) {
      introAudioRef.current.muted = muted;
    }
  }, [muted]);

  const playIntroAudio = () => {
    if (!introAudioRef.current) return;
    introAudioRef.current.currentTime = 0;
    introAudioRef.current.volume = 0.55;
    introAudioRef.current.muted = muted;
    introAudioRef.current.play().catch(() => {});
  };

  const playClickSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext || muted) return;
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(720, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(180, context.currentTime + 0.18);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.24);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.26);
      window.setTimeout(() => context.close().catch(() => {}), 420);
    } catch {
      // Sound is decorative; ignore unavailable audio APIs.
    }
  };

  const playNarration = (force = false) => {
    if ((!force && muted) || !("speechSynthesis" in window)) return;
    stopNarration();
    const narration = new SpeechSynthesisUtterance(`${introScenes.join(". ")}. Choose your membership. Grab yours now.`);
    narration.rate = 0.78;
    narration.pitch = 0.82;
    narration.volume = 0.82;
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find((voice) => /male|david|mark|daniel|english/i.test(`${voice.name} ${voice.lang}`));
    if (preferredVoice) narration.voice = preferredVoice;
    voiceRef.current = narration;
    window.speechSynthesis.speak(narration);
  };

  const enterPlatform = () => {
    if (entering) return;
    setEntering(true);
    playClickSound();
    playIntroAudio();
    playNarration();

    timersRef.current.push(
      window.setTimeout(() => setIntroActive(true), 760)
    );
  };

  const skipIntro = () => {
    clearIntroTimers();
    stopIntroAudio();
    stopNarration();
    navigate("/home");
  };

  const toggleMute = () => {
    setMuted((current) => {
      const next = !current;
      if (introAudioRef.current) {
        introAudioRef.current.muted = next;
        if (!next && introActive) {
          introAudioRef.current.play().catch(() => {});
          playNarration(true);
        } else if (next) {
          stopNarration();
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
            <span />
            <span />
            <span />
            <span />
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
                  key={introScenes[introScene]}
                  className="intro-scene-title"
                  initial={{ opacity: 0, y: 26, scale: 0.96, filter: "blur(14px)" }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -22, scale: 1.025, filter: "blur(12px)" }}
                  transition={{ duration: 0.95, ease: [0.16, 0.78, 0.24, 1] }}
                >
                  {introScenes[introScene]}
                </motion.span>
              </AnimatePresence>
            </div>
            <motion.strong
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: introScene >= 5 ? 1 : 0, y: introScene >= 5 ? 0 : 16 }}
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
