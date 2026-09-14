import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Download, Printer, Receipt } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { transactions, restaurants, orders, products } from "@/data/mocks";
import { formatFCFA } from "@/lib/format";
import { downloadHtml } from "@/lib/export";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/farmer/revenue/$txId")({
  head: () => ({ meta: [{ title: "Transaction · Diambar Agro" }] }),
  component: TxPage,
});

function TxPage() {
  const { txId } = Route.useParams();
  const tx = transactions.find((t) => t.id === txId);
  if (!tx)
    return <p className="text-center text-muted-foreground py-12">Transaction introuvable</p>;
  const r = restaurants.find((x) => x.id === tx.restaurantId);
  const order = orders.find((o) => o.reference === tx.orderRef);

  const downloadReceipt = () => {
    const itemsHtml = order
      ? order.items
          .map((it) => {
            const p = products.find((x) => x.id === it.productId);
            return `<div class="row"><span>${p?.name ?? ""} ×${it.qty}${p?.unit ?? ""}</span><span>${formatFCFA(it.qty * it.price)}</span></div>`;
          })
          .join("")
      : "";
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Reçu ${tx.orderRef}</title>
<style>
body{font-family:system-ui,sans-serif;max-width:560px;margin:32px auto;color:#111;padding:0 16px}
h1{font-size:1.25rem;margin-bottom:0}
.muted{color:#666;font-size:.85rem}
.row{display:flex;justify-content:space-between;margin:6px 0}
.section{border-top:1px solid #ddd;padding-top:12px;margin-top:16px}
.total{font-weight:bold;font-size:1.15rem;border-top:2px solid #111;padding-top:10px;margin-top:10px}
</style></head><body>
<h1>Reçu de paiement — Diambar Agro</h1>
<p class="muted">Transaction ${tx.id.toUpperCase()} · ${tx.orderRef} · ${new Date(tx.date).toLocaleDateString("fr-FR", { dateStyle: "long" })}</p>
<div class="row"><span>Restaurant</span><span>${r?.name ?? ""} (${r?.city ?? ""})</span></div>
<div class="row"><span>Méthode</span><span>${tx.method}</span></div>
<div class="row"><span>Statut</span><span>${tx.status}</span></div>
${itemsHtml ? `<div class="section">${itemsHtml}</div>` : ""}
<div class="section">
<div class="row"><span>Sous-total</span><span>${formatFCFA(tx.gross)}</span></div>
<div class="row"><span>Commission Diambar</span><span>-${formatFCFA(tx.commission)}</span></div>
<div class="row total"><span>Net reçu</span><span>${formatFCFA(tx.net)}</span></div>
</div>
</body></html>`;
    downloadHtml(`recu-${tx.orderRef}`, html);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title={`Transaction ${tx.orderRef}`}
        subtitle={new Date(tx.date).toLocaleDateString("fr-FR", { dateStyle: "long" })}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" className="gap-2">
              <Link to="/farmer/revenue">
                <ArrowLeft className="h-4 w-4" />
                Retour
              </Link>
            </Button>
            <Button variant="outline" onClick={downloadReceipt} className="gap-2">
              <Download className="h-4 w-4" />
              Télécharger
            </Button>
            <Button variant="outline" onClick={() => window.print()} className="gap-2">
              <Printer className="h-4 w-4" />
              Imprimer
            </Button>
          </div>
        }
      />

      <div className="glass rounded-2xl p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-5">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary">
              <Receipt className="h-6 w-6" />
            </span>
            <div>
              <div className="font-display text-xl font-bold">Reçu de paiement</div>
              <div className="text-xs text-muted-foreground">Diambar Agro</div>
            </div>
          </div>
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
              tx.status === "Payé"
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                : tx.status === "En attente"
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                  : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
            }`}
          >
            {tx.status}
          </span>
        </div>

        <div className="grid sm:grid-cols-2 gap-6 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Restaurant</div>
            <div className="font-semibold mt-1">{r?.name}</div>
            <div className="text-xs text-muted-foreground">{r?.city}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Méthode</div>
            <div className="font-semibold mt-1">{tx.method}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Référence commande</div>
            <div className="font-mono mt-1">{tx.orderRef}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">ID transaction</div>
            <div className="font-mono mt-1">{tx.id.toUpperCase()}</div>
          </div>
        </div>

        {order && (
          <div className="space-y-2 border-t border-border pt-5">
            <div className="text-xs font-semibold text-muted-foreground">ARTICLES</div>
            {order.items.map((it, i) => {
              const p = products.find((x) => x.id === it.productId);
              return (
                <div key={i} className="flex justify-between text-sm">
                  <span>
                    {p?.name}{" "}
                    <span className="text-muted-foreground">
                      ×{it.qty}
                      {p?.unit}
                    </span>
                  </span>
                  <span>{formatFCFA(it.qty * it.price)}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="border-t border-border pt-5 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sous-total</span>
            <span>{formatFCFA(tx.gross)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Commission Diambar</span>
            <span className="text-rose-500">-{formatFCFA(tx.commission)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg pt-3 border-t border-border">
            <span>Net reçu</span>
            <span className="text-primary">{formatFCFA(tx.net)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
