import { useState } from "react";
import { toast } from "sonner";
import { MessageCircleQuestion, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { market } from "@/data/market-remote";
import { Link } from "@tanstack/react-router";
import { EmptyState } from "@/components/farmer/empty-state";
import { TICKET_CATEGORY_LABEL, TICKET_STATUS_LABEL, type SupportTicket } from "@/data/support";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<SupportTicket["status"], string> = {
  open: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  answered: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  closed: "bg-muted text-muted-foreground",
};

export function SupportTicketList({
  tickets,
  resolveOrderHref,
}: {
  tickets: SupportTicket[];
  /** Résout une référence de commande vers un vrai lien de suivi, propre
   * à chaque portail (restaurant/agriculteur/livreur) — absent quand la
   * commande n'existe plus vraiment. */
  resolveOrderHref?: (orderRef: string) => string | undefined;
}) {
  if (tickets.length === 0) {
    return (
      <EmptyState
        icon={MessageCircleQuestion}
        title="Aucun ticket envoyé"
        description="Vos demandes au support apparaîtront ici."
      />
    );
  }

  return (
    <div className="space-y-3">
      {tickets.map((t) => {
        const orderHref = t.orderRef ? resolveOrderHref?.(t.orderRef) : undefined;
        return (
          <div key={t.id} className="glass rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{t.subject}</div>
                <div className="text-xs text-muted-foreground">
                  {TICKET_CATEGORY_LABEL[t.category]}
                  {t.orderRef &&
                    (orderHref ? (
                      <>
                        {" · "}
                        <Link to={orderHref as never} className="text-primary hover:underline">
                          Commande {t.orderRef}
                        </Link>
                      </>
                    ) : (
                      <> · Commande {t.orderRef}</>
                    ))}
                </div>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  STATUS_TONE[t.status],
                )}
              >
                {TICKET_STATUS_LABEL[t.status]}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{t.message}</p>
            <div className="mt-2 text-[11px] text-muted-foreground">
              {t.reference ?? t.id.toUpperCase()} · {relativeTime(t.createdAt)}
            </div>
            {/* Suite de l'échange (réponses de l'équipe, et les vôtres). */}
            {t.messages.length > 1 && (
              <div className="mt-3 space-y-2 border-t border-border pt-3">
                {t.messages.slice(1).map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "rounded-xl px-3 py-2 text-sm",
                      m.authorRole === "platform" ? "bg-primary/10" : "bg-muted",
                    )}
                  >
                    <div className="text-[10px] text-muted-foreground">
                      {m.authorName} · {relativeTime(m.at)}
                    </div>
                    {m.text}
                  </div>
                ))}
              </div>
            )}
            {market.isRemote() && t.status !== "closed" && <ReplyBox ticketId={t.id} />}
          </div>
        );
      })}
    </div>
  );
}

/** Réponse à une demande (mode base) : elle repasse « Ouvert » côté équipe. */
function ReplyBox({ ticketId }: { ticketId: string }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  return (
    <form
      className="mt-3 flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        setSending(true);
        const res = await market.replyTicket(ticketId, text.trim());
        setSending(false);
        if (!res.ok) {
          toast.error(res.message);
          return;
        }
        setText("");
        toast.success("Message envoyé à l'équipe");
      }}
    >
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Répondre à l'équipe…"
        aria-label="Répondre à l'équipe"
      />
      <Button type="submit" size="icon" disabled={sending} aria-label="Envoyer">
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}
