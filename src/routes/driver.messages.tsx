import { createFileRoute } from "@tanstack/react-router";
import { Send, Search, MessageSquare, Paperclip, Phone } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { restaurants } from "@/data/mocks";
import { useDriverConversations, driverConversationActions } from "@/data/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/format";

export const Route = createFileRoute("/driver/messages")({
  head: () => ({ meta: [{ title: "Messages · Livreur" }] }),
  component: DriverMessages,
});

function DriverMessages() {
  const convs = useDriverConversations();
  const enriched = convs.map((c) => ({ ...c, resto: restaurants.find((r) => r.id === c.restaurantId) ?? restaurants[0] }));
  const [activeId, setActiveId] = useState<string | null>(enriched[0]?.id ?? null);
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");

  const active = enriched.find((c) => c.id === activeId) ?? null;
  const filtered = enriched.filter((c) => c.resto.name.toLowerCase().includes(q.toLowerCase()) || c.lastMessage.toLowerCase().includes(q.toLowerCase()));

  const open = (id: string) => { setActiveId(id); driverConversationActions.markRead(id); };
  const send = () => {
    if (!active || !draft.trim()) return;
    driverConversationActions.send(active.id, draft.trim(), "me");
    setDraft("");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Messages" subtitle="Discutez avec vos restaurants clients" />
      <div className="glass rounded-2xl overflow-hidden grid lg:grid-cols-[320px_1fr] h-[640px]">
        <div className="border-r border-border flex flex-col">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" className="pl-9" />
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {filtered.map((c) => {
              const isActive = c.id === activeId;
              return (
                <button key={c.id} onClick={() => open(c.id)} className={`w-full p-3 flex items-center gap-3 border-b border-border text-left hover:bg-accent transition ${isActive ? "bg-accent" : ""}`}>
                  <img src={c.resto.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{c.resto.name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{relativeTime(c.lastAt)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground truncate">{c.lastMessage}</span>
                      {c.unread > 0 && <span className="grid h-5 min-w-5 px-1 place-items-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">{c.unread}</span>}
                    </div>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && <div className="p-6 text-center text-xs text-muted-foreground">Aucune conversation</div>}
          </div>
        </div>

        {active ? (
          <div className="flex flex-col">
            <div className="p-4 border-b border-border flex items-center gap-3">
              <img src={active.resto.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
              <div className="flex-1">
                <div className="font-semibold">{active.resto.name}</div>
                <div className="text-xs text-muted-foreground">{active.resto.city} · Restaurant client</div>
              </div>
              <Button size="icon" variant="outline"><Phone className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-3 bg-muted/20">
              {active.messages.map((m) => (
                <div key={m.id} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${m.from === "me" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-border rounded-bl-sm"}`}>
                    <div>{m.text}</div>
                    <div className={`text-[10px] mt-1 ${m.from === "me" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{new Date(m.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); send(); }} className="p-3 border-t border-border flex gap-2">
              <Button type="button" size="icon" variant="outline"><Paperclip className="h-4 w-4" /></Button>
              <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Écrire un message…" className="flex-1" />
              <Button type="submit" size="icon" disabled={!draft.trim()}><Send className="h-4 w-4" /></Button>
            </form>
          </div>
        ) : (
          <div className="grid place-items-center p-8"><EmptyState icon={MessageSquare} title="Aucune conversation sélectionnée" description="Choisissez une conversation pour commencer." /></div>
        )}
      </div>
    </div>
  );
}