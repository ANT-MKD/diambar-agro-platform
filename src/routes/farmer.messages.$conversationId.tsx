import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ArrowLeft, Send, Paperclip, Phone, ShoppingBag, X, FileText } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { ChatBubble } from "@/components/common/chat-bubble";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { restaurants, type ChatAttachment } from "@/data/mocks";
import { useConversation, conversationActions } from "@/data/store";
import { relativeTime } from "@/lib/format";

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

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

// Un seul producteur peut se connecter dans cette démo (Mamadou Diallo, f1).
const MY_FARMER_ID = "f1";

function FarmerConversation() {
  const { conversationId } = Route.useParams();
  const found = useConversation(conversationId);
  const conv = found && found.farmerId === MY_FARMER_ID ? found : null;
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const pickFile = (file: File) => {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error("Fichier trop volumineux (5 Mo max)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({ name: file.name, dataUrl: reader.result as string, mime: file.type });
    };
    reader.readAsDataURL(file);
  };

  const send = () => {
    if (!draft.trim() && !attachment) return;
    conversationActions.send(conv.id, draft.trim(), "farmer", undefined, attachment ?? undefined);
    setDraft("");
    setAttachment(null);
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
              Dernier message {relativeTime(conv.lastAt)}
            </div>
          </div>
          {r?.phone && (
            <Button variant="outline" size="icon" asChild>
              <a href={`tel:${r.phone}`} aria-label={`Appeler ${r.name}`}>
                <Phone className="h-4 w-4" />
              </a>
            </Button>
          )}
          <Link to="/farmer/orders">
            <Button variant="outline" size="sm">
              Voir ses commandes
            </Button>
          </Link>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3 bg-muted/20">
          {conv.messages.map((m) => (
            <ChatBubble
              key={m.id}
              message={m}
              mine={m.from === "farmer"}
              label={m.senderName ?? r?.name}
            />
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="p-3 border-t border-border space-y-2"
        >
          {attachment && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 truncate">{attachment.name}</span>
              <button
                type="button"
                onClick={() => setAttachment(null)}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Retirer la pièce jointe"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,.pdf,.doc,.docx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) pickFile(file);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Écrire un message…"
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={!draft.trim() && !attachment}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
