import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { AlertTriangle, Download, Filter, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/farmer/page-header";
import { useRestaurantOrders, useRestaurantProfile } from "@/data/store";
import { farmers } from "@/data/mocks";
import { useAllDisputes } from "@/data/disputes";
import { formatFCFA } from "@/lib/format";
import { downloadCsv } from "@/lib/export";
import { invoiceNumberFor, isInvoiceOverdue } from "@/lib/invoice-data";

export const Route = createFileRoute("/restaurant/invoices")({
  head: () => ({
    meta: [
      { title: "Factures · Restaurant · Diambar Agro" },
      {
        name: "description",
        content: "Suivez vos factures fournisseurs, leur statut de paiement réel et exportez-les.",
      },
    ],
  }),
  component: InvoicesLayout,
});

function InvoicesLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const orders = useRestaurantOrders();
  const profile = useRestaurantProfile();
  const disputes = useAllDisputes();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "paid" | "pending" | "disputed">("all");
  const [period, setPeriod] = useState<"all" | "Q1" | "Q2" | "Q3" | "Q4" | "year">("all");

  const disputedOrderIds = useMemo(
    () => new Set(disputes.filter((d) => d.orderId).map((d) => d.orderId)),
    [disputes],
  );

  const nowYear = new Date().getFullYear();
  const overdue = orders.filter((o) => isInvoiceOverdue(o, profile.paymentTermsDays));
  const unpaidCash = orders.filter((o) => !o.paid);
  const paidOrders = orders.filter((o) => o.paid);
  const totalInvoiced = orders.reduce((s, o) => s + o.total, 0);
  const totalPaid = paidOrders.reduce((s, o) => s + o.total, 0);
  const thisMonth = orders.filter((o) => {
    const d = new Date(o.createdAt);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });

  const filtered = useMemo(() => {
    const inPeriod = (o: (typeof orders)[number]) => {
      if (period === "all") return true;
      const d = new Date(o.createdAt);
      if (d.getFullYear() !== nowYear) return false;
      if (period === "year") return true;
      const m = d.getMonth();
      if (period === "Q1") return m <= 2;
      if (period === "Q2") return m >= 3 && m <= 5;
      if (period === "Q3") return m >= 6 && m <= 8;
      return m >= 9;
    };
    const src =
      status === "paid"
        ? orders.filter((o) => o.paid)
        : status === "pending"
          ? orders.filter((o) => !o.paid)
          : status === "disputed"
            ? orders.filter((o) => disputedOrderIds.has(o.id))
            : orders;
    return src
      .filter(inPeriod)
      .filter((o) =>
        (o.reference + invoiceNumberFor(o.id)).toLowerCase().includes(q.toLowerCase()),
      );
  }, [orders, q, status, period, nowYear, disputedOrderIds]);

  const exportCsv = () => {
    downloadCsv(
      "factures-diambar.csv",
      ["N° Facture", "Commande", "Fournisseur", "Date", "Montant", "Mode de paiement", "Statut"],
      filtered.map((o) => {
        const f = farmers.find((x) => x.id === o.farmerId);
        return [
          invoiceNumberFor(o.id),
          o.reference,
          f?.farm ?? "—",
          new Date(o.createdAt).toLocaleDateString("fr-FR"),
          o.total,
          o.paymentMethod,
          disputedOrderIds.has(o.id) ? "Contestée" : o.paid ? "Payée" : "En attente",
        ];
      }),
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Factures"
        subtitle={`${paidOrders.length} facture(s) payée(s) · ${formatFCFA(totalPaid)} au total`}
        actions={
          <Button variant="outline" className="gap-2" onClick={exportCsv}>
            <Download className="h-4 w-4" />
            Exporter en CSV
          </Button>
        }
      />

      {overdue.length > 0 && (
        <div className="glass rounded-2xl p-4 flex items-center gap-3 border border-amber-500/30 bg-amber-500/5">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <div className="flex-1 text-sm">
            <b>{overdue.length} facture(s) en espèces en retard</b> — plus de{" "}
            {profile.paymentTermsDays} jours sans livraison, donc sans règlement réel.
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-5 gap-4">
        <div className="glass rounded-2xl p-4">
          <div className="text-xs text-muted-foreground">Total facturé</div>
          <div className="text-2xl font-bold text-primary">{formatFCFA(totalInvoiced)}</div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="text-xs text-muted-foreground">Payé</div>
          <div className="text-2xl font-bold text-emerald-500">{formatFCFA(totalPaid)}</div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="text-xs text-muted-foreground">À payer (espèces)</div>
          <div className="text-2xl font-bold text-amber-500">
            {formatFCFA(unpaidCash.reduce((s, o) => s + o.total, 0))}
          </div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="text-xs text-muted-foreground">En retard</div>
          <div className="text-2xl font-bold text-destructive">{overdue.length}</div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="text-xs text-muted-foreground">Ce mois-ci</div>
          <div className="text-2xl font-bold">
            {formatFCFA(thisMonth.reduce((s, o) => s + o.total, 0))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[420px_1fr] gap-6 items-start">
        <div className="glass rounded-2xl overflow-hidden flex flex-col">
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher une facture…"
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as typeof period)}
                className="h-9 rounded-lg border border-border bg-background px-2 text-xs flex-1"
              >
                <option value="all">Toutes périodes</option>
                <option value="year">Année {nowYear}</option>
                <option value="Q1">T1 (Jan-Mar)</option>
                <option value="Q2">T2 (Avr-Juin)</option>
                <option value="Q3">T3 (Juil-Sep)</option>
                <option value="Q4">T4 (Oct-Déc)</option>
              </select>
            </div>
            <div className="flex items-center gap-1 text-xs flex-wrap">
              <Filter className="h-3.5 w-3.5 text-muted-foreground mr-1" />
              {(["all", "paid", "pending", "disputed"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition ${status === s ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground"}`}
                >
                  {s === "all"
                    ? "Toutes"
                    : s === "paid"
                      ? "Payées"
                      : s === "pending"
                        ? "En attente"
                        : "Contestées"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-auto max-h-[640px]">
            {filtered.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Aucune facture trouvée.
              </div>
            )}
            {filtered.map((o) => {
              const f = farmers.find((x) => x.id === o.farmerId);
              const disputed = disputedOrderIds.has(o.id);
              const isActive = pathname.endsWith(`/invoices/${o.id}`);
              return (
                <Link
                  key={o.id}
                  to="/restaurant/invoices/$invoiceId"
                  params={{ invoiceId: o.id }}
                  className={`block w-full text-left p-3 border-b border-border last:border-0 hover:bg-accent/40 transition ${isActive ? "bg-accent" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold text-sm text-primary">
                      {invoiceNumberFor(o.id)}
                    </span>
                    <span className="font-bold text-sm">{formatFCFA(o.total)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <span className="text-xs text-muted-foreground truncate">
                      {f?.farm ?? "—"} · {new Date(o.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                        disputed
                          ? "bg-destructive/10 text-destructive"
                          : o.paid
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-amber-500/10 text-amber-500"
                      }`}
                    >
                      {disputed ? "Contestée" : o.paid ? "Payée" : "En attente"}
                    </span>
                  </div>
                  {isInvoiceOverdue(o, profile.paymentTermsDays) && !disputed && (
                    <span className="inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      Retard
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="glass rounded-2xl min-h-[500px]">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
