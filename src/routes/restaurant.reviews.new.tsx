import { createFileRoute, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Check, Star } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileDrop } from "@/components/disputes/file-drop";
import { useRestaurantOrders, useSuppliers, useMissions } from "@/data/store";
import { restaurants, drivers } from "@/data/mocks";
import { relativeTime } from "@/lib/format";
import type { DisputeAttachment } from "@/data/disputes";
import {
  useReviewsForRestaurant,
  reviewActions,
  REVIEW_CRITERION_LABEL,
  REVIEW_TAGS,
  type ReviewCriterion,
} from "@/data/business";

export const Route = createFileRoute("/restaurant/reviews/new")({
  validateSearch: z.object({ orderId: z.string().optional() }),
  head: () => ({ meta: [{ title: "Évaluer une commande · Restaurant" }] }),
  component: NewReview,
});

const CRITERIA: ReviewCriterion[] = [
  "quality",
  "quantity",
  "freshness",
  "timeliness",
  "packaging",
  "communication",
];
const STEPS = ["Note & critères", "Commentaire", "Photos", "Récapitulatif"];

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="transition hover:scale-110"
        >
          <Star
            className={`h-6 w-6 ${n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
          />
        </button>
      ))}
    </div>
  );
}

function StaticStars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-6 w-6 ${n <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
        />
      ))}
    </div>
  );
}

function NewReview() {
  const navigate = useNavigate();
  const { orderId: initialOrderId } = Route.useSearch();
  const { user } = useRouteContext({ from: "/restaurant" });
  const myRestaurant = restaurants.find((r) => r.name === user.name);
  const orders = useRestaurantOrders();
  const suppliers = useSuppliers();
  const missions = useMissions();
  const reviews = useReviewsForRestaurant(myRestaurant?.id ?? "");

  const [orderId, setOrderId] = useState<string | null>(initialOrderId ?? null);
  const [step, setStep] = useState(0);
  const [ratings, setRatings] = useState<Record<ReviewCriterion, number>>({
    quality: 5,
    quantity: 5,
    freshness: 5,
    timeliness: 5,
    packaging: 5,
    communication: 5,
  });
  const [comment, setComment] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [photos, setPhotos] = useState<DisputeAttachment[]>([]);

  const rated = new Set(reviews.map((r) => r.orderRef));
  const toRate = orders.filter((o) => o.status === "delivered" && !rated.has(o.reference));
  const order = orders.find((o) => o.id === orderId) ?? null;
  const supplierName = (id: string) =>
    suppliers.find((s) => s.id === id || s.farmerId === id)?.name ?? "Producteur";
  const mission = order ? missions.find((m) => m.orderRef === order.reference) : null;
  const driverName = mission ? drivers.find((d) => d.id === mission.driverId)?.name : undefined;

  const avg = CRITERIA.reduce((s, c) => s + ratings[c], 0) / CRITERIA.length;

  if (!order) {
    return (
      <div className="space-y-6 max-w-2xl">
        <PageHeader
          title="Évaluer une commande"
          subtitle="Choisissez la livraison que vous souhaitez évaluer."
          actions={
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => navigate({ to: "/restaurant/reviews" })}
            >
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Button>
          }
        />
        {toRate.length === 0 ? (
          <EmptyState
            icon={Star}
            title="Tout est déjà noté"
            description="Vous n'avez aucune livraison en attente d'évaluation."
          />
        ) : (
          <div className="space-y-2">
            {toRate.map((o) => (
              <button
                key={o.id}
                onClick={() => setOrderId(o.id)}
                className="w-full text-left glass rounded-2xl p-4 hover:bg-accent/40 transition flex items-center justify-between gap-3"
              >
                <div>
                  <div className="font-semibold">{o.reference}</div>
                  <div className="text-xs text-muted-foreground">
                    {supplierName(o.farmerId)} · livrée {relativeTime(o.createdAt)}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const submit = () => {
    if (!myRestaurant) return;
    reviewActions.create({
      restaurantId: myRestaurant.id,
      orderRef: order.reference,
      supplierId: order.farmerId,
      supplierName: supplierName(order.farmerId),
      driverName,
      ...ratings,
      comment: comment.trim(),
      tags: tags.length > 0 ? tags : undefined,
      photos: photos.length > 0 ? photos : undefined,
    });
    toast.success("Merci pour votre évaluation", {
      description: `${supplierName(order.farmerId)} · ${avg.toFixed(1)}/5`,
    });
    navigate({ to: "/restaurant/reviews" });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Évaluer une commande"
        subtitle={`${supplierName(order.farmerId)} · Commande ${order.reference} · Livrée`}
        actions={
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => navigate({ to: "/restaurant/reviews" })}
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
        }
      />

      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex-1 flex items-center gap-2">
            <div
              className={`h-8 w-8 rounded-full grid place-items-center text-xs font-bold shrink-0 ${step >= i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {step > i ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={`text-xs font-medium hidden sm:inline ${step >= i ? "" : "text-muted-foreground"}`}
            >
              {s}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px ${step > i ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>

      <div className="glass rounded-2xl p-6 space-y-5">
        {step === 0 && (
          <>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">Note globale</h3>
              <div className="flex items-center gap-2">
                <StaticStars value={avg} />
                <span className="text-sm font-bold">{avg.toFixed(1)}/5</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-3">
              Calculée automatiquement à partir des critères ci-dessous.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {CRITERIA.map((c) => (
                <div key={c} className="space-y-1">
                  <div className="text-xs text-muted-foreground">{REVIEW_CRITERION_LABEL[c]}</div>
                  <StarPicker
                    value={ratings[c]}
                    onChange={(v) => setRatings({ ...ratings, [c]: v })}
                  />
                </div>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h3 className="font-display text-lg font-bold">Votre commentaire</h3>
            <Textarea
              placeholder="Décrivez votre expérience avec cette livraison…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
            />
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">
                Qu'avez-vous particulièrement apprécié ? (facultatif)
              </div>
              <div className="flex flex-wrap gap-2">
                {REVIEW_TAGS.map((t) => {
                  const active = tags.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTags(active ? tags.filter((x) => x !== t) : [...tags, t])}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${active ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-accent"}`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h3 className="font-display text-lg font-bold">Photos (facultatif)</h3>
            <FileDrop
              value={photos}
              onChange={setPhotos}
              by={myRestaurant?.name ?? user.name}
              kind="photo"
              label="Ajouter des photos"
            />
          </>
        )}

        {step === 3 && (
          <>
            <h3 className="font-display text-lg font-bold">Récapitulatif de votre évaluation</h3>
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Note globale</div>
                <div className="flex items-center gap-2">
                  <StaticStars value={avg} />
                  <span className="text-sm font-bold">{avg.toFixed(1)}/5</span>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                {CRITERIA.map((c) => (
                  <div key={c} className="flex justify-between">
                    <span className="text-muted-foreground">{REVIEW_CRITERION_LABEL[c]}</span>
                    <span className="font-medium">{ratings[c]}/5</span>
                  </div>
                ))}
              </div>
            </div>
            {comment && <p className="text-sm border-t border-border pt-3">{comment}</p>}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span key={t} className="text-[10px] rounded-full bg-muted px-2 py-0.5">
                    {t}
                  </span>
                ))}
              </div>
            )}
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {photos.map((p) =>
                  p.dataUrl ? (
                    <img
                      key={p.id}
                      src={p.dataUrl}
                      alt=""
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  ) : null,
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex justify-between">
        {step > 0 ? (
          <Button variant="outline" onClick={() => setStep(step - 1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Précédent
          </Button>
        ) : (
          <Button variant="outline" onClick={() => navigate({ to: "/restaurant/reviews" })}>
            Annuler
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep(step + 1)} className="gap-2">
            Suivant <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={submit} className="gap-2">
            <Check className="h-4 w-4" />
            Publier mon évaluation
          </Button>
        )}
      </div>
    </div>
  );
}
