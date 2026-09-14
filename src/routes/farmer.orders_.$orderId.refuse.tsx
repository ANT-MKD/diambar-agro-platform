import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, AlertOctagon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { useOrder, orderActions } from "@/data/store";
import { restaurants } from "@/data/mocks";
import { formatFCFA } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/farmer/orders_/$orderId/refuse")({
  head: () => ({ meta: [{ title: "Refuser la commande · Diambar Agro" }] }),
  component: RefusePage,
});

const REASONS = [
  "Produit en rupture de stock",
  "Délai impossible à tenir",
  "Adresse de livraison hors zone",
  "Quantité demandée trop importante",
  "Restaurant non vérifié",
  "Autre",
];

function RefusePage() {
  const { orderId } = Route.useParams();
  const order = useOrder(orderId);
  const navigate = useNavigate();
  const [reason, setReason] = useState(REASONS[0]);
  const [comment, setComment] = useState("");

  if (!order)
    return <p className="text-center text-muted-foreground py-12">Commande introuvable</p>;
  const r = restaurants.find((x) => x.id === order.restaurantId);

  const submit = () => {
    const note = comment.trim() ? `${reason} : ${comment.trim()}` : reason;
    orderActions.setStatus(order.id, "cancelled", note);
    toast.success(`${order.reference} refusée · motif : ${reason}`);
    navigate({ to: "/farmer/orders" });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Refuser la commande"
        subtitle={`${order.reference} · ${formatFCFA(order.total)}`}
        actions={
          <Button
            variant="outline"
            onClick={() => navigate({ to: "/farmer/orders/$orderId", params: { orderId } })}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
        }
      />

      <div className="glass rounded-2xl p-6 space-y-5">
        <div className="flex items-start gap-3 rounded-xl bg-rose-500/10 border border-rose-500/30 p-4">
          <AlertOctagon className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold text-rose-500">Action irréversible</div>
            <div className="text-muted-foreground mt-0.5">
              Le restaurant <b>{r?.name}</b> sera notifié immédiatement.
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Motif du refus</Label>
          <div className="grid sm:grid-cols-2 gap-2">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`text-left rounded-xl border p-3 text-sm transition ${reason === r ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Commentaire (visible par le restaurant)</Label>
          <Textarea
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Expliquez le contexte au restaurant…"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => navigate({ to: "/farmer/orders/$orderId", params: { orderId } })}
          >
            Annuler
          </Button>
          <Button
            onClick={submit}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            Refuser la commande
          </Button>
        </div>
      </div>
    </div>
  );
}
