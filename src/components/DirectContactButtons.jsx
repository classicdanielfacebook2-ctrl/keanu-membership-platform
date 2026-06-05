import { MessageCircle, Send } from "lucide-react";
import { useLanguage } from "../context/LanguageContext.jsx";

const cleanWhatsappNumber = (value = "") => value.replace(/[^\d]/g, "");
const cleanTelegramUsername = (value = "") => value.replace(/^@/, "").trim();

export default function DirectContactButtons({
  compact = false,
  className = "",
  title,
  subtext
}) {
  const { t } = useLanguage();
  const whatsappNumber = cleanWhatsappNumber(import.meta.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "");
  const telegramUsername = cleanTelegramUsername(import.meta.env.NEXT_PUBLIC_TELEGRAM_USERNAME || "");

  if (!whatsappNumber && !telegramUsername) return null;

  const whatsappUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(t.contact.whatsappMessage)}`
    : "";
  const telegramUrl = telegramUsername ? `https://t.me/${telegramUsername}` : "";

  return (
    <div className={`direct-contact-card ${compact ? "compact" : ""} ${className}`.trim()}>
      <div className="direct-contact-copy">
        <strong>{title || t.contact.title}</strong>
        <span>{subtext || t.contact.subtext}</span>
      </div>
      <div className="direct-contact-actions" aria-label={t.contact.channels}>
        {whatsappUrl ? (
          <a href={whatsappUrl} target="_blank" rel="noreferrer" aria-label={t.contact.whatsappAria} title="WhatsApp">
            <MessageCircle size={17} />
            <span>WhatsApp</span>
          </a>
        ) : null}
        {telegramUrl ? (
          <a href={telegramUrl} target="_blank" rel="noreferrer" aria-label={t.contact.telegramAria} title="Telegram">
            <Send size={17} />
            <span>Telegram</span>
          </a>
        ) : null}
      </div>
    </div>
  );
}
