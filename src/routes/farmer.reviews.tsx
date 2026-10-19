import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MessageSquareReply, Star, MessageCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { KpiCard } from "@/components/farmer/kpi-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  REVIEW_CRITERION_LABEL,
  reviewScore,
  useReviews,
  type Review,
  type ReviewCriterion,
} from "@/data/business";
import { useMyId } from "@/data/market-mode";
import { market } from "@/data/market-remote";
import { relativeTime } from "@/lib/format";

export const Route = createFileRoute("/farmer/reviews")({
  head: () => ({
    meta: [
      { title: "Avis reçus — Espace agriculteur Diambar Agro" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FarmerReviews,
});

const CRITERIA = Object.keys(REVIEW_CRITERION_LABEL) as ReviewCriterion[];

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value.toFixed(1)} sur 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-3.5 w-3.5 ${n <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
        />
      ))}
    </span>
  );
}

function ReplyBox({ review }: { review: Review }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  if (!open) {
    return (
      <Button size="sm" variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <MessageSquareReply className="h-4 w-4" />
        Répondre
      </Button>
    );
  }
  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const res = await market.replyReview(review.id, text.trim());
    setSending(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success("Réponse publiée");
    setOpen(false);
    setText("");
  };
  return (
    <div className="space-y-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Remerciez le restaurant ou expliquez ce qui sera amélioré…"
        maxLength={1000}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={send} disabled={!text.trim() || sending}>
          Publier la réponse
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
    </div>
  );
}

function FarmerReviews() {
  const myId = useMyId("farmer");
  const reviews = useReviews().filter((r) => r.supplierId === myId);
  const avg = reviews.length ? reviews.reduce((s, r) => s + reviewScore(r), 0) / reviews.length : 0;
  const unanswered = reviews.filter((r) => !r.reply).length;
  const byCriterion = CRITERIA.map((c) => ({
    c,
    avg: reviews.length ? reviews.reduce((s, r) => s + r[c], 0) / reviews.length : 0,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Avis reçus"
        subtitle="Les notes laissées par les restaurants après chaque livraison"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          icon={Star}
          label="Note moyenne"
          value={reviews.length ? `${avg.toFixed(1)} / 5` : "—"}
          tone="amber"
        />
        <KpiCard icon={MessageCircle} label="Avis reçus" value={String(reviews.length)} />
        <KpiCard icon={Clock} label="Sans réponse" value={String(unanswered)} tone="blue" />
      </div>

      {reviews.length === 0 ? (
        <EmptyState
          icon={Star}
          title="Aucun avis pour le moment"
          description="Les restaurants peuvent noter chaque commande livrée. Leurs avis apparaîtront ici."
        />
      ) : (
        <>
          <div className="glass rounded-2xl p-5">
            <h3 className="font-semibold mb-3">Détail par critère</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {byCriterion.map(({ c, avg: v }) => (
                <div key={c} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">{REVIEW_CRITERION_LABEL[c]}</span>
                  <span className="inline-flex items-center gap-2 font-medium">
                    <Stars value={v} />
                    {v.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {reviews.map((r) => (
              <div key={r.id} className="glass rounded-2xl p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold">
                      {r.orderRef ? `Commande ${r.orderRef}` : "Commande livrée"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {relativeTime(r.createdAt)}
                      {r.driverName ? ` · livrée par ${r.driverName}` : ""}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold">
                    <Stars value={reviewScore(r)} />
                    {reviewScore(r).toFixed(1)}
                  </span>
                </div>
                {r.comment && <p className="text-sm">{r.comment}</p>}
                {r.tags && r.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {r.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {r.reply ? (
                  <div className="rounded-xl bg-muted/60 p-3 text-sm">
                    <div className="text-[11px] text-muted-foreground mb-0.5">
                      Votre réponse · {relativeTime(r.reply.at)}
                    </div>
                    {r.reply.text}
                  </div>
                ) : (
                  <ReplyBox review={r} />
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
