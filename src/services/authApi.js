export async function authRequest(path, options = {}) {
  const { headers: optionHeaders, ...fetchOptions } = options;
  const response = await fetch(path, {
    credentials: "include",
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      ...(optionHeaders || {})
    }
  });

  const contentType = response.headers.get("content-type") || "";
  const rawText = contentType.includes("application/json") ? "" : await response.text().catch(() => "");
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : { error: rawText && !rawText.trim().startsWith("<") ? rawText : "" };

  if (!response.ok) {
    const fallback = `Authentication API failed (${response.status} ${response.statusText}).`;
    const error = new Error(data.error || fallback);
    Object.assign(error, data);
    throw error;
  }
  return data;
}

export const getMe = () => authRequest("/api/auth/me");
export const login = (payload) =>
  authRequest("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
export const verifyLoginTwoStep = (payload) =>
  authRequest("/api/auth/verify-login-2fa", {
    method: "POST",
    body: JSON.stringify(payload)
  });
export const register = (payload) =>
  authRequest("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload)
  });
export const bootstrapAdmin = (payload) =>
  authRequest("/api/auth/bootstrap-admin", {
    method: "POST",
    body: JSON.stringify(payload)
  });
export const verifyOtp = (payload) =>
  authRequest("/api/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify(payload)
  });
export const resendOtp = (payload) =>
  authRequest("/api/auth/resend-otp", {
    method: "POST",
    body: JSON.stringify(payload)
  });
export const logout = () =>
  authRequest("/api/auth/logout", {
    method: "POST",
    body: JSON.stringify({})
  });
export const logoutEverywhere = () =>
  authRequest("/api/auth/logout-everywhere", {
    method: "POST",
    body: JSON.stringify({})
  });
export const changePassword = (payload) =>
  authRequest("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify(payload)
  });
export const getSecuritySettings = () => authRequest("/api/auth/security-settings");
export const updateSecuritySettings = (payload) =>
  authRequest("/api/auth/security-settings", {
    method: "POST",
    body: JSON.stringify(payload)
  });
export const updateProfile = (payload) =>
  authRequest("/api/auth/update-profile", {
    method: "POST",
    body: JSON.stringify(payload)
  });
export const sendProfileVerification = (payload) =>
  authRequest("/api/auth/send-profile-verification", {
    method: "POST",
    body: JSON.stringify(payload)
  });
export const verifyProfileContact = (payload) =>
  authRequest("/api/auth/verify-profile-contact", {
    method: "POST",
    body: JSON.stringify(payload)
  });
export const getTwoStepStatus = () => authRequest("/api/auth/two-step-status");
export const startTwoStepSetup = () =>
  authRequest("/api/auth/two-step-setup", {
    method: "POST",
    body: JSON.stringify({})
  });
export const verifyTwoStepSetup = (payload) =>
  authRequest("/api/auth/two-step-verify-setup", {
    method: "POST",
    body: JSON.stringify(payload)
  });
export const disableTwoStep = (payload) =>
  authRequest("/api/auth/two-step-disable", {
    method: "POST",
    body: JSON.stringify(payload)
  });
export const regenerateRecoveryCodes = (payload) =>
  authRequest("/api/auth/two-step-regenerate-recovery", {
    method: "POST",
    body: JSON.stringify(payload)
  });
export const forgotPassword = (payload) =>
  authRequest("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(payload)
  });
export const resetPassword = (payload) =>
  authRequest("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(payload)
  });
