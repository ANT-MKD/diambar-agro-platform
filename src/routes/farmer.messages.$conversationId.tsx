import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Send, Paperclip, Phone, ShoppingBag } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { ChatBubble } from "@/components/common/chat-bubble";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { restaurants } from "@/data/mocks";
import { useConversation, conversationActions } from "@/data/store";

export const Route = createFileRoute("/farmer/messages/$conversationId")({
  head: () => ({
    meta: [
      { title: "Conversation · Messages agriculteur · Diambar Agro" },
      {
        name: "description",
        content: "Échangez en direct avec un restaurant client sur Diambar Agro.",
      },
      { property: "og:title", content: "Conversation · Messages agriculteur" },
      { property: "og:description", content: "Échangez en direct avec vos restaurants clients." },
    ],
  }),
  component: FarmerConversation,
});

function FarmerConversation() {
  const { conversationId } = Route.useParams();
  const conv = useConversation(conversationId);
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");

  if (!conv) {
    return (
      <div className="space-y-6">
        <PageHeader title="Conversation" subtitle="Introuvable" />
        <EmptyState
          icon={ShoppingBag}
          title="Conversation introuvable"
          description="Cette conversation n'existe plus."
          action={
            <Button onClick={() => navigate({ to: "/farmer/messages" })}>
              Retour aux messages
            </Button>
          }
        />
      </div>
    );
  }

  const r = restaurants.find((x) => x.id === conv.restaurantId);
  const send = () => {
    if (!draft.trim()) return;
    conversationActions.send(conv.id, draft.trim(), "me");
    setDraft("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/farmer/messages"
          className="grid h-9 w-9 place-items-center rounded-xl border border-border hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <PageHeader
          title={r?.name ?? "Conversation"}
          subtitle={`${r?.city ?? ""} · ${r?.type ?? "Restaurant"}`}
        />
      </div>

      <div className="glass rounded-2xl overflow-hidden flex flex-col h-[640px]">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <img
            src={r?.avatar}
            alt={`Logo ${r?.name ?? "restaurant"}`}
            className="h-10 w-10 rounded-full object-cover"
          />
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{r?.name}</div>
            <div className="text-xs text-muted-foreground">
              En ligne · répond en général en 10 min
            </div>
          </div>
          <Button variant="outline" size="icon">
            <Phone className="h-4 w-4" />
          </Button>
          <Link to="/farmer/orders">
            <Button variant="outline" size="sm">
              Voir ses commandes
            </Button>
          </Link>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3 bg-muted/20">
          {conv.messages.map((m) => (
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
    </div>
  );
}
