import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { computeDailyOps } from "@/lib/daily-ops";
import { formatFCFA, relativeTime } from "@/lib/format";

export const Route = createFileRoute("/admin/operations")({
  head: () => ({
    meta: [
      { title: "Opérations du jour — Administration Diambar Agro" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OperationsPage,
});

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)} %`);

function OperationsPage() {
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

  const ops = useMemo(
    () => computeDailyOps({ day, restaurantOrders, missions, transactions, disputes, refunds }),
    [day, restaurantOrders, missions, transactions, disputes, refunds],
  );

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
            {urgentTickets.length > 0 && (
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
            {pendingDocs.length > 0 && (
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
          hint="Livrées au plus tard 4 h après le début du créneau"
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

      <div className="glass rounded-2xl p-5">
        <h3 className="font-semibold mb-3">Marge du jour, ligne par ligne</h3>
        <div className="space-y-1.5 text-sm max-w-md">
          {(
            [
              ["Commissions producteurs", ops.margin.commissions],
              ["Frais de livraison facturés", ops.margin.deliveryFees],
              ["Commissions livreurs (20 %)", ops.margin.driverCommissions],
              ["Courses payées aux livreurs", -ops.margin.driverPayouts],
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
