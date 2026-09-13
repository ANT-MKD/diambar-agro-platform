import { MessageCircleQuestion } from "lucide-react";
import { EmptyState } from "@/components/farmer/empty-state";
import { TICKET_CATEGORY_LABEL, TICKET_STATUS_LABEL, type SupportTicket } from "@/data/support";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<SupportTicket["status"], string> = {
  open: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  answered: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  closed: "bg-muted text-muted-foreground",
};

export function SupportTicketList({ tickets }: { tickets: SupportTicket[] }) {
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
      {tickets.map((t) => (
        <div key={t.id} className="glass rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">{t.subject}</div>
              <div className="text-xs text-muted-foreground">
                {TICKET_CATEGORY_LABEL[t.category]}
                {t.orderRef && <> · Commande {t.orderRef}</>}
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
            {t.id.toUpperCase()} · {relativeTime(t.createdAt)}
          </div>
        </div>
      ))}
    </div>
  );
}
