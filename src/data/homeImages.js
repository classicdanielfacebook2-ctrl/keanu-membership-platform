export const HOME_IMAGE_STORAGE_KEY = "home-media-image-review-decisions";

export const homeImageSuggestions = [
  {
    id: "official-portrait",
    title: "Keanu Reeves portrait, 2019",
    category: "Official portrait placeholder",
    imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Keanu%20Reeves%202019.jpg",
    alt: "Keanu Reeves photographed in 2019 during a public meeting in Sao Paulo",
    source: "Wikimedia Commons",
    credit: "Gilberto Marques / Governo do Estado de Sao Paulo, CC BY 2.0",
    status: "pending",
    reviewedByManagement: false
  },
  {
    id: "campaign-still",
    title: "John Wick red carpet portrait, 2014",
    category: "Campaign still placeholder",
    imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Keanu%20Reeves%202014.jpg",
    alt: "Keanu Reeves at a John Wick red carpet event in 2014",
    source: "Wikimedia Commons",
    credit: "Anna Hanks, CC BY 2.0",
    status: "pending",
    reviewedByManagement: false
  },
  {
    id: "membership-lifestyle",
    title: "Fantastic Fest portrait, 2013",
    category: "Membership card lifestyle placeholder",
    imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Keanu%20Reeves%20%2810615035873%29.jpg",
    alt: "Keanu Reeves at the Fantastic Fest premiere of Man of Tai Chi in 2013",
    source: "Wikimedia Commons",
    credit: "Anna Hanks from Austin, Texas, USA, CC BY 2.0",
    status: "pending",
    reviewedByManagement: false
  },
  {
    id: "press-photo",
    title: "Keanu Reeves cropped portrait, 2019",
    category: "Approved press photo placeholder",
    imageUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Keanu%20Reeves-2019.jpg",
    alt: "Cropped portrait of Keanu Reeves in 2019",
    source: "Wikimedia Commons",
    credit: "Governo do Estado de Sao Paulo, CC BY 2.0",
    status: "pending",
    reviewedByManagement: false
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

    return {
      ...image,
      ...decision,
      status,
      approved: status === "approved",
      reviewedByManagement: Boolean(decision.reviewedByManagement)
    };
  });

export const getApprovedHomeImages = () =>
  mergeHomeImageDecisions(getStoredHomeImageDecisions()).filter((image) => image.approved);
