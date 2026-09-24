import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Check, MessageSquare, Paperclip, ReceiptText, Send, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { FileDrop } from "@/components/disputes/file-drop";
import {
  useReturn,
  returnActions,
  RETURN_REASON_LABEL,
  RETURN_STATUS_LABEL,
} from "@/data/business";
import { useFarmerProfile } from "@/data/store";
import { formatFCFA, relativeTime } from "@/lib/format";
import type { DisputeAttachment } from "@/data/disputes";

export const Route = createFileRoute("/farmer/returns/$returnId")({
  head: () => ({ meta: [{ title: "Retour · Espace producteur Diambar Agro" }] }),
  component: FarmerReturnDetail,
});

const STATUS_CLASS: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  accepted: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  credited: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  refused: "bg-destructive/10 text-destructive",
};

function FarmerReturnDetail() {
  const { returnId } = Route.useParams();
  const r = useReturn(returnId);
  const profile = useFarmerProfile();
  const myName = `${profile.firstName} ${profile.lastName}`;
  const [tab, setTab] = useState("details");
  const [draft, setDraft] = useState("");
  const [newPhotos, setNewPhotos] = useState<DisputeAttachment[]>([]);
  const [amount, setAmount] = useState(() => (r ? String(r.requestedAmount) : ""));
  const [note, setNote] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);

  if (!r) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <h2 className="font-semibold">Retour introuvable</h2>
        <Link to="/farmer/returns" className="mt-4 inline-block text-sm text-primary">
          Retour à la liste
        </Link>
      </div>
    );
  }

  const send = () => {
    if (!draft.trim()) return;
    returnActions.reply(r.id, { role: "farmer", name: myName, text: draft.trim() });
    setDraft("");
    toast.success("Message envoyé au restaurant");
  };

  const attachDocs = (files: DisputeAttachment[]) => {
    const added = files.slice(newPhotos.length);
    setNewPhotos(files);
    if (added.length > 0) {
      returnActions.addPhotos(r.id, added);
      toast.success(`${added.length} document(s) ajouté(s)`);
    }
  };

  const accept = () => {
    const parsed = Number(amount.replace(",", "."));
    if (amount.trim() === "" || !Number.isFinite(parsed)) {
      setAmountError("Montant invalide");
      return;
    }
    if (parsed < 0) {
      setAmountError("Le montant ne peut pas être négatif");
      return;
    }
    if (parsed > r.requestedAmount) {
      setAmountError(
        `Le montant ne peut pas dépasser le montant réclamé (${formatFCFA(r.requestedAmount)})`,
      );
      return;
    }
    setAmountError(null);
    returnActions.accept(r.id, parsed, note.trim() || undefined);
    toast.success("Retour accepté", {
      description: `Demande de remboursement de ${formatFCFA(parsed)} envoyée à la plateforme.`,
    });
  };

  const refuse = () => {
    if (!note.trim()) {
      toast.error("Indiquez un motif de refus avant de confirmer");
      return;
    }
    returnActions.refuse(r.id, note.trim());
    toast.success("Retour refusé");
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            Retour {r.reference}
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_CLASS[r.status]}`}
            >
              {RETURN_STATUS_LABEL[r.status]}
            </span>
          </span>
        }
        subtitle={`${r.orderRef} · ${r.productName}`}
        actions={
          <Button asChild variant="outline" className="gap-2">
            <Link to="/farmer/returns">
              <ArrowLeft className="h-4 w-4" />
              Retour à la liste
            </Link>
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="details">Détails</TabsTrigger>
          <TabsTrigger value="suivi">Suivi</TabsTrigger>
          <TabsTrigger value="messages">
            Échanges{r.messages.length > 0 ? ` (${r.messages.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="documents">
            Documents{r.photos?.length ? ` (${r.photos.length})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="pt-4">
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 glass rounded-2xl p-5 space-y-3">
              <h3 className="font-semibold">Informations générales</h3>
              <div className="grid sm:grid-cols-2 gap-y-2 text-sm">
                <div className="text-muted-foreground">Client</div>
                <div className="font-medium">{r.restaurantName}</div>
                <div className="text-muted-foreground">Commande associée</div>
                <div className="font-medium">{r.orderRef}</div>
                <div className="text-muted-foreground">Produit concerné</div>
                <div className="font-medium">
                  {r.productName} ({r.qty} {r.unit})
                </div>
                <div className="text-muted-foreground">Motif</div>
                <div className="font-medium">{RETURN_REASON_LABEL[r.reason]}</div>
                <div className="text-muted-foreground">Montant réclamé</div>
                <div className="font-medium">{formatFCFA(r.requestedAmount)}</div>
                {r.awardedAmount !== undefined && (
                  <>
                    <div className="text-muted-foreground">Montant accordé</div>
                    <div className="font-medium text-emerald-600 dark:text-emerald-400">
                      {formatFCFA(r.awardedAmount)}
                    </div>
                  </>
                )}
                <div className="text-muted-foreground">Date de déclaration</div>
                <div className="font-medium">
                  {new Date(r.createdAt).toLocaleString("fr-FR", {
                    dateStyle: "long",
                    timeStyle: "short",
                  })}
                </div>
              </div>
              <p className="pt-2 border-t border-border text-sm">{r.description}</p>
              {r.decisionNote && (
                <p className="text-xs text-muted-foreground">Votre décision : {r.decisionNote}</p>
              )}
              {r.creditNoteRef && (
                <p className="text-xs">
                  Avoir émis : <span className="font-mono">{r.creditNoteRef}</span>
                </p>
              )}
            </div>

            <div className="glass rounded-2xl p-5 space-y-3">
              <h3 className="font-semibold mb-1">Actions possibles</h3>

              {r.status === "pending" && (
                <div className="space-y-2">
                  <Input
                    inputMode="decimal"
                    placeholder="Montant accordé (FCFA)"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setAmountError(null);
                    }}
                  />
                  {amountError && <p className="text-xs text-destructive">{amountError}</p>}
                  <Textarea
                    placeholder="Note de décision (obligatoire en cas de refus)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" className="gap-2" onClick={accept}>
                      <Check className="h-4 w-4" />
                      Accepter
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button size="sm" variant="destructive" className="gap-2">
                          <X className="h-4 w-4" />
                          Refuser
                        </Button>
                      }
                      title="Refuser ce retour ?"
                      description={`${r.restaurantName} sera informé du refus et du motif indiqué. Cette décision est définitive.`}
                      destructive
                      confirmLabel="Refuser"
                      onConfirm={refuse}
                    />
                  </div>
                </div>
              )}

              {r.status === "accepted" && (
                <Button
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => {
                    const result = returnActions.issueCredit(r.id);
                    if (!result.ok) toast.error(result.message);
                    else toast.success("Avoir émis · il remplace le remboursement");
                  }}
                >
                  <ReceiptText className="h-4 w-4" />
                  Émettre l'avoir
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 justify-start"
                onClick={() => setTab("messages")}
              >
                <MessageSquare className="h-4 w-4" />
                Écrire au restaurant
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 justify-start"
                onClick={() => setTab("documents")}
              >
                <Paperclip className="h-4 w-4" />
                Voir les documents
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="suivi" className="pt-4">
          <div className="glass rounded-2xl p-5">
            <h3 className="font-semibold mb-3">Timeline du dossier</h3>
            <ul className="space-y-3 border-l-2 border-border pl-4">
              {r.history.map((h, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                  <div className="text-sm font-medium">{h.text}</div>
                  <div className="text-xs text-muted-foreground">
                    {h.actor} · {relativeTime(h.at)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="messages" className="pt-4">
          <div className="glass rounded-2xl overflow-hidden flex flex-col h-[420px]">
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {r.messages.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title="Aucun échange"
                  description="Envoyez un message au restaurant au sujet de ce retour."
                />
              ) : (
                r.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[80%] rounded-xl p-3 text-sm ${m.authorRole === "farmer" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"}`}
                  >
                    <div className="text-[11px] opacity-70 mb-0.5">
                      {m.authorName} · {relativeTime(m.at)}
                    </div>
                    {m.text}
                  </div>
                ))
              )}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="p-3 border-t border-border flex gap-2"
            >
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Écrire un message au restaurant…"
                className="flex-1 min-h-0 h-10"
              />
              <Button type="submit" size="icon" disabled={!draft.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </TabsContent>

        <TabsContent value="documents" className="pt-4 space-y-4">
          <FileDrop
            value={newPhotos}
            onChange={attachDocs}
            by={myName}
            kind="photo"
            label="Ajouter des documents ou photos"
          />
          {r.photos && r.photos.length > 0 && (
            <div className="glass rounded-2xl p-5">
              <h3 className="font-semibold mb-3">Documents joints ({r.photos.length})</h3>
              <div className="grid sm:grid-cols-3 gap-3">
                {r.photos.map((p) =>
                  p.dataUrl ? (
                    <a
                      key={p.id}
                      href={p.dataUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-xl overflow-hidden border border-border aspect-square"
                    >
                      <img src={p.dataUrl} alt={p.name} className="h-full w-full object-cover" />
                    </a>
                  ) : null,
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
