import { blobHomeImages } from "./blobHomeImages.js";

export const HOME_IMAGE_STORAGE_KEY = "home-media-image-review-decisions";

const blobImageUrl = (id, fallback = "") => blobHomeImages[id]?.url || fallback;
const downloadedImageUrl = (url) => url?.includes("vercel-storage.com") || url?.startsWith("/media/");

export const homeImageSuggestions = [
  {
    id: "official-portrait",
    title: "Keanu Reeves portrait, 2019",
    category: "Official portrait placeholder",
    imageUrl: blobImageUrl("official-portrait", "/media/review-images/keanu-reeves-2019.jpg"),
    alt: "Keanu Reeves photographed in 2019 during a public meeting in Sao Paulo",
    source: blobHomeImages["official-portrait"]?.url ? "Vercel Blob" : "Wikimedia Commons",
    credit: "Gilberto Marques / Governo do Estado de Sao Paulo, CC BY 2.0",
    status: "approved",
    reviewedByManagement: true
  },
  {
    id: "campaign-still",
    title: "John Wick red carpet portrait, 2014",
    category: "Campaign still placeholder",
    imageUrl: blobImageUrl("campaign-still", "/media/review-images/keanu-reeves-2014.jpg"),
    alt: "Keanu Reeves at a John Wick red carpet event in 2014",
    source: blobHomeImages["campaign-still"]?.url ? "Vercel Blob" : "Wikimedia Commons",
    credit: "Anna Hanks, CC BY 2.0",
    status: "approved",
    reviewedByManagement: true
  },
  {
    id: "membership-lifestyle",
    title: "Fantastic Fest portrait, 2013",
    category: "Membership card lifestyle placeholder",
    imageUrl: blobImageUrl("membership-lifestyle", "/media/review-images/keanu-fantastic-fest-2013.jpg"),
    alt: "Keanu Reeves at the Fantastic Fest premiere of Man of Tai Chi in 2013",
    source: blobHomeImages["membership-lifestyle"]?.url ? "Vercel Blob" : "Wikimedia Commons",
    credit: "Anna Hanks from Austin, Texas, USA, CC BY 2.0",
    status: "approved",
    reviewedByManagement: true
  },
  {
    id: "press-photo",
    title: "Keanu Reeves cropped portrait, 2019",
    category: "Approved press photo placeholder",
    imageUrl: blobImageUrl("press-photo", "/media/review-images/keanu-reeves-2019-cropped.jpg"),
    alt: "Cropped portrait of Keanu Reeves in 2019",
    source: blobHomeImages["press-photo"]?.url ? "Vercel Blob" : "Wikimedia Commons",
    credit: "Governo do Estado de Sao Paulo, CC BY 2.0",
    status: "approved",
    reviewedByManagement: true
  }
];

export const getStoredHomeImageDecisions = () => {
  try {
    return JSON.parse(localStorage.getItem(HOME_IMAGE_STORAGE_KEY)) || {};
  } catch {
    return {};
  }
};

export const mergeHomeImageDecisions = (decisions = {}) =>
  homeImageSuggestions.map((image) => {
    const decision = decisions[image.id] || {};
    const status = decision.status || image.status;
    const imageUrl = downloadedImageUrl(decision.imageUrl) ? decision.imageUrl : image.imageUrl;

    return {
      ...image,
      ...decision,
      imageUrl,
      status,
      approved: status === "approved",
      reviewedByManagement: Boolean(decision.reviewedByManagement)
    };
  });

export const getApprovedHomeImages = () =>
  mergeHomeImageDecisions(getStoredHomeImageDecisions()).filter((image) => image.approved);
