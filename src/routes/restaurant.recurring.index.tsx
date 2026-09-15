import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Repeat,
  Plus,
  Search,
  Calendar,
  MoreVertical,
  Pencil,
  Pause,
  Copy,
  ListOrdered,
  Ban,
  Wallet,
  PauseCircle,
} from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import {
  useRecurringOrders,
  useRestaurantOrders,
  useProducts,
  recurringOrderActions,
} from "@/data/store";
import { farmers, type RecurringOrder } from "@/data/mocks";
import { frequencyLabel, computeNextOccurrence, itemsSubtotal } from "@/lib/recurring-engine";
import { formatFCFA } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/common/confirm-dialog";

export const Route = createFileRoute("/restaurant/recurring/")({
  head: () => ({ meta: [{ title: "Commandes récurrentes · Restaurant" }] }),
  component: RecurringDashboard,
});

type Tab = "all" | "active" | "upcoming" | "paused" | "ended" | "problem";
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "active", label: "Actives" },
  { key: "upcoming", label: "À venir" },
  { key: "paused", label: "En pause" },
  { key: "ended", label: "Terminées" },
  { key: "problem", label: "Avec problème" },
];

const STATUS_TONE: Record<RecurringOrder["status"], string> = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  paused: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  ended: "bg-muted text-muted-foreground",
  problem: "bg-rose-500/10 text-rose-500",
};
const STATUS_LABEL: Record<RecurringOrder["status"], string> = {
  active: "Active",
  paused: "En pause",
  ended: "Terminée",
  problem: "Avec problème",
};

function estimateTotal(ro: RecurringOrder, priceOf: (id: string) => number) {
  const subtotal = itemsSubtotal(ro.items, priceOf);
  return subtotal + Math.round(subtotal * 0.03);
}

/** Occurrences restantes ce mois-ci pour une récurrence active (projection,
 * pas encore générées). */
function remainingOccurrencesThisMonth(ro: RecurringOrder): number {
  if (ro.status !== "active" || !ro.nextRunAt) return 0;
  const now = new Date();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  let count = 0;
  let cursor = new Date(ro.nextRunAt);
  let guard = 0;
  while (cursor <= monthEnd && guard < 20) {
    count++;
    const next = computeNextOccurrence(ro, cursor);
    if (!next) break;
    cursor = next;
    guard++;
  }
  return count;
}

