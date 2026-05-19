import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Check, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { wallets, transactions, type PaymentMethod } from "@/data/mocks";
import { useWithdrawals, withdrawalActions } from "@/data/store";
import { formatFCFA } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/farmer/revenue/withdraw")({
  head: () => ({ meta: [{ title: "Retirer · Diambar Agro" }] }),
  component: WithdrawPage,
});

function WithdrawPage() {
  const navigate = useNavigate();
  const withdrawals = useWithdrawals();
  const available = transactions.filter((t) => t.status === "Payé").reduce((a, t) => a + t.net, 0)
    - withdrawals.filter((w) => w.status === "Effectué").reduce((a, w) => a + w.amount + w.fee, 0);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [method, setMethod] = useState<PaymentMethod>("Wave");
  const [amount, setAmount] = useState(50000);
  const fee = Math.round(amount * 0.005);

  const STEPS = ["Méthode", "Montant", "Confirmation"];

  const confirm = () => {
    withdrawalActions.create({ method, amount });
    toast.success(`Retrait de ${formatFCFA(amount)} initié`);
    navigate({ to: "/farmer/revenue/withdrawals" });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Retirer mes fonds" subtitle={`Disponible : ${formatFCFA(Math.max(0, available))}`} actions={
        <Button variant="outline" onClick={() => navigate({ to: "/farmer/revenue" })} className="gap-2"><ArrowLeft className="h-4 w-4" />Retour</Button>
      } />

      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const idx = i + 1;
          const done = idx < step;
          const active = idx === step;
          return (
            <div key={s} className="flex-1 flex items-center gap-2">
              <div className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold shrink-0 ${done ? "bg-primary text-primary-foreground" : active ? "bg-primary/15 text-primary border border-primary" : "bg-muted text-muted-foreground"}`}>
                {done ? <Check className="h-4 w-4" /> : idx}
              </div>
              <span className={`text-xs font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
              {idx < STEPS.length && <div className={`flex-1 h-px ${done ? "bg-primary" : "bg-border"}`} />}
            </div>
          );
        })}
      </div>

      <div className="glass rounded-2xl p-6">
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-semibold">Choisissez le compte de réception</h3>
            <div className="space-y-2">
              {wallets.map((w) => (
                <button key={w.id} onClick={() => setMethod(w.method)} className={`w-full text-left rounded-xl border p-4 flex items-center gap-3 transition ${method === w.method ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"}`}>
                  <span className="grid h-10 w-10 place-items-center rounded-xl font-bold text-white text-xs" style={{ background: w.color }}>{w.method.slice(0, 2)}</span>
                  <div className="flex-1">
                    <div className="font-semibold">{w.method}</div>
                    <div className="text-xs text-muted-foreground">{w.phone}</div>
                  </div>
                  {method === w.method && <Check className="h-5 w-5 text-primary" />}
                </button>
              ))}
            </div>
            <div className="flex justify-end"><Button onClick={() => setStep(2)} className="gap-2">Continuer <ChevronRight className="h-4 w-4" /></Button></div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-semibold">Montant à retirer</h3>
            <div className="space-y-1.5">
              <Label>Montant (FCFA)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))} min={5000} max={Math.max(0, available)} />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[25000, 50000, 100000, 200000].map((v) => (
                <button key={v} onClick={() => setAmount(v)} className="rounded-lg border border-border py-2 text-xs font-semibold hover:border-primary">{formatFCFA(v)}</button>
              ))}
            </div>
            <div className="rounded-xl bg-muted/40 p-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Montant</span><span className="font-semibold">{formatFCFA(amount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Frais (0,5%)</span><span>-{formatFCFA(fee)}</span></div>
              <div className="flex justify-between font-bold pt-2 border-t border-border"><span>Vous recevrez</span><span className="text-primary">{formatFCFA(amount - fee)}</span></div>
            </div>
            <div className="flex justify-between"><Button variant="outline" onClick={() => setStep(1)}>Retour</Button><Button onClick={() => setStep(3)} disabled={amount < 5000 || amount > available} className="gap-2">Continuer <ChevronRight className="h-4 w-4" /></Button></div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-semibold">Vérifiez et confirmez</h3>
            <div className="rounded-xl border border-border p-4 space-y-2 text-sm">
              <Row k="Compte" v={`${method} · ${wallets.find((w) => w.method === method)?.phone}`} />
              <Row k="Montant brut" v={formatFCFA(amount)} />
              <Row k="Frais" v={`-${formatFCFA(fee)}`} />
              <Row k="Net reçu" v={formatFCFA(amount - fee)} bold />
              <Row k="Délai estimé" v="< 5 min" />
            </div>
            <div className="flex justify-between"><Button variant="outline" onClick={() => setStep(2)}>Retour</Button><Button onClick={confirm}>Confirmer le retrait</Button></div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className={bold ? "font-bold text-primary" : "font-medium"}>{v}</span></div>;
}