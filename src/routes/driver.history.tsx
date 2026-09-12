import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Truck, Search, MapPin, Clock, Route as RouteIcon, Download } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { useMissions } from "@/data/store";
import { restaurants, farmers } from "@/data/mocks";
import { formatFCFA } from "@/lib/format";
import { downloadCsv } from "@/lib/export";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

function HistoryPage() {
  const all = useMissions();
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState("all");

  const items = useMemo(() => {
    return all
      .filter((m) => m.driverId === "d1" && m.status === "delivered")
      .filter(
        (m) =>
          q === "" ||
          m.reference.toLowerCase().includes(q.toLowerCase()) ||
          m.orderRef.toLowerCase().includes(q.toLowerCase()),
      )
      .filter((m) => {
        if (period === "all") return true;
        const days = period === "7d" ? 7 : 30;
        const cutoff = Date.now() - days * 24 * 3600 * 1000;
        return new Date(m.scheduledFor).getTime() > cutoff;
      });
  }, [all, q, period]);

  const totalEarned = items.reduce((s, m) => s + m.payout, 0);
  const totalKm = items.reduce((s, m) => s + m.distanceKm, 0);

  const exportCsv = () => {
    downloadCsv(
      "historique-livraisons.csv",
      ["Date", "Mission", "Commande", "Départ", "Arrivée", "Distance (km)", "Durée (min)", "Gain"],
      items.map((m) => [
        m.scheduledFor.slice(0, 10),
        m.reference,
        m.orderRef,
        m.pickup.city,
        m.dropoff.city,
        m.distanceKm,
        m.estimatedMinutes,
        m.payout,
      ]),
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Historique de livraisons"
        subtitle={`${items.length} livraison(s) · ${formatFCFA(totalEarned)} générés · ${totalKm} km parcourus`}
        actions={
          <Button variant="outline" className="gap-2" onClick={exportCsv}>
            <Download className="h-4 w-4" />
            Exporter CSV
          </Button>
        }
      />

      <div className="glass rounded-2xl p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Référence mission ou commande…"
            className="pl-9"
          />
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toute période</SelectItem>
            <SelectItem value="7d">7 derniers jours</SelectItem>
            <SelectItem value="30d">30 derniers jours</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="Aucune livraison"
          description="Aucune mission livrée ne correspond à votre recherche."
        />
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Mission</th>
                <th className="text-left p-3">Trajet</th>
                <th className="text-left p-3">Restaurant</th>
                <th className="text-right p-3">Distance</th>
                <th className="text-right p-3">Durée</th>
                <th className="text-right p-3">Gain</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => {
                const r = restaurants.find((x) => x.id === m.restaurantId);
                const f = farmers.find((x) => x.id === m.farmerId);
                return (
                  <tr key={m.id} className="border-t border-border hover:bg-accent/30">
                    <td className="p-3 text-xs text-muted-foreground">
                      {m.scheduledFor.slice(0, 10)}
                    </td>
                    <td className="p-3 font-medium">
                      <Link
                        to="/driver/missions/$missionId"
                        params={{ missionId: m.id }}
                        className="hover:text-primary"
                      >
                        {m.reference}
                      </Link>
                    </td>
                    <td className="p-3 text-xs">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {m.pickup.city} → {m.dropoff.city}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {f?.farm} → {r?.name}
                    </td>
                    <td className="p-3 text-right text-xs">
                      <span className="inline-flex items-center gap-1">
                        <RouteIcon className="h-3 w-3" />
                        {m.distanceKm} km
                      </span>
                    </td>
                    <td className="p-3 text-right text-xs">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {m.estimatedMinutes} min
                      </span>
                    </td>
                    <td className="p-3 text-right font-semibold text-primary">
                      {formatFCFA(m.payout)}
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
