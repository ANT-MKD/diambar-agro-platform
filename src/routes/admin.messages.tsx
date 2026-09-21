import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Send,
  Search,
  MessageSquare,
  Sprout,
  Truck,
  ExternalLink,
  Lock,
  TicketPlus,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { StatCard } from "@/components/admin/stat-card";
import { AdminBadge } from "@/components/admin/admin-badge";
import { ChatBubble } from "@/components/common/chat-bubble";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  useConversations,
  useDriverConversations,
  conversationActions,
  driverConversationActions,
  useOrders,
  useMissions,
} from "@/data/store";
import { useAllDisputes } from "@/data/disputes";
import { useIncidents, useReturns, returnStage, RETURN_STAGE_LABEL } from "@/data/business";
import { useRefunds, REFUND_STATUS_LABEL } from "@/data/finance";
import { supportTicketActions } from "@/data/support";
import { auditActions } from "@/data/admin-store";
import { restaurants, farmers, drivers, type Order } from "@/data/mocks";
import { formatFCFA, relativeTime } from "@/lib/format";

export const Route = createFileRoute("/admin/messages")({
  head: () => ({
    meta: [
      { title: "Messages — Administration Diambar Agro" },
      {
        name: "description",
        content:
          "Centre de communication : conversations agriculteur-restaurant et livreur-restaurant, avec contexte opérationnel complet.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminMessages,
});

// Chaque store de conversation est écrit du point de vue d'un seul compte
// démo (il n'existe qu'un agriculteur et qu'un livreur connectables) : ces
// noms reflètent honnêtement ce que représentent les données, plutôt que
// d'inventer un rattachement par conversation qui n'existe pas dans le modèle.
const FARMER_NAME = farmers[0]?.name ?? "Agriculteur";
const DRIVER_NAME = drivers[0]?.name ?? "Livreur";

const TAG_OPTIONS = [
  "Livraison",
  "Retard",
  "Litige",
  "Paiement",
  "Retour",
  "Remboursement",
  "Produit",
  "Support",
];

const QUICK_REPLIES = [
  "Bonjour, nous vérifions votre commande.",
  "Votre demande a été transmise au service concerné.",
  "Nous avons contacté le livreur, nous revenons vers vous rapidement.",
  "Votre remboursement est en cours de traitement.",
];

const PRIORITY_LABEL: Record<"normal" | "important" | "urgent", string> = {
  normal: "Normale",
  important: "Importante",
  urgent: "Urgente",
};
const PRIORITY_DOT: Record<"normal" | "important" | "urgent", string> = {
  normal: "bg-muted-foreground/40",
  important: "bg-orange-500",
  urgent: "bg-destructive",
};

type Thread = {
  id: string;
  kind: "farmer" | "driver";
  restaurantId: string;
  farmerId?: string;
  counterpartName: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
  priority?: "normal" | "important" | "urgent";
  tags?: string[];
  internalNotes?: { id: string; at: string; actor: string; text: string }[];
  ticketId?: string;
  messages: {
    id: string;
    from: "restaurant" | "farmer" | "admin" | "me" | "them";
    text: string;
    at: string;
    senderName?: string;
  }[];
};

function lastOrderFor(orders: Order[], restaurantId: string, farmerId?: string) {
  const matching = orders.filter(
    (o) => o.restaurantId === restaurantId && (!farmerId || o.farmerId === farmerId),
  );
  if (matching.length === 0) return undefined;
  return matching.reduce((a, b) => (new Date(b.createdAt) > new Date(a.createdAt) ? b : a));
}

function AdminMessages() {
  const { user } = useRouteContext({ from: "/admin" });
  const farmerConvos = useConversations();
  const driverConvos = useDriverConversations();
  const orders = useOrders();
  const missions = useMissions();
  const disputes = useAllDisputes();
  const incidents = useIncidents();
  const returns = useReturns();
  const refunds = useRefunds();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  const [filterTab, setFilterTab] = useState<
    "all" | "unread" | "farmer" | "driver" | "urgent" | "escalated"
  >("all");
  const [noteDraft, setNoteDraft] = useState("");
  const [ticketOpen, setTicketOpen] = useState(false);

  const threads = useMemo<Thread[]>(() => {
    const fromFarmer: Thread[] = farmerConvos.map((c) => ({
      id: c.id,
      kind: "farmer",
      restaurantId: c.restaurantId,
      farmerId: c.farmerId,
      counterpartName: FARMER_NAME,
      lastMessage: c.lastMessage,
      lastAt: c.lastAt,
      unread: c.unread,
      priority: c.priority,
      tags: c.tags,
      internalNotes: c.internalNotes,
      ticketId: c.ticketId,
      messages: c.messages,
    }));
    const fromDriver: Thread[] = driverConvos.map((c) => ({
      id: c.id,
      kind: "driver",
      restaurantId: c.restaurantId,
      counterpartName: DRIVER_NAME,
      lastMessage: c.lastMessage,
      lastAt: c.lastAt,
      unread: c.unread,
      priority: c.priority,
      tags: c.tags,
      internalNotes: c.internalNotes,
      ticketId: c.ticketId,
      messages: c.messages,
    }));
    return [...fromFarmer, ...fromDriver].sort(
      (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
    );
  }, [farmerConvos, driverConvos]);

  const contextFor = (t: Thread) => {
    const restaurant = restaurants.find((x) => x.id === t.restaurantId);
    const restaurantOrders = orders.filter((o) => o.restaurantId === t.restaurantId);
    const order = lastOrderFor(orders, t.restaurantId, t.farmerId);
    const spend = restaurantOrders.reduce((s, o) => s + o.total, 0);
    const dispute = [...disputes]
      .filter((d) => d.openedByName === restaurant?.name || d.againstName === restaurant?.name)
      .sort((a, b) => {
        const aOpen = a.status !== "resolved" && a.status !== "rejected";
        const bOpen = b.status !== "resolved" && b.status !== "rejected";
        if (aOpen !== bOpen) return aOpen ? -1 : 1;
        return new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime();
      })[0];
    const restMissions = missions.filter((m) => m.restaurantId === t.restaurantId);
    const incident = [...incidents]
      .filter((i) => restMissions.some((m) => m.reference === i.missionRef))
      .sort((a, b) => {
        const aOpen = a.status !== "resolved";
        const bOpen = b.status !== "resolved";
        if (aOpen !== bOpen) return aOpen ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })[0];
    const returnReq = [...returns]
      .filter((r) => r.restaurantId === t.restaurantId)
      .sort((a, b) => {
        if (!!a.closedAt !== !!b.closedAt) return a.closedAt ? 1 : -1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })[0];
    const refund = [...refunds]
      .filter((r) => r.requester === restaurant?.name)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    return {
      restaurant,
      order,
      spend,
      ordersCount: restaurantOrders.length,
      dispute,
      incident,
      returnReq,
      refund,
    };
  };

  const active = threads.find((t) => t.id === activeId) ?? null;
  const activeCtx = active ? contextFor(active) : null;

  const filtered = threads.filter((t) => {
    if (filterTab === "unread" && t.unread === 0) return false;
    if (filterTab === "farmer" && t.kind !== "farmer") return false;
    if (filterTab === "driver" && t.kind !== "driver") return false;
    if (filterTab === "urgent" && t.priority !== "urgent") return false;
    if (filterTab === "escalated" && !t.ticketId) return false;
    if (q.trim()) {
      const ctx = contextFor(t);
      const blob = [
        t.counterpartName,
        ctx.restaurant?.name,
        ...t.messages.map((m) => m.text),
        ctx.order?.reference,
        ctx.dispute?.reference,
        ctx.incident?.reference,
        ctx.returnReq?.reference,
        ctx.refund?.reference,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!blob.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const totalUnread = threads.reduce((s, t) => s + t.unread, 0);
  const urgentCount = threads.filter((t) => t.priority === "urgent").length;
  const escalatedCount = threads.filter((t) => t.ticketId).length;

  const openThread = (t: Thread) => {
    setActiveId(t.id);
    if (t.unread > 0) {
      if (t.kind === "farmer") conversationActions.markRead(t.id);
      else driverConversationActions.markRead(t.id);
    }
  };

  const send = () => {
    if (!active || !draft.trim()) return;
    if (active.kind === "farmer") {
      conversationActions.send(active.id, draft.trim(), "admin", user.name);
    } else {
      driverConversationActions.send(active.id, draft.trim(), "them", user.name);
    }
    setDraft("");
  };

  const setPriority = (t: Thread, priority: "normal" | "important" | "urgent") => {
    if (t.kind === "farmer") conversationActions.setPriority(t.id, priority);
    else driverConversationActions.setPriority(t.id, priority);
  };

  const toggleTag = (t: Thread, tag: string) => {
    const next = (t.tags ?? []).includes(tag)
      ? (t.tags ?? []).filter((x) => x !== tag)
      : [...(t.tags ?? []), tag];
    if (t.kind === "farmer") conversationActions.setTags(t.id, next);
    else driverConversationActions.setTags(t.id, next);
  };

  const addNote = () => {
    if (!active || !noteDraft.trim()) return;
    if (active.kind === "farmer") {
      conversationActions.addInternalNote(active.id, user.name, noteDraft.trim());
    } else {
      driverConversationActions.addInternalNote(active.id, user.name, noteDraft.trim());
    }
    setNoteDraft("");
    toast.success("Note interne ajoutée");
  };

  const createTicket = () => {
    if (!active || !activeCtx) return;
    const ticket = supportTicketActions.create({
      subject: `Conversation ${active.kind === "farmer" ? "agriculteur" : "livreur"} — ${activeCtx.restaurant?.name ?? active.counterpartName}`,
      message: active.lastMessage || "Conversation transférée depuis la messagerie de supervision.",
      fromName: activeCtx.restaurant?.name ?? active.counterpartName,
      fromRole: "restaurant",
      category: "other",
      orderRef: activeCtx.order?.reference,
    });
    if (active.kind === "farmer") conversationActions.linkTicket(active.id, ticket.id);
    else driverConversationActions.linkTicket(active.id, ticket.id);
    auditActions.log(
      `Ticket support créé depuis une conversation (${ticket.id.toUpperCase()})`,
      activeCtx.restaurant?.name ?? active.counterpartName,
      "info",
    );
    toast.success(`Ticket ${ticket.id.toUpperCase()} créé`);
    setTicketOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        subtitle="Supervisez les conversations et intervenez lorsqu'une situation nécessite l'aide de Diambar Agro"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Conversations" value={String(threads.length)} icon={MessageSquare} />
        <StatCard
          label="Non lues"
          value={String(totalUnread)}
          icon={MessageSquare}
          hint={totalUnread > 0 ? "Action requise" : undefined}
        />
        <StatCard label="Urgentes" value={String(urgentCount)} icon={Zap} />
        <StatCard label="Escaladées" value={String(escalatedCount)} icon={TicketPlus} />
      </div>

      <div className="glass rounded-2xl overflow-hidden grid lg:grid-cols-[300px_1fr_300px] h-[680px]">
        <div className="border-r border-border flex flex-col min-w-0">
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nom, référence commande/litige…"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  { v: "all", label: "Toutes" },
                  { v: "unread", label: "Non lues" },
                  { v: "farmer", label: "Agriculteurs" },
                  { v: "driver", label: "Livreurs" },
                  { v: "urgent", label: "Urgentes" },
                  { v: "escalated", label: "Escaladées" },
                ] as const
              ).map((f) => (
                <button
                  key={f.v}
                  onClick={() => setFilterTab(f.v)}
                  className={`h-6 rounded-full px-2 text-[10px] font-medium transition ${filterTab === f.v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {filtered.length === 0 && (
              <div className="p-6 text-sm text-muted-foreground text-center">
                Aucune conversation.
              </div>
            )}
            {filtered.map((t) => {
              const r = restaurants.find((x) => x.id === t.restaurantId);
              const isActive = t.id === activeId;
              const KindIcon = t.kind === "farmer" ? Sprout : Truck;
              return (
                <button
                  key={t.id}
                  onClick={() => openThread(t)}
                  className={`w-full p-3 flex items-center gap-3 border-b border-border text-left hover:bg-accent transition ${isActive ? "bg-accent" : ""}`}
                >
                  <div className="relative shrink-0">
                    <img src={r?.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                    <span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-background border border-border text-muted-foreground">
                      <KindIcon className="h-2.5 w-2.5" />
                    </span>
                    {t.priority && t.priority !== "normal" && (
                      <span
                        className={`absolute -top-0.5 -left-0.5 h-2.5 w-2.5 rounded-full border border-background ${PRIORITY_DOT[t.priority]}`}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">
                        {t.counterpartName} · {r?.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {relativeTime(t.lastAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground truncate flex-1">
                        {t.lastMessage}
                      </span>
                      {t.ticketId && <TicketPlus className="h-3 w-3 shrink-0 text-primary" />}
                      {t.unread > 0 && (
                        <span className="shrink-0 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                          {t.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {active && activeCtx ? (
          <div className="flex flex-col min-w-0">
            <div className="p-4 border-b border-border flex items-center gap-3">
              <img
                src={activeCtx.restaurant?.avatar}
                alt=""
                className="h-10 w-10 rounded-full object-cover"
              />
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">
                  {active.counterpartName} ↔ {activeCtx.restaurant?.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {active.kind === "farmer" ? "Agriculteur · Restaurant" : "Livreur · Restaurant"}
                </div>
              </div>
              <select
                value={active.priority ?? "normal"}
                onChange={(e) =>
                  setPriority(active, e.target.value as "normal" | "important" | "urgent")
                }
                className="h-8 rounded-lg border border-border bg-background px-2 text-xs"
              >
                {(["normal", "important", "urgent"] as const).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-3 bg-muted/20">
              {active.messages.map((m) => {
                const mine =
                  active.kind === "farmer"
                    ? m.from === "admin"
                    : m.from === "them" && m.senderName === user.name;
                // "them" (fil livreur) ou "restaurant" (fil agriculteur) ne
                // désignent pas forcément le même expéditeur : un message
                // peut venir du restaurant OU avoir été injecté par l'admin
                // (senderName renseigné). Sans cette distinction, tout
                // message non-admin s'affichait à tort sous le nom du
                // livreur/agriculteur, y compris ceux du restaurant.
                let label: string | undefined;
                if (!mine) {
                  if (m.senderName) label = m.senderName;
                  else if (active.kind === "farmer")
                    label =
                      m.from === "farmer" ? active.counterpartName : activeCtx.restaurant?.name;
                  else
                    label = m.from === "me" ? active.counterpartName : activeCtx.restaurant?.name;
                }
                return <ChatBubble key={m.id} message={m} mine={mine} label={label} />;
              })}
            </div>

            <div className="border-t border-border p-3 space-y-2">
              <div className="flex flex-wrap gap-1">
                {TAG_OPTIONS.map((tag) => {
                  const on = (active.tags ?? []).includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(active, tag)}
                      className={`h-6 rounded-full px-2 text-[10px] font-medium border transition ${on ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-accent"}`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_REPLIES.map((qr) => (
                  <button
                    key={qr}
                    onClick={() => setDraft(qr)}
                    className="rounded-full border border-border px-2.5 py-1 text-[10px] text-muted-foreground hover:bg-accent"
                  >
                    {qr}
                  </button>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
                className="flex gap-2"
              >
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Intervenir dans la conversation en tant qu'admin…"
                  className="flex-1"
                />
                <Button type="submit" size="icon" disabled={!draft.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        ) : (
          <div className="grid place-items-center p-8">
            <EmptyState
              icon={MessageSquare}
              title="Aucune conversation sélectionnée"
              description="Choisissez une conversation pour la superviser."
            />
          </div>
        )}

        {active && activeCtx ? (
          <div className="border-l border-border overflow-auto p-4 space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">CLIENT</h3>
              <div className="font-medium">{activeCtx.restaurant?.name}</div>
              <div className="text-xs text-muted-foreground">{activeCtx.restaurant?.city}</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl bg-muted p-2">
                  <div className="text-sm font-bold">{activeCtx.ordersCount}</div>
                  <div className="text-[10px] text-muted-foreground">Commandes</div>
                </div>
                <div className="rounded-xl bg-muted p-2">
                  <div className="text-sm font-bold">{formatFCFA(activeCtx.spend)}</div>
                  <div className="text-[10px] text-muted-foreground">Dépenses</div>
                </div>
              </div>
            </div>

            {activeCtx.order && (
              <div className="rounded-xl border border-border p-3 space-y-1">
                <h3 className="text-[10px] font-semibold text-muted-foreground">
                  DERNIÈRE COMMANDE
                </h3>
                <div className="text-sm font-medium">{activeCtx.order.reference}</div>
                <div className="text-xs text-muted-foreground">
                  {formatFCFA(activeCtx.order.total)}
                </div>
                <Link
                  to="/admin/orders/$orderId"
                  params={{ orderId: activeCtx.order.id }}
                  className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Voir la commande
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}

            {activeCtx.dispute && (
              <div className="rounded-xl border border-destructive/30 p-3 space-y-1">
                <h3 className="text-[10px] font-semibold text-muted-foreground">LITIGE</h3>
                <div className="text-sm font-medium">{activeCtx.dispute.reference}</div>
                <div className="text-xs text-muted-foreground">{activeCtx.dispute.subcategory}</div>
                <Link
                  to="/admin/disputes/$disputeId"
                  params={{ disputeId: activeCtx.dispute.id }}
                  className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Voir le litige
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}

            {activeCtx.incident && (
              <div className="rounded-xl border border-amber-500/30 p-3 space-y-1">
                <h3 className="text-[10px] font-semibold text-muted-foreground">INCIDENT</h3>
                <div className="text-sm font-medium">{activeCtx.incident.reference}</div>
                <Link
                  to="/admin/incidents/$incidentId"
                  params={{ incidentId: activeCtx.incident.id }}
                  className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Voir l'incident
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}

            {activeCtx.returnReq && (
              <div className="rounded-xl border border-border p-3 space-y-1">
                <h3 className="text-[10px] font-semibold text-muted-foreground">RETOUR</h3>
                <div className="text-sm font-medium">{activeCtx.returnReq.reference}</div>
                <AdminBadge
                  value={returnStage(activeCtx.returnReq)}
                  label={RETURN_STAGE_LABEL[returnStage(activeCtx.returnReq)]}
                />
                <Link
                  to="/admin/returns/$returnId"
                  params={{ returnId: activeCtx.returnReq.id }}
                  className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Voir le retour
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}

            {activeCtx.refund && (
              <div className="rounded-xl border border-border p-3 space-y-1">
                <h3 className="text-[10px] font-semibold text-muted-foreground">REMBOURSEMENT</h3>
                <div className="text-sm font-medium">{activeCtx.refund.reference}</div>
                <div className="text-xs text-muted-foreground">
                  {formatFCFA(activeCtx.refund.amount)}
                </div>
                <AdminBadge
                  value={activeCtx.refund.status}
                  label={REFUND_STATUS_LABEL[activeCtx.refund.status]}
                />
                <Link
                  to="/admin/refunds/$refundId"
                  params={{ refundId: activeCtx.refund.id }}
                  className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Voir le remboursement
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}

            <div className="space-y-2 border-t border-border pt-3">
              {active.ticketId ? (
                <div className="text-xs text-muted-foreground">
                  Ticket lié : <span className="font-mono">{active.ticketId.toUpperCase()}</span>
                </div>
              ) : ticketOpen ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Créer un ticket support à partir de cette conversation ?
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={createTicket}>
                      Confirmer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setTicketOpen(false)}
                    >
                      Annuler
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => setTicketOpen(true)}
                >
                  <TicketPlus className="h-3.5 w-3.5" />
                  Créer un ticket support
                </Button>
              )}
            </div>

            <div className="space-y-2 border-t border-border pt-3">
              <h3 className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                <Lock className="h-3 w-3" />
                NOTES INTERNES
              </h3>
              {(active.internalNotes ?? []).map((n) => (
                <div
                  key={n.id}
                  className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2 text-xs"
                >
                  <div className="text-muted-foreground mb-0.5">
                    {n.actor} · {relativeTime(n.at)}
                  </div>
                  {n.text}
                </div>
              ))}
              <Textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Note visible par les admins uniquement…"
                rows={2}
                className="text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={addNote}
                disabled={!noteDraft.trim()}
              >
                Ajouter la note
              </Button>
            </div>
          </div>
        ) : (
          <div className="border-l border-border" />
        )}
      </div>
    </div>
  );
}
