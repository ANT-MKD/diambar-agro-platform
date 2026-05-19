import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Plus } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { useWithdrawals } from "@/data/store";
import { formatFCFA } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/farmer/revenue/withdrawals")({
  head: () => ({ meta: [{ title: "Historique des retraits · Diambar Agro" }] }),
  component: WithdrawalsPage,
});

function WithdrawalsPage() {
  const withdrawals = useWithdrawals();
  const total = withdrawals.filter((w) => w.status === "Effectué").reduce((a, w) => a + w.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Historique des retraits" subtitle={`${withdrawals.length} opération(s) · ${formatFCFA(total)} retiré`} actions={
        <div className="flex gap-2">
          <Button asChild variant="outline" className="gap-2"><Link to="/farmer/revenue"><ArrowLeft className="h-4 w-4" />Retour</Link></Button>
          <Button asChild className="gap-2"><Link to="/farmer/revenue/withdraw"><Plus className="h-4 w-4" />Nouveau retrait</Link></Button>
        </div>
      } />

      <div className="glass rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Référence</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Méthode</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead className="text-right">Frais</TableHead>
              <TableHead className="text-right">Net</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {withdrawals.map((w) => (
              <TableRow key={w.id}>
                <TableCell className="font-mono text-xs">{w.reference}</TableCell>
                <TableCell className="text-sm">{new Date(w.date).toLocaleDateString("fr-FR")}</TableCell>
                <TableCell className="text-sm">{w.method}</TableCell>
                <TableCell className="text-right text-sm">{formatFCFA(w.amount)}</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">-{formatFCFA(w.fee)}</TableCell>
                <TableCell className="text-right text-sm font-semibold text-primary">{formatFCFA(w.amount - w.fee)}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                    w.status === "Effectué" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" :
                    w.status === "En cours" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" :
                    "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
                  }`}>{w.status}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}