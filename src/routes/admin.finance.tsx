import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Wallet, TrendingUp, Receipt } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { AdminBadge, RoleBadge } from "@/components/admin/admin-badge";
import { formatFCFA } from "@/lib/format";
import { payouts } from "@/data/admin-mocks";
import { useCommissionTiers } from "@/data/admin-store";
import { useOrders } from "@/data/store";
import { commissionForOrder, deliveredVolumeByFarmer, computeCommission } from "@/lib/commission";
import { downloadCsv } from "@/lib/export";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export const Route = createFileRoute("/admin/finance")({
  head: () => ({
    meta: [
      { title: "Finance — Administration Diambar Agro" },
      {
        name: "description",
        content:
          "Commissions encaissées, versements aux partenaires et trésorerie de la plateforme.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminFinance,
});

function AdminFinance() {
  const orders = useOrders();
  const tiers = useCommissionTiers();
  const delivered = orders.filter((o) => o.status === "delivered");
  const gmv = delivered.reduce((s, o) => s + o.total, 0);
  const commission = computeCommission(orders, tiers);
  const paid = payouts.filter((p) => p.status === "Payé").reduce((s, p) => s + p.amount, 0);
  const pending = payouts.filter((p) => p.status !== "Payé").reduce((s, p) => s + p.amount, 0);

  // Chaque producteur a son propre palier de commission (barème dégressif
  // réel de /admin/settings) selon son volume livré cumulé ; on répartit
  // donc la commission par jour en appliquant à chaque commande le palier
  // de son producteur, plutôt qu'un taux fixe. Les commandes de démo ne
  // couvrent que quelques jours, pas plusieurs mois : affiché par jour.
  const chart = useMemo(() => {
    const volumeByFarmer = deliveredVolumeByFarmer(orders);
    const totals = new Map<string, number>();
    for (const o of delivered) {
      const day = o.createdAt.slice(0, 10);
      totals.set(day, (totals.get(day) ?? 0) + commissionForOrder(o, tiers, volumeByFarmer));
    }
    return Array.from(totals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, commissionForDay]) => ({
        day: new Date(day).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
        commission: commissionForDay,
      }));
  }, [orders, delivered, tiers]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance"
        subtitle="Commissions, versements et trésorerie"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() =>
                downloadCsv(
                  "commissions-par-jour",
                  ["Jour", "Commission FCFA"],
                  chart.map((c) => [c.day, c.commission]),
                )
              }
            >
              <Download className="h-4 w-4" />
              Export comptable
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() =>
                downloadCsv(
                  "versements",
                  [
                    "Référence",
                    "Bénéficiaire",
                    "Rôle",
                    "Montant FCFA",
                    "Méthode",
                    "Statut",
                    "Date",
                  ],
                  payouts.map((p) => [
                    p.reference,
                    p.beneficiary,
                    p.role,
                    p.amount,
                    p.method,
                    p.status,
                    p.date,
                  ]),
                )
              }
            >
              <Download className="h-4 w-4" />
              Versements CSV
            </Button>
          </div>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Commissions (livré)"
          value={formatFCFA(commission)}
          icon={TrendingUp}
          hint={`${delivered.length} commande(s) livrée(s)`}
        />
        <StatCard
          label="Versements effectués"
          value={formatFCFA(paid)}
          icon={Wallet}
          hint="Semaine en cours"
        />
        <StatCard
          label="Versements en attente"
          value={formatFCFA(pending)}
          icon={Receipt}
          hint={`${payouts.filter((p) => p.status !== "Payé").length} opérations`}
        />
      </div>

      <div className="glass rounded-2xl p-5">
        <h2 className="font-semibold">Commissions encaissées par jour</h2>
        <div className="h-56 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="day"
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${Math.round(v / 1000)}k`}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
                formatter={(v: number) => formatFCFA(v)}
              />
              <Bar dataKey="commission" fill="var(--primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border font-semibold text-sm">
          Derniers versements partenaires
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-3">Référence</th>
              <th className="text-left font-medium px-4 py-3">Bénéficiaire</th>
              <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Rôle</th>
              <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">Moyen</th>
              <th className="text-right font-medium px-4 py-3">Montant</th>
              <th className="text-left font-medium px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {payouts.map((p) => (
              <tr key={p.id} className="hover:bg-accent/50 transition">
                <td className="px-4 py-3 font-medium">{p.reference}</td>
                <td className="px-4 py-3">{p.beneficiary}</td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <RoleBadge role={p.role} />
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{p.method}</td>
                <td className="px-4 py-3 text-right font-medium">{formatFCFA(p.amount)}</td>
                <td className="px-4 py-3">
                  <AdminBadge value={p.status} label={p.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
