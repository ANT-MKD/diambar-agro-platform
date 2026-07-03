import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Download, Search, Filter } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/farmer/page-header";
import { useRestaurantOrders } from "@/data/store";
import { farmers } from "@/data/mocks";
import { formatFCFA } from "@/lib/format";
import { downloadInvoicePdf } from "@/lib/invoice-pdf";

export const Route = createFileRoute("/restaurant/invoices")({
  head: () => ({ meta: [{ title: "Factures · Restaurant" }] }),
  component: InvoicesList,
});

function invoiceNumberFor(id: string) {
  return `FCT-${id.slice(-4).toUpperCase()}`;
}

function InvoicesList() {
  const orders = useRestaurantOrders();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "paid" | "pending">("all");

  const paidOrders = useMemo(() => orders.filter((o) => o.status === "delivered" || o.status === "delivering"), [orders]);
  const filtered = useMemo(() => {
    const src = status === "paid" ? paidOrders : status === "pending" ? orders.filter((o) => o.status === "pending" || o.status === "preparing" || o.status === "confirmed") : orders;
    return src.filter((o) => (o.reference + invoiceNumberFor(o.id)).toLowerCase().includes(q.toLowerCase()));
  }, [orders, paidOrders, q, status]);

  const totalPaid = paidOrders.reduce((s, o) => s + o.total, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Factures"
        subtitle={`${paidOrders.length} factures payées · ${formatFCFA(totalPaid)} au total`}
      />

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="glass rounded-2xl p-4">
          <div className="text-xs text-muted-foreground">Payées</div>
          <div className="text-2xl font-bold text-emerald-500">{paidOrders.length}</div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="text-xs text-muted-foreground">En attente</div>
          <div className="text-2xl font-bold text-amber-500">{orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled").length}</div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="text-xs text-muted-foreground">Total facturé</div>
          <div className="text-2xl font-bold text-primary">{formatFCFA(totalPaid)}</div>
        </div>
      </div>

      <div className="glass rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une facture ou une commande…" className="pl-9" />
        </div>
        <div className="flex items-center gap-1 text-xs">
          <Filter className="h-3.5 w-3.5 text-muted-foreground mr-1" />
          {(["all", "paid", "pending"] as const).map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={`px-3 py-1.5 rounded-lg font-medium transition ${status === s ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground"}`}>
              {s === "all" ? "Toutes" : s === "paid" ? "Payées" : "En attente"}
            </button>
          ))}
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[1fr_1.2fr_1fr_1fr_120px_140px] items-center px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
          <span>N° Facture</span><span>Fournisseur</span><span>Date</span><span>Montant</span><span>Statut</span><span className="text-right">Actions</span>
        </div>
        {filtered.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Aucune facture trouvée.</div>}
        {filtered.map((o) => {
          const f = farmers.find((x) => x.id === o.farmerId);
          const paid = o.status === "delivered" || o.status === "delivering";
          return (
            <div key={o.id} className="grid grid-cols-[1fr_1.2fr_1fr_1fr_120px_140px] items-center px-4 py-3 border-b border-border last:border-0 hover:bg-accent/40 transition text-sm">
              <Link to="/restaurant/invoices/$invoiceId" params={{ invoiceId: o.id }} className="font-mono font-semibold text-primary">{invoiceNumberFor(o.id)}</Link>
              <span className="truncate">{f?.farm ?? "—"}</span>
              <span className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleDateString("fr-FR")}</span>
              <span className="font-bold">{formatFCFA(o.total)}</span>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit ${paid ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}>
                {paid ? "Payée" : "En attente"}
              </span>
              <div className="flex items-center justify-end gap-1">
                <Button asChild variant="ghost" size="sm"><Link to="/restaurant/invoices/$invoiceId" params={{ invoiceId: o.id }}><FileText className="h-3.5 w-3.5" /></Link></Button>
                <Button variant="ghost" size="sm" onClick={() => downloadInvoicePdf(
                  `${invoiceNumberFor(o.id)}.pdf`,
                  [
                    "DIAMBAR AGRO — FACTURE",
                    "",
                    `N° Facture : ${invoiceNumberFor(o.id)}`,
                    `Commande   : ${o.reference}`,
                    `Date       : ${new Date(o.createdAt).toLocaleDateString("fr-FR")}`,
                    `Fournisseur: ${f?.farm ?? ""}`,
                    `Livraison  : ${o.deliveryAddress}`,
                    `Paiement   : ${o.paymentMethod}`,
                    "",
                    "----- Articles -----",
                    ...o.items.map((it) => `- Produit ${it.productId}  x${it.qty}  @ ${it.price} FCFA`),
                    "",
                    `TOTAL : ${o.total} FCFA`,
                    "",
                    "Merci pour votre confiance.",
                  ],
                )}><Download className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}