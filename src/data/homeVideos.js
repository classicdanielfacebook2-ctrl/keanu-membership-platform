import { blobHomeVideos } from "./blobHomeVideos.js";

export const HOME_VIDEO_STORAGE_KEY = "home-media-video-review-decisions";

const blobVideoUrl = (id, fallback = "") => blobHomeVideos[id]?.url || fallback;

export const homeVideoSuggestions = [
  {
    id: "top-video-advert",
    title: "John Wick: Chapter 4 Official Trailer",
    category: "Top video advert placeholder",
    videoUrl: blobVideoUrl("top-video-advert", "https://www.youtube.com/watch?v=qEVUtrk8_B4"),
    embedUrl: "",
    thumbnailUrl: "https://img.youtube.com/vi/qEVUtrk8_B4/hqdefault.jpg",
    source: blobHomeVideos["top-video-advert"]?.url ? "Vercel Blob" : "YouTube / Lionsgate Movies",
    credit: "Lionsgate Movies",
    status: "approved",
    reviewedByManagement: true
  },
  {
    id: "main-video-banner-approved-v2",
    title: "John Wick: Chapter 4 Behind-the-Scenes Stunt Clip",
    category: "Main approved video banner",
    videoUrl: blobVideoUrl("main-video-banner-approved-v2", "https://www.youtube.com/watch?v=yjRHZEUamCc"),
    embedUrl: "",
    thumbnailUrl: "https://img.youtube.com/vi/yjRHZEUamCc/hqdefault.jpg",
    source: blobHomeVideos["main-video-banner-approved-v2"]?.url ? "Vercel Blob" : "YouTube / Lionsgate Movies",
    credit: blobHomeVideos["main-video-banner-approved-v2"]?.url ? "IGN / Lionsgate promotional clip" : "Lionsgate Movies",
    status: "approved",
    reviewedByManagement: true
  },
  {
    id: "interview-preview",
    title: "WIRED Autocomplete Interview",
    category: "Interview preview",
    videoUrl: blobVideoUrl("interview-preview", "https://www.youtube.com/watch?v=X_2b4qMBXCI"),
    embedUrl: "",
    thumbnailUrl: "https://img.youtube.com/vi/X_2b4qMBXCI/hqdefault.jpg",
    source: blobHomeVideos["interview-preview"]?.url ? "Vercel Blob" : "YouTube / WIRED",
    credit: "WIRED",
    status: "approved",
    reviewedByManagement: true
  },
  {
    id: "membership-campaign-preview",
    title: "John Wick: Chapter 4 Red Carpet Clip",
    category: "Membership campaign preview",
    videoUrl: blobVideoUrl("membership-campaign-preview", "https://www.youtube.com/watch?v=LaLpGTtbwlM"),
    embedUrl: "",
    thumbnailUrl: "https://img.youtube.com/vi/LaLpGTtbwlM/hqdefault.jpg",
    source: blobHomeVideos["membership-campaign-preview"]?.url ? "Vercel Blob" : "YouTube / The Allison Hagendorf Show",
    credit: blobHomeVideos["membership-campaign-preview"]?.url ? "The Sun Showbiz / PA red carpet footage" : "The Allison Hagendorf Show",
    status: "approved",
    reviewedByManagement: true
  }
];

export const getYouTubeId = (url = "") => {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtube\.com\/embed\/([^?&]+)/,
    /youtu\.be\/([^?&]+)/
  ];
  const match = patterns.map((pattern) => url.match(pattern)).find(Boolean);
  return match?.[1] || "";
};

export const getVideoEmbedUrl = (url = "") => {
  const youtubeId = getYouTubeId(url);
  if (youtubeId) return `https://www.youtube.com/embed/${youtubeId}`;
  return url;
};

export const getVideoThumbnailUrl = (url = "") => {
  const youtubeId = getYouTubeId(url);
  if (youtubeId) return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
  return "";
};

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
