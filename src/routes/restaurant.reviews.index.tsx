import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Star,
  MessageSquare,
  Plus,
  AlertTriangle,
  Users,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { KpiCard } from "@/components/farmer/kpi-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { relativeTime } from "@/lib/format";
import { useRestaurantOrders, useSuppliers } from "@/data/store";
import { restaurants } from "@/data/mocks";
import {
  useReviewsForRestaurant,
  useSupplierScoresForRestaurant,
  reviewScore,
  REVIEW_CRITERION_LABEL,
  type ReviewCriterion,
} from "@/data/business";

export const Route = createFileRoute("/restaurant/reviews/")({
  head: () => ({
    meta: [
      { title: "Évaluations — Espace restaurant Diambar Agro" },
      {
        name: "description",
        content:
          "Évaluez vos livraisons et consultez la réputation de vos producteurs partenaires.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReviewsPage,
});

const CRITERIA: ReviewCriterion[] = [
  "quality",
  "quantity",
  "freshness",
  "timeliness",
  "packaging",
  "communication",
];

function Stars({ value, size = 4 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-${size} w-${size} ${n <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
        />
      ))}
    </div>
  );
}

function monthKeyFromIso(iso: string) {
  return iso.slice(0, 7);
}

function ReviewsPage() {
  const { user } = useRouteContext({ from: "/restaurant" });
  const myRestaurant = restaurants.find((r) => r.name === user.name);
  const orders = useRestaurantOrders();
  const suppliers = useSuppliers();
  const reviews = useReviewsForRestaurant(myRestaurant?.id ?? "");
  const scores = useSupplierScoresForRestaurant(myRestaurant?.id ?? "");

  const [tab, setTab] = useState("torate");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [starFilter, setStarFilter] = useState<number | "all">("all");

  const rated = new Set(reviews.map((r) => r.orderRef));
  const toRate = orders.filter((o) => o.status === "delivered" && !rated.has(o.reference));

  const avgGiven = reviews.length
    ? reviews.reduce((s, r) => s + reviewScore(r), 0) / reviews.length
    : 0;
  const suppliersRated = new Set(reviews.map((r) => r.supplierId)).size;
  const flagged = reviews.filter((r) => CRITERIA.some((c) => r[c] <= 2)).length;

  const filteredReviews = useMemo(() => {
    return [...reviews]
      .filter((r) => starFilter === "all" || Math.round(reviewScore(r)) === starFilter)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [reviews, starFilter]);

  const starBuckets = [5, 4, 3, 2, 1].map((n) => ({
    n,
    count: reviews.filter((r) => Math.round(reviewScore(r)) === n).length,
  }));

  const monthlyTrend = useMemo(() => {
    const map = new Map<string, number[]>();
    reviews.forEach((r) => {
      const key = monthKeyFromIso(r.createdAt);
      map.set(key, [...(map.get(key) ?? []), reviewScore(r)]);
    });
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, scoresList]) => ({
        month: new Date(`${key}-01`).toLocaleDateString("fr-FR", {
          month: "short",
          year: "2-digit",
        }),
        Note: Number((scoresList.reduce((a, b) => a + b, 0) / scoresList.length).toFixed(2)),
      }));
  }, [reviews]);

  const criteriaAvg = CRITERIA.map((c) => ({
    critere: REVIEW_CRITERION_LABEL[c],
    Moyenne: reviews.length
      ? Number((reviews.reduce((s, r) => s + r[c], 0) / reviews.length).toFixed(2))
      : 0,
  }));

  const supplierName = (id: string) =>
    suppliers.find((s) => s.id === id || s.farmerId === id)?.name ?? "Producteur";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Évaluations"
        subtitle="Partagez votre expérience et consultez la qualité de vos fournisseurs."
        actions={
          toRate[0] && (
            <Button asChild className="gap-2">
              <Link to="/restaurant/reviews/new" search={{ orderId: toRate[0].id }}>
                <Plus className="h-4 w-4" />
                Évaluer une commande
              </Link>
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          icon={MessageSquare}
          label="Mes évaluations"
          value={String(reviews.length)}
          tone="blue"
        />
        <KpiCard
          icon={Star}
          label="Note moyenne donnée"
          value={reviews.length ? `${avgGiven.toFixed(1)}/5` : "—"}
          tone="amber"
        />
        <KpiCard
          icon={AlertTriangle}
          label="À évaluer"
          value={String(toRate.length)}
          tone="violet"
        />
        <KpiCard
          icon={Users}
          label="Fournisseurs évalués"
          value={String(suppliersRated)}
          tone="emerald"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Problèmes signalés"
          value={String(flagged)}
          tone="rose"
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="torate">À évaluer ({toRate.length})</TabsTrigger>
          <TabsTrigger value="mine">Mes évaluations ({reviews.length})</TabsTrigger>
          <TabsTrigger value="suppliers">Mes fournisseurs</TabsTrigger>
          <TabsTrigger value="analysis">Analyse</TabsTrigger>
        </TabsList>

        <TabsContent value="torate" className="pt-4 space-y-3">
          {toRate.length === 0 ? (
            <EmptyState
              icon={Star}
              title="Tout est noté"
              description="Vous avez évalué toutes vos livraisons reçues."
            />
          ) : (
            toRate.map((o) => (
              <div
                key={o.id}
                className="glass rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <div className="font-semibold">{o.reference}</div>
                  <div className="text-xs text-muted-foreground">
                    {supplierName(o.farmerId)} · livrée {relativeTime(o.createdAt)}
                  </div>
                </div>
                <Button asChild size="sm" className="gap-2">
                  <Link to="/restaurant/reviews/new" search={{ orderId: o.id }}>
                    Évaluer <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
                  </Link>
                </Button>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="mine" className="pt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {(["all", 5, 4, 3, 2, 1] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStarFilter(s)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${starFilter === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-accent"}`}
              >
                {s === "all"
                  ? `Toutes (${reviews.length})`
                  : `${s} étoile(s) (${starBuckets.find((b) => b.n === s)?.count ?? 0})`}
              </button>
            ))}
          </div>
          {filteredReviews.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="Aucun avis"
              description="Vos évaluations apparaîtront ici."
            />
          ) : (
            filteredReviews.map((r) => (
              <div key={r.id} className="glass rounded-2xl p-4 space-y-2">
                <button
                  className="w-full flex flex-wrap items-center justify-between gap-2 text-left"
                  onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                >
                  <div>
                    <div className="font-semibold">{r.supplierName}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.orderRef} · {relativeTime(r.createdAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Stars value={reviewScore(r)} />
                    <span className="text-sm font-bold">{reviewScore(r).toFixed(1)}</span>
                    {expandedId === r.id ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>
                {expandedId === r.id && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <div className="grid sm:grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                      {CRITERIA.map((c) => (
                        <span key={c}>
                          {REVIEW_CRITERION_LABEL[c]} : <b className="text-foreground">{r[c]}/5</b>
                        </span>
                      ))}
                    </div>
                    {r.tags && r.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {r.tags.map((t) => (
                          <span key={t} className="text-[10px] rounded-full bg-muted px-2 py-0.5">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {r.comment && <p className="text-sm">{r.comment}</p>}
                    {r.photos && r.photos.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {r.photos.map((p) =>
                          p.dataUrl ? (
                            <img
                              key={p.id}
                              src={p.dataUrl}
                              alt=""
                              className="h-14 w-14 rounded-lg object-cover"
                            />
                          ) : null,
                        )}
                      </div>
                    )}
                    {r.reply && (
                      <p className="rounded-xl bg-muted p-2 text-xs">
                        <span className="font-medium">Réponse du producteur :</span> {r.reply.text}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="suppliers" className="pt-4">
          {scores.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Aucun fournisseur évalué"
              description="Vos évaluations par fournisseur apparaîtront ici."
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {scores.map((s) => {
                const supplier = suppliers.find((x) => x.farmerId === s.id || x.id === s.id);
                return (
                  <div key={s.id} className="glass rounded-2xl p-4 space-y-2">
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{supplier?.city ?? ""}</div>
                    <div className="flex items-center gap-2">
                      <Stars value={s.avg} />
                      <span className="text-sm font-bold">{s.avg.toFixed(1)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{s.count} avis</div>
                    {supplier && (
                      <Button asChild variant="outline" size="sm" className="w-full">
                        <Link
                          to="/restaurant/suppliers/$supplierId"
                          params={{ supplierId: supplier.id }}
                        >
                          Voir le profil
                        </Link>
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analysis" className="pt-4 space-y-6">
          <div className="glass rounded-2xl p-5">
            <h3 className="font-semibold mb-1">Évolution de ma note moyenne</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Calculée sur vos vraies évaluations, mois par mois.
            </p>
            <div className="h-56">
              {monthlyTrend.length === 0 ? (
                <p className="text-sm text-muted-foreground flex h-full items-center justify-center">
                  Pas encore assez d'évaluations pour une courbe.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyTrend}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="month"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      domain={[0, 5]}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Note"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <h3 className="font-semibold mb-3">Performance par critère</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={criteriaAvg} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    domain={[0, 5]}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="critere"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={140}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="Moyenne" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
