import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Star, Send, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { relativeTime } from "@/lib/format";
import { useRestaurantOrders, useSuppliers } from "@/data/store";
import { useReviews, useSupplierScores, reviewActions, reviewScore } from "@/data/business";

export const Route = createFileRoute("/restaurant/reviews")({
  head: () => ({ meta: [
    { title: "Notations fournisseurs — Espace restaurant Diambar Agro" },
    { name: "description", content: "Notez vos livraisons (qualité, ponctualité, emballage) et consultez le scoring de vos producteurs partenaires." },
    { property: "og:title", content: "Notations fournisseurs — Espace restaurant" },
    { property: "og:description", content: "Notez vos livraisons et suivez le scoring de vos producteurs." },
    { name: "robots", content: "noindex" },
  ] }),
  component: ReviewsPage,
});

function Stars({ value, onChange, size = 4 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onChange} onClick={() => onChange?.(n)} className={onChange ? "transition hover:scale-110" : "cursor-default"}>
          <Star className={`h-${size} w-${size} ${n <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`} />
        </button>
      ))}
    </div>
  );
}

function RatingForm({ orderRef, supplierId, supplierName }: { orderRef: string; supplierId: string; supplierName: string }) {
  const [quality, setQuality] = useState(5);
  const [delivery, setDelivery] = useState(5);
  const [packaging, setPackaging] = useState(5);
  const [comment, setComment] = useState("");
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-border p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="space-y-1"><div className="text-xs text-muted-foreground">Qualité produits</div><Stars value={quality} onChange={setQuality} /></div>
        <div className="space-y-1"><div className="text-xs text-muted-foreground">Ponctualité</div><Stars value={delivery} onChange={setDelivery} /></div>
        <div className="space-y-1"><div className="text-xs text-muted-foreground">Emballage</div><Stars value={packaging} onChange={setPackaging} /></div>
      </div>
      <Textarea placeholder="Votre commentaire (facultatif)" value={comment} onChange={(e) => setComment(e.target.value)} />
      <Button size="sm" className="gap-2" onClick={() => {
        reviewActions.create({ orderRef, supplierId, supplierName, quality, delivery, packaging, comment: comment.trim() });
        toast.success("Merci pour votre note", { description: `${supplierName} · ${((quality + delivery + packaging) / 3).toFixed(1)}/5` });
      }}><Send className="h-4 w-4" />Publier ma note</Button>
    </div>
  );
}

function ReviewsPage() {
  const orders = useRestaurantOrders();
  const suppliers = useSuppliers();
  const reviews = useReviews();
  const scores = useSupplierScores();

  const rated = new Set(reviews.map((r) => r.orderRef));
  const toRate = orders.filter((o) => o.status === "delivered" && !rated.has(o.reference));
  const supplierName = (id: string) => suppliers.find((s) => s.id === id || s.farmerId === id)?.name ?? "Producteur";

  return (
    <div className="space-y-6">
      <PageHeader title="Notations & avis" subtitle="Évaluez vos livraisons et suivez le scoring de vos producteurs" />

      <div className="glass rounded-2xl p-5">
        <h3 className="font-semibold">Scoring fournisseurs</h3>
        {scores.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Aucune note pour le moment.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {scores.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div>
                  <div className="text-sm font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.count} avis</div>
                </div>
                <div className="flex items-center gap-2">
                  <Stars value={s.avg} />
                  <span className="text-sm font-bold">{s.avg.toFixed(1)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold">Livraisons à noter</h3>
        {toRate.length === 0 ? (
          <EmptyState icon={Star} title="Tout est noté" description="Vous avez évalué toutes vos livraisons reçues." />
        ) : toRate.map((o) => (
          <div key={o.id} className="glass rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold">{o.reference}</div>
                <div className="text-xs text-muted-foreground">{supplierName(o.farmerId)} · livrée {relativeTime(o.createdAt)}</div>
              </div>
            </div>
            <RatingForm orderRef={o.reference} supplierId={o.farmerId} supplierName={supplierName(o.farmerId)} />
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold">Mes avis publiés</h3>
        {reviews.length === 0 ? (
          <EmptyState icon={MessageSquare} title="Aucun avis" description="Vos évaluations apparaîtront ici." />
        ) : reviews.map((r) => (
          <div key={r.id} className="glass rounded-2xl p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold">{r.supplierName}</div>
                <div className="text-xs text-muted-foreground">{r.orderRef} · {relativeTime(r.createdAt)}</div>
              </div>
              <div className="flex items-center gap-2"><Stars value={reviewScore(r)} /><span className="text-sm font-bold">{reviewScore(r).toFixed(1)}</span></div>
            </div>
            <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
              <span>Qualité {r.quality}/5</span><span>Ponctualité {r.delivery}/5</span><span>Emballage {r.packaging}/5</span>
            </div>
            {r.comment && <p className="text-sm">{r.comment}</p>}
            {r.reply && <p className="rounded-xl bg-muted p-2 text-xs"><span className="font-medium">Réponse du producteur :</span> {r.reply.text}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
