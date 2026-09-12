import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { Wallet, TrendingDown, AlertTriangle, Download, PiggyBank, Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { KpiCard } from "@/components/farmer/kpi-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatFCFA } from "@/lib/format";
import { downloadCsv } from "@/lib/export";
import { useBudget, budgetActions, budgetHistory } from "@/data/budget";
import { useRestaurantOrders, useProducts, useSuppliers } from "@/data/store";

export const Route = createFileRoute("/restaurant/budget")({
  head: () => ({
    meta: [
      { title: "Budget d'achat — Espace restaurant Diambar Agro" },
      {
        name: "description",
        content:
          "Pilotez votre budget mensuel d'approvisionnement : dépenses par catégorie, par fournisseur et alertes de dépassement.",
      },
      { property: "og:title", content: "Budget d'achat — Espace restaurant" },
      {
        property: "og:description",
        content: "Budget mensuel, dépenses par catégorie et alertes de dépassement.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BudgetPage,
});

const CATEGORY_MAP: Record<string, string> = {
  Légumes: "legumes",
  Fruits: "fruits",
  Céréales: "cereales",
  Tubercules: "cereales",
  Volaille: "proteines",
  Viande: "proteines",
  Épices: "autres",
};

function BudgetPage() {
  const budget = useBudget();
  const orders = useRestaurantOrders();
  const products = useProducts();
  const suppliers = useSuppliers();
  const [draftMonthly, setDraftMonthly] = useState(String(budget.monthly));
  const [draftThreshold, setDraftThreshold] = useState(String(budget.alertThreshold));

  const spentByCategory = useMemo(() => {
    const acc: Record<string, number> = {};
    orders
      .filter((o) => o.status !== "cancelled")
      .forEach((o) => {
        o.items.forEach((it) => {
          const p = products.find((x) => x.id === it.productId);
          const key = p ? (CATEGORY_MAP[p.category] ?? "autres") : "autres";
          acc[key] = (acc[key] ?? 0) + it.qty * it.price;
        });
      });
    return acc;
  }, [orders, products]);

  const spentBySupplier = useMemo(() => {
    const acc: Record<string, number> = {};
    orders
      .filter((o) => o.status !== "cancelled")
      .forEach((o) => {
        acc[o.farmerId] = (acc[o.farmerId] ?? 0) + o.total;
      });
    return acc;
  }, [orders]);

  const spent = Object.values(spentByCategory).reduce((a, b) => a + b, 0);
  const remaining = budget.monthly - spent;
  const usage = budget.monthly > 0 ? Math.round((spent / budget.monthly) * 100) : 0;
  const overThreshold = usage >= budget.alertThreshold;

  const chart = budgetHistory.map((m) => ({ month: m.month, Dépensé: m.spent, Budget: m.budget }));

  const saveBudget = () => {
    budgetActions.setMonthly(Number(draftMonthly) || 0);
    budgetActions.setThreshold(Number(draftThreshold) || 80);
    toast.success("Budget mis à jour");
  };

  const exportCsv = () => {
    downloadCsv(
      "budget-restaurant.csv",
      ["Catégorie", "Budget alloué (FCFA)", "Dépensé (FCFA)", "Reste (FCFA)", "Consommation (%)"],
      budget.categories.map((c) => {
        const s = spentByCategory[c.key] ?? 0;
        return [
          c.label,
          c.allocated,
          s,
          c.allocated - s,
          c.allocated ? Math.round((s / c.allocated) * 100) : 0,
        ];
      }),
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budget d'achat"
        subtitle="Pilotez vos dépenses d'approvisionnement du mois"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={exportCsv}>
              <Download className="h-4 w-4" />
              Exporter CSV
            </Button>
            <Button asChild className="gap-2">
              <Link to="/restaurant/marketplace">Commander</Link>
            </Button>
          </div>
        }
      />

      {overThreshold && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div>
            <div className="font-semibold text-amber-700 dark:text-amber-300">
              Seuil d'alerte atteint ({usage}% du budget)
            </div>
            <p className="text-muted-foreground mt-0.5">
              Vous approchez de la limite mensuelle. Ajustez vos commandes récurrentes ou relevez le
              budget.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Budget mensuel" value={formatFCFA(budget.monthly)} icon={PiggyBank} />
        <KpiCard label="Dépensé" value={formatFCFA(spent)} icon={Wallet} />
        <KpiCard
          label="Reste disponible"
          value={formatFCFA(Math.max(0, remaining))}
          icon={TrendingDown}
        />
        <KpiCard label="Consommation" value={`${usage}%`} icon={AlertTriangle} />
      </div>

      <div className="glass rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-semibold">Répartition par catégorie</h2>
          <span className="text-xs text-muted-foreground">
            Seuil d'alerte : {budget.alertThreshold}%
          </span>
        </div>
        <div className="space-y-4">
          {budget.categories.map((c) => {
            const s = spentByCategory[c.key] ?? 0;
            const pct = c.allocated ? Math.min(100, Math.round((s / c.allocated) * 100)) : 0;
            const danger = pct >= budget.alertThreshold;
            return (
              <div key={c.key} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">{c.label}</span>
                  <span className="text-muted-foreground text-xs">
                    {formatFCFA(s)} / {formatFCFA(c.allocated)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${danger ? "bg-destructive" : "bg-primary"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    defaultValue={c.allocated}
                    onBlur={(e) => {
                      budgetActions.setCategory(c.key, Number(e.target.value) || 0);
                      toast.success(`Enveloppe « ${c.label} » mise à jour`);
                    }}
                    className="h-8 max-w-36 text-xs"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    enveloppe allouée (FCFA)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass rounded-2xl p-5">
          <h2 className="font-semibold">Budget vs dépenses (6 mois)</h2>
          <div className="h-60 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="month"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => formatFCFA(v)}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  dataKey="Budget"
                  fill="hsl(var(--muted-foreground))"
                  radius={[6, 6, 0, 0]}
                  opacity={0.35}
                />
                <Bar dataKey="Dépensé" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold">Paramètres du budget</h2>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Budget mensuel (FCFA)</label>
            <Input
              type="number"
              value={draftMonthly}
              onChange={(e) => setDraftMonthly(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Seuil d'alerte (%)</label>
            <Input
              type="number"
              value={draftThreshold}
              onChange={(e) => setDraftThreshold(e.target.value)}
            />
          </div>
          <Button className="w-full gap-2" onClick={saveBudget}>
            <Save className="h-4 w-4" />
            Enregistrer
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => {
              budgetActions.reset();
              setDraftMonthly("1200000");
              setDraftThreshold("80");
              toast.success("Budget réinitialisé");
            }}
          >
            Réinitialiser
          </Button>
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border font-semibold text-sm">
          Dépenses par fournisseur
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-3">Fournisseur</th>
              <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Ville</th>
              <th className="text-right font-medium px-4 py-3">Dépensé ce mois</th>
              <th className="text-right font-medium px-4 py-3 hidden sm:table-cell">
                Part du budget
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {suppliers.map((s) => {
              const amount = spentBySupplier[s.farmerId ?? s.id] ?? 0;
              return (
                <tr key={s.id} className="hover:bg-accent/50 transition">
                  <td className="px-4 py-3 font-medium">
                    <Link
                      to="/restaurant/suppliers/$supplierId"
                      params={{ supplierId: s.id }}
                      className="hover:text-primary"
                    >
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{s.city}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatFCFA(amount)}</td>
                  <td className="px-4 py-3 text-right hidden sm:table-cell text-muted-foreground">
                    {budget.monthly ? Math.round((amount / budget.monthly) * 100) : 0}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
