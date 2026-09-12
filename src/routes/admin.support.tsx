import { createFileRoute } from "@tanstack/react-router";
import { MessageCircleQuestion, Check, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { auditActions } from "@/data/admin-store";
import {
  useSupportTickets,
  supportTicketActions,
  TICKET_STATUS_LABEL,
  type SupportTicket,
} from "@/data/support";

export const Route = createFileRoute("/admin/support")({
  head: () => ({
    meta: [
      { title: "Support — Administration Diambar Agro" },
      {
        name: "description",
        content: "Tickets de support envoyés par les agriculteurs, restaurants et livreurs.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminSupportPage,
});

const ROLE_LABEL: Record<SupportTicket["fromRole"], string> = {
  farmer: "Agriculteur",
  restaurant: "Restaurant",
  driver: "Livreur",
};

const STATUS_TONE: Record<SupportTicket["status"], string> = {
  open: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  answered: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  closed: "bg-muted text-muted-foreground",
};

function AdminSupportPage() {
  const tickets = useSupportTickets();
  const openCount = tickets.filter((t) => t.status === "open").length;

  const respond = (t: SupportTicket) => {
    supportTicketActions.setStatus(t.id, "answered");
    auditActions.log("Ticket support marqué répondu", t.id.toUpperCase(), "info");
    toast.success(`${t.id.toUpperCase()} marqué comme répondu`);
  };
  const close = (t: SupportTicket) => {
    supportTicketActions.setStatus(t.id, "closed");
    auditActions.log("Ticket support fermé", t.id.toUpperCase(), "info");
    toast.success(`${t.id.toUpperCase()} fermé`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support"
        subtitle={`${openCount} ticket(s) ouvert(s) sur ${tickets.length}`}
      />

      {tickets.length === 0 ? (
        <EmptyState
          icon={MessageCircleQuestion}
          title="Aucun ticket"
          description="Les demandes envoyées par les utilisateurs apparaîtront ici."
        />
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <div key={t.id} className="glass rounded-2xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{t.subject}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.fromName} · {ROLE_LABEL[t.fromRole]}
                    {t.orderRef ? ` · Commande ${t.orderRef}` : ""}
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
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  {t.id.toUpperCase()} · {relativeTime(t.createdAt)}
                </span>
                {t.status !== "closed" && (
                  <div className="flex gap-2">
                    {t.status === "open" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => respond(t)}
                      >
                        <Check className="h-3.5 w-3.5" />
                        Marquer répondu
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => close(t)}>
                      <X className="h-3.5 w-3.5" />
                      Fermer
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
