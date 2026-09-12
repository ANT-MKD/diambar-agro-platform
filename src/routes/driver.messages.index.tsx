import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search, MessageSquare, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { restaurants } from "@/data/mocks";
import { useDriverConversations } from "@/data/store";
import { Input } from "@/components/ui/input";
import { relativeTime } from "@/lib/format";

export const Route = createFileRoute("/driver/messages/")({
  head: () => ({
    meta: [
      { title: "Messages · Livreur Diambar Agro" },
      {
        name: "description",
        content: "Toutes vos conversations avec les restaurants et producteurs.",
      },
      { property: "og:title", content: "Messages · Livreur Diambar Agro" },
      { property: "og:description", content: "Conversations livreur sur Diambar Agro." },
    ],
  }),
  component: DriverMessagesList,
});

function DriverMessagesList() {
  const convs = useDriverConversations();
  const [q, setQ] = useState("");
  const enriched = convs.map((c) => ({
    ...c,
    resto: restaurants.find((r) => r.id === c.restaurantId) ?? restaurants[0],
  }));
  const filtered = enriched.filter(
    (c) =>
      c.resto.name.toLowerCase().includes(q.toLowerCase()) ||
      c.lastMessage.toLowerCase().includes(q.toLowerCase()),
  );
  const unread = convs.reduce((s, c) => s + c.unread, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        subtitle={`${convs.length} conversation(s) · ${unread} non lue(s)`}
      />

      <div className="glass rounded-2xl p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un restaurant, un message…"
            className="pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Aucune conversation"
          description="Vos échanges avec les restaurants apparaîtront ici."
        />
      ) : (
        <div className="glass rounded-2xl divide-y divide-border overflow-hidden">
          {filtered.map((c) => (
            <Link
              key={c.id}
              to="/driver/messages/$conversationId"
              params={{ conversationId: c.id }}
              className="flex items-center gap-3 p-4 hover:bg-accent/40 transition"
            >
              <img src={c.resto.avatar} alt="" className="h-11 w-11 rounded-full object-cover" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate">{c.resto.name}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {relativeTime(c.lastAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground truncate">{c.lastMessage}</span>
                  {c.unread > 0 && (
                    <span className="grid h-5 min-w-5 px-1 place-items-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                      {c.unread}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
