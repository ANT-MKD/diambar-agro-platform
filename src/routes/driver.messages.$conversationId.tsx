import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Send, Paperclip, Phone, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { restaurants } from "@/data/mocks";
import { useDriverConversation, driverConversationActions } from "@/data/store";

export const Route = createFileRoute("/driver/messages/$conversationId")({
  head: () => ({
    meta: [
      { title: "Conversation · Messages livreur · Diambar Agro" },
      { name: "description", content: "Échangez avec le restaurant pendant la livraison." },
      { property: "og:title", content: "Conversation · Messages livreur" },
      { property: "og:description", content: "Chat livreur ↔ restaurant sur Diambar Agro." },
    ],
  }),
  component: DriverConversation,
});

function DriverConversation() {
  const { conversationId } = Route.useParams();
  const conv = useDriverConversation(conversationId);
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");

  if (!conv) {
    return (
      <div className="space-y-6">
        <PageHeader title="Conversation" subtitle="Introuvable" />
        <EmptyState
          icon={MessageSquare}
          title="Conversation introuvable"
          description="Cette conversation n'existe plus."
          action={<Button onClick={() => navigate({ to: "/driver/messages" })}>Retour aux messages</Button>}
        />
      </div>
    );
  }

  const r = restaurants.find((x) => x.id === conv.restaurantId);
  const send = () => {
    if (!draft.trim()) return;
    driverConversationActions.send(conv.id, draft.trim(), "me");
    setDraft("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/driver/messages" className="grid h-9 w-9 place-items-center rounded-xl border border-border hover:bg-accent">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <PageHeader title={r?.name ?? "Conversation"} subtitle={`${r?.city ?? ""} · client livraison`} />
      </div>

      <div className="glass rounded-2xl overflow-hidden flex flex-col h-[640px]">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <img src={r?.avatar} alt={`Logo ${r?.name ?? "restaurant"}`} className="h-10 w-10 rounded-full object-cover" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{r?.name}</div>
            <div className="text-xs text-muted-foreground">En ligne · répond en général en 5 min</div>
          </div>
          <Button variant="outline" size="icon"><Phone className="h-4 w-4" /></Button>
          <Link to="/driver/missions"><Button variant="outline" size="sm">Mes missions</Button></Link>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3 bg-muted/20">
          {conv.messages.map((m) => (
            <div key={m.id} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${m.from === "me" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-border rounded-bl-sm"}`}>
                <div>{m.text}</div>
                <div className={`text-[10px] mt-1 ${m.from === "me" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {new Date(m.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </div>
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
    </div>
  );
}
