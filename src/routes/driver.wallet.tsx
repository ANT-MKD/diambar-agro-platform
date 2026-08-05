import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Wallet, ArrowUpRight, ArrowDownLeft, Percent, TrendingUp, Download,
  Gift, Truck, Receipt, ArrowLeft,
} from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDriverWallet, driverWalletActions } from "@/data/store";
import { formatFCFA } from "@/lib/format";
import type { PaymentMethod } from "@/data/mocks";

export const Route = createFileRoute("/driver/wallet")({
  head: () => ({
    meta: [
      { title: "Portefeuille · Livreur Diambar" },
      { name: "description", content: "Solde, transactions et récapitulatif de commission du livreur." },
    ],
  }),
  component: WalletPage,
});

const KIND_META: Record<string, { label: string; icon: typeof Wallet; tone: string }> = {
  mission: { label: "Mission", icon: Truck, tone: "text-emerald-600 dark:text-emerald-400" },
  bonus: { label: "Bonus", icon: Gift, tone: "text-amber-600 dark:text-amber-400" },
  commission: { label: "Commission", icon: Percent, tone: "text-rose-500" },
  withdrawal: { label: "Retrait", icon: ArrowUpRight, tone: "text-blue-600 dark:text-blue-400" },
  adjustment: { label: "Ajustement", icon: Receipt, tone: "text-muted-foreground" },
};

