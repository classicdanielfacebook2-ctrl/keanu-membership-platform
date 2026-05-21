import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, CheckCheck, Headset, ImagePlus, Loader2, Paperclip, Send, Sparkles, X } from "lucide-react";
import { createSupportSocket, supportVisitorId } from "../services/supportSocket.js";

const starterPrompts = ["OTP issue", "Password reset", "Membership question", "Payment support", "Human agent"];

const readFileAttachment = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: reader.result
      });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function LiveChatWidget() {
  const socketRef = useRef(null);
  const scrollRef = useRef(null);
  const fileRef = useRef(null);
  const openRef = useRef(false);
  const visitorId = useMemo(() => supportVisitorId(), []);
  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [agentOnline, setAgentOnline] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [typing, setTyping] = useState("");
  const [unread, setUnread] = useState(0);
  const [sendingFile, setSendingFile] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    const socket = createSupportSocket("visitor");
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setError("");
      socket.emit("support:join", { visitorId });
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => {
      setConnected(false);
      setError("Live support is reconnecting.");
    });
    socket.on("support:history", ({ conversation: activeConversation, messages: history, agentOnline: online }) => {
      setConversation(activeConversation);
      setMessages(history || []);
      setAgentOnline(Boolean(online));
    });
    socket.on("support:message", (message) => {
      setMessages((current) => (current.some((item) => item.id === message.id) ? current : [...current, message]));
      if (!openRef.current && message.role !== "user") setUnread((count) => count + 1);
    });
    socket.on("support:conversation", setConversation);
    socket.on("support:agent-status", ({ online }) => setAgentOnline(Boolean(online)));
    socket.on("support:typing", ({ role, typing: isTyping }) => setTyping(isTyping ? role : ""));
    socket.on("support:error", ({ error: message }) => setError(message || "Support connection failed."));

    socket.connect();
    return () => socket.disconnect();
  }, [visitorId]);

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener("open-live-chat", handleOpen);
    return () => window.removeEventListener("open-live-chat", handleOpen);
  }, []);

  useEffect(() => {
    if (!open || !conversation?.id || !socketRef.current?.connected) return;
    setUnread(0);
    socketRef.current.emit("support:seen", { conversationId: conversation.id });
  }, [conversation?.id, messages.length, open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, typing, open]);

  const sendMessage = (overrideText = "") => {
    const body = (overrideText || text).trim();
    if (!body && !attachments.length) return;
    socketRef.current?.emit("support:message", {
      conversationId: conversation?.id,
      visitorId,
      text: body,
      attachments
    });
    setText("");
    setAttachments([]);
  };

  const handleTyping = (value) => {
    setText(value);
    if (conversation?.id) {
      socketRef.current?.emit("support:typing", { conversationId: conversation.id, typing: Boolean(value) });
    }
  };

  const handleFiles = async (event) => {
    const files = [...(event.target.files || [])].slice(0, 3);
    if (!files.length) return;
    setSendingFile(true);
    try {
      const loaded = await Promise.all(files.map(readFileAttachment));
      setAttachments((current) => [...current, ...loaded].slice(0, 4));
    } finally {
      setSendingFile(false);
      event.target.value = "";
    }
  };

  return (
    <>
      <button className="live-chat-launcher" type="button" onClick={() => setOpen(true)} aria-label="Open live support">
        <span className="launcher-glow" />
        <Headset size={22} />
        {unread ? <strong>{unread}</strong> : null}
      </button>

      <aside className={open ? "live-chat-widget open" : "live-chat-widget"} aria-label="Live support chat">
        <header className="live-chat-header">
          <div>
            <span className="mini-eyebrow">Concierge Support</span>
            <h2>Keanu Reeves Company</h2>
            <p>
              <span className={agentOnline ? "support-dot online" : "support-dot"} />
              {agentOnline ? "Agent available" : "AI support available"}
            </p>
          </div>
          <button className="icon-button" type="button" onClick={() => setOpen(false)} aria-label="Close live support">
            <X size={18} />
          </button>
        </header>

        <div className="live-chat-messages" ref={scrollRef}>
          {!messages.length ? (
            <div className="support-welcome">
              <Sparkles size={24} />
              <strong>How can we assist?</strong>
              <span>Ask about verification, password reset, membership cards, or payment support.</span>
            </div>
          ) : null}

          {messages.map((message) => (
            <article className={`support-message ${message.role}`} key={message.id}>
              <div className="message-bubble">
                {message.role === "bot" ? (
                  <span className="message-author">
                    <Bot size={14} />
                    AI Support
                  </span>
                ) : null}
                {message.role === "agent" ? <span className="message-author">Support Agent</span> : null}
                {message.text ? <p>{message.text}</p> : null}
                {message.attachments?.length ? (
                  <div className="message-attachments">
                    {message.attachments.map((file) => (
                      <a href={file.dataUrl} target="_blank" rel="noreferrer" key={`${message.id}-${file.name}`}>
                        {file.type?.startsWith("image/") ? <img src={file.dataUrl} alt={file.name} /> : <Paperclip size={15} />}
                        <span>{file.name}</span>
                      </a>
                    ))}
                  </div>
                ) : null}
                {message.role === "user" ? (
                  <small>
                    <CheckCheck size={13} />
                    {message.status === "seen" ? "Seen" : "Delivered"}
                  </small>
                ) : null}
              </div>
            </article>
          ))}

          {typing ? (
            <div className="support-typing">
              <span />
              <span />
              <span />
              {typing === "bot" ? "AI is replying" : "Support is typing"}
            </div>
          ) : null}
        </div>

        <div className="support-prompt-row">
          {starterPrompts.map((prompt) => (
            <button type="button" key={prompt} onClick={() => sendMessage(prompt)}>
              {prompt}
            </button>
          ))}
        </div>

        {attachments.length ? (
          <div className="support-attachment-preview">
            {attachments.map((file) => (
              <span key={file.name}>{file.name}</span>
            ))}
          </div>
        ) : null}
        {error ? <div className="support-inline-error">{error}</div> : null}

        <footer className="live-chat-composer">
          <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx" multiple hidden onChange={handleFiles} />
          <button type="button" onClick={() => fileRef.current?.click()} aria-label="Attach file">
            {sendingFile ? <Loader2 className="spin" size={18} /> : <ImagePlus size={18} />}
          </button>
          <input
            value={text}
            onChange={(event) => handleTyping(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") sendMessage();
            }}
            placeholder={connected ? "Type your message" : "Connecting to support"}
          />
          <button className="send-chat" type="button" onClick={() => sendMessage()} aria-label="Send message">
            <Send size={18} />
          </button>
        </footer>
      </aside>
    </>
  );
}
