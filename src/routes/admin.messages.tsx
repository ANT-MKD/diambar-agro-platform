import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Send, Search, MessageSquare, Sprout, Truck } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { ChatBubble } from "@/components/common/chat-bubble";
import {
  useConversations,
  useDriverConversations,
  conversationActions,
  driverConversationActions,
} from "@/data/store";
import { restaurants, farmers, drivers } from "@/data/mocks";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/format";

export const Route = createFileRoute("/admin/messages")({
  head: () => ({
    meta: [
      { title: "Messages — Administration Diambar Agro" },
      {
        name: "description",
        content:
          "Supervision des conversations agriculteur-restaurant et livreur-restaurant de la plateforme.",
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

type Thread = {
  id: string;
  kind: "farmer" | "driver";
  restaurantId: string;
  counterpartName: string;
  lastMessage: string;
  lastAt: string;
  messages: {
    id: string;
    from: "restaurant" | "farmer" | "admin" | "me" | "them";
    text: string;
    at: string;
    senderName?: string;
  }[];
};

function AdminMessages() {
  const { user } = useRouteContext({ from: "/admin" });
  const farmerConvos = useConversations();
  const driverConvos = useDriverConversations();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");

  const threads = useMemo<Thread[]>(() => {
    const fromFarmer: Thread[] = farmerConvos.map((c) => ({
      id: c.id,
      kind: "farmer",
      restaurantId: c.restaurantId,
      counterpartName: FARMER_NAME,
      lastMessage: c.lastMessage,
      lastAt: c.lastAt,
      messages: c.messages,
    }));
    const fromDriver: Thread[] = driverConvos.map((c) => ({
      id: c.id,
      kind: "driver",
      restaurantId: c.restaurantId,
      counterpartName: DRIVER_NAME,
      lastMessage: c.lastMessage,
      lastAt: c.lastAt,
      messages: c.messages,
    }));
    return [...fromFarmer, ...fromDriver].sort(
      (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
    );
  }, [farmerConvos, driverConvos]);

  const active = threads.find((t) => t.id === activeId) ?? null;
  const filtered = threads.filter((t) => {
    const r = restaurants.find((x) => x.id === t.restaurantId);
    const label = `${t.counterpartName} ${r?.name ?? ""} ${t.lastMessage}`.toLowerCase();
    return label.includes(q.toLowerCase());
  });

  const send = () => {
    if (!active || !draft.trim()) return;
    if (active.kind === "farmer") {
      conversationActions.send(active.id, draft.trim(), "admin", user.name);
    } else {
      driverConversationActions.send(active.id, draft.trim(), "them", user.name);
    }
    setDraft("");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        subtitle="Supervision des conversations agriculteur-restaurant et livreur-restaurant"
      />
      <div className="glass rounded-2xl overflow-hidden grid lg:grid-cols-[340px_1fr] h-[640px]">
        <div className="border-r border-border flex flex-col">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher…"
                className="pl-9"
              />
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
                  onClick={() => setActiveId(t.id)}
                  className={`w-full p-3 flex items-center gap-3 border-b border-border text-left hover:bg-accent transition ${isActive ? "bg-accent" : ""}`}
                >
                  <div className="relative shrink-0">
                    <img src={r?.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                    <span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-background border border-border text-muted-foreground">
                      <KindIcon className="h-2.5 w-2.5" />
                    </span>
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
                    <span className="text-xs text-muted-foreground truncate block">
                      {t.lastMessage}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {active ? (
          (() => {
            const r = restaurants.find((x) => x.id === active.restaurantId);
            return (
              <div className="flex flex-col">
                <div className="p-4 border-b border-border flex items-center gap-3">
                  <img src={r?.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                  <div className="flex-1">
                    <div className="font-semibold">
                      {active.counterpartName} ↔ {r?.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {active.kind === "farmer"
                        ? "Agriculteur · Restaurant"
                        : "Livreur · Restaurant"}
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-4 space-y-3 bg-muted/20">
                  {active.messages.map((m) => {
                    // Chaque store de conversation a sa propre convention
                    // ("restaurant"/"farmer"/"admin" pour les fils producteur,
                    // "me"/"them" + senderName pour les fils livreur) : un
                    // message de l'admin est donc identifié différemment
                    // selon le fil, plutôt que par une étiquette partagée.
                    const mine =
                      active.kind === "farmer"
                        ? m.from === "admin"
                        : m.from === "them" && m.senderName === user.name;
                    const label = m.senderName ?? (mine ? undefined : active.counterpartName);
                    return <ChatBubble key={m.id} message={m} mine={mine} label={label} />;
                  })}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    send();
                  }}
                  className="p-3 border-t border-border flex gap-2"
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
            );
          })()
        ) : (
          <div className="grid place-items-center p-8">
            <EmptyState
              icon={MessageSquare}
              title="Aucune conversation sélectionnée"
              description="Choisissez une conversation pour la superviser."
            />
          </div>
        )}
      </div>
    </div>
  );
}
