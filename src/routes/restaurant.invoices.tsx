import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Download, Search, Filter, AlertTriangle, Send } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/farmer/page-header";
import { useRestaurantOrders } from "@/data/store";
import { farmers, products } from "@/data/mocks";
import { formatFCFA } from "@/lib/format";
import { downloadDiambarInvoice, type InvoiceData } from "@/lib/invoice-pdf";

export const Route = createFileRoute("/restaurant/invoices")({
  head: () => ({ meta: [{ title: "Factures · Restaurant" }] }),
  component: InvoicesList,
});

function invoiceNumberFor(id: string) {
  return `FAC-2025-${id.slice(-3).toUpperCase().padStart(3, "0")}`;
}

function InvoicesList() {
  const orders = useRestaurantOrders();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "paid" | "pending">("all");
  const [period, setPeriod] = useState<"all" | "Q1" | "Q2" | "Q3" | "Q4" | "year">("all");

  const paidOrders = useMemo(() => orders.filter((o) => o.status === "delivered" || o.status === "delivering"), [orders]);
  const nowYear = new Date().getFullYear();
  const isOverdue = (o: typeof orders[number]) => {
    if (o.status === "delivered") return false;
    const days = (Date.now() - new Date(o.createdAt).getTime()) / 86400_000;
    return days > 14;
  };
  const inPeriod = (o: typeof orders[number]) => {
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
  const filtered = useMemo(() => {
    const src = status === "paid" ? paidOrders : status === "pending" ? orders.filter((o) => o.status === "pending" || o.status === "preparing" || o.status === "confirmed") : orders;
    return src.filter(inPeriod).filter((o) => (o.reference + invoiceNumberFor(o.id)).toLowerCase().includes(q.toLowerCase()));
  }, [orders, paidOrders, q, status, period]);

  const overdue = orders.filter(isOverdue);

  const totalPaid = paidOrders.reduce((s, o) => s + o.total, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Factures"
        subtitle={`${paidOrders.length} factures payées · ${formatFCFA(totalPaid)} au total`}
      />

      {overdue.length > 0 && (
        <div className="glass rounded-2xl p-4 flex items-center gap-3 border border-amber-500/30 bg-amber-500/5">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <div className="flex-1 text-sm">
            <b>{overdue.length} facture(s) en retard</b> — plus de 14 jours sans règlement
          </div>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => toast.success(`Relance envoyée pour ${overdue.length} facture(s)`)}>
            <Send className="h-3.5 w-3.5" />Relancer tout
          </Button>
        </div>
      )}

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
        <select value={period} onChange={(e) => setPeriod(e.target.value as typeof period)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
          <option value="all">Toutes périodes</option>
          <option value="year">Année {nowYear}</option>
          <option value="Q1">T1 (Jan-Mar)</option>
          <option value="Q2">T2 (Avr-Juin)</option>
          <option value="Q3">T3 (Juil-Sep)</option>
          <option value="Q4">T4 (Oct-Déc)</option>
        </select>
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
              <Button variant="ghost" size="sm" onClick={() => {
                  const subtotal = o.items.reduce((s, i) => s + i.qty * i.price, 0);
                  const vat = Math.round(subtotal * 0.18);
                  const total = subtotal + vat;
                  const isPaid = o.status === "delivered" || o.status === "delivering";
                  const issued = new Date(o.createdAt);
                  const data: InvoiceData = {
                    number: invoiceNumberFor(o.id),
                    issuedAt: issued,
                    dueAt: new Date(issued.getTime() + 14 * 86400_000),
                    orderRef: o.reference,
                    seller: { name: "DIAMBAR AGRO SARL", addressLines: ["Immeuble Plateau, Avenue Léopold Sédar Senghor,", "Dakar, Sénégal"], email: "contact@diambar.sn", legal: "NINEA 008772341 · RC DKR-2024-B-12847" },
                    buyer: { label: "Destinataire", name: "Le Baobab SARL", addressLines: ["12 Avenue Léopold Sédar Senghor, Dakar Plateau,", "Sénégal"], email: "baobab@diambar.sn" },
                    paidBanner: isPaid ? `${new Intl.NumberFormat("fr-FR").format(total)} FCFA payés` : `${new Intl.NumberFormat("fr-FR").format(total)} FCFA à payer`,
                    items: o.items.map((it) => {
                      const p = products.find((x) => x.id === it.productId);
                      return { name: p?.name ?? it.productId, sub: `Commande ${o.reference} · ${f?.name ?? ""}`, qty: String(it.qty), qtyUnit: p?.unit, unitPrice: it.price, amount: it.qty * it.price };
                    }),
                    subtotalHT: subtotal, vat, vatRate: 18, totalTTC: total, amountDue: isPaid ? 0 : total,
                  };
                  downloadDiambarInvoice(`${data.number}.pdf`, data);
                }}><Download className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}