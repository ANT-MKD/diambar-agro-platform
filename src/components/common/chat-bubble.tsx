import { FileText } from "lucide-react";

type ChatAttachment = { name: string; dataUrl: string; mime: string };

type ChatMessage = {
  id: string;
  text: string;
  at: string;
  senderName?: string;
  attachment?: ChatAttachment;
};

export function ChatBubble({
  message,
  mine,
  label,
}: {
  message: ChatMessage;
  /** Calculé par l'appelant à partir du rôle réel de l'auteur (pas une
   * étiquette "me" ambiguë partagée entre plusieurs portails avec des
   * conventions différentes). */
  mine: boolean;
  /** Nom affiché pour un message qui n'est pas de moi. */
  label?: string;
}) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-border rounded-bl-sm"}`}
      >
        {!mine && label && (
          <div className="text-[10px] font-semibold text-primary mb-0.5">{label}</div>
        )}
        {message.attachment &&
          (message.attachment.mime.startsWith("image/") ? (
            <a href={message.attachment.dataUrl} target="_blank" rel="noopener noreferrer">
              <img
                src={message.attachment.dataUrl}
                alt={message.attachment.name}
                className="max-h-48 rounded-lg mb-1.5 object-cover"
              />
            </a>
          ) : (
            <a
              href={message.attachment.dataUrl}
              download={message.attachment.name}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-2 mb-1.5 text-xs ${mine ? "bg-primary-foreground/15" : "bg-muted"}`}
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span className="truncate">{message.attachment.name}</span>
            </a>
          ))}
        {message.text && <div>{message.text}</div>}
        <div
          className={`text-[10px] mt-1 ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}
        >
          {new Date(message.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}
