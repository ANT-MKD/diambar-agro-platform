import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { Send, Search, MessageSquare, Paperclip, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { ChatBubble } from "@/components/common/chat-bubble";
import { farmers, restaurants } from "@/data/mocks";
import {
  useConversations,
  useSuppliers,
  conversationActions,
  useDriverConversations,
  driverConversationActions,
} from "@/data/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { relativeTime } from "@/lib/format";

export const Route = createFileRoute("/restaurant/messages/")({
  head: () => ({ meta: [{ title: "Messages · Restaurant" }] }),
  component: Messages,
});

function Messages() {
  const { user } = useRouteContext({ from: "/restaurant" });
  const myRestaurant = restaurants.find((r) => r.name === user.name);
  const suppliers = useSuppliers();
  const convs = useConversations();
  // Une conversation réelle par fournisseur du carnet — plus un unique
  // producteur codé en dur.
  const enriched = convs
    .filter((c) => c.restaurantId === myRestaurant?.id)
    .map((c) => ({ ...c, farmer: farmers.find((f) => f.id === c.farmerId) }))
    .filter((c): c is typeof c & { farmer: NonNullable<(typeof c)["farmer"]> } => !!c.farmer);
  const [activeId, setActiveId] = useState<string | null>(enriched[0]?.id ?? null);
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");

  const active = enriched.find((c) => c.id === activeId) ?? null;
  const filtered = enriched.filter(
    (c) =>
      c.farmer.farm.toLowerCase().includes(q.toLowerCase()) ||
      c.lastMessage.toLowerCase().includes(q.toLowerCase()),
  );

  const myCarnet = suppliers.filter((s) => s.restaurantId === myRestaurant?.id && s.farmerId);
  const conversedFarmerIds = new Set(enriched.map((c) => c.farmerId));
  const startableSuppliers = myCarnet.filter((s) => !conversedFarmerIds.has(s.farmerId!));

  const open = (id: string) => {
    setActiveId(id);
    conversationActions.markRead(id);
  };
  const startConversation = (farmerId: string) => {
    if (!myRestaurant) return;
    const id = conversationActions.startOrGet(myRestaurant.id, farmerId);
    setActiveId(id);
    toast.success("Nouvelle conversation prête");
  };
  const send = () => {
    if (!active || !draft.trim() || !myRestaurant) return;
    conversationActions.send(active.id, draft.trim(), "restaurant");
    setDraft("");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        subtitle="Discutez directement avec vos producteurs"
        actions={
          startableSuppliers.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nouvelle conversation
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {startableSuppliers.map((s) => (
                  <DropdownMenuItem key={s.id} onClick={() => startConversation(s.farmerId!)}>
                    {s.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }
      />
      <div className="glass rounded-2xl overflow-hidden grid lg:grid-cols-[320px_1fr] h-[640px]">
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
              <div className="p-6 text-center text-xs text-muted-foreground">
                Aucune conversation. Démarrez-en une avec un fournisseur de votre carnet.
              </div>
            )}
            {filtered.map((c) => {
              const isActive = c.id === activeId;
              return (
                <button
                  key={c.id}
                  onClick={() => open(c.id)}
                  className={`w-full p-3 flex items-center gap-3 border-b border-border text-left hover:bg-accent transition ${isActive ? "bg-accent" : ""}`}
                >
                  <img
                    src={c.farmer.avatar}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{c.farmer.farm}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {relativeTime(c.lastAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground truncate">
                        {c.lastMessage || "Nouvelle conversation"}
                      </span>
                      {c.unread > 0 && (
                        <span className="grid h-5 min-w-5 px-1 place-items-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                          {c.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {active ? (
          <div className="flex flex-col">
            <div className="p-4 border-b border-border flex items-center gap-3">
              <img
                src={active.farmer.avatar}
                alt=""
                className="h-10 w-10 rounded-full object-cover"
              />
              <div className="flex-1">
                <div className="font-semibold">{active.farmer.farm}</div>
                <div className="text-xs text-muted-foreground">
                  {active.farmer.city} · Producteur vérifié
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-3 bg-muted/20">
              {active.messages.length === 0 && (
                <p className="text-center text-xs text-muted-foreground pt-8">
                  Écrivez le premier message à {active.farmer.farm}.
                </p>
              )}
              {active.messages.map((m) => (
                <ChatBubble
                  key={m.id}
                  message={m}
                  mine={m.from === "restaurant"}
                  label={m.senderName ?? active.farmer.farm}
                />
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="p-3 border-t border-border flex gap-2"
            >
              <Button type="button" size="icon" variant="outline">
                <Paperclip className="h-4 w-4" />
              </Button>
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Écrire un message…"
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={!draft.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        ) : (
          <div className="grid place-items-center p-8">
            <EmptyState
              icon={MessageSquare}
              title="Aucune conversation sélectionnée"
              description="Choisissez une conversation pour commencer."
            />
          </div>
        )}
      </div>
      {myRestaurant && <DriverThreads restaurantId={myRestaurant.id} name={myRestaurant.name} />}
    </div>
  );
}

/** Messages échangés avec les livreurs de vos commandes (avant, seul l'admin
 * les voyait). */
function DriverThreads({ restaurantId, name }: { restaurantId: string; name: string }) {
  const threads = useDriverConversations().filter(
    (c) => c.restaurantId === restaurantId && c.messages.length > 0,
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  if (threads.length === 0) return null;
  const active = threads.find((t) => t.id === openId) ?? null;
  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <h3 className="font-semibold">Messages des livreurs</h3>
      <div className="flex flex-wrap gap-2">
        {threads.map((t) => (
          <Button
            key={t.id}
            variant={t.id === openId ? "default" : "outline"}
            size="sm"
            onClick={() => setOpenId(t.id)}
          >
            Livreur · {relativeTime(t.lastAt)}
          </Button>
        ))}
      </div>
      {active && (
        <div className="space-y-2">
          <div className="max-h-72 overflow-auto space-y-2">
            {active.messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-xl px-3 py-2 text-sm max-w-[85%] ${m.from === "me" ? "bg-muted" : "bg-primary text-primary-foreground ml-auto"}`}
              >
                <div className="text-[10px] opacity-70">
                  {m.from === "me" ? "Livreur" : (m.senderName ?? name)} · {relativeTime(m.at)}
                </div>
                {m.text}
              </div>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!reply.trim()) return;
              driverConversationActions.send(active.id, reply.trim(), "them", name);
              setReply("");
            }}
          >
            <Input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Répondre au livreur…"
            />
            <Button type="submit" size="icon" aria-label="Envoyer">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
