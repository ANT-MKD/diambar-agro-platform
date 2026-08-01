import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, ShoppingBag, Wallet, Scale, ShieldCheck, ArrowRight } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/farmer/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { AdminBadge, RoleBadge } from "@/components/admin/admin-badge";
import { formatFCFA, relativeTime } from "@/lib/format";
import { platformGmv, platformRoleSplit } from "@/data/admin-mocks";
import { useAuditLogs, useDisputes, usePlatformUsers, useValidations } from "@/data/admin-store";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Vue d'ensemble — Administration Diambar Agro" },
      { name: "description", content: "Pilotage de la plateforme : volume d'affaires, utilisateurs, litiges et validations en attente." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const users = usePlatformUsers();
  const validations = useValidations();
  const disputes = useDisputes();
  const logs = useAuditLogs();

  const active = users.filter((u) => u.status === "active").length;
  const gmv = platformGmv[platformGmv.length - 1].gmv;
  const orders = platformGmv[platformGmv.length - 1].orders;
  const commission = Math.round(gmv * 0.11);
  const pendingValidations = validations.filter((v) => v.status === "pending");
  const openDisputes = disputes.filter((d) => d.status === "open" || d.status === "investigating");

  return (
    <div className="space-y-6">
      <PageHeader title="Vue d'ensemble" subtitle="Santé de la plateforme Diambar Agro — mai 2025" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Volume d'affaires (mois)" value={formatFCFA(gmv)} delta={24} icon={Wallet} hint="GMV brut toutes commandes livrées" />
        <StatCard label="Commandes du mois" value={String(orders)} delta={22} icon={ShoppingBag} hint="Moyenne 20 / jour" />
        <StatCard label="Comptes actifs" value={String(active)} delta={18} icon={Users} hint={`${users.length} comptes au total`} />
        <StatCard label="Revenu commissions" value={formatFCFA(commission)} delta={19} icon={Scale} hint="Taux moyen 11 %" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <h2 className="font-semibold">Croissance du volume</h2>
          <p className="text-xs text-muted-foreground">GMV mensuel et nombre de commandes</p>
          <div className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={platformGmv}>
                <defs>
                  <linearGradient id="gmvGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000000}M`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                  formatter={(v: number) => formatFCFA(v)}
                />
                <Area type="monotone" dataKey="gmv" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#gmvGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <h2 className="font-semibold">Répartition des comptes</h2>
          <p className="text-xs text-muted-foreground">Par rôle</p>
          <div className="h-48 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={platformRoleSplit} dataKey="value" nameKey="role" innerRadius={45} outerRadius={70} paddingAngle={3}>
                  {platformRoleSplit.map((s) => (
                    <Cell key={s.role} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-2 mt-2">
            {platformRoleSplit.map((s) => (
              <li key={s.role} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                <span className="flex-1">{s.role}</span>
                <span className="font-semibold">{s.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-violet-500" />Validations en attente</h2>
            <Link to="/admin/validations" className="text-xs text-primary font-medium inline-flex items-center gap-1">Tout voir <ArrowRight className="h-3 w-3" /></Link>
          </div>
          <ul className="mt-4 space-y-2">
            {pendingValidations.length === 0 && <li className="text-sm text-muted-foreground">Aucune demande en attente 🎉</li>}
            {pendingValidations.map((v) => {
              const u = users.find((x) => x.id === v.userId);
              return (
                <li key={v.id}>
                  <Link to="/admin/validations/$validationId" params={{ validationId: v.id }} className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-accent transition">
                    <img src={u?.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{u?.name}</div>
                      <div className="text-[11px] text-muted-foreground">{relativeTime(v.submittedAt)} · {v.docs.length} documents</div>
                    </div>
                    <RoleBadge role={v.type} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2"><Scale className="h-4 w-4 text-amber-500" />Litiges ouverts</h2>
            <Link to="/admin/disputes" className="text-xs text-primary font-medium inline-flex items-center gap-1">Tout voir <ArrowRight className="h-3 w-3" /></Link>
          </div>
          <ul className="mt-4 space-y-2">
            {openDisputes.length === 0 && <li className="text-sm text-muted-foreground">Aucun litige en cours.</li>}
            {openDisputes.map((d) => (
              <li key={d.id}>
                <Link to="/admin/disputes/$disputeId" params={{ disputeId: d.id }} className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-accent transition">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{d.reference} · {d.reason}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{d.openedBy} vs {d.against} · {formatFCFA(d.amount)}</div>
                  </div>
                  <AdminBadge value={d.status} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Activité récente</h2>
          <Link to="/admin/logs" className="text-xs text-primary font-medium inline-flex items-center gap-1">Journal complet <ArrowRight className="h-3 w-3" /></Link>
        </div>
        <ul className="mt-4 divide-y divide-border">
          {logs.slice(0, 5).map((l) => (
            <li key={l.id} className="flex items-center gap-3 py-2.5 text-sm">
              <span className={`h-2 w-2 rounded-full ${l.level === "critical" ? "bg-destructive" : l.level === "warning" ? "bg-amber-500" : "bg-emerald-500"}`} />
              <span className="flex-1">{l.action} — <span className="text-muted-foreground">{l.target}</span></span>
              <span className="text-[11px] text-muted-foreground">{relativeTime(l.at)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}