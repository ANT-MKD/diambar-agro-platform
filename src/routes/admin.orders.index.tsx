import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ShoppingBag, Clock, Truck, CheckCircle2, XCircle, Search } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { OrderStatusBadge } from "@/components/farmer/status-badge";
import { formatFCFA } from "@/lib/format";
import { farmers, restaurants, type OrderStatus } from "@/data/mocks";
import { useOrders, useRestaurantOrders } from "@/data/store";
import { useCommissionTiers } from "@/data/admin-store";
import { commissionForOrder, deliveredVolumeByFarmer } from "@/lib/commission";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useRecordedCommissions } from "@/data/store";

export const Route = createFileRoute("/admin/orders/")({
  head: () => ({
    meta: [
      { title: "Toutes les commandes — Administration Diambar Agro" },
      {
        name: "description",
        content: "Vue globale des commandes de la plateforme, tous rôles confondus.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminOrders,
});

const IN_PROGRESS: OrderStatus[] = ["confirmed", "preparing", "delivering"];

function AdminOrders() {
  const orders = useOrders();
  const restaurantOrders = useRestaurantOrders();
  const tiers = useCommissionTiers();
  const recorded = useRecordedCommissions();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | OrderStatus>("all");
  const [farmerId, setFarmerId] = useState("all");
  const [zone, setZone] = useState("all");

  const zones = useMemo(() => Array.from(new Set(restaurants.map((r) => r.city))), []);
  const farmersWithOrders = useMemo(
    () => farmers.filter((f) => orders.some((o) => o.farmerId === f.id)),
    [orders],
  );

  const volumeByFarmer = useMemo(() => deliveredVolumeByFarmer(orders), [orders]);

  const rows = useMemo(() => {
    return orders.filter((o) => {
      const r = restaurants.find((x) => x.id === o.restaurantId);
      const f = farmers.find((x) => x.id === o.farmerId);
      if (status !== "all" && o.status !== status) return false;
      if (farmerId !== "all" && o.farmerId !== farmerId) return false;
      if (zone !== "all" && r?.city !== zone) return false;
      if (q) {
        const haystack = `${o.reference} ${r?.name ?? ""} ${f?.name ?? ""}`.toLowerCase();
        if (!haystack.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [orders, status, farmerId, zone, q]);

  const total = orders.length;
  const pending = orders.filter((o) => o.status === "pending").length;
  const inProgress = orders.filter((o) => IN_PROGRESS.includes(o.status)).length;
  const delivered = orders.filter((o) => o.status === "delivered").length;
  const cancelled = orders.filter((o) => o.status === "cancelled").length;
  const gmv = rows.reduce((s, o) => s + o.total, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Commandes" subtitle="Supervisez toutes les commandes de la plateforme" />

      <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Total" value={String(total)} icon={ShoppingBag} />
        <StatCard label="En attente" value={String(pending)} icon={Clock} />
        <StatCard label="En cours" value={String(inProgress)} icon={Truck} />
        <StatCard label="Livrées" value={String(delivered)} icon={CheckCircle2} />
        <StatCard label="Annulées" value={String(cancelled)} icon={XCircle} />
      </div>

      <div className="glass rounded-2xl p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Référence, client ou producteur…"
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="confirmed">Confirmée</SelectItem>
            <SelectItem value="preparing">Préparation</SelectItem>
            <SelectItem value="delivering">En livraison</SelectItem>
            <SelectItem value="delivered">Livrée</SelectItem>
            <SelectItem value="cancelled">Annulée</SelectItem>
          </SelectContent>
        </Select>
        <Select value={farmerId} onValueChange={setFarmerId}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Producteur" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les producteurs</SelectItem>
            {farmersWithOrders.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.farm ?? f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={zone} onValueChange={setZone}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Zone" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les zones</SelectItem>
            {zones.map((z) => (
              <SelectItem key={z} value={z}>
                {z}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {rows.length} commande(s) · {formatFCFA(gmv)}
        </span>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-3">Référence</th>
              <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Producteur</th>
              <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Client</th>
              <th className="text-right font-medium px-4 py-3">Montant</th>
              <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">Paiement</th>
              <th className="text-right font-medium px-4 py-3 hidden lg:table-cell">Commission</th>
              <th className="text-left font-medium px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((o) => {
              const ro = restaurantOrders.find((x) => x.reference === o.reference);
              return (
                <tr key={o.id} className="hover:bg-accent/50 transition">
                  <td className="px-4 py-3 font-medium">
                    <Link
                      to="/admin/orders/$orderId"
                      params={{ orderId: o.id }}
                      className="text-primary hover:underline"
                    >
                      {o.reference}
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                    {farmers.find((f) => f.id === o.farmerId)?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                    {restaurants.find((r) => r.id === o.restaurantId)?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{formatFCFA(o.total)}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                    {ro?.paymentMethod ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right hidden lg:table-cell text-muted-foreground">
                    {o.status === "delivered"
                      ? formatFCFA(commissionForOrder(o, tiers, volumeByFarmer, recorded))
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={o.status} />
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  Aucune commande ne correspond à ces filtres.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
