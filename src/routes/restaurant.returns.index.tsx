import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import {
  RotateCcw,
  Plus,
  ClipboardList,
  Clock,
  CheckCheck,
  Wallet,
  Ban,
  Search,
} from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { KpiCard } from "@/components/farmer/kpi-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useReturnsForRestaurant,
  RETURN_REASON_LABEL,
  RETURN_STATUS_LABEL,
  type ReturnStatus,
} from "@/data/business";
import { useCreditNotesForRestaurant, isCreditExpired } from "@/data/disputes";
import { restaurants } from "@/data/mocks";
import { formatFCFA, relativeTime } from "@/lib/format";

export const Route = createFileRoute("/restaurant/returns/")({
  validateSearch: z.object({ tab: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Retours & avoirs — Espace restaurant Diambar Agro" },
      {
        name: "description",
        content:
          "Déclarez un retour produit sur une commande livrée et suivez vos avoirs auprès de vos producteurs.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RestaurantReturnsPage,
});

type Tab = "all" | ReturnStatus | "avoirs";
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "pending", label: "Demandes ouvertes" },
  { key: "accepted", label: "Retours acceptés" },
  { key: "credited", label: "Remboursés" },
  { key: "refused", label: "Refusés" },
  { key: "avoirs", label: "Avoirs disponibles" },
];

function RestaurantReturnsPage() {
  const { tab: initialTab } = Route.useSearch();
  const { user } = useRouteContext({ from: "/restaurant" });
  const myRestaurant = restaurants.find((r) => r.name === user.name);
  const returns = useReturnsForRestaurant(myRestaurant?.id ?? "");
  const credits = useCreditNotesForRestaurant(myRestaurant?.name ?? "");

  const [tab, setTab] = useState<Tab>((initialTab as Tab) ?? "all");
  const [q, setQ] = useState("");

  const pending = returns.filter((r) => r.status === "pending").length;
  const accepted = returns.filter((r) => r.status === "accepted").length;
  const refused = returns.filter((r) => r.status === "refused").length;
  const availableCredits = credits.filter((c) => c.status === "issued" && !isCreditExpired(c));
  const totalAvailable = availableCredits.reduce((s, c) => s + c.amount, 0);
  const totalRefunded = returns
    .filter((r) => r.status === "credited")
    .reduce((s, r) => s + (r.awardedAmount ?? 0), 0);

  const filtered = useMemo(() => {
    if (tab === "avoirs") return [];
    return returns
      .filter((r) => tab === "all" || r.status === tab)
      .filter((r) =>
        `${r.reference} ${r.orderRef} ${r.productName}`.toLowerCase().includes(q.toLowerCase()),
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [returns, tab, q]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Retours & avoirs"
        subtitle="Déclarez un retour sur une livraison et suivez vos remboursements."
        actions={
          <Button asChild className="gap-2">
            <Link to="/restaurant/returns/new">
              <Plus className="h-4 w-4" />
              Déclarer un problème
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          icon={ClipboardList}
          label="Demandes ouvertes"
          value={String(pending)}
          tone="blue"
        />
        <KpiCard icon={Clock} label="Retours acceptés" value={String(accepted)} tone="amber" />
        <KpiCard
          icon={Wallet}
          label="Avoir disponible"
          value={formatFCFA(totalAvailable)}
          tone="emerald"
        />
        <KpiCard
          icon={CheckCheck}
          label="Remboursements reçus"
          value={formatFCFA(totalRefunded)}
          tone="violet"
        />
        <KpiCard icon={Ban} label="Refusés" value={String(refused)} tone="rose" />
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${tab === t.key ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-accent"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "avoirs" ? (
        <div className="space-y-3">
          {credits.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Aucun avoir"
              description="Vos avoirs (retours crédités ou litiges résolus en votre faveur) apparaîtront ici."
            />
          ) : (
            <div className="glass rounded-2xl overflow-hidden">
              <div className="grid grid-cols-[1fr_1fr_100px_120px] items-center px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
                <span>N° avoir</span>
                <span>Origine</span>
                <span className="text-right">Montant</span>
                <span className="text-right">Statut</span>
              </div>
              {credits.map((c) => {
                const expired = isCreditExpired(c);
                const statusLabel =
                  c.status === "applied" ? "Utilisé" : expired ? "Expiré" : "Disponible";
                return (
                  <div
                    key={c.id}
                    className="grid grid-cols-[1fr_1fr_100px_120px] items-center px-4 py-3 border-b border-border last:border-0 text-sm"
                  >
                    <span className="font-mono font-semibold text-primary">{c.reference}</span>
                    <span className="text-muted-foreground text-xs">
                      {c.source === "return" ? "Retour produit" : "Litige"} · {relativeTime(c.at)}
                    </span>
                    <span className="text-right font-bold">{formatFCFA(c.amount)}</span>
                    <span
                      className={`text-right text-[11px] font-semibold ${statusLabel === "Disponible" ? "text-emerald-500" : statusLabel === "Expiré" ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {statusLabel}
                      {c.expiresAt && statusLabel === "Disponible"
                        ? ` · exp. ${new Date(c.expiresAt).toLocaleDateString("fr-FR")}`
                        : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="relative max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher une demande, une commande, un produit…"
              className="pl-9"
            />
          </div>
          {filtered.length === 0 ? (
            <EmptyState
              icon={RotateCcw}
              title="Aucun retour"
              description="Aucune demande de retour dans cette catégorie."
              action={
                <Button asChild>
                  <Link to="/restaurant/returns/new">Déclarer un problème</Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((r) => (
                <Link
                  key={r.id}
                  to="/restaurant/returns/$returnId"
                  params={{ returnId: r.id }}
                  className="block glass rounded-2xl p-4 hover:bg-accent/40 transition"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">
                        {r.reference} · {r.productName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.orderRef} · {RETURN_REASON_LABEL[r.reason]} · {relativeTime(r.createdAt)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold">{formatFCFA(r.requestedAmount)}</div>
                      <div className="text-xs text-muted-foreground">
                        {RETURN_STATUS_LABEL[r.status]}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
