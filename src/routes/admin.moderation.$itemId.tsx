import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Flag, Ban, Check, MessageSquareWarning, UserX } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { AdminBadge } from "@/components/admin/admin-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatFCFA, relativeTime } from "@/lib/format";
import { useModerationItem, moderationActions } from "@/data/admin-store";
import { useProducts } from "@/data/store";
import { farmers } from "@/data/mocks";

export const Route = createFileRoute("/admin/moderation/$itemId")({
  head: () => ({
    meta: [
      { title: "Produit signalé — Administration Diambar Agro" },
      {
        name: "description",
        content: "Détail d'un produit signalé : signalements, historique et décision.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ModerationDetail,
});

function ModerationDetail() {
  const { itemId } = Route.useParams();
  const m = useModerationItem(itemId);
  const products = useProducts();
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeNote, setChangeNote] = useState("");
  const [suspendOpen, setSuspendOpen] = useState(false);

  if (!m) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <h2 className="font-semibold">Produit introuvable</h2>
        <Link to="/admin/moderation" className="mt-4 inline-block text-sm text-primary">
          Retour
        </Link>
      </div>
    );
  }

  const product = products.find((p) => p.id === m.productId);
  const farmer =
    farmers.find((f) => f.id === product?.farmerId) ?? farmers.find((f) => f.name === m.farmer);
  const closed = m.status !== "pending";

  const events = [...m.events].sort((a, b) => (a.at < b.at ? 1 : -1));

  const submitChange = () => {
    if (!changeNote.trim()) {
      toast.error("Décrivez la modification attendue");
      return;
    }
    moderationActions.requestChange(m.id, changeNote.trim());
    toast.success("Modification demandée au producteur");
    setChangeOpen(false);
    setChangeNote("");
  };

  return (
    <div className="space-y-6">
      <Link
        to="/admin/moderation"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Modération
      </Link>

      <PageHeader
        title={m.name.toUpperCase()}
        subtitle={`Signalé ${relativeTime(m.reports[m.reports.length - 1]?.at ?? m.events[0]?.at ?? new Date().toISOString())}`}
        actions={<AdminBadge value={m.status} />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="glass rounded-2xl overflow-hidden grid sm:grid-cols-2">
            <img src={m.image} alt={m.name} className="h-full min-h-48 w-full object-cover" />
            <div className="p-5 space-y-2 text-sm">
              <h2 className="font-semibold mb-1">Informations</h2>
              <Row label="Producteur" value={farmer?.farm ?? m.farmer} />
              <Row label="Prix" value={`${formatFCFA(m.price)}/kg`} />
              {product && (
                <>
                  <Row label="Stock" value={`${product.stock} ${product.unit}`} />
                  <Row label="Catégorie" value={product.category} />
                </>
              )}
            </div>
          </div>

          <div className="glass rounded-2xl p-5 space-y-3">
            <h2 className="font-semibold flex items-center gap-2">
              <Flag className="h-4 w-4 text-amber-500" />
              Motif du signalement ({m.reports.length})
            </h2>
            {m.reports.map((r, i) => (
              <div key={i} className="rounded-xl border border-border p-3 space-y-1">
                <div className="text-sm font-medium">{r.reason}</div>
                <div className="text-xs text-muted-foreground">
                  Signalé par {r.by} · {relativeTime(r.at)}
                </div>
              </div>
            ))}
          </div>

          <div className="glass rounded-2xl p-5">
            <h2 className="font-semibold mb-3">Historique</h2>
            <ul className="space-y-2">
              {events.map((e, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-[11px] text-muted-foreground shrink-0 w-24">
                    {new Date(e.at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                  </span>
                  <span className="flex-1">
                    {e.label} <span className="text-muted-foreground">— {e.actor}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="glass rounded-2xl p-5 space-y-2 h-fit">
          <h2 className="font-semibold mb-1">Décision</h2>
          <Button
            disabled={closed}
            className="w-full justify-start gap-2"
            onClick={() => {
              moderationActions.approve(m.id);
              toast.success("Produit conservé");
            }}
          >
            <Check className="h-4 w-4" />
            Conserver le produit
          </Button>
          <Button
            disabled={closed}
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => setChangeOpen(true)}
          >
            <MessageSquareWarning className="h-4 w-4" />
            Demander une modification
          </Button>
          <Button
            disabled={closed}
            variant="outline"
            className="w-full justify-start gap-2 text-destructive"
            onClick={() => {
              moderationActions.unpublish(m.id);
              toast.success("Produit dépublié");
            }}
          >
            <Ban className="h-4 w-4" />
            Dépublier le produit
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-2 text-destructive"
            onClick={() => setSuspendOpen(true)}
          >
            <UserX className="h-4 w-4" />
            Suspendre le producteur
          </Button>
          {closed && (
            <p className="text-[11px] text-muted-foreground pt-1">
              Décision déjà prise sur ce produit — action enregistrée dans le journal d'audit.
            </p>
          )}
        </div>
      </div>

      <Dialog open={changeOpen} onOpenChange={setChangeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demander une modification</DialogTitle>
            <DialogDescription>
              Le producteur reçoit une notification avec votre commentaire.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            rows={4}
            placeholder="Ex : remplacez la photo par un visuel représentatif du produit…"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeOpen(false)}>
              Annuler
            </Button>
            <Button onClick={submitChange}>Envoyer la demande</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspendre {farmer?.farm ?? m.farmer} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le compte du producteur sera suspendu — pas seulement ce produit. Il ne pourra plus
              vendre sur la plateforme jusqu'à réactivation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                moderationActions.suspendFarmer(m.id);
                toast.success("Producteur suspendu");
                setSuspendOpen(false);
              }}
            >
              Suspendre le producteur
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
