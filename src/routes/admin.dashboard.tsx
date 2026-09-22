import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Users,
  ShoppingBag,
  Wallet,
  Scale,
  ShieldCheck,
  ArrowRight,
  Truck,
  TriangleAlert,
  PackageSearch,
  LifeBuoy,
  Undo2,
  MapPin,
  Receipt,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/farmer/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { DiambarMapLazy } from "@/components/maps/diambar-map-lazy";
import { formatFCFA, relativeTime } from "@/lib/format";
import { dayKey, addDays } from "@/lib/driver-day";
import { computeCommission } from "@/lib/commission";
import {
  useAuditLogs,
  usePlatformUsers,
  useValidations,
  useModerationQueue,
  useCommissionTiers,
} from "@/data/admin-store";
import { useAllDisputes } from "@/data/disputes";
import { useIncidents } from "@/data/business";
import { useRefunds } from "@/data/finance";
import { AUDIT_LEVEL_DOT } from "@/data/admin-mocks";
import { useSupportTickets } from "@/data/support";
import { useOrders, useMissions } from "@/data/store";
import { payouts } from "@/data/admin-mocks";
import { drivers, farmers, restaurants, type MissionStatus } from "@/data/mocks";
import { ROLE_COLOR, ROLE_LABEL } from "@/lib/role-colors";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Vue d'ensemble — Administration Diambar Agro" },
      {
        name: "description",
        content:
          "Centre de contrôle Diambar Agro : ventes, livraisons, finance et actions à traiter, en direct.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminDashboard,
});

const ACTIVE_LABEL: Record<string, string> = {
  accepted: "Collecte",
  pickup: "Collecte",
  loaded: "En livraison",
};

function pct(current: number, previous: number) {
  if (previous <= 0) return undefined;
  return Math.round(((current - previous) / previous) * 100);
}

