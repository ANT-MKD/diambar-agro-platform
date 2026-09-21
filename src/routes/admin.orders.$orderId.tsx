import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  ArrowLeft,
  Check,
  Package,
  Truck,
  MapPin,
  Scale,
  TriangleAlert,
  ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { OrderStatusBadge, ORDER_LABEL } from "@/components/farmer/status-badge";
import { AdminBadge } from "@/components/admin/admin-badge";
import { useOrder, useOrders, useRestaurantOrders, useMissions } from "@/data/store";
import { useAllDisputes } from "@/data/disputes";
import { useIncidents } from "@/data/business";
import { useCommissionTiers } from "@/data/admin-store";
import { commissionForOrder, deliveredVolumeByFarmer } from "@/lib/commission";
import { farmers, restaurants, drivers, products, type OrderStatus } from "@/data/mocks";
import { formatFCFA, relativeTime } from "@/lib/format";

export const Route = createFileRoute("/admin/orders/$orderId")({
  head: () => ({
    meta: [
      { title: "Détail commande — Administration Diambar Agro" },
      {
        name: "description",
        content: "Timeline, participants, articles, finance et livraison d'une commande.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminOrderDetail,
});

const STATUS_FLOW: OrderStatus[] = ["pending", "confirmed", "preparing", "delivering", "delivered"];

function AdminOrderDetail() {
  const { orderId } = Route.useParams();
  const order = useOrder(orderId);
  const allOrders = useOrders();
  const restaurantOrders = useRestaurantOrders();
  const missions = useMissions();
  const disputes = useAllDisputes();
  const incidents = useIncidents();
  const tiers = useCommissionTiers();
  const volumeByFarmer = useMemo(() => deliveredVolumeByFarmer(allOrders), [allOrders]);

  if (!order) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <h2 className="font-semibold">Commande introuvable</h2>
        <Link to="/admin/orders" className="mt-4 inline-block text-sm text-primary">
          Retour
        </Link>
      </div>
    );
  }

  const farmer = farmers.find((f) => f.id === order.farmerId);
  const restaurant = restaurants.find((r) => r.id === order.restaurantId);
  // La commande "producteur" ne connaît pas le mode de paiement ni l'adresse
  // de livraison : ces champs vivent sur le miroir "restaurant" de la même
  // commande, synchronisé par référence (voir data/store.ts).
  const restaurantOrder = restaurantOrders.find((ro) => ro.reference === order.reference);
  // La mission réelle liée à cette commande — c'est elle, pas order.driverId
  // (jamais mis à jour après création), qui reflète le vrai livreur assigné.
  const mission = missions.find((m) => m.orderRef === order.reference);
  const driver = mission?.driverId
    ? drivers.find((d) => d.id === mission.driverId)
    : order.driverId
      ? drivers.find((d) => d.id === order.driverId)
      : null;
  const dispute = disputes.find((d) => d.orderRef === order.reference);
  const incident = mission ? incidents.find((i) => i.missionRef === mission.reference) : null;

  const commission =
    order.status === "delivered" ? commissionForOrder(order, tiers, volumeByFarmer) : 0;
  const farmerRevenue = order.status === "delivered" ? order.total - commission : null;

  const subtotal = order.items.reduce((s, it) => s + it.qty * it.price, 0);
  const statusIdx = STATUS_FLOW.indexOf(order.status);
  const cancelled = order.status === "cancelled";

  const historyAt = (status: OrderStatus) =>
    restaurantOrder?.statusHistory.find((h) => h.status === status)?.at;

  return (
    <div className="space-y-6">
      <Link
        to="/admin/orders"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Commandes
      </Link>

      <PageHeader
        title={`Commande ${order.reference}`}
        subtitle={`${formatFCFA(order.total)} · ${new Date(order.createdAt).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}`}
        actions={<OrderStatusBadge status={order.status} />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="glass rounded-2xl p-5 overflow-x-auto">
            <h2 className="font-semibold mb-4">Progression</h2>
            {cancelled ? (
              <div className="text-sm text-destructive font-medium">Commande annulée</div>
            ) : (
              <ol className="flex items-center min-w-[520px]">
                {STATUS_FLOW.map((s, i) => {
                  const done = i <= statusIdx;
                  const at = historyAt(s);
                  return (
                    <li key={s} className="flex-1 flex items-center">
                      <div className="flex flex-col items-center gap-1.5 flex-1">
                        <div
                          className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold shrink-0 ${done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground border border-border"}`}
                        >
                          {done ? <Check className="h-4 w-4" /> : i + 1}
                        </div>
                        <span
                          className={`text-[11px] font-medium text-center ${done ? "" : "text-muted-foreground"}`}
                        >
                          {ORDER_LABEL[s]}
                        </span>
                        {at && (
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(at).toLocaleTimeString("fr-FR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                      {i < STATUS_FLOW.length - 1 && (
                        <div
                          className={`h-px flex-1 -mt-6 ${i < statusIdx ? "bg-primary" : "bg-border"}`}
                        />
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          <div className="glass rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-border font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              Articles
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-2">Produit</th>
                  <th className="text-right font-medium px-4 py-2">Qté</th>
                  <th className="text-right font-medium px-4 py-2">Prix</th>
                  <th className="text-right font-medium px-4 py-2">Sous-total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {order.items.map((it, i) => {
                  const p = products.find((x) => x.id === it.productId);
                  return (
                    <tr key={i}>
                      <td className="px-4 py-2.5">{p?.name ?? it.productId}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">
                        {it.qty} {p?.unit}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">
                        {formatFCFA(it.price)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium">
                        {formatFCFA(it.qty * it.price)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="glass rounded-2xl p-5 space-y-2">
            <h2 className="font-semibold mb-2">Finance</h2>
            <Row label="Sous-total produits" value={formatFCFA(subtotal)} />
            <Row label="Total commande" value={formatFCFA(order.total)} bold />
            <div className="h-px bg-border my-2" />
            {order.status === "delivered" ? (
              <>
                <Row label="Commission plateforme" value={`- ${formatFCFA(commission)}`} />
                <Row
                  label="Revenu producteur"
                  value={formatFCFA(farmerRevenue ?? 0)}
                  tone="emerald"
                />
                <Row
                  label="Revenu livreur"
                  value={mission ? formatFCFA(mission.payout) : "—"}
                  tone="blue"
                />
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                La commission et les revenus ne sont calculés qu'une fois la commande livrée.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold">Participants</h2>
            <PartyRow
              kind="Client"
              name={restaurant?.name}
              sub={restaurant?.city}
              avatar={restaurant?.avatar}
            />
            <PartyRow
              kind="Producteur"
              name={farmer?.farm ?? farmer?.name}
              sub={farmer?.city}
              avatar={farmer?.avatar}
            />
            <PartyRow
              kind="Livreur"
              name={driver?.name}
              sub={driver ? `${driver.vehicle} enregistré` : "Aucun livreur assigné pour l'instant"}
              avatar={driver?.avatar}
            />
          </div>

          <div className="glass rounded-2xl p-5 space-y-2">
            <h2 className="font-semibold flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              Livraison
            </h2>
            {mission ? (
              <>
                <Row label="Statut" value={mission.status} />
                <Row label="Distance" value={`${mission.distanceKm} km`} />
                <Row label="Durée estimée" value={`${mission.estimatedMinutes} min`} />
                <div className="text-xs text-muted-foreground flex items-start gap-1.5 pt-1">
                  <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  {mission.pickup.address} → {mission.dropoff.address}
                </div>
                <Link
                  to="/admin/deliveries"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline pt-1"
                >
                  Voir les livraisons <ExternalLink className="h-3 w-3" />
                </Link>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucune mission de livraison créée pour cette commande.
              </p>
            )}
          </div>

          {incident && (
            <div className="glass rounded-2xl p-5 space-y-2 border border-amber-500/30">
              <h2 className="font-semibold flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <TriangleAlert className="h-4 w-4" />
                Incident {incident.reference}
              </h2>
              <AdminBadge value={incident.status} />
              <p className="text-sm text-muted-foreground">{incident.description}</p>
              <p className="text-xs text-muted-foreground">
                Signalé {relativeTime(incident.createdAt)}
              </p>
              <Link
                to="/admin/incidents"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Voir l'incident <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}

          {dispute && (
            <div className="glass rounded-2xl p-5 space-y-2 border border-destructive/30">
              <h2 className="font-semibold flex items-center gap-2 text-destructive">
                <Scale className="h-4 w-4" />
                Litige {dispute.reference}
              </h2>
              <AdminBadge value={dispute.status} />
              <p className="text-sm text-muted-foreground">{dispute.subcategory}</p>
              <Link
                to="/admin/disputes/$disputeId"
                params={{ disputeId: dispute.id }}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Voir le litige <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  tone,
}: {
  label: string;
  value: string;
  bold?: boolean;
  tone?: "emerald" | "blue";
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`${bold ? "font-bold text-base" : "font-medium"} ${
          tone === "emerald"
            ? "text-emerald-600 dark:text-emerald-400"
            : tone === "blue"
              ? "text-blue-600 dark:text-blue-400"
              : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function PartyRow({
  kind,
  name,
  sub,
  avatar,
}: {
  kind: string;
  name?: string;
  sub?: string;
  avatar?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {avatar ? (
        <img src={avatar} alt="" className="h-10 w-10 rounded-xl object-cover shrink-0" />
      ) : (
        <div className="h-10 w-10 rounded-xl bg-muted grid place-items-center text-muted-foreground shrink-0">
          <Truck className="h-4 w-4" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {kind}
        </div>
        <div className="text-sm font-medium truncate">{name ?? "—"}</div>
        {sub && <div className="text-xs text-muted-foreground truncate">{sub}</div>}
      </div>
    </div>
  );
}
