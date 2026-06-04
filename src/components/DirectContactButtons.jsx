import { MessageCircle, Send } from "lucide-react";

const welcomeMessage = "Hello support, I need help with my membership application.";

const cleanWhatsappNumber = (value = "") => value.replace(/[^\d]/g, "");
const cleanTelegramUsername = (value = "") => value.replace(/^@/, "").trim();

export default function DirectContactButtons({
  compact = false,
  className = "",
  title = "Contact us directly",
  subtext = "Message support on WhatsApp or Telegram"
}) {
  const whatsappNumber = cleanWhatsappNumber(import.meta.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "");
  const telegramUsername = cleanTelegramUsername(import.meta.env.NEXT_PUBLIC_TELEGRAM_USERNAME || "");

  if (!whatsappNumber && !telegramUsername) return null;

  const whatsappUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(welcomeMessage)}`
    : "";
  const telegramUrl = telegramUsername ? `https://t.me/${telegramUsername}` : "";

  return (
    <div className={`direct-contact-card ${compact ? "compact" : ""} ${className}`.trim()}>
      <div className="direct-contact-copy">
        <strong>{title}</strong>
        <span>{subtext}</span>
      </div>
      <div className="direct-contact-actions" aria-label="Direct support channels">
        {whatsappUrl ? (
          <a href={whatsappUrl} target="_blank" rel="noreferrer" aria-label="Message support on WhatsApp" title="WhatsApp">
            <MessageCircle size={17} />
            <span>WhatsApp</span>
          </a>
        ) : null}
        {telegramUrl ? (
          <a href={telegramUrl} target="_blank" rel="noreferrer" aria-label="Message support on Telegram" title="Telegram">
            <Send size={17} />
            <span>Telegram</span>
          </a>
        ) : null}
      </div>
    </div>
  );
}
