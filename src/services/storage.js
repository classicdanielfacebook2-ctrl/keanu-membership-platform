const APPLICATIONS_KEY = "authorized-membership-applications";
const SUPPORT_KEY = "authorized-membership-support";

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

export const getApplications = () => read(APPLICATIONS_KEY, []);

export const saveApplication = (application) => {
  const applications = getApplications();
  const next = [
    {
      ...application,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      reviewStatus: "Pending Review",
      paymentStatus: "Pending",
      cardStatus: "Not Started"
    },
    ...applications
  ];
  write(APPLICATIONS_KEY, next);
  return next[0];
};

export const updateApplication = (id, updates) => {
  const next = getApplications().map((application) =>
    application.id === id ? { ...application, ...updates } : application
  );
  write(APPLICATIONS_KEY, next);
  return next;
};

export const getSupportMessages = () => read(SUPPORT_KEY, []);

export const saveSupportMessage = (message) => {
  const messages = getSupportMessages();
  const next = [
    {
      ...message,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      status: "Open"
    },
    ...messages
  ];
  write(SUPPORT_KEY, next);
  return next[0];
};
