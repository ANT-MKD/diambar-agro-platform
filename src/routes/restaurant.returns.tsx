import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatFCFA, relativeTime } from "@/lib/format";
import {
  useReturns, returnActions, RETURN_REASON_LABEL, RETURN_STATUS_LABEL,
  type ReturnReason,
} from "@/data/business";

export const Route = createFileRoute("/restaurant/returns")({
  head: () => ({ meta: [
    { title: "Retours & avoirs — Espace restaurant Diambar Agro" },
    { name: "description", content: "Déclarez un retour produit sur une commande livrée et suivez les avoirs obtenus auprès de vos producteurs." },
    { property: "og:title", content: "Retours & avoirs — Espace restaurant" },
    { property: "og:description", content: "Déclaration de retours produits et suivi des avoirs." },
    { name: "robots", content: "noindex" },
  ] }),
  component: RestaurantReturnsPage,
});

const REASONS = Object.keys(RETURN_REASON_LABEL) as ReturnReason[];

function RestaurantReturnsPage() {
  const returns = useReturns();
  const [form, setForm] = useState({ orderRef: "", productName: "", qty: "", unit: "kg", reason: "quality" as ReturnReason, description: "", requestedAmount: "" });

  const submit = () => {
    if (!form.orderRef.trim() || !form.productName.trim() || !form.description.trim()) {
      toast.error("Commande, produit et description sont obligatoires");
      return;
    }
    returnActions.create({
      orderRef: form.orderRef.trim(),
      restaurantName: "Le Baobab",
      productName: form.productName.trim(),
      qty: Number(form.qty) || 1,
      unit: form.unit,
      reason: form.reason,
      description: form.description.trim(),
      requestedAmount: Number(form.requestedAmount) || 0,
    });
    setForm({ orderRef: "", productName: "", qty: "", unit: "kg", reason: "quality", description: "", requestedAmount: "" });
    toast.success("Demande de retour envoyée au producteur");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Retours & avoirs" subtitle="Déclarez un problème sur une livraison et suivez vos avoirs" />

      <div className="glass rounded-2xl p-5 space-y-4">
        <h3 className="font-semibold">Nouvelle demande de retour</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Référence commande</label>
            <Input placeholder="CMD-3049" value={form.orderRef} onChange={(e) => setForm({ ...form, orderRef: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Produit concerné</label>
            <Input placeholder="Tomates fraîches" value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Quantité</label>
            <Input inputMode="numeric" placeholder="8" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Montant réclamé (FCFA)</label>
            <Input inputMode="numeric" placeholder="6800" value={form.requestedAmount} onChange={(e) => setForm({ ...form, requestedAmount: e.target.value })} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Motif</label>
            <div className="flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <button key={r} type="button" onClick={() => setForm({ ...form, reason: r })}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${form.reason === r ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-accent"}`}>
                  {RETURN_REASON_LABEL[r]}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <Textarea placeholder="Décrivez le problème constaté à la réception…" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        <Button className="gap-2" onClick={submit}><Send className="h-4 w-4" />Envoyer la demande</Button>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold">Mes demandes</h3>
        {returns.length === 0 ? (
          <EmptyState icon={RotateCcw} title="Aucun retour déclaré" description="Vos demandes de retour apparaîtront ici." />
        ) : returns.map((r) => (
          <div key={r.id} className="glass rounded-2xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{r.reference} · {r.productName}</div>
                <div className="text-xs text-muted-foreground">{r.orderRef} · {RETURN_REASON_LABEL[r.reason]} · {relativeTime(r.createdAt)}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold">{formatFCFA(r.requestedAmount)}</div>
                <div className="text-xs text-muted-foreground">{RETURN_STATUS_LABEL[r.status]}</div>
              </div>
            </div>
            <p className="mt-2 text-sm">{r.description}</p>
            {r.decisionNote && <p className="mt-1 text-xs text-muted-foreground">Réponse du producteur : {r.decisionNote}</p>}
            {r.creditNoteRef && <p className="mt-1 text-xs">Avoir reçu <span className="font-mono">{r.creditNoteRef}</span> — {formatFCFA(r.awardedAmount ?? 0)}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
