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
  const audioContextRef = useRef(null);
  const mutedRef = useRef(false);
  const timersRef = useRef([]);
  const heroImage = getApprovedHomeImages().find((image) => image.id === "official-portrait" || image.id === "press-photo");
  const heroVideo = getApprovedHomeVideos().find((video) => video.isDirectVideo);

  const clearIntroTimers = () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  };

  const stopIntroAudio = () => {
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  };

  useEffect(() => () => {
    clearIntroTimers();
    stopIntroAudio();
  }, []);

  const playIntroAudio = () => {
    if (mutedRef.current || audioContextRef.current) return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      const context = new AudioContext();
      audioContextRef.current = context;
      const master = context.createGain();
      master.gain.setValueAtTime(0.0001, context.currentTime);
      master.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.35);
      master.gain.exponentialRampToValueAtTime(0.018, context.currentTime + 5.7);
      master.connect(context.destination);

      const createTone = (type, start, duration, fromFrequency, toFrequency, volume) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(fromFrequency, context.currentTime + start);
        oscillator.frequency.exponentialRampToValueAtTime(toFrequency, context.currentTime + start + duration);
        gain.gain.setValueAtTime(0.0001, context.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + start + 0.18);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + start + duration);
        oscillator.connect(gain);
        gain.connect(master);
        oscillator.start(context.currentTime + start);
        oscillator.stop(context.currentTime + start + duration + 0.12);
      };

      createTone("sine", 0, 5.4, 82, 130, 0.38);
      createTone("triangle", 0.55, 3.7, 220, 520, 0.08);
      createTone("sine", 4.4, 1.4, 392, 784, 0.055);
    } catch {
      stopIntroAudio();
    }
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
      mutedRef.current = next;
      if (next) {
        stopIntroAudio();
      } else if (introActive || entering) {
        window.setTimeout(playIntroAudio, 0);
      }
      return next;
    });
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
          <div className="official-intro-bg" aria-hidden="true">
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
            <div className="intro-logo-reveal" aria-hidden="true">
              <span>KR</span>
            </div>
            <div className="intro-copy-sequence">
              <span>Official Membership Access</span>
              <span>Premium Digital Membership Cards</span>
              <span>Exclusive recognition for dedicated supporters</span>
            </div>
            <strong>Choose your membership. Grab yours now.</strong>
          </div>
        </div>
      ) : null}
    </section>
  );
}
