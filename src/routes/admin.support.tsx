import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  MessageCircleQuestion,
  Check,
  X,
  RotateCcw,
  Send,
  ExternalLink,
  TriangleAlert,
  Lock,
} from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PriorityBadge } from "@/components/disputes/dispute-badges";
import { formatFCFA, relativeTime } from "@/lib/format";
import { auditActions } from "@/data/admin-store";
import {
  useSupportTickets,
  supportTicketActions,
  TICKET_STATUS_LABEL,
  TICKET_CATEGORY_LABEL,
  type SupportTicket,
} from "@/data/support";
import { SUPPORT_AGENTS, useAllDisputes } from "@/data/disputes";
import { useMissions, useOrders } from "@/data/store";
import { useIncidents } from "@/data/business";
import { cn } from "@/lib/utils";

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

const TABS: { v: SupportTicket["status"] | "all"; label: string }[] = [
  { v: "all", label: "Tous" },
  { v: "open", label: "Ouverts" },
  { v: "answered", label: "Répondus" },
  { v: "closed", label: "Fermés" },
];

function AdminSupportPage() {
  const tickets = useSupportTickets();
  const orders = useOrders();
  const missions = useMissions();
  const disputes = useAllDisputes();
  const incidents = useIncidents();

  const [tab, setTab] = useState<SupportTicket["status"] | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(tickets[0]?.id ?? null);
  const [reply, setReply] = useState("");
  const [internalDraft, setInternalDraft] = useState(false);

  const openCount = tickets.filter((t) => t.status === "open").length;
  const rows = tickets.filter((t) => (tab === "all" ? true : t.status === tab));
  const selected = tickets.find((t) => t.id === selectedId) ?? rows[0] ?? null;

  const order = selected?.orderRef
    ? orders.find((o) => o.reference === selected.orderRef)
    : undefined;
  const mission = selected?.orderRef
    ? missions.find((m) => m.orderRef === selected.orderRef)
    : undefined;
  const dispute = selected?.orderRef
    ? disputes.find((d) => d.orderRef === selected.orderRef)
    : undefined;
  const incident = mission
    ? incidents.find((i) => i.missionRef === mission.reference && i.status !== "resolved")
    : undefined;

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
  const reopen = (t: SupportTicket) => {
    supportTicketActions.setStatus(t.id, "open");
    auditActions.log("Ticket support rouvert", t.id.toUpperCase(), "warning");
    toast.success(`${t.id.toUpperCase()} rouvert`);
  };

  const sendReply = () => {
    if (!selected || !reply.trim()) return;
    if (internalDraft) {
      supportTicketActions.addInternalNote(selected.id, "Admin Diambar", reply.trim());
      auditActions.log("Note interne ajoutée", selected.id.toUpperCase(), "info");
      toast.success("Note interne ajoutée");
    } else {
      supportTicketActions.addMessage(selected.id, "Admin Diambar", reply.trim());
      auditActions.log("Réponse envoyée au ticket", selected.id.toUpperCase(), "info");
      toast.success("Réponse envoyée");
    }
    setReply("");
  };

  const assign = (t: SupportTicket, agent: string | null) => {
    supportTicketActions.assign(t.id, agent);
    auditActions.log(
      agent ? `Ticket assigné à ${agent}` : "Ticket désassigné",
      t.id.toUpperCase(),
      "info",
    );
    toast.success(agent ? `Assigné à ${agent}` : "Ticket désassigné");
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
        <div className="grid gap-4 lg:grid-cols-[320px_1fr_300px] items-start">
          <div className="space-y-3">
            <div className="glass inline-flex flex-wrap gap-1 rounded-2xl p-1.5">
              {TABS.map((t) => (
                <button
                  key={t.v}
                  onClick={() => setTab(t.v)}
                  className={`h-8 rounded-xl px-2.5 text-xs font-medium transition ${tab === t.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {rows.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={cn(
                    "glass w-full rounded-2xl p-3 text-left transition",
                    selected?.id === t.id && "ring-2 ring-primary",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold truncate">{t.subject}</div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        STATUS_TONE[t.status],
                      )}
                    >
                      {TICKET_STATUS_LABEL[t.status]}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground truncate">
                    {t.fromName} · {ROLE_LABEL[t.fromRole]}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                    <PriorityBadge priority={t.priority} />
                    <span>{relativeTime(t.createdAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selected ? (
            <div className="glass rounded-2xl p-5 space-y-4 min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display font-bold">{selected.subject}</h2>
                  <p className="text-xs text-muted-foreground">
                    {selected.id.toUpperCase()} · {TICKET_CATEGORY_LABEL[selected.category]}
                  </p>
                </div>
                <div className="flex gap-2">
                  {selected.status === "open" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => respond(selected)}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Marquer répondu
                    </Button>
                  )}
                  {selected.status !== "closed" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => close(selected)}
                    >
                      <X className="h-3.5 w-3.5" />
                      Fermer
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => reopen(selected)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Rouvrir
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {selected.messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "max-w-[85%] rounded-2xl p-3 text-sm",
                      m.internal
                        ? "ml-auto bg-amber-500/10 border border-amber-500/30"
                        : m.authorRole === "platform"
                          ? "ml-auto bg-primary/10 text-foreground"
                          : "bg-muted",
                    )}
                  >
                    <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                      {m.internal && <Lock className="h-3 w-3" />}
                      {m.authorName} · {relativeTime(m.at)}
                      {m.internal && " · Note interne"}
                    </div>
                    {m.text}
                  </div>
                ))}
              </div>

              {selected.status !== "closed" && (
                <div className="space-y-2 border-t border-border pt-3">
                  <Textarea
                    placeholder={
                      internalDraft
                        ? "Note interne (visible admin uniquement)…"
                        : "Répondre au ticket…"
                    }
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={3}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={internalDraft}
                        onChange={(e) => setInternalDraft(e.target.checked)}
                      />
                      Note interne (non visible par le demandeur)
                    </label>
                    <Button
                      size="sm"
                      variant={internalDraft ? "outline" : "default"}
                      className="gap-2"
                      onClick={sendReply}
                      disabled={!reply.trim()}
                    >
                      {internalDraft ? (
                        <Lock className="h-3.5 w-3.5" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      {internalDraft ? "Ajouter la note" : "Envoyer"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              icon={MessageCircleQuestion}
              title="Aucun ticket dans cette catégorie"
              description="Choisissez un autre filtre."
            />
          )}

          {selected && (
            <div className="space-y-4">
              <div className="glass rounded-2xl p-4 space-y-2.5">
                <h3 className="text-sm font-display font-bold">Détails</h3>
                <Row
                  label="Demandeur"
                  value={`${selected.fromName} (${ROLE_LABEL[selected.fromRole]})`}
                />
                <Row
                  label="Priorité"
                  value=""
                  custom={<PriorityBadge priority={selected.priority} />}
                />
                <div className="space-y-1 pt-1">
                  <label className="text-xs font-medium text-muted-foreground">Assigné à</label>
                  <Select
                    value={selected.assignee ?? "none"}
                    onValueChange={(v) => assign(selected, v === "none" ? null : v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Non assigné</SelectItem>
                      {SUPPORT_AGENTS.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(order || dispute || incident) && (
                <div className="glass rounded-2xl p-4 space-y-2">
                  <h3 className="text-sm font-display font-bold">Liens automatiques</h3>
                  {order && (
                    <Link
                      to="/admin/orders/$orderId"
                      params={{ orderId: order.id }}
                      className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-xs hover:bg-accent"
                    >
                      <span>
                        Commande {order.reference} · {formatFCFA(order.total)}
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </Link>
                  )}
                  {dispute && (
                    <Link
                      to="/admin/disputes/$disputeId"
                      params={{ disputeId: dispute.id }}
                      className="flex items-center justify-between rounded-xl border border-destructive/30 px-3 py-2 text-xs text-destructive hover:bg-destructive/5"
                    >
                      <span>Litige {dispute.reference}</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  )}
                  {incident && (
                    <Link
                      to="/admin/incidents/$incidentId"
                      params={{ incidentId: incident.id }}
                      className="flex items-center justify-between rounded-xl border border-amber-500/30 px-3 py-2 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-500/5"
                    >
                      <span className="flex items-center gap-1.5">
                        <TriangleAlert className="h-3.5 w-3.5" />
                        Incident {incident.reference}
                      </span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, custom }: { label: string; value: string; custom?: ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      {custom ?? <span className="font-semibold">{value}</span>}
    </div>
  );
}
