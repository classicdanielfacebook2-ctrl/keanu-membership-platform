import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCheck, Headset, MessageSquareText, Send, UserCheck, UsersRound } from "lucide-react";
import SectionHeader from "../components/SectionHeader.jsx";
import { createSupportSocket } from "../services/supportSocket.js";

const statusLabel = {
  bot: "AI assisting",
  waiting_agent: "Needs agent",
  agent: "Agent active",
  closed: "Closed"
};

export default function SupportAdmin() {
  const socketRef = useRef(null);
  const scrollRef = useRef(null);
  const activeIdRef = useRef("");
  const [connected, setConnected] = useState(false);
  const [agentOnline, setAgentOnline] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState("");
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    const socket = createSupportSocket("agent");
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("support:join");
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("support:admin-state", ({ conversations: items, agentOnline: online }) => {
      setConversations(items || []);
      setAgentOnline(Boolean(online));
      if (!activeIdRef.current && items?.length) setActiveId(items[0].id);
    });
    socket.on("support:history", ({ conversation, messages: history }) => {
      setActiveConversation(conversation);
      setMessages(history || []);
    });
    socket.on("support:message", (message) => {
      if (message.conversationId === activeIdRef.current) {
        setMessages((current) => (current.some((item) => item.id === message.id) ? current : [...current, message]));
      }
    });
    socket.on("support:conversation", (conversation) => {
      if (conversation?.id === activeIdRef.current) setActiveConversation(conversation);
    });
    socket.on("support:conversation-updated", (conversation) => {
      setConversations((current) => {
        const without = current.filter((item) => item.id !== conversation.id);
        return [conversation, ...without].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
      });
      if (conversation.id === activeIdRef.current) setActiveConversation(conversation);
    });
    socket.on("support:agent-status", ({ online }) => setAgentOnline(Boolean(online)));
    socket.on("support:typing", ({ role, typing: isTyping }) => setTyping(role === "visitor" || role === "user" ? Boolean(isTyping) : false));

    socket.connect();
    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    if (!activeId || !socketRef.current?.connected) return;
    socketRef.current.emit("support:open-conversation", { conversationId: activeId });
    socketRef.current.emit("support:seen", { conversationId: activeId });
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

  const takeover = () => {
    if (!activeId) return;
    socketRef.current?.emit("support:agent-takeover", { conversationId: activeId });
  };

  const sendReply = () => {
    const text = reply.trim();
    if (!text || !activeId) return;
    socketRef.current?.emit("support:message", { conversationId: activeId, text });
    setReply("");
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

      <div className="support-console premium-panel">
        <aside className="conversation-list">
          <div className="conversation-list-head">
            <h3>Live Queue</h3>
            <span className={agentOnline && connected ? "support-dot online" : "support-dot"} />
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
