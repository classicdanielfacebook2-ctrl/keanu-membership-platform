export const APPLICATION_DRAFT_KEY = "krMembershipApplicationDraft";
export const APPLICATION_RETURN_KEY = "krMembershipApplicationReturn";

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

export const saveApplicationReturn = (targetId) => {
  sessionStorage.setItem(
    APPLICATION_RETURN_KEY,
    JSON.stringify({
      targetId,
      scrollY: window.scrollY || 0
    })
  );
};

export const consumeApplicationReturn = () => {
  try {
    const returnState = JSON.parse(sessionStorage.getItem(APPLICATION_RETURN_KEY) || "{}");
    sessionStorage.removeItem(APPLICATION_RETURN_KEY);
    return returnState;
  } catch {
    sessionStorage.removeItem(APPLICATION_RETURN_KEY);
    return {};
  }
};
