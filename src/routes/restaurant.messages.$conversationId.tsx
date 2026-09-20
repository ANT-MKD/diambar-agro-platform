import { createFileRoute, Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Send, Paperclip, Phone, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { ChatBubble } from "@/components/common/chat-bubble";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { farmers, restaurants } from "@/data/mocks";
import { useConversations, useSuppliers, conversationActions } from "@/data/store";
import { relativeTime } from "@/lib/format";

export const Route = createFileRoute("/restaurant/messages/$conversationId")({
  head: () => ({
    meta: [
      { title: "Conversation · Messages restaurant · Diambar Agro" },
      { name: "description", content: "Discutez en direct avec vos producteurs partenaires." },
      { property: "og:title", content: "Conversation · Messages restaurant" },
      {
        property: "og:description",
        content: "Discutez en direct avec vos producteurs partenaires.",
      },
    ],
  }),
  component: RestaurantConversation,
});

function RestaurantConversation() {
  const { conversationId } = Route.useParams();
  const { user } = useRouteContext({ from: "/restaurant" });
  const myRestaurant = restaurants.find((r) => r.name === user.name);
  const convs = useConversations();
  const suppliers = useSuppliers();
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");

  const conv =
    convs.find((c) => c.id === conversationId && c.restaurantId === myRestaurant?.id) ?? null;
  const farmer = conv ? farmers.find((f) => f.id === conv.farmerId) : null;
  const supplier = farmer
    ? suppliers.find((s) => s.restaurantId === myRestaurant?.id && s.farmerId === farmer.id)
    : null;

  if (!conv || !farmer) {
    return (
      <div className="space-y-6">
        <PageHeader title="Conversation" subtitle="Introuvable" />
        <EmptyState
          icon={MessageSquare}
          title="Conversation introuvable"
          description="Cette conversation n'existe plus."
          action={
            <Button onClick={() => navigate({ to: "/restaurant/messages" })}>
              Retour aux messages
            </Button>
          }
        />
      </div>
    );
  }

  const send = () => {
    if (!draft.trim()) return;
    conversationActions.send(conv.id, draft.trim(), "restaurant");
    setDraft("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/restaurant/messages"
          className="grid h-9 w-9 place-items-center rounded-xl border border-border hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <PageHeader title={farmer.farm} subtitle={`${farmer.city} · Producteur vérifié`} />
      </div>

      <div className="glass rounded-2xl overflow-hidden flex flex-col h-[640px]">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <img
            src={farmer.avatar}
            alt={`Photo du producteur ${farmer.farm}`}
            className="h-10 w-10 rounded-full object-cover"
          />
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{farmer.farm}</div>
            <div className="text-xs text-muted-foreground">
              Dernier message {relativeTime(conv.lastAt)}
            </div>
          </div>
          {farmer.phone && (
            <Button variant="outline" size="icon" asChild>
              <a href={`tel:${farmer.phone}`}>
                <Phone className="h-4 w-4" />
              </a>
            </Button>
          )}
          {supplier && (
            <Link to="/restaurant/suppliers/$supplierId" params={{ supplierId: supplier.id }}>
              <Button variant="outline" size="sm">
                Voir ses produits
              </Button>
            </Link>
          )}
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3 bg-muted/20">
          {conv.messages.length === 0 && (
            <p className="text-center text-xs text-muted-foreground pt-8">
              Écrivez le premier message à {farmer.farm}.
            </p>
          )}
          {conv.messages.map((m) => (
            <ChatBubble
              key={m.id}
              message={m}
              mine={m.from === "restaurant"}
              label={m.senderName ?? farmer.farm}
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
    </div>
  );
}
