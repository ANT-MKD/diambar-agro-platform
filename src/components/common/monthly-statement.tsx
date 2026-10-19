import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/farmer/empty-state";
import { PageHeader } from "@/components/farmer/page-header";
import { market } from "@/data/market-remote";
import { useMarketMode } from "@/data/market-mode";
import { formatFCFA } from "@/lib/format";
import { downloadDiambarInvoice } from "@/lib/invoice-pdf";
import { monthLabel, statementPdfData, type StatementView } from "@/lib/market/documents-view";

// Relevé mensuel du compte (producteur ou livreur), tiré du grand livre :
// solde d'ouverture, chaque mouvement du mois, solde de clôture.

function lastMonths(n: number): string[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

export function MonthlyStatement() {
  const { remote } = useMarketMode();
  const months = lastMonths(12);
  const [month, setMonth] = useState(months[0]);
  const [data, setData] = useState<StatementView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!remote) return;
    let alive = true;
    setLoading(true);
    setError(null);
    void market.statement(month).then((res) => {
      if (!alive) return;
      setLoading(false);
      if (res.ok) setData(res.statement);
      else setError(res.message);
    });
    return () => {
      alive = false;
    };
  }, [remote, month]);

  if (!remote) {
    return (
      <div className="space-y-6">
        <PageHeader title="Relevé mensuel" />
        <EmptyState
          icon={FileText}
          title="Disponible avec la base de données"
          description="Le relevé reprend les écritures réelles de votre compte : il n'existe pas en démonstration."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relevé mensuel"
        subtitle="Tout ce qui a été crédité et versé sur votre compte Diambar, mois par mois."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="Mois"
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              disabled={!data}
              onClick={() =>
                data &&
                downloadDiambarInvoice(`releve-diambar-${data.month}.pdf`, statementPdfData(data))
              }
            >
              <Download className="mr-1.5 h-4 w-4" /> PDF
            </Button>
          </div>
        }
      />
      {error && (
        <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}
      {loading && !data && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="statement-totals">
            {[
              ["Solde d'ouverture", data.opening],
              ["Crédits", data.credits],
              ["Débits", data.debits],
              ["Solde de clôture", data.closing],
            ].map(([label, value]) => (
              <div key={label as string} className="glass rounded-2xl p-4">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="font-display text-lg font-bold">{formatFCFA(value as number)}</div>
              </div>
            ))}
          </div>
          {data.lines.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Aucun mouvement ce mois-ci"
              description={`Solde : ${formatFCFA(data.closing)}.`}
            />
          ) : (
            <div className="glass overflow-x-auto rounded-2xl">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Opération</th>
                    <th className="p-3">Référence</th>
                    <th className="p-3 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.lines.map((l, i) => (
                    <tr key={i}>
                      <td className="p-3 whitespace-nowrap">
                        {new Date(l.at).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="p-3">{l.label}</td>
                      <td className="p-3 text-muted-foreground">{l.reference}</td>
                      <td
                        className={`p-3 text-right font-semibold ${l.amount < 0 ? "text-destructive" : "text-emerald-600"}`}
                      >
                        {l.amount > 0 ? "+" : ""}
                        {formatFCFA(l.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
