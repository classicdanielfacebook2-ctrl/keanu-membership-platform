import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.NEXT_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "";

let client;

export const hasSupabaseConfig = () => Boolean(supabaseUrl && supabaseAnonKey);

export const getSupportRealtimeClient = () => {
  if (!hasSupabaseConfig()) return null;
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: { eventsPerSecond: 8 }
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }
  return client;
};

export const supportVisitorId = () => {
  const key = "kr_support_visitor_id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const value = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(key, value);
  return value;
};

export const supportChannelName = (conversationId = "queue") => `support:${conversationId}`;

export const supportApi = async (path, options = {}) => {
  const response = await fetch(`/api/support/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || "Support request failed.");
  }
  return data;
};

export const mergeById = (items, nextItems) => {
  const map = new Map(items.map((item) => [item.id, item]));
  for (const item of nextItems.filter(Boolean)) {
    map.set(item.id, item);
  }
  return [...map.values()].sort((a, b) => Date.parse(a.createdAt || 0) - Date.parse(b.createdAt || 0));
};
