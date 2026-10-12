import { useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock,
  Copy,
  RotateCcw,
  Smartphone,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { market } from "@/data/market-remote";
import { useMerchantNumbers } from "@/data/payments-store";
import { formatFCFA } from "@/lib/format";
import {
  PAYMENT_STATE_LABEL,
  REFUND_SOURCE_LABEL,
  type OrderPayment,
  type RefundView,
} from "@/lib/market/payment-view";

// Paiement d'une commande pendant le pilote : où payer, déclarer la
// référence de la transaction, suivre la vérification par Diambar, et les
// remboursements éventuels.

const dateTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString("fr-FR", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

type PrepaidMethod = "wave" | "orange_money";

function CopyNumber({ label, number }: { label: string; number: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/60 px-4 py-3">
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-display text-lg font-bold tracking-wide">{number}</div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          void navigator.clipboard
            ?.writeText(number.replace(/\s+/g, ""))
            .then(() => toast.success("Numéro copié"));
        }}
      >
        <Copy className="mr-1.5 h-4 w-4" /> Copier
      </Button>
    </div>
  );
}

function DeclareForm({
  payment,
  onDone,
  submitLabel,
}: {
  payment: OrderPayment;
  onDone?: () => void;
  submitLabel: string;
}) {
  const merchant = useMerchantNumbers();
  const options: { key: PrepaidMethod; label: string; number: string }[] = [
    ...(merchant?.wave ? [{ key: "wave" as const, label: "Wave", number: merchant.wave }] : []),
    ...(merchant?.orangeMoney
      ? [{ key: "orange_money" as const, label: "Orange Money", number: merchant.orangeMoney }]
      : []),
  ];
  const preferred: PrepaidMethod = payment.method === "Orange Money" ? "orange_money" : "wave";
  const [method, setMethod] = useState<PrepaidMethod>(
    options.some((o) => o.key === preferred) ? preferred : (options[0]?.key ?? "wave"),
  );
  const [ref, setRef] = useState("");
  const [sending, setSending] = useState(false);
  const chosen = options.find((o) => o.key === method);

  if (options.length === 0) {
    return (
      <p className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
        Le paiement par Wave ou Orange Money n'est pas encore ouvert. Contactez Diambar pour régler
        cette commande.
      </p>
    );
  }

  const submit = async () => {
    if (ref.trim().length < 4) {
      toast.error("Recopiez la référence de la transaction (dans le SMS de confirmation).");
      return;
    }
    setSending(true);
    const res = await market.declarePayment(payment.checkoutId, method, ref);
    setSending(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success("Paiement déclaré : Diambar le vérifie.");
    setRef("");
    onDone?.();
  };

  return (
    <div className="space-y-4">
      {options.length > 1 && (
        <div className="flex gap-2" role="radiogroup" aria-label="Moyen de paiement">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={method === o.key}
              onClick={() => setMethod(o.key)}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                method === o.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
      {chosen && <CopyNumber label={`Numéro marchand ${chosen.label}`} number={chosen.number} />}
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>
          Envoyez exactement{" "}
          <span className="font-semibold text-foreground">{formatFCFA(payment.amount)}</span> à ce
          numéro.
        </li>
        <li>
          Recopiez la référence de la transaction, indiquée dans le SMS de confirmation ou
          l'historique de l'application.
        </li>
        <li>Saisissez-la ci-dessous : Diambar vérifie puis lance la préparation.</li>
      </ol>
      <div className="space-y-1.5">
        <Label htmlFor={`ref-${payment.id}`}>Référence de la transaction</Label>
        <Input
          id={`ref-${payment.id}`}
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder="Ex. T_8K2L5QZ7"
          autoComplete="off"
          maxLength={64}
        />
      </div>
      <Button onClick={submit} disabled={sending} className="w-full sm:w-auto">
        {sending ? "Envoi…" : submitLabel}
      </Button>
    </div>
  );
}

export function RefundList({ refunds }: { refunds: RefundView[] }) {
  if (refunds.length === 0) return null;
  return (
    <ul className="space-y-2">
      {refunds.map((r) => (
        <li
          key={r.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
        >
          <span className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
            <span>
              <span className="font-medium">{r.reference}</span> ·{" "}
              {REFUND_SOURCE_LABEL[r.source] ?? "Remboursement"}
            </span>
          </span>
          <span className="flex items-center gap-2">
            <span className="font-semibold">{formatFCFA(r.amount)}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                r.status === "paid"
                  ? "bg-emerald-500/10 text-emerald-600"
                  : r.status === "rejected" || r.status === "failed"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-amber-500/10 text-amber-600"
              }`}
            >
              {r.status === "paid"
                ? `Remboursé le ${dateTime(r.paidAt)}`
                : r.status === "rejected"
                  ? "Refusé"
                  : r.status === "failed"
                    ? "Échec, nouvel essai prévu"
                    : "Prévu"}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function PaymentPanel({
  payment,
  refunds = [],
}: {
  payment: OrderPayment;
  refunds?: RefundView[];
}) {
  const [editing, setEditing] = useState(false);
  const covers =
    payment.mode === "prepaid" && payment.orderReferences.length > 1
      ? `Panier ${payment.checkoutReference} : ${payment.orderReferences.join(", ")}`
      : null;
  const s = payment.state;

  return (
    <div className="glass space-y-4 rounded-2xl p-5" data-testid="payment-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display font-semibold">
          <Wallet className="h-5 w-5 text-primary" /> Paiement
        </h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            s === "paid"
              ? "bg-emerald-500/10 text-emerald-600"
              : s === "refused"
                ? "bg-destructive/10 text-destructive"
                : s === "cancelled"
                  ? "bg-muted text-muted-foreground"
                  : "bg-amber-500/10 text-amber-600"
          }`}
        >
          {PAYMENT_STATE_LABEL[s]}
        </span>
      </div>
      {covers && <p className="text-xs text-muted-foreground">{covers}</p>}

      {(s === "to_pay" || s === "refused") && (
        <>
          {s === "refused" && (
            <div className="flex gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Diambar n'a pas retrouvé votre paiement
                {payment.providerRef ? ` (réf. ${payment.providerRef})` : ""}
                {payment.note ? ` : ${payment.note}` : ""}. Vérifiez la référence et déclarez à
                nouveau.
              </span>
            </div>
          )}
          <p className="text-sm">
            <span className="font-display text-2xl font-bold">{formatFCFA(payment.amount)}</span>{" "}
            <span className="text-muted-foreground">à payer</span>
          </p>
          <p className="text-sm text-muted-foreground">
            La commande est préparée et livrée une fois le paiement confirmé par Diambar.
          </p>
          {payment.dueBy && (
            <p
              className="flex gap-2 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400"
              data-testid="payment-due-by"
            >
              <Clock className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                À payer avant le <span className="font-semibold">{dateTime(payment.dueBy)}</span>.
                Sans paiement déclaré à cette heure, la commande est annulée et les produits remis
                en vente.
              </span>
            </p>
          )}
          <DeclareForm payment={payment} submitLabel="J'ai payé" />
        </>
      )}

      {s === "declared" && (
        <>
          <div className="flex gap-3 text-sm">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p>
              Vous avez déclaré <span className="font-semibold">{formatFCFA(payment.amount)}</span>{" "}
              par {payment.method} le {dateTime(payment.declaredAt)} (réf.{" "}
              <span className="font-mono">{payment.providerRef}</span>). Diambar vérifie sur son
              compte marchand, puis la préparation commence.
            </p>
          </div>
          {editing ? (
            <DeclareForm
              payment={payment}
              submitLabel="Corriger la référence"
              onDone={() => setEditing(false)}
            />
          ) : (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Corriger la référence
            </Button>
          )}
        </>
      )}

      {s === "paid" && (
        <div className="flex gap-3 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <p>
            <span className="font-semibold">{formatFCFA(payment.amount)}</span> reçus
            {payment.mode === "cash" ? " en espèces" : ` par ${payment.method}`}
            {payment.paidAt ? `, confirmé le ${dateTime(payment.paidAt)}` : ""}
            {payment.providerRef ? ` (réf. ${payment.providerRef})` : ""}.
          </p>
        </div>
      )}

      {s === "cash_on_delivery" && (
        <div className="flex gap-3 text-sm">
          <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            <span className="font-semibold">{formatFCFA(payment.amount)}</span> en espèces, à
            remettre au livreur à la livraison. Le montant suit les quantités réellement livrées.
          </p>
        </div>
      )}

      {s === "collected" && (
        <div className="flex gap-3 text-sm">
          <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <p>
            <span className="font-semibold">{formatFCFA(payment.amount)}</span> remis au livreur le{" "}
            {dateTime(payment.collectedAt)}.
          </p>
        </div>
      )}

      {s === "cancelled" && (
        <p className="text-sm text-muted-foreground">
          Rien à payer : les commandes de ce panier ont été annulées.
        </p>
      )}

      {refunds.length > 0 && (
        <div className="space-y-2 border-t border-border pt-4">
          <h4 className="text-sm font-semibold">Remboursements</h4>
          <RefundList refunds={refunds} />
          <p className="text-xs text-muted-foreground">
            Diambar renvoie l'argent sur le numéro qui a payé, puis le remboursement passe à «
            Remboursé ».
          </p>
        </div>
      )}
    </div>
  );
}
