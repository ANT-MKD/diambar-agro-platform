import { createFileRoute, Link } from "@tanstack/react-router";
import { useHiddenInBase } from "@/data/demo-only";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Clock,
  Scale,
  Banknote,
  TrendingUp,
  PackageCheck,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { Button } from "@/components/ui/button";
import {
  useMissions,
  useRestaurantOrders,
  useTransactions,
  useDocRenewals,
  useOrders,
} from "@/data/store";
import { useAllDisputes } from "@/data/disputes";
import { useRefunds } from "@/data/finance";
import { useSupportTickets } from "@/data/support";
import { market } from "@/data/market-remote";
import { useMarketMode } from "@/data/market-mode";
import { computeDailyOps, deliveryMargins, marginByBracket } from "@/lib/daily-ops";
import { DEFAULT_DELIVERY_PRICING, type DeliveryPricing } from "@/lib/delivery-pricing";
import { formatFCFA, relativeTime } from "@/lib/format";
import { useRules } from "@/data/rules";

export const Route = createFileRoute("/admin/operations")({
  head: () => ({
    meta: [
      { title: "Opérations du jour — Administration Diambar Agro" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OperationsPage,
});

/** Barème en vigueur (base) ou barème par défaut (démonstration). */
function useDeliveryPricing(): DeliveryPricing {
  const { remote } = useMarketMode();
  const [pricing, setPricing] = useState(DEFAULT_DELIVERY_PRICING);
  useEffect(() => {
    if (!remote) return;
    let alive = true;
    void market.deliverySettings().then((res) => {
      if (alive && res.ok) setPricing(res.pricing);
    });
    return () => {
      alive = false;
    };
  }, [remote]);
  return pricing;
}

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)} %`);

function OperationsPage() {
  const hiddenInBase = useHiddenInBase();
  const [offset, setOffset] = useState(0);
  const day = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    return d;
  }, [offset]);
  const restaurantOrders = useRestaurantOrders();
  const farmerOrders = useOrders();
  const missions = useMissions();
  const transactions = useTransactions();
  const disputes = useAllDisputes();
  const refunds = useRefunds();
  const tickets = useSupportTickets();
  const docs = useDocRenewals();

  const driverCommissionRate = useRules().driverPay.commissionRate;
  const ops = useMemo(
    () =>
      computeDailyOps({
        day,
        restaurantOrders,
        missions,
        transactions,
        disputes,
        refunds,
        driverCommissionRate,
      }),
    [day, restaurantOrders, missions, transactions, disputes, refunds, driverCommissionRate],
  );
  const pricing = useDeliveryPricing();
  const margins = useMemo(
    () => deliveryMargins({ day, restaurantOrders, missions, driverCommissionRate }),
    [day, restaurantOrders, missions, driverCommissionRate],
  );
  const losses = useMemo(
    () => margins.filter((d) => d.margin < 0).sort((a, b) => a.margin - b.margin),
    [margins],
  );
  const brackets = useMemo(() => marginByBracket(margins, pricing), [margins, pricing]);

  // Ce qui doit être traité tout de suite, quel que soit le jour affiché.
  const now = Date.now();
  const stalePending = farmerOrders.filter(
    (o) => o.status === "pending" && now - new Date(o.createdAt).getTime() > 4 * 3600_000,
  );
  const staleMissions = ops.unassigned.filter(
    (m) => now - new Date(m.createdAt).getTime() > 2 * 3600_000,
  );
  const urgentTickets = tickets.filter((t) => t.priority === "urgent" && t.status !== "closed");
  const pendingDocs = docs.filter((d) => d.status === "pending");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Opérations du jour"
        subtitle={day.toLocaleDateString("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOffset((o) => o + 1)}>
              Jour précédent
            </Button>
            <Button
              variant="outline"
              disabled={offset === 0}
              onClick={() => setOffset((o) => o - 1)}
            >
              Jour suivant
            </Button>
          </div>
        }
      />

      {(urgentTickets.length > 0 ||
        staleMissions.length > 0 ||
        stalePending.length > 0 ||
        pendingDocs.length > 0) && (
        <div className="glass rounded-2xl p-4 border border-destructive/30 space-y-2">
          <div className="font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />À traiter maintenant
          </div>
          <ul className="text-sm space-y-1">
            {urgentTickets.length > 0 && !hiddenInBase("/admin/support") && (
              <li>
                <Link
                  to="/admin/support"
                  className="text-destructive font-semibold hover:underline"
                >
                  {urgentTickets.length} alerte(s) SOS livreur
                </Link>
              </li>
            )}
            {staleMissions.length > 0 && (
              <li>
                <Link to="/admin/deliveries" className="hover:underline">
                  {staleMissions.length} course(s) sans livreur depuis plus de 2 h
                </Link>
              </li>
            )}
            {stalePending.length > 0 && (
              <li>
                <Link to="/admin/orders" className="hover:underline">
                  {stalePending.length} commande(s) non confirmée(s) par le producteur depuis plus
                  de 4 h
                </Link>
              </li>
            )}
            {pendingDocs.length > 0 && !hiddenInBase("/admin/documents") && (
              <li>
                <Link to="/admin/documents" className="hover:underline">
                  {pendingDocs.length} document(s) livreur à vérifier
                </Link>
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Taux de service"
          value={pct(ops.serviceRate)}
          icon={PackageCheck}
          hint="Quantités livrées et acceptées / commandées (annulations comprises)"
        />
        <StatCard
          label="Ponctualité"
          value={pct(ops.onTimeRate)}
          icon={Clock}
          hint="Livrées au plus tard 1 h après l'heure choisie par le restaurant"
        />
        <StatCard
          label="Litiges ouverts"
          value={`${ops.disputesOpened}`}
          icon={Scale}
          hint={`Soit ${pct(ops.disputeRate)} des livraisons du jour`}
        />
        <StatCard
          label="Espèces à reverser"
          value={formatFCFA(ops.cashToReconcile)}
          icon={Banknote}
          hint="Encaissées par les livreurs, à rapprocher"
        />
        <StatCard
          label="Commandes passées"
          value={`${ops.ordersPlaced}`}
          icon={Activity}
          hint={`${ops.delivered} livrée(s), ${ops.cancelled} annulée(s)`}
        />
        <StatCard label="Volume livré" value={formatFCFA(ops.gmv)} icon={TrendingUp} />
        <StatCard
          label="Marge par commande"
          value={ops.marginPerOrder === null ? "—" : formatFCFA(ops.marginPerOrder)}
          icon={TrendingUp}
          hint="Revenus − coûts de la plateforme, par livraison"
        />
        <StatCard
          label="Courses sans livreur"
          value={`${ops.unassigned.length}`}
          icon={AlertTriangle}
          hint={
            ops.unassigned[0]
              ? `La plus ancienne : ${relativeTime(ops.unassigned[0].createdAt)}`
              : undefined
          }
        />
      </div>

      <div className="glass rounded-2xl p-5" data-testid="bracket-margins">
        <h3 className="font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Marge des livraisons par distance
        </h3>
        {brackets.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Aucune course ce jour-là.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Tranche</th>
                  <th className="py-2 pr-3 text-right">Courses</th>
                  <th className="py-2 pr-3 text-right">Frais payés</th>
                  <th className="py-2 pr-3 text-right">Coût des courses</th>
                  <th className="py-2 text-right">Marge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {brackets.map((b) => (
                  <tr key={b.label}>
                    <td className="py-2 pr-3">{b.label}</td>
                    <td className="py-2 pr-3 text-right">{b.count}</td>
                    <td className="py-2 pr-3 text-right">{formatFCFA(b.fees)}</td>
                    <td className="py-2 pr-3 text-right">{formatFCFA(b.costs)}</td>
                    <td
                      className={`py-2 text-right font-semibold ${b.margin < 0 ? "text-rose-600" : "text-emerald-600"}`}
                    >
                      {formatFCFA(b.margin)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div
        className={`glass rounded-2xl p-5 ${losses.length ? "border border-rose-500/30" : ""}`}
        data-testid="loss-deliveries"
      >
        <h3 className="font-semibold flex items-center gap-2">
          <AlertTriangle
            className={`h-4 w-4 ${losses.length ? "text-rose-600" : "text-muted-foreground"}`}
          />
          Livraisons à perte
        </h3>
        {losses.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Aucune course de ce jour ne coûte plus que les frais de livraison payés par le
            restaurant.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm">
              <span className="font-semibold text-rose-600">
                {losses.length} course(s) · {formatFCFA(losses.reduce((s, l) => s + l.margin, 0))}
              </span>{" "}
              <span className="text-muted-foreground">
                : la course payée au livreur (commission déduite) dépasse les frais facturés au
                restaurant. Vérifiez le barème et la position des lieux (
                <Link to="/admin/delivery-pricing" className="underline">
                  Tarifs de livraison
                </Link>
                ) ou regroupez les commandes d'un même trajet.
              </span>
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Course</th>
                    <th className="py-2 pr-3">Trajet</th>
                    <th className="py-2 pr-3 text-right">Distance · poids</th>
                    <th className="py-2 pr-3 text-right">Frais payés</th>
                    <th className="py-2 pr-3 text-right">Coût de la course</th>
                    <th className="py-2 text-right">Écart</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {losses.map((l) => (
                    <tr key={l.mission.id}>
                      <td className="py-2 pr-3">
                        <Link
                          to="/admin/deliveries/$missionId"
                          params={{ missionId: l.mission.id }}
                          className="font-medium hover:underline"
                        >
                          {l.mission.reference}
                        </Link>
                        <div className="text-xs text-muted-foreground">{l.mission.orderRef}</div>
                      </td>
                      <td className="py-2 pr-3">
                        {l.mission.pickup.city} → {l.mission.dropoff.city}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {l.mission.distanceKm} km · {l.mission.weightKg} kg
                      </td>
                      <td className="py-2 pr-3 text-right">{formatFCFA(l.fee)}</td>
                      <td className="py-2 pr-3 text-right">{formatFCFA(l.cost)}</td>
                      <td className="py-2 text-right font-semibold text-rose-600">
                        {formatFCFA(l.margin)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="glass rounded-2xl p-5">
        <h3 className="font-semibold mb-3">Marge du jour, ligne par ligne</h3>
        <div className="space-y-1.5 text-sm max-w-md">
          {(
            [
              ["Commissions producteurs", ops.margin.commissions],
              ["Frais de livraison facturés", ops.margin.deliveryFees],
              [`Commissions livreurs (${driverCommissionRate} %)`, ops.margin.driverCommissions],
              ["Courses payées aux livreurs", -ops.margin.driverPayouts],
              ["Attente payée aux livreurs", -ops.margin.waitPay],
              ["Promos et avoirs", -ops.margin.discounts],
              ["Remboursements à la charge de la plateforme", -ops.margin.platformRefunds],
            ] as const
          ).map(([label, v]) => (
            <div key={label} className="flex justify-between">
              <span className="text-muted-foreground">{label}</span>
              <span className={v < 0 ? "text-rose-600" : ""}>
                {v < 0 ? "−" : "+"}
                {formatFCFA(Math.abs(v))}
              </span>
            </div>
          ))}
          <div className="flex justify-between font-bold border-t border-border pt-2">
            <span>Marge</span>
            <span className={ops.margin.total < 0 ? "text-rose-600" : "text-emerald-600"}>
              {formatFCFA(ops.margin.total)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
