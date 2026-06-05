import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";
import { getApprovedHomeImages } from "../data/homeImages.js";
import { getApprovedHomeVideos } from "../data/homeVideos.js";

export default function Welcome() {
  const { language, setLanguage, t } = useLanguage();
  const heroImage = getApprovedHomeImages().find((image) => image.id === "official-portrait" || image.id === "press-photo");
  const heroVideo = getApprovedHomeVideos().find((video) => video.isDirectVideo);

  return (
    <section className="welcome-landing" aria-label={t.welcome.aria}>
      <label className="welcome-language-switcher" htmlFor="welcomeLanguage">
        <span>{t.language.label}</span>
        <select id="welcomeLanguage" value={language} onChange={(event) => setLanguage(event.target.value)}>
          <option value="en">{t.language.english}</option>
          <option value="de">{t.language.german}</option>
        </select>
      </label>
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
        <span className="welcome-kicker">{t.welcome.kicker}</span>
        <h1>{t.welcome.title}</h1>
        <p>{t.welcome.subtitle}</p>
        <Link className="button primary welcome-enter-button" to="/home">
          <span className="welcome-button-text">{t.welcome.enter}</span>
          <ArrowRight className="welcome-button-arrow" size={18} />
        </Link>
      </div>
    </section>
  );
}
