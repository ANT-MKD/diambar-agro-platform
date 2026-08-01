import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Wallet, TrendingUp, Receipt, PiggyBank } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { AdminBadge, RoleBadge } from "@/components/admin/admin-badge";
import { formatFCFA } from "@/lib/format";
import { payouts, platformGmv } from "@/data/admin-mocks";

export const Route = createFileRoute("/admin/finance")({
  head: () => ({ meta: [{ title: "Finance — Administration Diambar Agro" }, { name: "description", content: "Commissions encaissées, versements aux partenaires et trésorerie de la plateforme." }, { name: "robots", content: "noindex" }] }),
  component: AdminFinance,
});

function AdminFinance() {
  const gmv = platformGmv[platformGmv.length - 1].gmv;
  const commission = Math.round(gmv * 0.11);
  const paid = payouts.filter((p) => p.status === "Payé").reduce((s, p) => s + p.amount, 0);
  const pending = payouts.filter((p) => p.status !== "Payé").reduce((s, p) => s + p.amount, 0);
  const chart = platformGmv.map((m) => ({ month: m.month, commission: Math.round(m.gmv * 0.11) }));

  return (
    <div className="space-y-6">
      <PageHeader title="Finance" subtitle="Commissions, versements et trésorerie" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Commissions du mois" value={formatFCFA(commission)} delta={19} icon={TrendingUp} />
        <StatCard label="Versements effectués" value={formatFCFA(paid)} icon={Wallet} hint="Semaine en cours" />
        <StatCard label="Versements en attente" value={formatFCFA(pending)} icon={Receipt} hint={`${payouts.filter((p) => p.status !== "Payé").length} opérations`} />
        <StatCard label="Trésorerie estimée" value={formatFCFA(commission - pending)} delta={7} icon={PiggyBank} />
      </div>

      <div className="glass rounded-2xl p-5">
        <h2 className="font-semibold">Commissions encaissées</h2>
        <div className="h-56 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} formatter={(v: number) => formatFCFA(v)} />
              <Bar dataKey="commission" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border font-semibold text-sm">Derniers versements partenaires</div>
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
                <td className="px-4 py-3 hidden md:table-cell"><RoleBadge role={p.role} /></td>
                <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{p.method}</td>
                <td className="px-4 py-3 text-right font-medium">{formatFCFA(p.amount)}</td>
                <td className="px-4 py-3"><AdminBadge value={p.status} label={p.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
