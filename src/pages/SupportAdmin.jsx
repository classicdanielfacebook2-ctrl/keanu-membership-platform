import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCheck, Headset, MessageSquareText, Send, UserCheck, UsersRound } from "lucide-react";
import SectionHeader from "../components/SectionHeader.jsx";
import {
  getSupportRealtimeClient,
  mergeById,
  supportApi,
  supportChannelName
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
  const chatChannelRef = useRef(null);
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
    let cancelled = false;
    const supabase = getSupportRealtimeClient();

    const loadQueue = async () => {
      try {
        const data = await supportApi("conversations");
        if (cancelled) return;
        setConversations(data.conversations || []);
        if (!activeIdRef.current && data.conversations?.length) setActiveId(data.conversations[0].id);
      } catch (requestError) {
        setError(requestError.message);
      }
    };

    loadQueue();
    if (!supabase) {
      setError("Supabase Realtime environment variables are missing.");
      return () => {
        cancelled = true;
      };
    }

    const queue = supabase.channel("support:agents", {
      config: { broadcast: { self: false }, presence: { key: "admin-agent" } }
    });
    queue
      .on("broadcast", { event: "conversation" }, ({ payload }) => {
        if (!payload.conversation) return;
        setConversations((current) => {
          const without = current.filter((item) => item.id !== payload.conversation.id);
          return [payload.conversation, ...without].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
        });
        if (payload.conversation.id === activeIdRef.current) setActiveConversation(payload.conversation);
      })
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") {
          setError("");
          queue.track({ role: "agent", onlineAt: new Date().toISOString() });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setError("Realtime support is reconnecting.");
        }
      });
    queueChannelRef.current = queue;

    const interval = window.setInterval(loadQueue, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      if (queueChannelRef.current) supabase.removeChannel(queueChannelRef.current);
      if (chatChannelRef.current) supabase.removeChannel(chatChannelRef.current);
    };
  }, []);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    const supabase = getSupportRealtimeClient();

    const loadConversation = async () => {
      try {
        const data = await supportApi(`conversation?conversationId=${encodeURIComponent(activeId)}`);
        if (cancelled) return;
        setActiveConversation(data.conversation);
        setMessages(data.messages || []);
        await supportApi("seen", {
          method: "POST",
          body: JSON.stringify({ conversationId: activeId, viewerRole: "agent" })
        });
      } catch (requestError) {
        setError(requestError.message);
      }
    };

    loadConversation();
    if (!supabase) return () => { cancelled = true; };

    if (chatChannelRef.current) supabase.removeChannel(chatChannelRef.current);
    const channel = supabase.channel(supportChannelName(activeId), {
      config: { broadcast: { self: false }, presence: { key: "admin-agent" } }
    });
    channel
      .on("broadcast", { event: "message" }, ({ payload }) => {
        setMessages((current) => mergeById(current, [payload.message, payload.botMessage]));
      })
      .on("broadcast", { event: "conversation" }, ({ payload }) => {
        if (payload.conversation) setActiveConversation(payload.conversation);
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.role === "user") setTyping(Boolean(payload.typing));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") channel.track({ role: "agent", onlineAt: new Date().toISOString() });
      });
    chatChannelRef.current = channel;

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

  const publishConversation = async (conversation) => {
    await chatChannelRef.current?.send({ type: "broadcast", event: "conversation", payload: { conversation } });
    await queueChannelRef.current?.send({ type: "broadcast", event: "conversation", payload: { conversation } });
  };

  const takeover = async () => {
    if (!activeId) return;
    const result = await supportApi("takeover", {
      method: "POST",
      body: JSON.stringify({ conversationId: activeId })
    });
    setActiveConversation(result.conversation);
    setMessages((current) => mergeById(current, [result.systemMessage]));
    await publishConversation(result.conversation);
    await chatChannelRef.current?.send({ type: "broadcast", event: "message", payload: { message: result.systemMessage } });
  };

  const sendReply = async () => {
    const text = reply.trim();
    if (!text || !activeId) return;
    setReply("");
    const result = await supportApi("message", {
      method: "POST",
      body: JSON.stringify({ conversationId: activeId, role: "agent", text })
    });
    setActiveConversation(result.conversation);
    setMessages((current) => mergeById(current, [result.message]));
    await publishConversation(result.conversation);
    await chatChannelRef.current?.send({ type: "broadcast", event: "message", payload: result });
  };

  return (
    <section className="page-section wide-page support-admin-page">
      <SectionHeader
        eyebrow="Support Dashboard"
        title="Real-time support command center."
        copy="Monitor new conversations, review AI handoffs, and continue live support from one premium agent inbox."
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
              onChange={(event) => setReply(event.target.value)}
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
