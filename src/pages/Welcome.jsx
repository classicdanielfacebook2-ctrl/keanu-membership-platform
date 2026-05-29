import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { getApprovedHomeImages } from "../data/homeImages.js";
import { getApprovedHomeVideos } from "../data/homeVideos.js";

export default function Welcome() {
  const heroImage = getApprovedHomeImages().find((image) => image.id === "official-portrait" || image.id === "press-photo");
  const heroVideo = getApprovedHomeVideos().find((video) => video.isDirectVideo);

  return (
    <section className="welcome-landing" aria-label="Official website welcome">
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
        <Link className="button primary welcome-enter-button" to="/home">
          <span className="welcome-button-text">ENTER OFFICIAL PLATFORM</span>
          <ArrowRight className="welcome-button-arrow" size={18} />
        </Link>
      </div>
    </section>
  );
}