function AdminDashboard() {
  const users = usePlatformUsers();
  const validations = useValidations();
  const disputes = useAllDisputes();
  const incidents = useIncidents();
  const tickets = useSupportTickets();
  const moderation = useModerationQueue();
  const refunds = useRefunds();
  const logs = useAuditLogs();
  const orders = useOrders();
  const missions = useMissions();
  const tiers = useCommissionTiers();

  const delivered = orders.filter((o) => o.status === "delivered");
  const gmv = delivered.reduce((s, o) => s + o.total, 0);
  const commission = computeCommission(orders, tiers);
  const active = users.filter((u) => u.status === "active").length;
  const pendingValidations = validations.filter((v) => v.status === "pending");
  const openDisputes = disputes.filter((d) => d.status === "open" || d.status === "investigating");
  const openTickets = tickets.filter((t) => t.status === "open");
  const pendingIncidents = incidents.filter((i) => i.status !== "resolved");
  const pendingModeration = moderation.filter((m) => m.status === "pending");
  const actionsRequired =
    pendingValidations.length +
    openDisputes.length +
    openTickets.length +
    pendingIncidents.length +
    pendingModeration.length;

  const pendingPayouts = payouts.filter((p) => p.status !== "Payé");
  const pendingPayoutsTotal = pendingPayouts.reduce((s, p) => s + p.amount, 0);
  const pendingRefundsTotal = refunds
    .filter((r) => r.status === "pending")
    .reduce((s, r) => s + r.amount, 0);

  // Les commandes de démo ne couvrent que 2 jours réels : on ancre "aujourd'hui"
  // sur le jour de la commande la plus récente (comme le fait déjà le portail
  // livreur avec referenceDay), plutôt que sur l'horloge système qui ne
  // correspondrait à aucune donnée. On ne compare que le nombre de commandes :
  // le GMV et la commission ne comptent que les commandes déjà *livrées*, donc
  // comparer "aujourd'hui" à "hier" y ferait presque toujours apparaître une
  // fausse chute de -100 % tant que les commandes du jour n'ont pas fini leur
  // cycle de livraison — un delta n'est affiché que quand il mesure vraiment
  // quelque chose, jamais un pourcentage trompeur.
  const ordersDelta = useMemo(() => {
    if (orders.length === 0) return undefined;
    const today = orders.reduce((a, b) => (a.createdAt > b.createdAt ? a : b)).createdAt;
    const todayKey = dayKey(today);
    const yesterdayKey = addDays(todayKey, -1);
    const todayOrders = orders.filter((o) => dayKey(o.createdAt) === todayKey);
    const yesterdayOrders = orders.filter((o) => dayKey(o.createdAt) === yesterdayKey);
    if (yesterdayOrders.length === 0) return undefined;
    return pct(todayOrders.length, yesterdayOrders.length);
  }, [orders]);

  const activeMissions = missions.filter((m) =>
    (["accepted", "pickup", "loaded"] as MissionStatus[]).includes(m.status),
  );
  const waitingMissions = missions.filter((m) => m.status === "available").length;
  const collecte = activeMissions.filter(
    (m) => m.status === "accepted" || m.status === "pickup",
  ).length;
  const enLivraison = activeMissions.filter((m) => m.status === "loaded").length;

  const gmvByDay = useMemo(() => {
    const totals = new Map<string, number>();
    for (const o of orders) {
      totals.set(dayKey(o.createdAt), (totals.get(dayKey(o.createdAt)) ?? 0) + o.total);
    }
    return Array.from(totals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, total]) => ({
        day: new Date(day).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
        total,
      }));
  }, [orders]);

  const roleSplit = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of users) counts.set(u.role, (counts.get(u.role) ?? 0) + 1);
    return Array.from(counts.entries()).map(([role, value]) => ({ role, value }));
  }, [users]);

  const statusSplit = useMemo(() => {
    const counts = { active: 0, pending: 0, suspended: 0, rejected: 0 };
    for (const u of users) counts[u.status] = (counts[u.status] ?? 0) + 1;
    return counts;
  }, [users]);

  const recentOrders = [...orders].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 5);

  const actionRows = [
    {
      key: "validations",
      icon: ShieldCheck,
      label: "Validations en attente",
      count: pendingValidations.length,
      oldest: [...pendingValidations].sort((a, b) => (a.submittedAt < b.submittedAt ? -1 : 1))[0]
        ?.submittedAt,
      to: "/admin/validations",
      action: "Examiner",
    },
    {
      key: "disputes",
      icon: Scale,
      label: "Litiges ouverts",
      count: openDisputes.length,
      oldest: [...openDisputes].sort((a, b) => (a.openedAt < b.openedAt ? -1 : 1))[0]?.openedAt,
      to: "/admin/disputes",
      action: "Traiter",
    },
    {
      key: "tickets",
      icon: LifeBuoy,
      label: "Tickets support ouverts",
      count: openTickets.length,
      oldest: [...openTickets].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))[0]?.createdAt,
      to: "/admin/support",
      action: "Répondre",
    },
    {
      key: "incidents",
      icon: TriangleAlert,
      label: "Incidents à traiter",
      count: pendingIncidents.length,
      oldest: [...pendingIncidents].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))[0]
        ?.createdAt,
      to: "/admin/incidents",
      action: "Traiter",
    },
    {
      key: "moderation",
      icon: PackageSearch,
      label: "Produits signalés",
      count: pendingModeration.length,
      oldest: [...pendingModeration]
        .map((m) => m.reports[0]?.at ?? m.events[0]?.at ?? "")
        .sort()[0],
      to: "/admin/moderation",
      action: "Modérer",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vue d'ensemble"
        subtitle="Centre de contrôle Diambar Agro — calculé en direct sur les données de la plateforme"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Volume d'affaires (livré)"
          value={formatFCFA(gmv)}
          icon={Wallet}
          hint={`${delivered.length} commande(s) livrée(s)`}
        />
        <StatCard
          label="Commandes"
          value={String(orders.length)}
          icon={ShoppingBag}
          delta={ordersDelta}
          hint={`${delivered.length} livrées · ${orders.length - delivered.length} en cours/annulées`}
        />
        <StatCard
          label="Livraisons actives"
          value={String(activeMissions.length)}
          icon={Truck}
          hint={`${collecte} collecte · ${enLivraison} en livraison · ${waitingMissions} en attente`}
        />
        <StatCard
          label="Revenu commissions"
          value={formatFCFA(commission)}
          icon={Scale}
          hint="Barème dégressif réel par producteur"
        />
        <StatCard
          label="Utilisateurs actifs"
          value={String(active)}
          icon={Users}
          hint={`${users.length} comptes au total`}
        />
        <StatCard
          label="Actions requises"
          value={String(actionsRequired)}
          icon={TriangleAlert}
          hint={
            actionsRequired === 0
              ? "Rien à traiter"
              : `${pendingValidations.length} validations · ${openDisputes.length} litiges · ${openTickets.length} tickets · ${pendingIncidents.length} incidents`
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <h2 className="font-semibold">Volume d'affaires par jour</h2>
          <p className="text-xs text-muted-foreground">GMV de toutes les commandes, tous statuts</p>
          <div className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={gmvByDay}>
                <defs>
                  <linearGradient id="gmvGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
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
                  tickFormatter={(v) => `${v / 1000}k`}
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
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="url(#gmvGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <h2 className="font-semibold">Utilisateurs</h2>
          <p className="text-xs text-muted-foreground">Par rôle et par statut</p>
          <div className="h-48 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={roleSplit}
                  dataKey="value"
                  nameKey="role"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                >
                  {roleSplit.map((s) => (
                    <Cell key={s.role} fill={ROLE_COLOR[s.role] ?? "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-1.5 mt-1">
            {roleSplit.map((s) => (
              <li key={s.role} className="flex items-center gap-2 text-sm">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: ROLE_COLOR[s.role] ?? "#94a3b8" }}
                />
                <span className="flex-1">{ROLE_LABEL[s.role] ?? s.role}</span>
                <span className="font-semibold">{s.value}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span>🟢 {statusSplit.active} actifs</span>
            <span>🟠 {statusSplit.pending} en attente</span>
            <span>🔴 {statusSplit.suspended} suspendus</span>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />
              Centre des livraisons
            </h2>
            <p className="text-xs text-muted-foreground">
              {activeMissions.length} livraison(s) active(s) · {collecte} collecte · {enLivraison}{" "}
              en livraison · {waitingMissions} en attente d'un livreur
            </p>
          </div>
          <Link
            to="/admin/deliveries"
            className="text-xs text-primary font-medium inline-flex items-center gap-1 shrink-0"
          >
            Voir toutes les livraisons <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {activeMissions.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Aucune livraison active pour le moment.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
            <DiambarMapLazy
              markers={activeMissions.map((m) => ({
                id: m.id,
                lat: m.dropoff.lat,
                lng: m.dropoff.lng,
                label: drivers.find((d) => d.id === m.driverId)?.name.charAt(0) ?? "?",
                color: m.status === "loaded" ? "emerald" : "amber",
              }))}
              minHeight={220}
              zoom={9}
              fitBounds
            />
            <ul className="space-y-2">
              {activeMissions.slice(0, 4).map((m) => {
                const driver = drivers.find((d) => d.id === m.driverId);
                return (
                  <li key={m.id}>
                    <Link
                      to="/admin/deliveries"
                      className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-accent transition"
                    >
                      <img
                        src={driver?.avatar}
                        alt=""
                        className="h-9 w-9 rounded-full object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {m.reference} · {driver?.name ?? "—"}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {m.pickup.city} → {m.dropoff.city}
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-muted-foreground shrink-0">
                        {ACTIVE_LABEL[m.status] ?? m.status}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <h2 className="font-semibold flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 text-amber-500" />À traiter maintenant
          </h2>
          <ul className="mt-4 divide-y divide-border">
            {actionRows.map((row) => (
              <li key={row.key} className="flex items-center gap-3 py-3">
                <div
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${row.count > 0 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"}`}
                >
                  <row.icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">
                    {row.count > 0 ? `${row.count} ${row.label.toLowerCase()}` : row.label}
                  </div>
                  {row.count > 0 && row.oldest && (
                    <div className="text-[11px] text-muted-foreground">
                      Le plus ancien : {relativeTime(row.oldest)}
                    </div>
                  )}
                  {row.count === 0 && (
                    <div className="text-[11px] text-muted-foreground">Rien en attente</div>
                  )}
                </div>
                {row.count > 0 && (
                  <Link
                    to={row.to}
                    className="shrink-0 text-xs font-semibold text-primary hover:underline"
                  >
                    {row.action}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-primary" />
              Commandes récentes
            </h2>
            <Link
              to="/admin/orders"
              className="text-xs text-primary font-medium inline-flex items-center gap-1"
            >
              Tout voir <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-border">
            {recentOrders.length === 0 && (
              <li className="text-sm text-muted-foreground py-2">Aucune commande.</li>
            )}
            {recentOrders.map((o) => {
              const farmer = farmers.find((f) => f.id === o.farmerId);
              const restaurant = restaurants.find((r) => r.id === o.restaurantId);
              return (
                <li key={o.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {o.reference} · {restaurant?.name ?? "—"}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {farmer?.farm ?? farmer?.name ?? "—"} · {relativeTime(o.createdAt)}
                    </div>
                  </div>
                  <span className="font-semibold text-sm shrink-0">{formatFCFA(o.total)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Finance
            </h2>
            <Link
              to="/admin/finance"
              className="text-xs text-primary font-medium inline-flex items-center gap-1"
            >
              Voir la finance <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="mt-4 space-y-2.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">GMV livré</span>
              <span className="font-semibold">{formatFCFA(gmv)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Commissions (barème réel)</span>
              <span className="font-semibold">{formatFCFA(commission)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5" /> Versements en attente
              </span>
              <span className="font-semibold">
                {formatFCFA(pendingPayoutsTotal)} · {pendingPayouts.length} opé.
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Undo2 className="h-3.5 w-3.5" /> Remboursements en attente
              </span>
              <span className="font-semibold">{formatFCFA(pendingRefundsTotal)}</span>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Activité récente</h2>
            <Link
              to="/admin/logs"
              className="text-xs text-primary font-medium inline-flex items-center gap-1"
            >
              Journal complet <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-border">
            {logs.slice(0, 5).map((l) => (
              <li key={l.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className={`h-2 w-2 rounded-full ${AUDIT_LEVEL_DOT[l.level]}`} />
                <span className="flex-1 truncate">
                  {l.action} — <span className="text-muted-foreground">{l.target}</span>
                </span>
                <span className="text-[11px] text-muted-foreground shrink-0">
                  {relativeTime(l.at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
