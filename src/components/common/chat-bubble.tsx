type ChatMessage = {
  id: string;
  from: "me" | "them";
  text: string;
  at: string;
  senderName?: string;
};

export function ChatBubble({ message }: { message: ChatMessage }) {
  const mine = message.from === "me";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-border rounded-bl-sm"}`}
      >
        {!mine && message.senderName && (
          <div className="text-[10px] font-semibold text-primary mb-0.5">{message.senderName}</div>
        )}
        <div>{message.text}</div>
        <div
          className={`text-[10px] mt-1 ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}
        >
          {new Date(message.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}
