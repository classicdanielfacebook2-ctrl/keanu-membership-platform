import { createClient } from "@supabase/supabase-js";
import { authRequest } from "./authApi.js";

const supabaseUrl = import.meta.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

let authClient;

export const hasSupabaseAuthConfig = () => Boolean(supabaseUrl && supabaseAnonKey);

export const getSupabasePasswordClient = () => {
  if (!hasSupabaseAuthConfig()) {
    throw new Error("Supabase Auth is not configured.");
  }

  if (!authClient) {
    authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }

  return authClient;
};

export const preparePasswordRecoverySession = async () => {
  const fallbackToken = new URLSearchParams(window.location.search).get("recovery_token");
  if (fallbackToken) {
    return { access_token: fallbackToken, fallback: true };
  }

  const supabase = getSupabasePasswordClient();
  const code = new URLSearchParams(window.location.search).get("code");

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      throw new Error("Recovery link expired. Please request a new password recovery email.");
    }
  }

  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session?.access_token) {
    throw new Error("Recovery link expired. Please request a new password recovery email.");
  }

  return data.session;
};

export const updateRecoveredPassword = async ({ password }) => {
  const session = await preparePasswordRecoverySession();
  let accessToken = session.access_token;

  if (!session.fallback) {
    const supabase = getSupabasePasswordClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      const message = /expired|invalid/i.test(error.message)
        ? "Recovery link expired. Please request a new password recovery email."
        : error.message || "Password could not be updated.";
      throw new Error(message);
    }

    const { data: refreshed } = await supabase.auth.getSession();
    accessToken = refreshed?.session?.access_token || session.access_token;
  }

  const data = await authRequest("/api/auth/supabase-reset-password", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ password })
  });

  if (!session.fallback) {
    await getSupabasePasswordClient().auth.signOut().catch(() => {});
  }
  return data;
};
