import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Download, Printer, Building2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/farmer/page-header";
import { useRestaurantOrder } from "@/data/store";
import { farmers, products } from "@/data/mocks";
import { formatFCFA } from "@/lib/format";
import { downloadInvoicePdf } from "@/lib/invoice-pdf";

export const Route = createFileRoute("/restaurant/invoices/$invoiceId")({
  head: () => ({ meta: [{ title: "Facture · Restaurant" }] }),
  component: InvoiceDetail,
});

function InvoiceDetail() {
  const { invoiceId } = Route.useParams();
  const order = useRestaurantOrder(invoiceId);

  if (!order) return <div className="glass rounded-2xl p-12 text-center text-muted-foreground">Facture introuvable</div>;

  const invoiceNo = `FCT-${order.id.slice(-4).toUpperCase()}`;
  const farmer = farmers.find((f) => f.id === order.farmerId);
  const subtotal = order.items.reduce((s, i) => s + i.qty * i.price, 0);
  const vat = Math.round(subtotal * 0.18);
  const total = subtotal + vat;

  const paid = order.status === "delivered" || order.status === "delivering";

  const pdfLines = [
    "DIAMBAR AGRO — FACTURE",
    "".padEnd(40, "="),
    `N° Facture : ${invoiceNo}`,
    `Commande   : ${order.reference}`,
    `Date       : ${new Date(order.createdAt).toLocaleDateString("fr-FR")}`,
    "",
    "Fournisseur:",
    `  ${farmer?.farm ?? ""}`,
    `  ${farmer?.city ?? ""}`,
    "",
    "Client:",
    "  Le Baobab — Dakar Plateau",
    `  Livraison : ${order.deliveryAddress}`,
    `  Paiement  : ${order.paymentMethod}`,
    "",
    "----- Articles -----",
    ...order.items.map((it) => {
      const p = products.find((x) => x.id === it.productId);
      return `- ${p?.name ?? it.productId}  x${it.qty} ${p?.unit ?? ""}  @ ${it.price} FCFA  = ${it.qty * it.price} FCFA`;
    }),
    "",
    `Sous-total : ${subtotal} FCFA`,
    `TVA 18%    : ${vat} FCFA`,
    `TOTAL      : ${total} FCFA`,
    "",
    `Statut     : ${paid ? "PAYEE" : "EN ATTENTE"}`,
    "",
    "Merci pour votre confiance.",
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={invoiceNo}
        subtitle={`Commande ${order.reference} · ${new Date(order.createdAt).toLocaleDateString("fr-FR")}`}
        actions={
          <>
            <Button asChild variant="outline" className="gap-2"><Link to="/restaurant/invoices"><ArrowLeft className="h-4 w-4" />Retour</Link></Button>
            <Button variant="outline" className="gap-2" onClick={() => window.print()}><Printer className="h-4 w-4" />Imprimer</Button>
            <Button className="gap-2" onClick={() => downloadInvoicePdf(`${invoiceNo}.pdf`, pdfLines)}><Download className="h-4 w-4" />Télécharger PDF</Button>
          </>
        }
      />

      <div className="glass rounded-2xl p-6 space-y-6">
        <div className="flex justify-between items-start flex-wrap gap-4 border-b border-border pb-4">
          <div>
            <div className="text-2xl font-display font-bold text-primary">DIAMBAR AGRO</div>
            <div className="text-xs text-muted-foreground">Plateforme agricole · Sénégal</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold text-muted-foreground uppercase">Facture</div>
            <div className="font-mono font-bold text-lg">{invoiceNo}</div>
            <span className={`inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${paid ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}>
              {paid ? "PAYÉE" : "EN ATTENTE"}
            </span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-6 text-sm">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />Fournisseur</div>
            <div className="font-semibold">{farmer?.farm}</div>
            <div className="text-muted-foreground">{farmer?.name}</div>
            <div className="text-muted-foreground">{farmer?.city}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1"><Truck className="h-3.5 w-3.5" />Livraison</div>
            <div className="font-semibold">Le Baobab</div>
            <div className="text-muted-foreground">{order.deliveryAddress}</div>
            <div className="text-muted-foreground">Paiement : {order.paymentMethod}</div>
          </div>
        </div>

        <div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-semibold text-muted-foreground uppercase border-b border-border">
                <th className="py-2">Produit</th><th className="text-right py-2">Qté</th><th className="text-right py-2">PU</th><th className="text-right py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it, i) => {
                const p = products.find((x) => x.id === it.productId);
                return (
                  <tr key={i} className="border-b border-border/60">
                    <td className="py-2.5">{p?.name ?? it.productId}</td>
                    <td className="text-right">{it.qty} {p?.unit}</td>
                    <td className="text-right">{formatFCFA(it.price)}</td>
                    <td className="text-right font-semibold">{formatFCFA(it.qty * it.price)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <div className="w-full sm:w-64 space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Sous-total</span><span>{formatFCFA(subtotal)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>TVA 18%</span><span>{formatFCFA(vat)}</span></div>
            <div className="flex justify-between font-bold text-lg border-t border-border pt-2"><span>Total</span><span className="text-primary">{formatFCFA(total)}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}