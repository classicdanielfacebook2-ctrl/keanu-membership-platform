import { Image, Play, Video } from "lucide-react";

export function VideoPlaceholder({ compact = false, label = "Approved Keanu Reeves video advert" }) {
  return (
    <div className={compact ? "media-placeholder video compact" : "media-placeholder video"}>
      <div className="media-overlay" />
      <div className="play-ring">
        <Play size={34} fill="currentColor" />
      </div>
      <div className="media-caption">
        <Video size={18} />
        <strong>{label}</strong>
        <span>Licensed management-approved video will replace this placeholder before launch.</span>
      </div>
    </div>
  );
}

export function PhotoPlaceholder({ label = "Approved official photo" }) {
  return (
    <div className="media-placeholder photo">
      <div className="media-overlay" />
      <Image size={28} />
      <span>{label}</span>
    </div>
  );
}
