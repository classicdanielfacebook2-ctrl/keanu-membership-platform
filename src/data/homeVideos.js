export const HOME_VIDEO_STORAGE_KEY = "home-media-video-review-decisions";

export const homeVideoSuggestions = [
  {
    id: "top-video-advert-local",
    title: "John Wick: Chapter 4 Official Trailer",
    category: "Top video advert placeholder",
    videoUrl: "/media/review-videos/top-video-advert.mp4",
    embedUrl: "",
    thumbnailUrl: "",
    source: "Local review video file",
    credit: "Lionsgate Movies",
    status: "pending",
    reviewedByManagement: false
  },
  {
    id: "main-video-banner-unavailable",
    title: "John Wick: Chapter 4 Action Featurette",
    category: "Main approved video banner",
    videoUrl: "",
    embedUrl: "",
    thumbnailUrl: "",
    source: "Original YouTube candidate unavailable",
    credit: "Lionsgate Movies",
    status: "pending",
    reviewedByManagement: false
  },
  {
    id: "main-video-banner-local-replacement",
    title: "John Wick: Chapter 4 Behind-the-Scenes Stunt Clip",
    category: "Main approved video banner",
    videoUrl: "/media/review-videos/main-video-banner-replacement-combined.mp4",
    embedUrl: "",
    thumbnailUrl: "",
    source: "Local review video file",
    credit: "IGN / Lionsgate promotional clip",
    status: "pending",
    reviewedByManagement: false
  },
  {
    id: "interview-preview-local",
    title: "WIRED Autocomplete Interview",
    category: "Interview preview",
    videoUrl: "/media/review-videos/interview-preview.mp4",
    embedUrl: "",
    thumbnailUrl: "",
    source: "Local review video file",
    credit: "WIRED",
    status: "pending",
    reviewedByManagement: false
  },
  {
    id: "membership-campaign-preview-local",
    title: "John Wick: Chapter 4 Red Carpet Clip",
    category: "Membership campaign preview",
    videoUrl: "/media/review-videos/membership-campaign-preview.mp4",
    embedUrl: "",
    thumbnailUrl: "",
    source: "Local review video file",
    credit: "The Sun Showbiz / PA red carpet footage",
    status: "pending",
    reviewedByManagement: false
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
