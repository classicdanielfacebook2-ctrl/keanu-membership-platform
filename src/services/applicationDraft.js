export const APPLICATION_DRAFT_KEY = "krMembershipApplicationDraft";

export const getApplicationDraft = () => {
  try {
    return JSON.parse(sessionStorage.getItem(APPLICATION_DRAFT_KEY) || "{}");
  } catch {
    return {};
  }
};

export const saveApplicationDraft = (draft) => {
  sessionStorage.setItem(APPLICATION_DRAFT_KEY, JSON.stringify(draft));
};

export const updateApplicationDraft = (updates) => {
  const nextDraft = { ...getApplicationDraft(), ...updates };
  saveApplicationDraft(nextDraft);
  return nextDraft;
};

export const clearApplicationDraft = () => {
  sessionStorage.removeItem(APPLICATION_DRAFT_KEY);
};
