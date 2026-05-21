import { io } from "socket.io-client";

const supportSocketUrl = import.meta.env.VITE_SUPPORT_SOCKET_URL || "http://127.0.0.1:4174";

export const createSupportSocket = (role = "visitor") =>
  io(supportSocketUrl, {
    withCredentials: true,
    transports: ["websocket", "polling"],
    query: { role },
    autoConnect: false
  });

export const supportVisitorId = () => {
  const key = "kr_support_visitor_id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const value = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(key, value);
  return value;
};
