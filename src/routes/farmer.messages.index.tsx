import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Send, Search, MessageSquare, Paperclip } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { ChatBubble } from "@/components/common/chat-bubble";
import { restaurants } from "@/data/mocks";
import { useConversations, conversationActions } from "@/data/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/format";

export const Route = createFileRoute("/farmer/messages/")({
  head: () => ({ meta: [{ title: "Messages · Diambar Agro" }] }),
  component: MessagesPage,
});

function MessagesPage() {
  const convs = useConversations();
  const [activeId, setActiveId] = useState<string | null>(convs[0]?.id ?? null);
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");

  const active = convs.find((c) => c.id === activeId) || null;
  const filtered = convs.filter((c) => {
    const r = restaurants.find((x) => x.id === c.restaurantId);
    return (
      r?.name.toLowerCase().includes(q.toLowerCase()) ||
      c.lastMessage.toLowerCase().includes(q.toLowerCase())
    );
  });

  const send = () => {
    if (!active || !draft.trim()) return;
    conversationActions.send(active.id, draft.trim(), "me");
    setDraft("");
  };

  const openConv = (id: string) => {
    setActiveId(id);
    conversationActions.markRead(id);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Messages" subtitle="Discutez avec vos restaurants clients" />
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
            {filtered.map((c) => {
              const r = restaurants.find((x) => x.id === c.restaurantId);
              const isActive = c.id === activeId;
              return (
                <button
                  key={c.id}
                  onClick={() => openConv(c.id)}
                  className={`w-full p-3 flex items-center gap-3 border-b border-border text-left hover:bg-accent transition ${isActive ? "bg-accent" : ""}`}
                >
                  <img src={r?.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{r?.name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {relativeTime(c.lastAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground truncate">
                        {c.lastMessage}
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
          (() => {
            const r = restaurants.find((x) => x.id === active.restaurantId);
            return (
              <div className="flex flex-col">
                <div className="p-4 border-b border-border flex items-center gap-3">
                  <img src={r?.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                  <div className="flex-1">
                    <div className="font-semibold">{r?.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r?.city} · {r?.type}
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-4 space-y-3 bg-muted/20">
                  {active.messages.map((m) => (
                    <ChatBubble key={m.id} message={m} />
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
            );
          })()
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
    </div>
  );
}
