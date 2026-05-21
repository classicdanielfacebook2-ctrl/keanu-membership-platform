import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

let client;

export const hasSupabaseConfig = () => Boolean(supabaseUrl && supabaseAnonKey);

export const getSupportRealtimeClient = () => {
  if (!hasSupabaseConfig()) return null;
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      realtime: {
        params: { eventsPerSecond: 10 }
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

export const toConversation = (row) =>
  row
    ? {
        id: row.id,
        visitorId: row.visitor_id,
        status: row.status || "bot",
        assignedAgent: row.assigned_agent || "",
        agentRequested: Boolean(row.agent_requested),
        unreadForAgent: Number(row.unread_for_agent || 0),
        unreadForVisitor: Number(row.unread_for_visitor || 0),
        lastMessage: row.last_message || "",
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    : null;

export const toMessage = (row) =>
  row
    ? {
        id: row.id,
        conversationId: row.conversation_id,
        role: row.role,
        author: row.author || "",
        text: row.text || "",
        attachments: row.attachments || [],
        status: row.status || "delivered",
        createdAt: row.created_at
      }
    : null;

export const mergeById = (items, nextItems) => {
  const map = new Map(items.map((item) => [item.id, item]));
  for (const item of nextItems.filter(Boolean)) map.set(item.id, item);
  return [...map.values()].sort((a, b) => Date.parse(a.createdAt || 0) - Date.parse(b.createdAt || 0));
};

const requireClient = () => {
  const supabase = getSupportRealtimeClient();
  if (!supabase) {
    throw new Error("Supabase environment variables are missing. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  return supabase;
};

export const getOrCreateConversation = async (visitorId) => {
  const supabase = requireClient();
  const { data: existing, error: selectError } = await supabase
    .from("support_conversations")
    .select("*")
    .eq("visitor_id", visitorId)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return toConversation(existing);

  const { data, error } = await supabase
    .from("support_conversations")
    .insert({
      visitor_id: visitorId,
      status: "bot",
      last_message: "Conversation opened"
    })
    .select()
    .single();
  if (error) throw error;
  return toConversation(data);
};

export const loadMessages = async (conversationId) => {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("support_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map(toMessage);
};

export const listConversations = async () => {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("support_conversations")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(120);
  if (error) throw error;
  return (data || []).map(toConversation);
};

export const insertMessage = async ({ conversationId, role, text, attachments = [], author }) => {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("support_messages")
    .insert({
      conversation_id: conversationId,
      role,
      author: author || (role === "agent" ? "Support Agent" : role === "bot" ? "AI Support" : "Visitor"),
      text: text || "",
      attachments,
      status: "delivered"
    })
    .select()
    .single();
  if (error) throw error;
  return toMessage(data);
};

export const updateConversation = async (conversationId, patch) => {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from("support_conversations")
    .update({
      ...patch,
      updated_at: new Date().toISOString()
    })
    .eq("id", conversationId)
    .select()
    .single();
  if (error) throw error;
  return toConversation(data);
};

export const markMessagesSeen = async (conversationId, roles) => {
  const supabase = requireClient();
  const { error } = await supabase
    .from("support_messages")
    .update({ status: "seen" })
    .eq("conversation_id", conversationId)
    .in("role", roles);
  if (error) throw error;
};

export const supportMessagesChannel = (conversationId) => `support_messages:${conversationId}`;
export const supportAgentsChannel = "support_agents_presence";
