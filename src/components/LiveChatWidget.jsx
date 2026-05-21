import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, CheckCheck, Headset, ImagePlus, Loader2, Paperclip, Send, Sparkles, X } from "lucide-react";
import {
  getOrCreateConversation,
  getSupportRealtimeClient,
  hasSupabaseConfig,
  insertMessage,
  loadMessages,
  markMessagesSeen,
  mergeById,
  supportAgentsChannel,
  supportMessagesChannel,
  supportVisitorId,
  toMessage,
  updateConversation
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

const needsHumanAgent = (text = "") =>
  /\b(human|agent|support|representative|person|staff|unresolved)\b/i.test(text) ||
  /\b(still|cannot|can't|failed|broken|not working|no code|no otp)\b/i.test(text);

const botReply = (text = "") => {
  const normalized = text.toLowerCase();
  if (needsHumanAgent(normalized)) {
    return "I will connect you with a support agent. Please keep this chat open while the team reviews your message.";
  }
  if (/\botp|verification|code\b/.test(normalized)) {
    return "For verification code issues, confirm the selected email or phone number, then use Resend Code. If it still does not arrive, request a support agent here.";
  }
  if (/password|reset|login|sign in/.test(normalized)) {
    return "For password recovery, open Forgot password, choose email or SMS, enter the code, and set a new password. I can transfer this chat if it does not work.";
  }
  if (/membership|card|silver|gold|vip|premium|apply/.test(normalized)) {
    return "Membership applications begin from the Apply page. Choose a card level, complete your details, and continue through the guided application flow.";
  }
  if (/payment|pay|stripe|paypal|purchase|paid/.test(normalized)) {
    return "Payments should only be completed through an approved secure payment provider. Do not enter card details manually on the review site.";
  }
  return "I can help with verification, password recovery, membership cards, and payment questions. If this needs a person, type agent and I will transfer the conversation.";
};

export default function LiveChatWidget() {
  const scrollRef = useRef(null);
  const fileRef = useRef(null);
  const messageChannelRef = useRef(null);
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

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupportRealtimeClient();

    const start = async () => {
      if (!hasSupabaseConfig() || !supabase) {
        setError("Supabase environment variables are missing. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
        setConnected(false);
        return;
      }

      try {
        const activeConversation = await getOrCreateConversation(visitorId);
        if (cancelled) return;
        setConversation(activeConversation);
        setMessages(await loadMessages(activeConversation.id));

        const messageChannel = supabase.channel(supportMessagesChannel(activeConversation.id));
        messageChannel
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "support_messages",
              filter: `conversation_id=eq.${activeConversation.id}`
            },
            ({ new: row }) => {
              const message = toMessage(row);
              setMessages((current) => mergeById(current, [message]));
              if (!openRef.current && message.role !== "user") setUnread((count) => count + 1);
            }
          )
          .on("broadcast", { event: "typing" }, ({ payload }) => {
            if (payload.role !== "user") setTyping(payload.typing ? payload.role : "");
          })
          .subscribe((status) => {
            setConnected(status === "SUBSCRIBED");
            if (status === "SUBSCRIBED") setError("");
          });
        messageChannelRef.current = messageChannel;

        const agentsChannel = supabase.channel(supportAgentsChannel, {
          config: { presence: { key: visitorId } }
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
      if (messageChannelRef.current) supabase?.removeChannel(messageChannelRef.current);
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
    markMessagesSeen(conversation.id, ["agent", "bot"]).catch(() => {});
    updateConversation(conversation.id, { unread_for_visitor: 0 }).then(setConversation).catch(() => {});
  }, [conversation?.id, open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, typing, open]);

  const sendMessage = async (overrideText = "") => {
    const body = (overrideText || text).trim();
    if ((!body && !attachments.length) || sending || !conversation?.id) return;
    setSending(true);
    setText("");
    const outgoingAttachments = attachments;
    setAttachments([]);

    try {
      const userMessage = await insertMessage({
        conversationId: conversation.id,
        role: "user",
        text: body,
        attachments: outgoingAttachments
      });
      setMessages((current) => mergeById(current, [userMessage]));

      const transferNeeded = needsHumanAgent(body);
      const updated = await updateConversation(conversation.id, {
        last_message: body || (outgoingAttachments.length ? "File attachment" : ""),
        status: transferNeeded ? "waiting_agent" : conversation.status || "bot",
        agent_requested: transferNeeded || conversation.agentRequested,
        unread_for_agent: Number(conversation.unreadForAgent || 0) + 1
      });
      setConversation(updated);

      await messageChannelRef.current?.send({
        type: "broadcast",
        event: "typing",
        payload: { conversationId: conversation.id, role: "bot", typing: true }
      });
      window.setTimeout(async () => {
        try {
          const reply = botReply(body);
          const botMessage = await insertMessage({ conversationId: conversation.id, role: "bot", text: reply });
          setMessages((current) => mergeById(current, [botMessage]));
          const afterBot = await updateConversation(conversation.id, {
            last_message: reply,
            unread_for_visitor: Number(updated.unreadForVisitor || 0) + 1
          });
          setConversation(afterBot);
        } finally {
          messageChannelRef.current?.send({
            type: "broadcast",
            event: "typing",
            payload: { conversationId: conversation.id, role: "bot", typing: false }
          });
        }
      }, 450);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSending(false);
    }
  };

  const handleTyping = (value) => {
    setText(value);
    messageChannelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { conversationId: conversation?.id, role: "user", typing: Boolean(value) }
    });
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
              <span className={connected ? "support-dot online" : "support-dot"} />
              {connected ? (agentOnline ? "Agent available" : "Online support available") : "Support initializing"}
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
            placeholder="Type your message..."
          />
          <button className="send-chat" type="button" onClick={() => sendMessage()} aria-label="Send message" disabled={sending}>
            {sending ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
          </button>
        </footer>
      </aside>
    </>
  );
}
