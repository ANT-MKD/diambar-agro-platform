import { Wallet, ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatFCFA } from "@/lib/format";

export function WalletWidget({ available, pending, withdrawn }: { available: number; pending: number; withdrawn: number }) {
  return (
    <div className="glass rounded-2xl p-5 bg-gradient-to-br from-emerald-500/10 via-transparent to-blue-500/10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/15 text-emerald-500"><Wallet className="h-5 w-5" /></span>
          Mon portefeuille
        </div>
        <Link to="/farmer/revenue/withdraw" className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:opacity-90">
          Retirer <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="mt-4 font-display text-3xl font-bold">{formatFCFA(available)}</div>
      <div className="text-xs text-muted-foreground">disponible immédiatement</div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg border border-border p-2.5">
          <div className="text-muted-foreground">En attente</div>
          <div className="font-semibold text-amber-500 mt-0.5">{formatFCFA(pending)}</div>
        </div>
        <div className="rounded-lg border border-border p-2.5">
          <div className="text-muted-foreground">Total retiré</div>
          <div className="font-semibold mt-0.5">{formatFCFA(withdrawn)}</div>
        </div>
      </div>
    </div>
  );
}