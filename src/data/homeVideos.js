export const HOME_VIDEO_STORAGE_KEY = "home-media-video-review-decisions";

export const homeVideoSuggestions = [
  {
    id: "top-video-advert",
    title: "John Wick: Chapter 4 Official Trailer",
    category: "Top video advert placeholder",
    videoUrl: "https://www.youtube.com/watch?v=qEVUtrk8_B4",
    embedUrl: "https://www.youtube.com/embed/qEVUtrk8_B4",
    thumbnailUrl: "https://img.youtube.com/vi/qEVUtrk8_B4/hqdefault.jpg",
    source: "YouTube / Lionsgate Movies",
    credit: "Lionsgate Movies",
    status: "approved",
    reviewedByManagement: true
  },
  {
    id: "main-video-banner-approved-v2",
    title: "John Wick: Chapter 4 Final Trailer",
    category: "Main approved video banner",
    videoUrl: "https://www.youtube.com/watch?v=yjRHZEUamCc",
    embedUrl: "https://www.youtube.com/embed/yjRHZEUamCc",
    thumbnailUrl: "https://img.youtube.com/vi/yjRHZEUamCc/hqdefault.jpg",
    source: "YouTube / Lionsgate Movies",
    credit: "Lionsgate Movies",
    status: "approved",
    reviewedByManagement: true
  },
  {
    id: "interview-preview",
    title: "WIRED Autocomplete Interview",
    category: "Interview preview",
    videoUrl: "https://www.youtube.com/watch?v=X_2b4qMBXCI",
    embedUrl: "https://www.youtube.com/embed/X_2b4qMBXCI",
    thumbnailUrl: "https://img.youtube.com/vi/X_2b4qMBXCI/hqdefault.jpg",
    source: "YouTube / WIRED",
    credit: "WIRED",
    status: "approved",
    reviewedByManagement: true
  },
  {
    id: "membership-campaign-preview",
    title: "Keanu Reeves and Dogstar Interview",
    category: "Membership campaign preview",
    videoUrl: "https://www.youtube.com/watch?v=LaLpGTtbwlM",
    embedUrl: "https://www.youtube.com/embed/LaLpGTtbwlM",
    thumbnailUrl: "https://img.youtube.com/vi/LaLpGTtbwlM/hqdefault.jpg",
    source: "YouTube / The Allison Hagendorf Show",
    credit: "The Allison Hagendorf Show",
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
    const isLocalVideo = videoUrl.startsWith("/");

    return {
      ...video,
      ...decision,
      videoUrl,
      isLocalVideo,
      embedUrl: isLocalVideo ? "" : decision.videoUrl ? getVideoEmbedUrl(decision.videoUrl) : decision.embedUrl || video.embedUrl,
      thumbnailUrl: isLocalVideo
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
