import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/farmer/empty-state";
import { PageHeader } from "@/components/farmer/page-header";
import { useInvoices } from "@/data/payments-store";
import { formatFCFA } from "@/lib/format";
import { downloadDiambarInvoice } from "@/lib/invoice-pdf";
import { invoicePdfData, type InvoiceView } from "@/lib/market/documents-view";

// Factures émises par la base (une par panier, quand tout est livré et le
// contrôle à la réception fait) : numérotation continue, PDF téléchargeable.

function downloadInvoice(v: InvoiceView) {
  downloadDiambarInvoice(`${v.number}.pdf`, invoicePdfData(v));
}

export function RemoteInvoices() {
  const invoices = useInvoices();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Factures"
        subtitle="Une facture par panier, émise une fois la livraison terminée et le contrôle à la réception fait (ou son délai passé)."
      />
      {invoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Pas encore de facture"
          description="Votre facture arrive dès que toutes les commandes d'un panier sont livrées et contrôlées."
        />
      ) : (
        <div className="glass overflow-x-auto rounded-2xl">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-3">Facture</th>
                <th className="p-3">Date</th>
                <th className="p-3">Panier · commandes</th>
                <th className="p-3 text-right">Montant</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.map((v) => (
                <tr key={v.id} data-testid="invoice-row">
                  <td className="p-3 font-semibold">{v.number}</td>
                  <td className="p-3">{new Date(v.issuedAt).toLocaleDateString("fr-FR")}</td>
                  <td className="p-3 text-muted-foreground">
                    {v.checkoutReference} · {v.content.orders.map((o) => o.reference).join(", ")}
                  </td>
                  <td className="p-3 text-right font-semibold">{formatFCFA(v.totalTtc)}</td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => downloadInvoice(v)}>
                      <Download className="mr-1.5 h-4 w-4" /> PDF
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