function RecurringDashboard() {
  const recurring = useRecurringOrders();
  const restaurantOrders = useRestaurantOrders();
  const products = useProducts();
  const priceOf = (id: string) => products.find((p) => p.id === id)?.pricePerKg ?? 0;
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");

  const in7Days = Date.now() + 7 * 86400_000;

  const kpis = useMemo(() => {
    const active = recurring.filter((r) => r.status === "active");
    const upcoming = active.filter(
      (r) => r.nextRunAt && new Date(r.nextRunAt).getTime() <= in7Days,
    );
    const paused = recurring.filter((r) => r.status === "paused");
    const now = new Date();
    const generatedIds = new Set(recurring.flatMap((r) => r.generatedOrderIds));
    const generatedThisMonth = restaurantOrders.filter((o) => {
      if (!generatedIds.has(o.id)) return false;
      const d = new Date(o.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const remainingThisMonth = active.reduce((s, r) => s + remainingOccurrencesThisMonth(r), 0);
    const projectedSpend =
      generatedThisMonth.reduce((s, o) => s + o.total, 0) +
      active.reduce((s, r) => s + estimateTotal(r, priceOf) * remainingOccurrencesThisMonth(r), 0);
    return {
      active: active.length,
      upcoming: upcoming.length,
      thisMonth: generatedThisMonth.length + remainingThisMonth,
      projectedSpend,
      paused: paused.length,
    };
  }, [recurring, products, restaurantOrders]);

  const filtered = useMemo(() => {
    return recurring
      .filter((r) => {
        if (tab === "all") return true;
        if (tab === "active") return r.status === "active";
        if (tab === "paused") return r.status === "paused";
        if (tab === "ended") return r.status === "ended";
        if (tab === "problem") return r.status === "problem";
        if (tab === "upcoming")
          return (
            r.status === "active" && !!r.nextRunAt && new Date(r.nextRunAt).getTime() <= in7Days
          );
        return true;
      })
      .filter((r) => {
        if (!q.trim()) return true;
        const f = farmers.find((x) => x.id === r.farmerId);
        return `${r.name} ${f?.farm ?? ""}`.toLowerCase().includes(q.trim().toLowerCase());
      });
  }, [recurring, tab, q]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commandes récurrentes"
        subtitle="Automatisez vos approvisionnements et ne manquez plus jamais vos produits essentiels."
        actions={
          <Button asChild className="gap-2">
            <Link to="/restaurant/recurring/new">
              <Plus className="h-4 w-4" />
              Nouvelle commande récurrente
            </Link>
          </Button>
        }
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Actives", value: kpis.active, icon: Repeat, tone: "text-emerald-500" },
          { label: "À venir", value: kpis.upcoming, icon: Calendar, tone: "text-blue-500" },
          { label: "Ce mois-ci", value: kpis.thisMonth, icon: ListOrdered, tone: "text-primary" },
          {
            label: "Dépenses prévues",
            value: formatFCFA(kpis.projectedSpend),
            icon: Wallet,
            tone: "text-primary",
          },
          { label: "En pause", value: kpis.paused, icon: PauseCircle, tone: "text-amber-500" },
        ].map((k) => (
          <div key={k.label} className="glass rounded-2xl p-4 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl bg-muted grid place-items-center ${k.tone}`}>
              <k.icon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-bold font-display">{k.value}</div>
              <div className="text-[11px] text-muted-foreground">{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {TABS.map((t) => {
          const count =
            t.key === "all"
              ? recurring.length
              : t.key === "active"
                ? recurring.filter((r) => r.status === "active").length
                : t.key === "paused"
                  ? recurring.filter((r) => r.status === "paused").length
                  : t.key === "ended"
                    ? recurring.filter((r) => r.status === "ended").length
                    : t.key === "problem"
                      ? recurring.filter((r) => r.status === "problem").length
                      : recurring.filter(
                          (r) =>
                            r.status === "active" &&
                            !!r.nextRunAt &&
                            new Date(r.nextRunAt).getTime() <= in7Days,
                        ).length;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                tab === t.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-accent text-muted-foreground"
              }`}
            >
              {t.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="glass rounded-2xl p-4 flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher une commande récurrente…"
            className="pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="Aucune commande récurrente"
          description="Créez votre première commande récurrente pour automatiser vos approvisionnements."
          action={
            <Button asChild>
              <Link to="/restaurant/recurring/new">Nouvelle commande récurrente</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const f = farmers.find((x) => x.id === r.farmerId);
            const itemNames = r.items
              .map((it) => products.find((p) => p.id === it.productId)?.name)
              .filter(Boolean)
              .join(" · ");
            const total = estimateTotal(r, priceOf);
            return (
              <div key={r.id} className="glass rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                      <Repeat className="h-5 w-5" />
                    </div>
                    <div>
                      <Link
                        to="/restaurant/recurring/$recurringOrderId"
                        params={{ recurringOrderId: r.id }}
                        className="font-semibold text-sm hover:text-primary"
                      >
                        {r.name}
                      </Link>
                      <div className="text-[11px] text-muted-foreground">{f?.farm}</div>
                      <div className="text-[11px] text-muted-foreground">{itemNames}</div>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_TONE[r.status]}`}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>

                <div className="text-xs text-muted-foreground">{frequencyLabel(r)}</div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    <span className="text-muted-foreground">Prochaine commande :</span>
                    <b>
                      {r.nextRunAt
                        ? new Date(r.nextRunAt).toLocaleString("fr-FR", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </b>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Budget estimé : </span>
                    <b className="text-primary">{formatFCFA(total)}</b>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <Button asChild variant="outline" size="sm">
                      <Link
                        to="/restaurant/recurring/$recurringOrderId"
                        params={{ recurringOrderId: r.id }}
                      >
                        Voir le détail →
                      </Link>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link
                            to="/restaurant/recurring/$recurringOrderId"
                            params={{ recurringOrderId: r.id }}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-2" />
                            Modifier
                          </Link>
                        </DropdownMenuItem>
                        {r.status === "active" && (
                          <DropdownMenuItem
                            onClick={() => {
                              recurringOrderActions.pause(r.id, "Autre");
                              toast.success("Récurrence mise en pause");
                            }}
                          >
                            <Pause className="h-3.5 w-3.5 mr-2" />
                            Mettre en pause
                          </DropdownMenuItem>
                        )}
                        {r.status === "paused" && (
                          <DropdownMenuItem
                            onClick={() => {
                              recurringOrderActions.resume(r.id);
                              toast.success("Récurrence réactivée");
                            }}
                          >
                            <Repeat className="h-3.5 w-3.5 mr-2" />
                            Réactiver
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => {
                            recurringOrderActions.create({
                              name: `${r.name} (copie)`,
                              farmerId: r.farmerId,
                              items: r.items,
                              frequency: r.frequency,
                              intervalDays: r.intervalDays,
                              daysOfWeek: r.daysOfWeek,
                              createTime: r.createTime,
                              deliverySlot: r.deliverySlot,
                              firstRunAt: new Date().toISOString(),
                              end: r.end,
                              rules: r.rules,
                              deliveryAddress: r.deliveryAddress,
                              deliveryMode: r.deliveryMode,
                              instructions: r.instructions,
                              paymentMethod: r.paymentMethod,
                            });
                            toast.success("Commande récurrente dupliquée");
                          }}
                        >
                          <Copy className="h-3.5 w-3.5 mr-2" />
                          Dupliquer
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/restaurant/orders">
                            <ListOrdered className="h-3.5 w-3.5 mr-2" />
                            Voir les commandes
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <ConfirmDialog
                          trigger={
                            <DropdownMenuItem
                              onSelect={(e) => e.preventDefault()}
                              className="text-destructive"
                            >
                              <Ban className="h-3.5 w-3.5 mr-2" />
                              Annuler
                            </DropdownMenuItem>
                          }
                          title="Annuler cette commande récurrente ?"
                          description="Les commandes déjà générées ne sont pas supprimées et restent dans votre historique."
                          destructive
                          confirmLabel="Annuler la récurrence"
                          onConfirm={() => {
                            recurringOrderActions.cancel(r.id, "full");
                            toast.success("Commande récurrente annulée");
                          }}
                        />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
