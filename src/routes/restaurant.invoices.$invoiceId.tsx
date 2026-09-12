import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRestaurantOrder } from "@/data/store";
import { farmers, products } from "@/data/mocks";
import { formatFCFA } from "@/lib/format";
import { downloadDiambarInvoice, type InvoiceData } from "@/lib/invoice-pdf";

export const Route = createFileRoute("/restaurant/invoices/$invoiceId")({
  head: () => ({ meta: [{ title: "Facture · Restaurant" }] }),
  component: InvoiceDetail,
});

function InvoiceDetail() {
  const { invoiceId } = Route.useParams();
  const order = useRestaurantOrder(invoiceId);

  if (!order)
    return (
      <div className="glass rounded-2xl p-12 text-center text-muted-foreground">
        Facture introuvable
      </div>
    );

  const invoiceNo = `FAC-2025-${order.id.slice(-3).toUpperCase().padStart(3, "0")}`;
  const farmer = farmers.find((f) => f.id === order.farmerId);
  const subtotal = order.items.reduce((s, i) => s + i.qty * i.price, 0);
  const vat = Math.round(subtotal * 0.18);
  const total = subtotal + vat;
  const paid = order.status === "delivered" || order.status === "delivering";
  const issued = new Date(order.createdAt);
  const due = new Date(issued.getTime() + 14 * 86400_000);
  const fmtLongDate = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const invoiceData: InvoiceData = {
    number: invoiceNo,
    issuedAt: issued,
    dueAt: due,
    orderRef: order.reference,
    seller: {
      name: "DIAMBAR AGRO SARL",
      addressLines: ["Immeuble Plateau, Avenue Léopold Sédar Senghor,", "Dakar, Sénégal"],
      email: "contact@diambar.sn",
      legal: "NINEA 008772341 · RC DKR-2024-B-12847",
    },
    buyer: {
      label: "Destinataire",
      name: "Le Baobab SARL",
      addressLines: ["12 Avenue Léopold Sédar Senghor, Dakar Plateau,", "Sénégal"],
      email: "baobab@diambar.sn",
    },
    paidBanner: paid
      ? `${new Intl.NumberFormat("fr-FR").format(total)} FCFA payés`
      : `${new Intl.NumberFormat("fr-FR").format(total)} FCFA à payer`,
    items: order.items.map((it) => {
      const p = products.find((x) => x.id === it.productId);
      return {
        name: p?.name ?? it.productId,
        sub: `Commande ${order.reference} · ${farmer?.name ?? ""}`,
        qty: String(it.qty),
        qtyUnit: p?.unit,
        unitPrice: it.price,
        amount: it.qty * it.price,
      };
    }),
    subtotalHT: subtotal,
    vat,
    vatRate: 18,
    totalTTC: total,
    amountDue: paid ? 0 : total,
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm" className="gap-2">
          <Link to="/restaurant/invoices">
            <ArrowLeft className="h-4 w-4" />
            Retour aux factures
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Imprimer
          </Button>
          <Button
            className="gap-2"
            onClick={() => downloadDiambarInvoice(`${invoiceNo}.pdf`, invoiceData)}
          >
            <Download className="h-4 w-4" />
            Télécharger PDF
          </Button>
        </div>
      </div>

      {/* On-screen preview — pixel-mirror of the generated PDF */}
      <article className="bg-white text-neutral-900 rounded-2xl shadow-xl print:shadow-none border border-border overflow-hidden">
        <div className="px-12 py-14 space-y-10">
          {/* Header */}
          <header className="flex items-start justify-between gap-6">
            <h1
              className="text-5xl font-black tracking-tight text-neutral-900"
              style={{ fontFamily: "Helvetica, Arial, sans-serif" }}
            >
              Facture
            </h1>
            <div className="text-right">
              <div className="text-lg font-bold text-emerald-600 tracking-tight">DIAMBAR AGRO</div>
              <div className="text-[11px] text-neutral-500 mt-0.5">Logistique alimentaire</div>
            </div>
          </header>

          {/* Info block */}
          <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-2 text-[13px]">
            <dt className="text-neutral-500">Numéro de facture</dt>
            <dd className="font-semibold text-neutral-900">{invoiceNo}</dd>
            <dt className="text-neutral-500">Date d'émission</dt>
            <dd className="font-semibold text-neutral-900">{fmtLongDate.format(issued)}</dd>
            <dt className="text-neutral-500">Date d'échéance</dt>
            <dd className="font-semibold text-neutral-900">{fmtLongDate.format(due)}</dd>
            <dt className="text-neutral-500">Commande</dt>
            <dd className="font-semibold text-neutral-900">{order.reference}</dd>
          </dl>

          {/* Seller / Buyer */}
          <div className="grid grid-cols-2 gap-8 text-[13px]">
            <div className="space-y-1">
              <div className="font-semibold text-neutral-900">DIAMBAR AGRO SARL</div>
              <div className="text-neutral-500">
                Immeuble Plateau, Avenue Léopold Sédar Senghor,
                <br />
                Dakar, Sénégal
              </div>
              <div className="text-neutral-500">contact@diambar.sn</div>
              <div className="text-[11px] text-neutral-400">
                NINEA 008772341 · RC DKR-2024-B-12847
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-neutral-500">Destinataire</div>
              <div className="font-semibold text-neutral-900 pt-1">Le Baobab SARL</div>
              <div className="text-neutral-500">
                12 Avenue Léopold Sédar Senghor, Dakar Plateau,
                <br />
                Sénégal
              </div>
              <div className="text-neutral-500">baobab@diambar.sn</div>
            </div>
          </div>

          {/* Paid banner */}
          <div className="text-3xl font-black tracking-tight text-neutral-900">
            {invoiceData.paidBanner}
          </div>

          {/* Table */}
          <div>
            <div className="border-t border-neutral-200" />
            <div className="grid grid-cols-[1fr_80px_140px_140px] gap-4 py-3 text-[11px] uppercase tracking-wider text-neutral-500">
              <div>Désignation</div>
              <div className="text-right">Qté</div>
              <div className="text-right">Prix unitaire HT</div>
              <div className="text-right">Montant HT</div>
            </div>
            <div className="border-t border-neutral-200" />
            {invoiceData.items.map((it, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_80px_140px_140px] gap-4 py-4 border-b border-neutral-200 text-[13px]"
              >
                <div>
                  <div className="font-semibold text-neutral-900">{it.name}</div>
                  {it.sub && <div className="text-[11px] text-neutral-500 mt-0.5">{it.sub}</div>}
                </div>
                <div className="text-right">
                  <div className="text-neutral-900">
                    {it.qty} {it.qtyUnit}
                  </div>
                </div>
                <div className="text-right text-neutral-900">{formatFCFA(it.unitPrice)}</div>
                <div className="text-right text-neutral-900">{formatFCFA(it.amount)}</div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-72 space-y-2 text-[13px]">
              <div className="flex justify-between text-neutral-500">
                <span>Sous-total HT</span>
                <span>{formatFCFA(subtotal)}</span>
              </div>
              <div className="flex justify-between text-neutral-500">
                <span>TVA (18%)</span>
                <span>{formatFCFA(vat)}</span>
              </div>
              <div className="flex justify-between font-semibold text-neutral-900">
                <span>Total TTC</span>
                <span>{formatFCFA(total)}</span>
              </div>
              <div className="flex justify-between font-bold text-neutral-900">
                <span>Montant dû</span>
                <span>{formatFCFA(paid ? 0 : total)} FCFA</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="border-t border-neutral-200 pt-4 flex justify-between text-[11px] text-neutral-400">
            <span>NINEA 008772341 · RC DKR-2024-B-12847</span>
            <span>Page 1 sur 1</span>
          </footer>
        </div>
      </article>
    </div>
  );
}