function WalletPage() {
  const wallet = useDriverWallet();
  const [filter, setFilter] = useState<"all" | "credit" | "debit">("all");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("Wave");

  const txs = useMemo(
    () => wallet.transactions.filter((t) => filter === "all" || (filter === "credit" ? t.amount > 0 : t.amount < 0)),
    [wallet.transactions, filter],
  );

  const gross = wallet.transactions.filter((t) => t.kind === "mission").reduce((s, t) => s + t.amount, 0);
  const bonus = wallet.transactions.filter((t) => t.kind === "bonus").reduce((s, t) => s + t.amount, 0);
  const commission = wallet.transactions.filter((t) => t.kind === "commission").reduce((s, t) => s + t.amount, 0);
  const net = gross + bonus + commission;
  const rate = gross ? Math.round((Math.abs(commission) / gross) * 1000) / 10 : 0;

  const submitWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value < 1000) return toast.error("Montant minimum : 1 000 FCFA");
    if (value > wallet.balance) return toast.error("Solde insuffisant");
    driverWalletActions.withdraw(value, method);
    setAmount("");
    toast.success(`Retrait de ${formatFCFA(value)} demandé · ${method}`);
  };

  const exportCsv = () => {
    const rows = [["Date", "Libellé", "Type", "Montant", "Statut"], ...wallet.transactions.map((t) => [
      new Date(t.at).toLocaleString("fr-FR"), t.label, KIND_META[t.kind]?.label ?? t.kind, String(t.amount), t.status,
    ])];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "portefeuille-livreur.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success("Export CSV téléchargé");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mon portefeuille"
        subtitle="Solde, transactions et commissions"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={exportCsv}><Download className="h-4 w-4" />Exporter</Button>
            <Button asChild variant="outline" className="gap-2"><Link to="/driver/earnings"><ArrowLeft className="h-4 w-4" />Revenus</Link></Button>
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-2xl p-6 bg-gradient-to-br from-primary/10 via-transparent to-blue-500/10">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary"><Wallet className="h-5 w-5" /></span>
              Solde disponible
            </div>
            <div className="mt-4 font-display text-4xl font-bold">{formatFCFA(wallet.balance)}</div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-border p-3">
                <div className="text-muted-foreground">En attente</div>
                <div className="mt-0.5 font-semibold text-amber-500">{formatFCFA(wallet.pending)}</div>
              </div>
              <div className="rounded-xl border border-border p-3">
                <div className="text-muted-foreground">Total retiré</div>
                <div className="mt-0.5 font-semibold">{formatFCFA(wallet.withdrawn)}</div>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl overflow-hidden">
            <div className="p-4 flex flex-wrap items-center gap-3 border-b border-border">
              <h3 className="font-display font-bold flex-1">Transactions</h3>
              <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                <TabsList className="h-9">
                  <TabsTrigger value="all" className="text-xs">Toutes</TabsTrigger>
                  <TabsTrigger value="credit" className="text-xs">Crédits</TabsTrigger>
                  <TabsTrigger value="debit" className="text-xs">Débits</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="divide-y divide-border">
              {txs.map((t) => {
                const meta = KIND_META[t.kind] ?? KIND_META.adjustment;
                const Icon = meta.icon;
                return (
                  <div key={t.id} className="flex items-center gap-3 p-4">
                    <div className={`grid h-10 w-10 place-items-center rounded-xl bg-muted/60 shrink-0 ${meta.tone}`}><Icon className="h-4 w-4" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{t.label}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(t.at).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · {meta.label}
                        {t.method ? ` · ${t.method}` : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${t.amount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}`}>
                        {t.amount > 0 ? "+" : "−"}{formatFCFA(Math.abs(t.amount))}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{t.status}</div>
                    </div>
                  </div>
                );
              })}
              {txs.length === 0 && <div className="p-10 text-center text-sm text-muted-foreground">Aucune transaction</div>}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <form onSubmit={submitWithdraw} className="glass rounded-2xl p-5 space-y-4">
            <h3 className="font-display font-bold flex items-center gap-2"><ArrowDownLeft className="h-4 w-4 text-primary" />Retirer mes gains</h3>
            <div className="space-y-1.5">
              <Label htmlFor="amt">Montant (FCFA)</Label>
              <Input id="amt" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} placeholder="25000" />
              <div className="flex gap-2 pt-1">
                {[10000, 25000, 50000].map((v) => (
                  <button type="button" key={v} onClick={() => setAmount(String(v))} className="rounded-full border border-border px-2.5 py-1 text-[11px] hover:bg-accent/40">
                    {formatFCFA(v)}
                  </button>
                ))}
                <button type="button" onClick={() => setAmount(String(wallet.balance))} className="rounded-full border border-primary text-primary px-2.5 py-1 text-[11px]">Max</button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Méthode</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Wave">Wave · +221 77 888 99 00</SelectItem>
                  <SelectItem value="Orange Money">Orange Money</SelectItem>
                  <SelectItem value="Free Money">Free Money</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full">Demander le retrait</Button>
            <p className="text-[11px] text-muted-foreground">Versement sous 24h · minimum 1 000 FCFA · aucun frais.</p>
          </form>

          <div className="glass rounded-2xl p-5">
            <h3 className="font-display font-bold flex items-center gap-2"><Percent className="h-4 w-4 text-rose-500" />Récapitulatif commission</h3>
            <div className="mt-4 space-y-3 text-sm">
              <Row label="Gains missions" value={formatFCFA(gross)} />
              <Row label="Bonus" value={`+ ${formatFCFA(bonus)}`} tone="text-emerald-600 dark:text-emerald-400" />
              <Row label={`Commission plateforme (${rate}%)`} value={`− ${formatFCFA(Math.abs(commission))}`} tone="text-rose-500" />
              <div className="border-t border-border pt-3">
                <Row label="Net perçu" value={formatFCFA(net)} bold />
              </div>
            </div>
            <div className="mt-4 h-2 rounded-full bg-muted overflow-hidden flex">
              <div className="h-full bg-primary" style={{ width: `${100 - rate}%` }} />
              <div className="h-full bg-rose-500" style={{ width: `${rate}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
              <span>Votre part {100 - rate}%</span><span>Diambar {rate}%</span>
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Prochain versement</div>
            <div className="mt-1 font-display text-2xl font-bold text-primary flex items-center gap-2">
              {formatFCFA(wallet.pending)} <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Programmé demain · Wave</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, tone, bold }: { label: string; value: string; tone?: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${tone ?? ""} ${bold ? "font-display text-lg font-bold" : "font-medium"}`}>{value}</span>
    </div>
  );
}
