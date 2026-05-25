import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCheck, Headset, MessageSquareText, Send, UserCheck, UsersRound } from "lucide-react";
import SectionHeader from "../components/SectionHeader.jsx";
import {
  getSupportRealtimeClient,
  hasSupabaseConfig,
  insertMessage,
  listConversations,
  loadMessages,
  markMessagesSeen,
  mergeById,
  supportAgentsChannel,
  toMessage,
  updateConversation
} from "../services/supportRealtime.js";

const statusLabel = {
  bot: "AI assisting",
  waiting_agent: "Needs agent",
  agent: "Agent active",
  closed: "Closed"
};

export default function SupportAdmin() {
  const scrollRef = useRef(null);
  const queueChannelRef = useRef(null);
  const activeIdRef = useRef("");
  const [connected, setConnected] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState("");
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupportRealtimeClient();

    const loadQueue = async () => {
      try {
        const items = await listConversations();
        if (cancelled) return;
        setConversations(items);
        if (!activeIdRef.current && items.length) setActiveId(items[0].id);
      } catch (requestError) {
        setError(requestError.message);
      }
    };

    if (!hasSupabaseConfig() || !supabase) {
      setError("Supabase environment variables are missing. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return () => {
        cancelled = true;
      };
    }

    loadQueue();
    const queue = supabase.channel("support_dashboard_messages", {
      config: { presence: { key: "admin-agent" } }
    });
    queue
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages" },
        async ({ new: row }) => {
          const message = toMessage(row);
          if (message.conversationId === activeIdRef.current) {
            setMessages((current) => mergeById(current, [message]));
          }
          await loadQueue();
          if ("Notification" in window && message.role === "user" && message.conversationId !== activeIdRef.current && Notification.permission === "granted") {
            new Notification("New support message", {
              body: message.text || "A visitor sent an attachment.",
              tag: message.conversationId
            });
          }
        }
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.conversationId === activeIdRef.current && payload.role === "user") setTyping(Boolean(payload.typing));
      })
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") {
          setError("");
          queue.track({ role: "agent", onlineAt: new Date().toISOString() });
        }
      });
    queueChannelRef.current = queue;

    const interval = window.setInterval(loadQueue, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      if (queueChannelRef.current) supabase.removeChannel(queueChannelRef.current);
    };
  }, []);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    const loadConversation = async () => {
      try {
        const items = await listConversations();
        const active = items.find((item) => item.id === activeId);
        const history = await loadMessages(activeId);
        if (cancelled) return;
        setActiveConversation(active || null);
        setConversations(items);
        setMessages(history);
        await markMessagesSeen(activeId, ["user"]);
        if (active) {
          const updated = await updateConversation(activeId, { unread_for_agent: 0 });
          setActiveConversation(updated);
        }
      } catch (requestError) {
        setError(requestError.message);
      }
    };
    loadConversation();
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, typing]);

  const stats = useMemo(
    () => [
      { label: "Total conversations", value: conversations.length, icon: MessageSquareText },
      { label: "Needs agent", value: conversations.filter((item) => item.status === "waiting_agent").length, icon: Bell },
      { label: "Agent active", value: conversations.filter((item) => item.status === "agent").length, icon: UserCheck },
      { label: "Unread", value: conversations.reduce((sum, item) => sum + Number(item.unreadForAgent || 0), 0), icon: UsersRound }
    ],
    [conversations]
  );

  const takeover = async () => {
    if (!activeId) return;
    const updated = await updateConversation(activeId, {
      status: "agent",
      agent_requested: false,
      assigned_agent: "admin"
    });
    const systemMessage = await insertMessage({
      conversationId: activeId,
      role: "system",
      author: "System",
      text: "A concierge specialist has joined the conversation."
    });
    setActiveConversation(updated);
    setMessages((current) => mergeById(current, [systemMessage]));
  };

  const sendReply = async () => {
    const body = reply.trim();
    if (!body || !activeId) return;
    setReply("");
    const message = await insertMessage({ conversationId: activeId, role: "agent", text: body });
    const updated = await updateConversation(activeId, {
      status: "agent",
      last_message: body,
      unread_for_visitor: Number(activeConversation?.unreadForVisitor || 0) + 1
    });
    setActiveConversation(updated);
    setMessages((current) => mergeById(current, [message]));
  };

  const handleTyping = (value) => {
    setReply(value);
    queueChannelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { conversationId: activeId, role: "agent", typing: Boolean(value) }
    });
  };

  return (
    <section className="page-section wide-page support-admin-page">
      <SectionHeader
        eyebrow="Support Dashboard"
        title="Real-time support command center."
        copy="Monitor new conversations, manage AI handoffs, and continue live support from one premium agent inbox."
      />

      <div className="dashboard-stats">
        {stats.map(({ label, value, icon: Icon }) => (
          <article className="stat-card" key={label}>
            <Icon size={22} />
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>

      {error ? <div className="notice">{error}</div> : null}

      <div className="support-console premium-panel">
        <aside className="conversation-list">
          <div className="conversation-list-head">
            <h3>Live Queue</h3>
            <span className={connected ? "support-dot online" : "support-dot"} />
          </div>
          {conversations.length ? (
            conversations.map((conversation) => (
              <button
                className={conversation.id === activeId ? "conversation-item active" : "conversation-item"}
                type="button"
                key={conversation.id}
                onClick={() => setActiveId(conversation.id)}
              >
                <strong>{conversation.visitorId.slice(0, 12)}</strong>
                <span>{conversation.lastMessage || "New conversation"}</span>
                <small>{statusLabel[conversation.status] || conversation.status}</small>
                {conversation.unreadForAgent ? <em>{conversation.unreadForAgent}</em> : null}
              </button>
            ))
          ) : (
            <div className="support-empty">No live chats yet.</div>
          )}
        </aside>

        <section className="agent-chat-panel">
          <header className="agent-chat-head">
            <div>
              <span className="mini-eyebrow">Conversation</span>
              <h3>{activeConversation ? activeConversation.visitorId.slice(0, 18) : "Select a chat"}</h3>
            </div>
            <button className="button secondary compact" type="button" onClick={takeover} disabled={!activeId}>
              <Headset size={16} />
              Take Over
            </button>
          </header>

          <div className="agent-chat-messages" ref={scrollRef}>
            {messages.length ? (
              messages.map((message) => (
                <article className={`support-message ${message.role}`} key={message.id}>
                  <div className="message-bubble">
                    <span className="message-author">{message.author || message.role}</span>
                    {message.text ? <p>{message.text}</p> : null}
                    {message.attachments?.length ? (
                      <div className="message-attachments">
                        {message.attachments.map((file) => (
                          <a href={file.dataUrl} target="_blank" rel="noreferrer" key={`${message.id}-${file.name}`}>
                            {file.name}
                          </a>
                        ))}
                      </div>
                    ) : null}
                    {message.role === "agent" ? (
                      <small>
                        <CheckCheck size={13} />
                        {message.status === "seen" ? "Seen" : "Delivered"}
                      </small>
                    ) : null}
                  </div>
                </article>
              ))
            ) : (
              <div className="support-empty large">Select a conversation to view support history.</div>
            )}
            {typing ? <div className="support-typing">Visitor is typing</div> : null}
          </div>

          <footer className="agent-reply-bar">
            <input
              value={reply}
              onChange={(event) => handleTyping(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") sendReply();
              }}
              placeholder="Write a professional support reply"
              disabled={!activeId}
            />
            <button className="button primary compact" type="button" onClick={sendReply} disabled={!activeId || !reply.trim()}>
              <Send size={16} />
              Send
            </button>
          </footer>
        </section>
      </div>
    </section>
  );
}
