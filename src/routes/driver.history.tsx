import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Truck,
  Search,
  MapPin,
  Clock,
  Route as RouteIcon,
  Download,
  Star,
  Wallet,
  Target,
  Gauge,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { useMissions, useDriverWallet } from "@/data/store";
import { useAllDisputes } from "@/data/disputes";
import { restaurants, farmers, driverProfile } from "@/data/mocks";
import { formatFCFA } from "@/lib/format";
import { downloadCsv } from "@/lib/export";
import { dayKey, addDays, referenceDay } from "@/lib/driver-day";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/driver/history")({
  head: () => ({ meta: [{ title: "Historique · Livreur Diambar" }] }),
  component: HistoryPage,
});

type Tab = "all" | "delivered" | "cancelled" | "disputed";
type Period = "7d" | "30d" | "all";

const OPEN_DISPUTE_STATUSES = new Set(["open", "investigating", "awaiting_response"]);

function HistoryPage() {
  const all = useMissions();
  const wallet = useDriverWallet();
  const disputes = useAllDisputes();
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState<Period>("7d");
  const [tab, setTab] = useState<Tab>("all");

  const mine = all.filter((m) => m.driverId === "d1");
  const disputedMissionIds = useMemo(
    () =>
      new Set(
        disputes
          .filter((d) => d.missionId && (d.openedByRole === "driver" || d.againstRole === "driver"))
          .filter((d) => OPEN_DISPUTE_STATUSES.has(d.status))
          .map((d) => d.missionId),
      ),
    [disputes],
  );

  // Les missions de démo sont figées dans le passé : "maintenant" est ancré
  // sur la mission la plus récente du livreur plutôt que la date système,
  // sinon les filtres "7/30 derniers jours" ne renverraient jamais rien.
  const { today } = useMemo(() => referenceDay(mine), [mine]);
  const days = period === "7d" ? 7 : period === "30d" ? 30 : null;
  const windowStart = days ? addDays(today, -(days - 1)) : null;
  const prevWindowStart = days ? addDays(today, -(2 * days - 1)) : null;
  const inWindow = (m: (typeof mine)[number], start: string | null, end: string) =>
    (!start || dayKey(m.scheduledFor) >= start) && dayKey(m.scheduledFor) <= end;

  const currentWindow = mine.filter((m) => inWindow(m, windowStart, today));
  const previousWindow =
    days && prevWindowStart
      ? mine.filter((m) => inWindow(m, prevWindowStart, addDays(windowStart!, -1)))
      : [];

  const delivered = currentWindow.filter((m) => m.status === "delivered");
  const cancelled = currentWindow.filter((m) => m.status === "cancelled");
  const prevDelivered = previousWindow.filter((m) => m.status === "delivered");

  const totalEarned = delivered.reduce((s, m) => s + m.payout, 0);
  const totalKm = delivered.reduce((s, m) => s + m.distanceKm, 0);
  const prevEarned = prevDelivered.reduce((s, m) => s + m.payout, 0);
  const prevKm = prevDelivered.reduce((s, m) => s + m.distanceKm, 0);

  const pctDelta = (curr: number, prev: number) =>
    prev !== 0 ? Math.round(((curr - prev) / prev) * 100) : null;
  const deliveredDelta = pctDelta(delivered.length, prevDelivered.length);
  const earnedDelta = pctDelta(totalEarned, prevEarned);
  const kmDelta = pctDelta(totalKm, prevKm);

  const successRate =
    delivered.length + cancelled.length > 0
      ? Math.round((delivered.length / (delivered.length + cancelled.length)) * 100)
      : 100;
  const avgKm = delivered.length > 0 ? Math.round((totalKm / delivered.length) * 10) / 10 : 0;
  const avgPayout = delivered.length > 0 ? Math.round(totalEarned / delivered.length) : 0;

  const revenueByDay = useMemo(() => {
    const totals = new Map<string, { net: number; bonus: number; commission: number }>();
    for (const t of wallet.transactions) {
      if (!["mission", "bonus", "commission"].includes(t.kind)) continue;
      const day = dayKey(t.at);
      const entry = totals.get(day) ?? { net: 0, bonus: 0, commission: 0 };
      if (t.kind === "mission") entry.net += t.amount;
      if (t.kind === "bonus") entry.bonus += t.amount;
      if (t.kind === "commission") entry.commission += Math.abs(t.amount);
      totals.set(day, entry);
    }
    return Array.from(totals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, v]) => ({
        day: new Date(day).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
        ...v,
      }));
  }, [wallet.transactions]);

  const items = useMemo(() => {
    return currentWindow
      .filter((m) => {
        if (tab === "delivered") return m.status === "delivered";
        if (tab === "cancelled") return m.status === "cancelled";
        if (tab === "disputed") return disputedMissionIds.has(m.id);
        return m.status === "delivered" || m.status === "cancelled";
      })
      .filter(
        (m) =>
          q === "" ||
          m.reference.toLowerCase().includes(q.toLowerCase()) ||
          m.orderRef.toLowerCase().includes(q.toLowerCase()),
      )
      .sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor));
  }, [currentWindow, tab, q, disputedMissionIds]);

  const exportCsv = () => {
    downloadCsv(
      "historique-livraisons.csv",
      [
        "Date",
        "Mission",
        "Commande",
        "Départ",
        "Arrivée",
        "Distance (km)",
        "Durée (min)",
        "Gain",
        "Statut",
      ],
      items.map((m) => [
        m.scheduledFor.slice(0, 10),
        m.reference,
        m.orderRef,
        m.pickup.city,
        m.dropoff.city,
        m.distanceKm,
        m.estimatedMinutes,
        m.payout,
        m.status,
      ]),
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Historique & performances"
        subtitle="Retrouvez vos livraisons terminées, vos gains et l'évolution de votre activité."
        actions={
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 derniers jours</SelectItem>
                <SelectItem value="30d">30 derniers jours</SelectItem>
                <SelectItem value="all">Toute période</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-2" onClick={exportCsv}>
              <Download className="h-4 w-4" />
              Exporter
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Truck}
          label="Livraisons terminées"
          value={String(delivered.length)}
          delta={deliveredDelta}
        />
        <KpiCard
          icon={Wallet}
          label="Gains totaux"
          value={formatFCFA(totalEarned)}
          delta={earnedDelta}
        />
        <KpiCard
          icon={RouteIcon}
          label="Distance parcourue"
          value={`${totalKm} km`}
          delta={kmDelta}
        />
        <KpiCard icon={Star} label="Note moyenne" value={`${driverProfile.rating} / 5`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {revenueByDay.length > 0 && (
          <div className="glass rounded-2xl p-5 lg:col-span-2">
            <h3 className="font-display font-bold mb-3">Évolution des revenus</h3>
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={revenueByDay}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatFCFA(v)} />
                  <Legend />
                  <Bar dataKey="net" name="Gains nets" stackId="a" fill="#059669" />
                  <Bar dataKey="bonus" name="Bonus" stackId="a" fill="#3b82f6" />
                  <Bar dataKey="commission" name="Commissions" stackId="a" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="glass rounded-2xl p-5 space-y-3">
          <h3 className="font-display font-bold">Performance récente</h3>
          <PerfRow icon={Truck} label="Livraisons terminées" value={String(delivered.length)} />
          <PerfRow icon={Target} label="Taux de réussite" value={`${successRate}%`} />
          <PerfRow icon={RouteIcon} label="Distance moyenne" value={`${avgKm} km`} />
          <PerfRow icon={Gauge} label="Gain moyen / mission" value={formatFCFA(avgPayout)} />
        </div>
      </div>

      <div className="glass rounded-2xl p-4 flex flex-wrap gap-3 items-center">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="all">Toutes</TabsTrigger>
            <TabsTrigger value="delivered">Livrées</TabsTrigger>
            <TabsTrigger value="cancelled">Annulées</TabsTrigger>
            <TabsTrigger value="disputed">En litige</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Référence mission ou commande…"
            className="pl-9"
          />
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="Aucune livraison"
          description="Aucune mission ne correspond à votre recherche."
        />
      ) : (
        <div className="glass rounded-2xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Mission</th>
                <th className="text-left p-3">Commande</th>
                <th className="text-left p-3">Trajet</th>
                <th className="text-right p-3">Distance</th>
                <th className="text-right p-3">Durée</th>
                <th className="text-right p-3">Gain</th>
                <th className="text-right p-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => {
                const r = restaurants.find((x) => x.id === m.restaurantId);
                const f = farmers.find((x) => x.id === m.farmerId);
                const disputed = disputedMissionIds.has(m.id);
                return (
                  <tr key={m.id} className="border-t border-border hover:bg-accent/30">
                    <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(m.scheduledFor).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="p-3 font-medium whitespace-nowrap">
                      <Link
                        to="/driver/missions/$missionId"
                        params={{ missionId: m.id }}
                        className="hover:text-primary"
                      >
                        {m.reference}
                      </Link>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                      {m.orderRef}
                    </td>
                    <td className="p-3 text-xs">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {f?.farm} → {r?.name}
                      </span>
                    </td>
                    <td className="p-3 text-right text-xs whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <RouteIcon className="h-3 w-3" />
                        {m.distanceKm} km
                      </span>
                    </td>
                    <td className="p-3 text-right text-xs whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {m.estimatedMinutes} min
                      </span>
                    </td>
                    <td className="p-3 text-right font-semibold text-primary whitespace-nowrap">
                      {formatFCFA(m.payout)}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <span
                        className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${
                          disputed
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : m.status === "delivered"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {disputed ? "En litige" : m.status === "delivered" ? "Livrée" : "Annulée"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  delta,
}: {
  icon: typeof Truck;
  label: string;
  value: string;
  delta?: number | null;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="font-display text-2xl font-bold mt-1">{value}</div>
      {typeof delta === "number" && (
        <div className="text-[11px] text-muted-foreground mt-0.5">
          {delta >= 0 ? "+" : ""}
          {delta}% vs période précédente
        </div>
      )}
    </div>
  );
}

function PerfRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Truck;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className="font-semibold text-sm">{value}</span>
    </div>
  );
}
