import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, ImageOff, Play, RotateCcw, XCircle } from "lucide-react";
import SectionHeader from "../components/SectionHeader.jsx";
import {
  getStoredKeanuMediaDecisions,
  KEANU_MEDIA_STORAGE_KEY,
  mergeKeanuMediaDecisions
} from "../data/keanuImages.js";
import {
  getStoredHomeImageDecisions,
  HOME_IMAGE_STORAGE_KEY,
  mergeHomeImageDecisions
} from "../data/homeImages.js";
import {
  getVideoEmbedUrl,
  getVideoThumbnailUrl,
  getStoredHomeVideoDecisions,
  HOME_VIDEO_STORAGE_KEY,
  mergeHomeVideoDecisions
} from "../data/homeVideos.js";

const saveStorage = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

function ReviewSection({
  title,
  copy,
  items,
  decisions,
  storageKey,
  setDecisions,
  type,
  failedMedia,
  setFailedMedia
}) {
  const saveDecision = (id, updates) => {
    const next = {
      ...decisions,
      [id]: {
        ...(decisions[id] || {}),
        ...updates
      }
    };
    setDecisions(next);
    saveStorage(storageKey, next);
  };

  const resetDecision = (id) => {
    const next = { ...decisions };
    delete next[id];
    setDecisions(next);
    saveStorage(storageKey, next);
    setFailedMedia((current) => ({ ...current, [id]: false }));
  };

  return (
    <section className="media-review-block">
      <div className="media-review-block-header">
        <div>
          <span className="eyebrow">Pending Management Review</span>
          <h2>{title}</h2>
          <p>{copy}</p>
        </div>
        <div className="mini-review-stats">
          <span>{items.filter((item) => item.status === "approved").length} approved</span>
          <span>{items.filter((item) => item.status === "rejected").length} rejected</span>
        </div>
      </div>

      <div className="media-review-grid">
        {items.map((item) => {
          const unavailable = failedMedia[item.id];
          const primaryUrl = type === "video" ? item.videoUrl : item.imageUrl;
          return (
            <article className={`media-review-card ${item.status || "pending"}`} key={item.id}>
              <div className={type === "video" ? "review-image-frame video-review-frame" : "review-image-frame"}>
                {unavailable ? (
                  <div className="image-unavailable">
                    <ImageOff size={32} />
                    <span>Media unavailable — replace URL</span>
                  </div>
                ) : type === "video" ? (
                  <>
                    {item.isLocalVideo ? (
                      <video
                        src={item.videoUrl}
                        preload="metadata"
                        muted
                        playsInline
                        onError={() => setFailedMedia((current) => ({ ...current, [item.id]: true }))}
                      />
                    ) : (
                      <img
                        src={item.thumbnailUrl}
                        alt={`${item.title} thumbnail`}
                        loading="lazy"
                        onError={() => setFailedMedia((current) => ({ ...current, [item.id]: true }))}
                      />
                    )}
                    <div className="video-review-play">
                      <Play size={28} fill="currentColor" />
                    </div>
                  </>
                ) : (
                  <img
                    src={item.imageUrl}
                    alt={item.alt}
                    loading="lazy"
                    onError={() => setFailedMedia((current) => ({ ...current, [item.id]: true }))}
                  />
                )}
                <span className="review-status">{item.status || "pending review"}</span>
              </div>

              <div className="review-card-copy">
                <span className="eyebrow">{item.category}</span>
                <h3>{item.title}</h3>
                <p>{type === "video" ? item.videoUrl : item.alt}</p>
                <dl>
                  <div>
                    <dt>Source</dt>
                    <dd>
                      <a href={primaryUrl} target="_blank" rel="noreferrer">
                        {item.source}
                        <ExternalLink size={14} />
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt>Credit</dt>
                    <dd>{item.credit}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{item.reviewedByManagement ? "Reviewed by management" : "Pending management review"}</dd>
                  </div>
                </dl>

                <label htmlFor={`replace-${type}-${item.id}`}>
                  Replace URL
                  <input
                    id={`replace-${type}-${item.id}`}
                    value={primaryUrl}
                    onChange={(event) => {
                      const value = event.target.value;
                      saveDecision(
                        item.id,
                        type === "video"
                          ? {
                              videoUrl: value,
                              embedUrl: getVideoEmbedUrl(value),
                              thumbnailUrl: getVideoThumbnailUrl(value)
                            }
                          : { imageUrl: value }
                      );
                      setFailedMedia((current) => ({ ...current, [item.id]: false }));
                    }}
                  />
                </label>

                <div className="media-review-actions">
                  <button
                    type="button"
                    onClick={() =>
                      saveDecision(item.id, {
                        status: "approved",
                        approved: true,
                        reviewedByManagement: true
                      })
                    }
                  >
                    <CheckCircle2 size={16} />
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      saveDecision(item.id, {
                        status: "rejected",
                        approved: false,
                        reviewedByManagement: true
                      })
                    }
                  >
                    <XCircle size={16} />
                    Reject
                  </button>
                  <button type="button" onClick={() => resetDecision(item.id)}>
                    <RotateCcw size={16} />
                    Reset
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function MediaReview() {
  const [bioDecisions, setBioDecisions] = useState({});
  const [homeImageDecisions, setHomeImageDecisions] = useState({});
  const [homeVideoDecisions, setHomeVideoDecisions] = useState({});
  const [failedMedia, setFailedMedia] = useState({});

  useEffect(() => {
    setBioDecisions(getStoredKeanuMediaDecisions());
    setHomeImageDecisions(getStoredHomeImageDecisions());
    setHomeVideoDecisions(getStoredHomeVideoDecisions());
  }, []);

  const bioImages = useMemo(() => mergeKeanuMediaDecisions(bioDecisions), [bioDecisions]);
  const homeImages = useMemo(() => mergeHomeImageDecisions(homeImageDecisions), [homeImageDecisions]);
  const homeVideos = useMemo(() => mergeHomeVideoDecisions(homeVideoDecisions), [homeVideoDecisions]);

  const totalItems = bioImages.length + homeImages.length + homeVideos.length;
  const totalApproved = [...bioImages, ...homeImages, ...homeVideos].filter((item) => item.status === "approved").length;
  const totalRejected = [...bioImages, ...homeImages, ...homeVideos].filter((item) => item.status === "rejected").length;

  return (
    <section className="page-section wide-page media-review-page">
      <SectionHeader
        eyebrow="Private Media Review"
        title="Management approval center for public media."
        copy="All collected videos and photos start pending. Only approved Home media appears publicly; rejected and pending media remain hidden behind premium placeholders."
      />

      <div className="media-review-stats">
        <article>
          <span>Total suggestions</span>
          <strong>{totalItems}</strong>
        </article>
        <article>
          <span>Approved</span>
          <strong>{totalApproved}</strong>
        </article>
        <article>
          <span>Rejected</span>
          <strong>{totalRejected}</strong>
        </article>
      </div>

      <ReviewSection
        title="Home Videos"
        copy="YouTube/Vimeo-style embeds for the Home hero, main video banner, interview preview, and campaign preview."
        items={homeVideos}
        decisions={homeVideoDecisions}
        setDecisions={setHomeVideoDecisions}
        storageKey={HOME_VIDEO_STORAGE_KEY}
        type="video"
        failedMedia={failedMedia}
        setFailedMedia={setFailedMedia}
      />

      <ReviewSection
        title="Home Photos"
        copy="Portrait, campaign, lifestyle, and press-photo suggestions for the public Home gallery."
        items={homeImages}
        decisions={homeImageDecisions}
        setDecisions={setHomeImageDecisions}
        storageKey={HOME_IMAGE_STORAGE_KEY}
        type="image"
        failedMedia={failedMedia}
        setFailedMedia={setFailedMedia}
      />

      <ReviewSection
        title="Biography / Journey Images"
        copy="Existing image suggestions for the Keanu Reeves Journey page. These remain separate from the Home media queue."
        items={bioImages}
        decisions={bioDecisions}
        setDecisions={setBioDecisions}
        storageKey={KEANU_MEDIA_STORAGE_KEY}
        type="image"
        failedMedia={failedMedia}
        setFailedMedia={setFailedMedia}
      />
    </section>
  );
}
