import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Download, Printer, Repeat, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRestaurantOrder, useRecurringOrders, useRestaurantProfile } from "@/data/store";
import { farmers, restaurants } from "@/data/mocks";
import { useAllDisputes, STATUS_LABEL } from "@/data/disputes";
import { formatFCFA } from "@/lib/format";
import { downloadDiambarInvoice } from "@/lib/invoice-pdf";
import { buildInvoiceData, invoiceNumberFor } from "@/lib/invoice-data";

export const Route = createFileRoute("/restaurant/invoices/$invoiceId")({
  head: () => ({ meta: [{ title: "Facture · Restaurant" }] }),
  component: InvoiceDetail,
});

function InvoiceDetail() {
  const { invoiceId } = Route.useParams();
  const { user } = useRouteContext({ from: "/restaurant" });
  const order = useRestaurantOrder(invoiceId);
  const disputes = useAllDisputes();
  const recurringOrders = useRecurringOrders();
  const profile = useRestaurantProfile();

  if (!order)
    return <div className="p-12 text-center text-muted-foreground">Facture introuvable</div>;

  const myRestaurant = restaurants.find((r) => r.name === user.name);
  const farmer = farmers.find((f) => f.id === order.farmerId);
  const dispute = disputes.find((d) => d.orderId === order.id);
  const originRecurring = recurringOrders.find((ro) => ro.generatedOrderIds.includes(order.id));
  const invoiceNo = invoiceNumberFor(order.id);
  const invoiceData = buildInvoiceData(order, farmer, myRestaurant, profile.paymentTermsDays);
  const fmtLongDate = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <Link
          to="/restaurant/invoices"
          className="lg:hidden inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux factures
        </Link>
        <div className="flex items-center gap-2 ml-auto">
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

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Link
          to="/restaurant/orders/$orderId"
          params={{ orderId: order.id }}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition"
        >
          <Truck className="h-3.5 w-3.5" />
          Voir le suivi de la commande
        </Link>
        {originRecurring && (
          <Link
            to="/restaurant/recurring/$recurringOrderId"
            params={{ recurringOrderId: originRecurring.id }}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition"
          >
            <Repeat className="h-3.5 w-3.5" />
            Générée depuis "{originRecurring.name}"
          </Link>
        )}
        {dispute && (
          <Link
            to="/restaurant/disputes/$disputeId"
            params={{ disputeId: dispute.id }}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10 transition"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Litige {dispute.reference} · {STATUS_LABEL[dispute.status]}
          </Link>
        )}
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
            <dd className="font-semibold text-neutral-900">
              {fmtLongDate.format(invoiceData.issuedAt)}
            </dd>
            <dt className="text-neutral-500">Date d'échéance</dt>
            <dd className="font-semibold text-neutral-900">
              {fmtLongDate.format(invoiceData.dueAt)}
            </dd>
            <dt className="text-neutral-500">Commande</dt>
            <dd className="font-semibold text-neutral-900">{order.reference}</dd>
            <dt className="text-neutral-500">Mode de paiement</dt>
            <dd className="font-semibold text-neutral-900">{order.paymentMethod}</dd>
            {order.paid && order.paidAt && (
              <>
                <dt className="text-neutral-500">Payée le</dt>
                <dd className="font-semibold text-emerald-600">
                  {fmtLongDate.format(new Date(order.paidAt))}
                </dd>
              </>
            )}
          </dl>

          {/* Seller / Buyer */}
          <div className="grid grid-cols-2 gap-8 text-[13px]">
            <div className="space-y-1">
              <div className="font-semibold text-neutral-900">{invoiceData.seller.name}</div>
              <div className="text-neutral-500">
                {invoiceData.seller.addressLines.map((l, i) => (
                  <span key={i}>
                    {l}
                    <br />
                  </span>
                ))}
              </div>
              <div className="text-neutral-500">{invoiceData.seller.email}</div>
              <div className="text-[11px] text-neutral-400">{invoiceData.seller.legal}</div>
            </div>
            <div className="space-y-1">
              <div className="text-neutral-500">{invoiceData.buyer.label}</div>
              <div className="font-semibold text-neutral-900 pt-1">{invoiceData.buyer.name}</div>
              <div className="text-neutral-500">
                {invoiceData.buyer.addressLines.map((l, i) => (
                  <span key={i}>
                    {l}
                    <br />
                  </span>
                ))}
              </div>
              <div className="text-neutral-500">{invoiceData.buyer.email}</div>
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
                <span>{formatFCFA(invoiceData.subtotalHT)}</span>
              </div>
              <div className="flex justify-between text-neutral-500">
                <span>TVA ({invoiceData.vatRate}%)</span>
                <span>{formatFCFA(invoiceData.vat)}</span>
              </div>
              <div className="flex justify-between font-semibold text-neutral-900">
                <span>Total TTC</span>
                <span>{formatFCFA(invoiceData.totalTTC)}</span>
              </div>
              <div className="flex justify-between font-bold text-neutral-900">
                <span>Montant dû</span>
                <span>{formatFCFA(invoiceData.amountDue)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="border-t border-neutral-200 pt-4 flex justify-between text-[11px] text-neutral-400">
            <span>{invoiceData.seller.legal}</span>
            <span>Page 1 sur 1</span>
          </footer>
        </div>
      </article>
    </div>
  );
}
