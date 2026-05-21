import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, CheckCheck, Headset, ImagePlus, Loader2, Paperclip, Send, Sparkles, X } from "lucide-react";
import {
  getSupportRealtimeClient,
  hasSupabaseConfig,
  mergeById,
  supportApi,
  supportChannelName,
  supportVisitorId
} from "../services/supportRealtime.js";

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
  const scrollRef = useRef(null);
  const fileRef = useRef(null);
  const channelRef = useRef(null);
  const agentChannelRef = useRef(null);
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
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const publish = async (event, payload, channel = channelRef.current) => {
    if (!channel) return;
    await channel.send({ type: "broadcast", event, payload });
  };

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupportRealtimeClient();

    const start = async () => {
      try {
        const initial = await supportApi("conversation", {
          method: "POST",
          body: JSON.stringify({ visitorId })
        });
        if (cancelled) return;
        setConversation(initial.conversation);
        setMessages(initial.messages || []);

        if (!supabase) {
          setConnected(false);
          setError("Realtime support is waiting for Supabase configuration.");
          return;
        }

        const chatChannel = supabase.channel(supportChannelName(initial.conversation.id), {
          config: { broadcast: { self: false }, presence: { key: visitorId } }
        });
        chatChannel
          .on("broadcast", { event: "message" }, ({ payload }) => {
            setMessages((current) => mergeById(current, [payload.message, payload.botMessage]));
            if (!openRef.current && payload.message?.role !== "user") setUnread((count) => count + 1);
          })
          .on("broadcast", { event: "conversation" }, ({ payload }) => {
            if (payload.conversation) setConversation(payload.conversation);
          })
          .on("broadcast", { event: "typing" }, ({ payload }) => {
            if (payload.role !== "user") setTyping(payload.typing ? payload.role : "");
          })
          .subscribe((status) => {
            setConnected(status === "SUBSCRIBED");
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              setError("Realtime support is reconnecting.");
            } else if (status === "SUBSCRIBED") {
              setError("");
              chatChannel.track({ role: "visitor", onlineAt: new Date().toISOString() });
            }
          });
        channelRef.current = chatChannel;

        const agentsChannel = supabase.channel("support:agents", {
          config: { presence: { key: visitorId }, broadcast: { self: false } }
        });
        agentsChannel.on("presence", { event: "sync" }, () => {
          const state = agentsChannel.presenceState();
          setAgentOnline(Object.values(state).flat().some((item) => item.role === "agent"));
        });
        agentsChannel.subscribe();
        agentChannelRef.current = agentsChannel;
      } catch (requestError) {
        if (!cancelled) setError(requestError.message);
      }
    };

    start();
    return () => {
      cancelled = true;
      if (channelRef.current) supabase?.removeChannel(channelRef.current);
      if (agentChannelRef.current) supabase?.removeChannel(agentChannelRef.current);
    };
  }, [visitorId]);

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener("open-live-chat", handleOpen);
    return () => window.removeEventListener("open-live-chat", handleOpen);
  }, []);

  useEffect(() => {
    if (!open || !conversation?.id) return;
    setUnread(0);
    supportApi("seen", {
      method: "POST",
      body: JSON.stringify({ conversationId: conversation.id, viewerRole: "visitor" })
    })
      .then((data) => {
        setConversation(data.conversation);
        setMessages(data.messages || []);
        publish("conversation", { conversation: data.conversation });
      })
      .catch(() => {});
  }, [conversation?.id, open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, typing, open]);

  const sendMessage = async (overrideText = "") => {
    const body = (overrideText || text).trim();
    if ((!body && !attachments.length) || sending) return;
    setSending(true);
    setText("");
    const outgoingAttachments = attachments;
    setAttachments([]);

    try {
      const result = await supportApi("message", {
        method: "POST",
        body: JSON.stringify({
          conversationId: conversation?.id,
          visitorId,
          role: "user",
          text: body,
          attachments: outgoingAttachments
        })
      });
      setConversation(result.conversation);
      setMessages((current) => mergeById(current, [result.message, result.botMessage]));
      await publish("message", result);
      await publish("conversation", { conversation: result.conversation });
      await agentChannelRef.current?.send({ type: "broadcast", event: "conversation", payload: { conversation: result.conversation } });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSending(false);
    }
  };

  const handleTyping = (value) => {
    setText(value);
    publish("typing", { conversationId: conversation?.id, role: "user", typing: Boolean(value) });
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
              {agentOnline ? "Agent available" : connected || hasSupabaseConfig() ? "AI support available" : "Realtime setup required"}
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
          <button className="send-chat" type="button" onClick={() => sendMessage()} aria-label="Send message" disabled={sending}>
            {sending ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
          </button>
        </footer>
      </aside>
    </>
  );
}
