// Review-only media suggestions. Do not use on public pages unless approved by management.
import { blobKeanuImages } from "./blobKeanuImages.js";

export const KEANU_MEDIA_STORAGE_KEY = "keanu-media-review-decisions";

const blobImageUrl = (id, fallback = "") => blobKeanuImages[id]?.url || fallback;
const downloadedImageUrl = (url) => url?.includes("vercel-storage.com") || url?.startsWith("/media/");

export const keanuImageSuggestions = [
  {
    id: "homepage-hero",
    category: "Homepage hero image",
    title: "Keanu Reeves portrait, 2019",
    imageUrl: blobImageUrl("homepage-hero", "/media/review-images/keanu-reeves-2019.jpg"),
    alt: "Keanu Reeves photographed in 2019 during a public meeting in Sao Paulo",
    sourceWebsite: blobKeanuImages["homepage-hero"]?.url ? "Vercel Blob" : "Downloaded review image",
    sourceUrl: blobImageUrl("homepage-hero", "/media/review-images/keanu-reeves-2019.jpg"),
    credit: "Gilberto Marques / Governo do Estado de Sao Paulo, CC BY 2.0",
    note: "Needs review before publishing",
    approved: false
  },
  {
    id: "young-keanu",
    category: "Childhood / young Keanu",
    title: "Young Keanu Reeves publicity still, 1986",
    imageUrl: blobImageUrl("young-keanu", "/media/review-images/young-keanu-cropped2.jpg"),
    alt: "Young Keanu Reeves in a 1986 publicity still",
    sourceWebsite: blobKeanuImages["young-keanu"]?.url ? "Vercel Blob" : "Downloaded review image",
    sourceUrl: blobImageUrl("young-keanu", "/media/review-images/young-keanu-cropped2.jpg"),
    credit: "CBS publicity still, listed on Commons as public-domain/no-notice review candidate",
    note: "Needs review before publishing",
    approved: false
  },
  {
    id: "early-acting",
    category: "Early acting career",
    title: "Keanu Reeves and Andy Griffith, 1986 press photo",
    imageUrl: blobImageUrl("early-acting", "/media/review-images/keanu-andy-griffith-1986.jpg"),
    alt: "Keanu Reeves and Andy Griffith in a 1986 press photo",
    sourceWebsite: blobKeanuImages["early-acting"]?.url ? "Vercel Blob" : "Downloaded review image",
    sourceUrl: blobImageUrl("early-acting", "/media/review-images/keanu-andy-griffith-1986.jpg"),
    credit: "CBS publicity still, listed on Commons as public-domain/no-notice review candidate",
    note: "Needs review before publishing",
    approved: false
  },
  {
    id: "bill-ted-era",
    category: "Bill & Ted era",
    title: "Bill & Ted cultural reference image",
    imageUrl: blobImageUrl("bill-ted-era", "/media/review-images/bill-ted-be-excellent.jpg"),
    alt: "A public sign reading Be Excellent to Each Other, referencing Bill and Ted",
    sourceWebsite: blobKeanuImages["bill-ted-era"]?.url ? "Vercel Blob" : "Downloaded review image",
    sourceUrl: blobImageUrl("bill-ted-era", "/media/review-images/bill-ted-be-excellent.jpg"),
    credit: "Jeremy Segrott from Cardiff, Wales, UK, CC BY 2.0",
    note: "Needs review before publishing",
    approved: false
  },
  {
    id: "speed-era",
    category: "Speed era",
    title: "1990s era placeholder candidate",
    imageUrl: blobImageUrl("speed-era", "/media/review-images/young-keanu-cropped2.jpg"),
    alt: "Young Keanu Reeves cropped publicity image for 1990s era review placement",
    sourceWebsite: blobKeanuImages["speed-era"]?.url ? "Vercel Blob" : "Downloaded review image",
    sourceUrl: blobImageUrl("speed-era", "/media/review-images/young-keanu-cropped2.jpg"),
    credit: "CBS publicity still, listed on Commons as public-domain/no-notice review candidate",
    note: "Needs review before publishing",
    approved: false
  },
  {
    id: "matrix-era",
    category: "The Matrix era",
    title: "Neo prop from The Matrix",
    imageUrl: blobImageUrl("matrix-era", "/media/review-images/matrix-neo-prop.jpg"),
    alt: "A prop submachine gun used by Neo in The Matrix displayed in a museum",
    sourceWebsite: blobKeanuImages["matrix-era"]?.url ? "Vercel Blob" : "Downloaded review image",
    sourceUrl: blobImageUrl("matrix-era", "/media/review-images/matrix-neo-prop.jpg"),
    credit: "Carlos Varela from Valladolid, Spain, CC BY 2.0",
    note: "Needs review before publishing",
    approved: false
  },
  {
    id: "john-wick-era",
    category: "John Wick era",
    title: "Keanu Reeves at John Wick red carpet, 2014",
    imageUrl: blobImageUrl("john-wick-era", "/media/review-images/keanu-reeves-2014.jpg"),
    alt: "Keanu Reeves at a John Wick red carpet event in 2014",
    sourceWebsite: blobKeanuImages["john-wick-era"]?.url ? "Vercel Blob" : "Downloaded review image",
    sourceUrl: blobImageUrl("john-wick-era", "/media/review-images/keanu-reeves-2014.jpg"),
    credit: "Anna Hanks, CC BY 2.0",
    note: "Needs review before publishing",
    approved: false
  },
  {
    id: "red-carpet-legacy",
    category: "Red carpet / legacy",
    title: "Keanu Reeves at Grand Rex, 2023",
    imageUrl: blobImageUrl("red-carpet-legacy", "/media/review-images/keanu-grand-rex-2023.jpg"),
    alt: "Keanu Reeves at the Grand Rex in 2023",
    sourceWebsite: blobKeanuImages["red-carpet-legacy"]?.url ? "Vercel Blob" : "Downloaded review image",
    sourceUrl: blobImageUrl("red-carpet-legacy", "/media/review-images/keanu-grand-rex-2023.jpg"),
    credit: "ManoSolo13241324, Wikimedia Commons",
    note: "Needs review before publishing",
    approved: false
  },
  {
    id: "gallery-2013-premiere",
    category: "Gallery photos",
    title: "Fantastic Fest portrait, 2013",
    imageUrl: blobImageUrl("gallery-2013-premiere", "/media/review-images/keanu-fantastic-fest-2013.jpg"),
    alt: "Keanu Reeves at the Fantastic Fest premiere of Man of Tai Chi in 2013",
    sourceWebsite: blobKeanuImages["gallery-2013-premiere"]?.url ? "Vercel Blob" : "Downloaded review image",
    sourceUrl: blobImageUrl("gallery-2013-premiere", "/media/review-images/keanu-fantastic-fest-2013.jpg"),
    credit: "Anna Hanks from Austin, Texas, USA, CC BY 2.0",
    note: "Needs review before publishing",
    approved: false
  },
  {
    id: "gallery-2013-qa",
    category: "Gallery photos",
    title: "Fantastic Fest Q&A, 2013",
    imageUrl: blobImageUrl("gallery-2013-qa", "/media/review-images/keanu-fantastic-fest-qa-2013.jpg"),
    alt: "Keanu Reeves during a Fantastic Fest Q&A in 2013",
    sourceWebsite: blobKeanuImages["gallery-2013-qa"]?.url ? "Vercel Blob" : "Downloaded review image",
    sourceUrl: blobImageUrl("gallery-2013-qa", "/media/review-images/keanu-fantastic-fest-qa-2013.jpg"),
    credit: "Anna Hanks from Austin, Texas, USA, CC BY 2.0",
    note: "Needs review before publishing",
    approved: false
  },
  {
    id: "gallery-2019-cropped",
    category: "Gallery photos",
    title: "Keanu Reeves cropped portrait, 2019",
    imageUrl: blobImageUrl("gallery-2019-cropped", "/media/review-images/keanu-reeves-2019-cropped.jpg"),
    alt: "Cropped portrait of Keanu Reeves in 2019",
    sourceWebsite: blobKeanuImages["gallery-2019-cropped"]?.url ? "Vercel Blob" : "Downloaded review image",
    sourceUrl: blobImageUrl("gallery-2019-cropped", "/media/review-images/keanu-reeves-2019-cropped.jpg"),
    credit: "Governo do Estado de Sao Paulo, CC BY 2.0",
    note: "Needs review before publishing",
    approved: false
  }
];

export const getStoredKeanuMediaDecisions = () => {
  try {
    return JSON.parse(localStorage.getItem(KEANU_MEDIA_STORAGE_KEY)) || {};
  } catch {
    return {};
  }
};

export const mergeKeanuMediaDecisions = (decisions = {}) =>
  keanuImageSuggestions.map((image) => {
    const decision = decisions[image.id] || {};
    const status = decision.status || (decision.approved ? "approved" : undefined);
    const imageUrl = downloadedImageUrl(decision.imageUrl) ? decision.imageUrl : image.imageUrl;

    return {
      ...image,
      ...decision,
      imageUrl,
      status,
      approved: status === "approved"
    };
  });

export const getApprovedKeanuImages = () =>
  mergeKeanuMediaDecisions(getStoredKeanuMediaDecisions()).filter((image) => image.approved);
