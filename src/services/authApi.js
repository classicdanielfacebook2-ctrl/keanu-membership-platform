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
export const resetPassword = (payload) =>
  authRequest("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(payload)
  });
