import { blobHomeVideos } from "./blobHomeVideos.js";

export const HOME_VIDEO_STORAGE_KEY = "home-media-video-review-decisions";

const blobVideoUrl = (id, fallback = "") => blobHomeVideos[id]?.url || fallback;

export const homeVideoSuggestions = [
  {
    id: "top-video-advert-downloaded",
    title: "John Wick: Chapter 4 Official Trailer",
    category: "Top video advert placeholder",
    videoUrl: blobVideoUrl("top-video-advert-downloaded", "/media/review-videos/top-video-advert.mp4"),
    embedUrl: "",
    thumbnailUrl: "",
    source: blobHomeVideos["top-video-advert-downloaded"]?.url ? "Vercel Blob" : "Downloaded review video",
    credit: "Lionsgate Movies",
    status: "approved",
    reviewedByManagement: true
  },
  {
    id: "main-video-banner-downloaded",
    title: "John Wick: Chapter 4 Behind-the-Scenes Stunt Clip",
    category: "Main approved video banner",
    videoUrl: blobVideoUrl("main-video-banner-downloaded", "/media/review-videos/main-video-banner-replacement-combined.mp4"),
    embedUrl: "",
    thumbnailUrl: "",
    source: blobHomeVideos["main-video-banner-downloaded"]?.url ? "Vercel Blob" : "Downloaded review video",
    credit: "IGN / Lionsgate promotional clip",
    status: "approved",
    reviewedByManagement: true
  },
  {
    id: "interview-preview-downloaded",
    title: "WIRED Autocomplete Interview",
    category: "Interview preview",
    videoUrl: blobVideoUrl("interview-preview-downloaded", "/media/review-videos/interview-preview.mp4"),
    embedUrl: "",
    thumbnailUrl: "",
    source: blobHomeVideos["interview-preview-downloaded"]?.url ? "Vercel Blob" : "Downloaded review video",
    credit: "WIRED",
    status: "approved",
    reviewedByManagement: true
  },
  {
    id: "membership-campaign-preview-downloaded",
    title: "John Wick: Chapter 4 Red Carpet Clip",
    category: "Membership campaign preview",
    videoUrl: blobVideoUrl("membership-campaign-preview-downloaded", "/media/review-videos/membership-campaign-preview.mp4"),
    embedUrl: "",
    thumbnailUrl: "",
    source: blobHomeVideos["membership-campaign-preview-downloaded"]?.url ? "Vercel Blob" : "Downloaded review video",
    credit: "The Sun Showbiz / PA red carpet footage",
    status: "approved",
    reviewedByManagement: true
  }
];

export const getVideoEmbedUrl = (url = "") => url;
export const getVideoThumbnailUrl = () => "";

export const getStoredHomeVideoDecisions = () => {
  try {
    return JSON.parse(localStorage.getItem(HOME_VIDEO_STORAGE_KEY)) || {};
  } catch {
    return {};
  }
};

export const mergeHomeVideoDecisions = (decisions = {}) =>
  homeVideoSuggestions.map((video) => {
    const decision = decisions[video.id] || {};
    const status = decision.status || video.status;
    const videoUrl = decision.videoUrl ?? video.videoUrl;
    const isDirectVideo = /\.(mp4|webm|ogg)(\?.*)?$/i.test(videoUrl);
    const isLocalVideo = videoUrl.startsWith("/");
    const shouldUseVideoTag = isLocalVideo || isDirectVideo;

    return {
      ...video,
      ...decision,
      videoUrl,
      isDirectVideo: shouldUseVideoTag,
      isLocalVideo,
      embedUrl: shouldUseVideoTag ? "" : decision.videoUrl ? getVideoEmbedUrl(decision.videoUrl) : decision.embedUrl || video.embedUrl || getVideoEmbedUrl(videoUrl),
      thumbnailUrl: shouldUseVideoTag
        ? ""
        : decision.videoUrl
          ? getVideoThumbnailUrl(decision.videoUrl)
          : decision.thumbnailUrl || video.thumbnailUrl,
      status,
      approved: status === "approved",
      reviewedByManagement: Boolean(decision.reviewedByManagement)
    };
  });

export const getApprovedHomeVideos = () =>
  mergeHomeVideoDecisions(getStoredHomeVideoDecisions()).filter((video) => video.approved);
