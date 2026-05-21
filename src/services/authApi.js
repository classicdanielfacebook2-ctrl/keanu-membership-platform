export async function authRequest(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Authentication request failed.");
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
export const register = (payload) =>
  authRequest("/api/auth/register", {
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
export const forgotPassword = (payload) =>
  authRequest("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(payload)
  });
