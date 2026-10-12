import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Banknote,
  Check,
  Clock,
  Hourglass,
  RotateCcw,
  Scale,
  Search,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { StatCard } from "@/components/admin/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAdminRoleForEmail } from "@/data/admin-store";
import { market } from "@/data/market-remote";
import { useMarketMode } from "@/data/market-mode";
import {
  useAdminAccounts,
  useAdminPayments,
  useAdminPayouts,
  useAdminRefunds,
  useMerchantNumbers,
} from "@/data/payments-store";
import { formatFCFA, relativeTime } from "@/lib/format";
import {
  PAYMENT_STATE_LABEL,
  REFUND_SOURCE_LABEL,
  type AdminPayment,
  type AdminPayout,
  type AdminRefund,
} from "@/lib/market/payment-view";
import { downloadCsv } from "@/lib/export";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/payments")({
  head: () => ({ meta: [{ title: "Encaissements — Admin Diambar" }] }),
  component: PaymentsPage,
});

// Argent du pilote, sans paiement intégré : l'admin rapproche ce que les
// restaurants déclarent avec ce qu'il voit sur le compte marchand Wave /
// Orange Money, récupère les espèces encaissées par les livreurs, puis
// envoie à la main les retraits des producteurs et livreurs et les
// remboursements des restaurants.

type PaymentTab = "check" | "cash" | "unpaid" | "history";
type Tab = PaymentTab | "payouts" | "refunds" | "balances";

const TABS: { key: Tab; label: string }[] = [
  { key: "check", label: "À vérifier" },
  { key: "cash", label: "Espèces chez les livreurs" },
  { key: "payouts", label: "Retraits à verser" },
  { key: "refunds", label: "Remboursements à faire" },
  { key: "unpaid", label: "Non payés" },
  { key: "balances", label: "Soldes" },
  { key: "history", label: "Historique" },
];
const PAYMENT_TABS: PaymentTab[] = ["check", "cash", "unpaid", "history"];
const isPaymentTab = (t: Tab): t is PaymentTab => (PAYMENT_TABS as Tab[]).includes(t);

const inTab = (p: AdminPayment, tab: PaymentTab) =>
  tab === "check"
    ? p.state === "declared"
    : tab === "cash"
      ? p.state === "collected"
      : tab === "unpaid"
        ? p.state === "to_pay" || p.state === "refused" || p.state === "cash_on_delivery"
        : p.state === "paid" || p.state === "cancelled";

const dateTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString("fr-FR", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

function PaymentsPage() {
  const { remote } = useMarketMode();
  const { user } = useRouteContext({ from: "/admin" });
  const role = useAdminRoleForEmail(user.email);
  const canHandle = role === "Super Administrateur" || role === "Finance";
  const payments = useAdminPayments();
  const payouts = useAdminPayouts();
  const refunds = useAdminRefunds();
  const accounts = useAdminAccounts();
  const merchant = useMerchantNumbers();
  const [tab, setTab] = useState<Tab>("check");
  const [search, setSearch] = useState("");
  const [confirming, setConfirming] = useState<AdminPayment | null>(null);
  const [rejecting, setRejecting] = useState<AdminPayment | null>(null);

  const counts = useMemo(
    () => Object.fromEntries(PAYMENT_TABS.map((t) => [t, payments.filter((p) => inTab(p, t))])),
    [payments],
  ) as Record<PaymentTab, AdminPayment[]>;
  const payoutsToPay = payouts.filter((p) => p.status === "requested" || p.status === "processing");
  const refundsToPay = refunds.filter((r) => r.status === "pending" || r.status === "approved");
  const tabCount = (t: Tab) =>
    isPaymentTab(t)
      ? counts[t].length
      : t === "payouts"
        ? payoutsToPay.length
        : t === "refunds"
          ? refundsToPay.length
          : accounts.length;

  const list = useMemo(() => {
    if (!isPaymentTab(tab)) return [];
    const q = search.trim().toLowerCase();
    return counts[tab]
      .filter(
        (p) =>
          !q ||
          `${p.checkoutReference} ${p.restaurantName} ${p.providerRef ?? ""} ${p.orderReferences.join(" ")}`
            .toLowerCase()
            .includes(q),
      )
      .sort((a, b) =>
        (b.declaredAt ?? b.collectedAt ?? b.createdAt).localeCompare(
          a.declaredAt ?? a.collectedAt ?? a.createdAt,
        ),
      );
  }, [counts, tab, search]);

  if (!remote) {
    return (
      <div className="space-y-6">
        <PageHeader title="Encaissements" />
        <EmptyState
          icon={Banknote}
          title="Disponible avec la base de données"
          description="Les paiements Wave, Orange Money et espèces se vérifient ici une fois l'application reliée à sa base. En démonstration, voyez la page Finance."
        />
      </div>
    );
  }

  const sum = (xs: AdminPayment[]) => xs.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Encaissements"
        subtitle="Rapprochez les paiements déclarés avec le compte marchand, et les espèces avec les livreurs."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="À vérifier"
          value={formatFCFA(sum(counts.check))}
          icon={Hourglass}
          hint={`${counts.check.length} paiement(s) déclaré(s) par les restaurants`}
        />
        <StatCard
          label="Espèces chez les livreurs"
          value={formatFCFA(sum(counts.cash))}
          icon={Banknote}
          hint={`${counts.cash.length} commande(s) encaissée(s), à récupérer`}
        />
        <StatCard
          label="Non payés"
          value={formatFCFA(counts.unpaid.reduce((s, p) => s + p.dueNow, 0))}
          icon={Clock}
          hint={`${counts.unpaid.length} paiement(s) en attente du restaurant`}
        />
        <StatCard
          label="Encaissé"
          value={formatFCFA(sum(counts.history.filter((p) => p.state === "paid")))}
          icon={Wallet}
          hint="Paiements confirmés sur les commandes chargées"
        />
        <StatCard
          label="Dû aux producteurs et livreurs"
          value={formatFCFA(accounts.reduce((s, a) => s + a.balance, 0))}
          icon={Scale}
          hint="Soldes après versements : à garder sur le compte marchand"
        />
        <StatCard
          label="Retraits à verser"
          value={formatFCFA(payoutsToPay.reduce((s, p) => s + p.amount, 0))}
          icon={ArrowUpRight}
          hint={`${payoutsToPay.length} demande(s)`}
        />
        <StatCard
          label="Remboursements à faire"
          value={formatFCFA(refundsToPay.reduce((s, r) => s + r.amount, 0))}
          icon={RotateCcw}
          hint={`${refundsToPay.length} remboursement(s) aux restaurants`}
        />
      </div>

      <div className="glass rounded-2xl p-4 text-sm">
        <span className="font-semibold">Numéros marchands : </span>
        {merchant?.wave || merchant?.orangeMoney ? (
          <>
            {merchant.wave && <span className="mr-4">Wave {merchant.wave}</span>}
            {merchant.orangeMoney && <span>Orange Money {merchant.orangeMoney}</span>}
          </>
        ) : (
          <span className="text-amber-600">
            aucun numéro ouvert : les restaurants ne peuvent pas payer par Wave ou Orange Money.
            Renseignez-les dans{" "}
            <Link to="/admin/setup" className="underline">
              la configuration (étape Paiements)
            </Link>
            .
          </span>
        )}
      </div>

      <Reconciliation payments={payments} payouts={payouts} refunds={refunds} />

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm transition",
              tab === t.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-muted",
            )}
          >
            {t.label} ({tabCount(t.key)})
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Panier, restaurant, référence…"
            className="pl-9"
            aria-label="Rechercher un paiement"
          />
        </div>
      </div>

      {!canHandle && (tab === "check" || tab === "cash") && list.length > 0 && (
        <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
          Seuls les rôles Finance et Super administrateur confirment les paiements.
        </p>
      )}

      {tab === "payouts" ? (
        <PayoutsTab payouts={payouts} canHandle={canHandle} search={search} />
      ) : tab === "refunds" ? (
        <RefundsTab refunds={refunds} canHandle={canHandle} search={search} />
      ) : tab === "balances" ? (
        <BalancesTab search={search} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Banknote}
          title={
            tab === "check"
              ? "Aucun paiement à vérifier"
              : tab === "cash"
                ? "Aucune espèce à récupérer"
                : tab === "unpaid"
                  ? "Aucun impayé"
                  : "Aucun paiement pour l'instant"
          }
          description={
            tab === "check"
              ? "Quand un restaurant déclare avoir payé, son paiement apparaît ici."
              : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {list.map((p) => (
            <PaymentRow
              key={p.id}
              p={p}
              canHandle={canHandle}
              onConfirm={() => setConfirming(p)}
              onReject={() => setRejecting(p)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog payment={confirming} onClose={() => setConfirming(null)} />
      <RejectDialog payment={rejecting} onClose={() => setRejecting(null)} />
    </div>
  );
}

function PaymentRow({
  p,
  canHandle,
  onConfirm,
  onReject,
}: {
  p: AdminPayment;
  canHandle: boolean;
  onConfirm: () => void;
  onReject: () => void;
}) {
  const changed = p.state === "declared" && p.dueNow !== p.amount;
  return (
    <div className="glass rounded-2xl p-4" data-testid="admin-payment">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{p.checkoutReference}</span>
            <span className="text-sm text-muted-foreground">· {p.restaurantName}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-semibold",
                p.state === "paid"
                  ? "bg-emerald-500/10 text-emerald-600"
                  : p.state === "refused"
                    ? "bg-destructive/10 text-destructive"
                    : p.state === "cancelled"
                      ? "bg-muted text-muted-foreground"
                      : "bg-amber-500/10 text-amber-600",
              )}
            >
              {PAYMENT_STATE_LABEL[p.state]}
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            {p.orders.map((o) => (
              <Link
                key={o.id}
                to="/admin/orders/$orderId"
                params={{ orderId: o.id }}
                className="mr-3 hover:underline"
              >
                {o.reference} ({o.farmerName}, {formatFCFA(o.due)})
              </Link>
            ))}
          </div>
          <div className="text-xs text-muted-foreground">
            {p.mode === "cash" ? "Espèces" : p.method}
            {p.providerRef && (
              <>
                {" "}
                · réf. <span className="font-mono text-foreground">{p.providerRef}</span>
              </>
            )}
            {p.declaredAt && <> · déclaré {relativeTime(p.declaredAt)}</>}
            {p.collectedBy && (
              <>
                {" "}
                · encaissé par {p.collectedBy.name} le {dateTime(p.collectedAt)}
              </>
            )}
            {p.paidAt && (
              <>
                {" "}
                · confirmé le {dateTime(p.paidAt)}
                {p.confirmedByName ? ` par ${p.confirmedByName}` : ""}
              </>
            )}
            {p.restaurantPhone && <> · {p.restaurantPhone}</>}
          </div>
          {p.note && <div className="text-xs text-destructive">Motif du refus : {p.note}</div>}
          {changed && (
            <div className="text-xs text-amber-600">
              Le panier a changé depuis la déclaration : dû aujourd'hui {formatFCFA(p.dueNow)}. La
              différence deviendra un remboursement à la confirmation.
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="font-display text-xl font-bold">{formatFCFA(p.amount)}</div>
          {canHandle && p.state === "declared" && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={onReject}>
                <X className="mr-1 h-4 w-4" /> Introuvable
              </Button>
              <Button size="sm" onClick={onConfirm}>
                <Check className="mr-1 h-4 w-4" /> Reçu
              </Button>
            </div>
          )}
          {canHandle && p.state === "collected" && (
            <Button size="sm" onClick={onConfirm}>
              <Check className="mr-1 h-4 w-4" /> Espèces remises
            </Button>
          )}
          {canHandle && (p.state === "to_pay" || p.state === "refused") && (
            <Button size="sm" variant="outline" onClick={onConfirm}>
              Reçu sans déclaration
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({
  payment,
  onClose,
}: {
  payment: AdminPayment | null;
  onClose: () => void;
}) {
  const [ref, setRef] = useState("");
  // Le montant est saisi tel qu'il apparaît sur le compte marchand (ou
  // compté dans les mains du livreur) : il n'est pas prérempli exprès.
  const [received, setReceived] = useState("");
  const [busy, setBusy] = useState(false);
  if (!payment) return null;
  const needsRef = payment.mode === "prepaid" && payment.state !== "declared";
  const amount = payment.state === "declared" ? payment.amount : payment.dueNow;
  const submit = async () => {
    const value = Number(received.replace(/\D/g, ""));
    if (!value) {
      toast.error("Saisissez le montant reçu.");
      return;
    }
    if (needsRef && ref.trim().length < 4) {
      toast.error("Indiquez la référence de la transaction vue sur le compte marchand.");
      return;
    }
    setBusy(true);
    const res = await market.confirmPayment(payment.id, value, needsRef ? ref : undefined);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(
      payment.mode === "cash"
        ? "Espèces enregistrées"
        : "Paiement confirmé : les producteurs peuvent préparer",
    );
    setRef("");
    setReceived("");
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {payment.mode === "cash" ? "Espèces remises par le livreur" : "Confirmer le paiement"}
          </DialogTitle>
          <DialogDescription>
            {payment.mode === "cash"
              ? `${payment.collectedBy?.name ?? "Le livreur"} vous a remis ${formatFCFA(payment.amount)} pour ${payment.orderReferences.join(", ")} ?`
              : `Vous avez vu ${formatFCFA(amount)} arriver sur le compte marchand ${payment.method} pour ${payment.checkoutReference} (${payment.restaurantName}) ?`}
          </DialogDescription>
        </DialogHeader>
        {payment.state === "declared" && (
          <p className="text-sm">
            Référence déclarée : <span className="font-mono">{payment.providerRef}</span>
          </p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="admin-amount">
            {payment.mode === "cash"
              ? "Montant compté (F CFA)"
              : "Montant vu sur le compte marchand (F CFA)"}
          </Label>
          <Input
            id="admin-amount"
            inputMode="numeric"
            value={received}
            onChange={(e) => setReceived(e.target.value.replace(/\D/g, ""))}
            placeholder="Recopiez le montant, sans le deviner"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Attendu : {formatFCFA(payment.mode === "cash" ? payment.amount : amount)}. Si ce n'est
            pas le même montant, la confirmation est refusée.
          </p>
        </div>
        {needsRef && (
          <div className="space-y-1.5">
            <Label htmlFor="admin-ref">Référence de la transaction</Label>
            <Input
              id="admin-ref"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="Telle qu'elle apparaît sur le compte marchand"
              autoComplete="off"
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Enregistrement…" : "Oui, c'est reçu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({ payment, onClose }: { payment: AdminPayment | null; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (!payment) return null;
  const submit = async () => {
    if (reason.trim().length < 5) {
      toast.error("Expliquez au restaurant ce qui ne va pas.");
      return;
    }
    setBusy(true);
    const res = await market.rejectPayment(payment.id, reason);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success("Le restaurant est prévenu et peut déclarer à nouveau.");
    setReason("");
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Paiement introuvable</DialogTitle>
          <DialogDescription>
            {payment.checkoutReference} · {formatFCFA(payment.amount)} par {payment.method} (réf.{" "}
            {payment.providerRef}). Le restaurant verra votre message.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="reject-reason">Motif</Label>
          <Textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex. Aucune transaction avec cette référence sur le compte Wave"
            maxLength={300}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="destructive" onClick={submit} disabled={busy}>
            {busy ? "Envoi…" : "Prévenir le restaurant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Double validation ----------------------------------------------------------------

/** Au-dessus du seuil : « Valider (1/2) » par un premier admin, puis l'envoi
 * par un autre. En dessous : envoi direct. */
function TwoStepAction({
  needsTwoAdmins,
  approvedById,
  approvedByName,
  sendLabel,
  onApprove,
  onSend,
}: {
  needsTwoAdmins: boolean;
  approvedById?: string;
  approvedByName?: string;
  sendLabel: string;
  onApprove: () => void;
  onSend: () => void;
}) {
  const { me } = useMarketMode();
  if (!needsTwoAdmins) {
    return (
      <Button size="sm" onClick={onSend}>
        <Check className="mr-1 h-4 w-4" /> {sendLabel}
      </Button>
    );
  }
  if (!approvedById) {
    return (
      <Button size="sm" variant="outline" onClick={onApprove}>
        <Check className="mr-1 h-4 w-4" /> Valider (1/2)
      </Button>
    );
  }
  if (approvedById === me?.id) {
    return (
      <span className="text-xs text-muted-foreground" data-testid="awaiting-second-admin">
        Validé par vous · un autre administrateur doit l'envoyer
      </span>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="text-xs text-muted-foreground">
        Validé par {approvedByName ?? "un admin"}
      </span>
      <Button size="sm" onClick={onSend}>
        <Check className="mr-1 h-4 w-4" /> {sendLabel} (2/2)
      </Button>
    </div>
  );
}

const approve = async (call: () => Promise<{ ok: boolean; message?: string }>) => {
  const res = await call();
  if (!res.ok) toast.error(res.message ?? "Action impossible");
  else toast.success("Validé : un autre administrateur peut maintenant envoyer l'argent");
};

// --- Retraits des producteurs et livreurs ------------------------------------------

function PayoutsTab({
  payouts,
  canHandle,
  search,
}: {
  payouts: AdminPayout[];
  canHandle: boolean;
  search: string;
}) {
  const [paying, setPaying] = useState<AdminPayout | null>(null);
  const [refusing, setRefusing] = useState<AdminPayout | null>(null);
  const q = search.trim().toLowerCase();
  const shown = payouts.filter(
    (p) => !q || `${p.reference} ${p.name} ${p.accountNumber}`.toLowerCase().includes(q),
  );
  const open = shown.filter((p) => p.status === "requested" || p.status === "processing");
  const done = shown.filter((p) => !open.includes(p)).slice(0, 30);
  if (shown.length === 0) {
    return (
      <EmptyState
        icon={ArrowUpRight}
        title="Aucun retrait demandé"
        description="Quand un producteur ou un livreur retire son solde, sa demande apparaît ici."
      />
    );
  }
  return (
    <div className="space-y-3">
      {open.map((p) => (
        <div key={p.id} className="glass rounded-2xl p-4" data-testid="admin-payout">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{p.reference}</span>
                <span className="text-sm text-muted-foreground">
                  · {p.name} ({p.role === "driver" ? "livreur" : "producteur"})
                </span>
              </div>
              <div className="text-sm">
                À envoyer par <span className="font-semibold">{p.method}</span> au{" "}
                <span className="font-mono font-semibold">{p.accountNumber}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Demandé {relativeTime(p.createdAt)} · solde du compte {formatFCFA(p.balance)}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="font-display text-xl font-bold">{formatFCFA(p.amount)}</div>
              {canHandle && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setRefusing(p)}>
                    <X className="mr-1 h-4 w-4" /> Refuser
                  </Button>
                  <TwoStepAction
                    needsTwoAdmins={p.needsTwoAdmins}
                    approvedById={p.approvedById}
                    approvedByName={p.approvedByName}
                    sendLabel="Versé"
                    onApprove={() => void approve(() => market.approvePayout(p.id))}
                    onSend={() => setPaying(p)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
      {done.length > 0 && (
        <div className="glass rounded-2xl p-4">
          <h3 className="mb-2 text-sm font-semibold">Derniers retraits traités</h3>
          <ul className="divide-y divide-border text-sm">
            {done.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  {p.reference} · {p.name}
                  {p.providerRef ? ` · réf. ${p.providerRef}` : ""}
                  {p.note ? ` · ${p.note}` : ""}
                </span>
                <span className={p.status === "paid" ? "text-emerald-600" : "text-destructive"}>
                  {formatFCFA(p.amount)} ·{" "}
                  {p.status === "paid" ? `versé le ${dateTime(p.paidAt)}` : "refusé"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ReferenceDialog
        open={!!paying}
        title="Retrait versé"
        description={
          paying
            ? `Vous avez envoyé ${formatFCFA(paying.amount)} par ${paying.method} au ${paying.accountNumber} (${paying.name}) ?`
            : ""
        }
        onClose={() => setPaying(null)}
        onSubmit={(ref) => market.payPayout(paying!.id, ref)}
        success="Retrait enregistré : le compte est prévenu"
      />
      <ReasonDialog
        open={!!refusing}
        title="Refuser ce retrait"
        description={refusing ? `${refusing.reference} · ${formatFCFA(refusing.amount)}` : ""}
        placeholder="Ex. Numéro Wave invalide, merci de le corriger"
        onClose={() => setRefusing(null)}
        onSubmit={(reason) => market.rejectPayout(refusing!.id, reason)}
        success="Retrait refusé : le montant est de nouveau disponible"
      />
    </div>
  );
}

// --- Remboursements aux restaurants -------------------------------------------------

function RefundsTab({
  refunds,
  canHandle,
  search,
}: {
  refunds: AdminRefund[];
  canHandle: boolean;
  search: string;
}) {
  const [paying, setPaying] = useState<AdminRefund | null>(null);
  const q = search.trim().toLowerCase();
  const shown = refunds.filter(
    (r) =>
      !q ||
      `${r.reference} ${r.orderReference} ${r.restaurantName} ${r.checkoutReference}`
        .toLowerCase()
        .includes(q),
  );
  const open = shown.filter((r) => r.status === "pending" || r.status === "approved");
  const done = shown.filter((r) => !open.includes(r)).slice(0, 30);
  if (shown.length === 0) {
    return (
      <EmptyState
        icon={RotateCcw}
        title="Aucun remboursement"
        description="Quantités manquantes après paiement, commandes annulées et refus à la réception apparaissent ici."
      />
    );
  }
  return (
    <div className="space-y-3">
      {open.map((r) => (
        <div key={r.id} className="glass rounded-2xl p-4" data-testid="admin-refund">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{r.reference}</span>
                <span className="text-sm text-muted-foreground">
                  · {r.restaurantName} · {r.orderReference}
                </span>
              </div>
              <div className="text-sm">{REFUND_SOURCE_LABEL[r.source]}</div>
              <div className="text-xs text-muted-foreground">
                {r.reason ? `${r.reason} · ` : ""}créé {relativeTime(r.createdAt)}
                {r.bornBy === "farmer" ? " · repris sur le solde du producteur" : ""}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="font-display text-xl font-bold">{formatFCFA(r.amount)}</div>
              {canHandle && (
                <TwoStepAction
                  needsTwoAdmins={r.needsTwoAdmins}
                  approvedById={r.status === "approved" ? r.approvedById : undefined}
                  approvedByName={r.approvedByName}
                  sendLabel="Remboursé"
                  onApprove={() => void approve(() => market.approveRefund(r.id))}
                  onSend={() => setPaying(r)}
                />
              )}
            </div>
          </div>
        </div>
      ))}
      {done.length > 0 && (
        <div className="glass rounded-2xl p-4">
          <h3 className="mb-2 text-sm font-semibold">Derniers remboursements</h3>
          <ul className="divide-y divide-border text-sm">
            {done.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  {r.reference} · {r.restaurantName}
                  {r.providerRef ? ` · réf. ${r.providerRef}` : ""}
                </span>
                <span className="text-emerald-600">
                  {formatFCFA(r.amount)} · remboursé le {dateTime(r.paidAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {paying && <RefundDialog refund={paying} onClose={() => setPaying(null)} />}
    </div>
  );
}

function RefundDialog({ refund, onClose }: { refund: AdminRefund; onClose: () => void }) {
  const [method, setMethod] = useState<"wave" | "orange_money">(
    refund.method === "Orange Money" ? "orange_money" : "wave",
  );
  const [to, setTo] = useState(refund.restaurantPhone);
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const res = await market.payRefund(refund.id, method, to, ref);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success("Remboursement enregistré : le restaurant est prévenu");
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remboursement envoyé</DialogTitle>
          <DialogDescription>
            {refund.reference} · {formatFCFA(refund.amount)} à {refund.restaurantName} (
            {REFUND_SOURCE_LABEL[refund.source].toLowerCase()}).
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          {(["wave", "orange_money"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={cn(
                "flex-1 rounded-xl border px-3 py-2 text-sm",
                method === m ? "border-primary bg-primary/10 text-primary" : "border-border",
              )}
            >
              {m === "wave" ? "Wave" : "Orange Money"}
            </button>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="refund-to">Numéro qui a reçu l'argent</Label>
          <Input id="refund-to" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="refund-ref">Référence de la transaction</Label>
          <Input
            id="refund-ref"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            autoComplete="off"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Soldes ---------------------------------------------------------------------------

function BalancesTab({ search }: { search: string }) {
  const accounts = useAdminAccounts();
  const q = search.trim().toLowerCase();
  const shown = accounts.filter((a) => !q || `${a.name} ${a.phone}`.toLowerCase().includes(q));
  if (shown.length === 0) {
    return (
      <EmptyState
        icon={Scale}
        title="Aucun solde pour l'instant"
        description="Chaque livraison crédite le producteur et le livreur : leurs soldes apparaissent ici."
      />
    );
  }
  return (
    <div className="glass overflow-x-auto rounded-2xl">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr>
            <th className="p-3">Compte</th>
            <th className="p-3">Téléphone</th>
            <th className="p-3 text-right">Solde</th>
            <th className="p-3 text-right">Retraits en cours</th>
            <th className="p-3 text-right">Espèces à remettre</th>
            <th className="p-3 text-right">Disponible</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {shown.map((a) => (
            <tr key={a.userId}>
              <td className="p-3">
                {a.name}{" "}
                <span className="text-xs text-muted-foreground">
                  ({a.role === "driver" ? "livreur" : "producteur"})
                </span>
              </td>
              <td className="p-3">{a.phone}</td>
              <td className="p-3 text-right font-semibold">{formatFCFA(a.balance)}</td>
              <td className="p-3 text-right">{formatFCFA(a.reserved)}</td>
              <td className="p-3 text-right">{a.cashHeld ? formatFCFA(a.cashHeld) : "—"}</td>
              <td className="p-3 text-right">{formatFCFA(a.available)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Boîtes de dialogue communes ------------------------------------------------------

function ReferenceDialog({
  open,
  title,
  description,
  onClose,
  onSubmit,
  success,
}: {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  onSubmit: (ref: string) => Promise<{ ok: boolean; message?: string }>;
  success: string;
}) {
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open) return null;
  const submit = async () => {
    if (ref.trim().length < 4) {
      toast.error("Indiquez la référence de la transaction.");
      return;
    }
    setBusy(true);
    const res = await onSubmit(ref);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.message ?? "Action impossible");
      return;
    }
    toast.success(success);
    setRef("");
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="out-ref">Référence de la transaction</Label>
          <Input
            id="out-ref"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            autoComplete="off"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReasonDialog({
  open,
  title,
  description,
  placeholder,
  onClose,
  onSubmit,
  success,
}: {
  open: boolean;
  title: string;
  description: string;
  placeholder: string;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<{ ok: boolean; message?: string }>;
  success: string;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open) return null;
  const submit = async () => {
    if (reason.trim().length < 5) {
      toast.error("Indiquez le motif.");
      return;
    }
    setBusy(true);
    const res = await onSubmit(reason);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.message ?? "Action impossible");
      return;
    }
    toast.success(success);
    setReason("");
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={placeholder}
          maxLength={300}
          aria-label="Motif"
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="destructive" onClick={submit} disabled={busy}>
            {busy ? "Envoi…" : "Refuser"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Rapprochement du jour ----------------------------------------------------------

/** Entrées et sorties confirmées un jour donné, par moyen de paiement : à
 * comparer chaque soir avec le relevé du compte marchand (et la caisse). */
function Reconciliation({
  payments,
  payouts,
  refunds,
}: {
  payments: AdminPayment[];
  payouts: AdminPayout[];
  refunds: AdminRefund[];
}) {
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const rows = useMemo(() => {
    const onDay = (iso?: string) => !!iso && iso.slice(0, 10) === day;
    const out: {
      at: string;
      kind: "Encaissement" | "Retrait versé" | "Remboursement";
      method: string;
      amount: number;
      ourRef: string;
      providerRef: string;
      who: string;
      by: string;
    }[] = [];
    for (const p of payments) {
      if (p.state !== "paid" || !onDay(p.paidAt)) continue;
      out.push({
        at: p.paidAt!,
        kind: "Encaissement",
        method: p.mode === "cash" ? "Espèces" : p.method,
        amount: p.amount,
        ourRef: p.mode === "cash" ? p.orderReferences.join(" ") : p.checkoutReference,
        providerRef: p.providerRef ?? "",
        who:
          p.mode === "cash"
            ? `${p.restaurantName} (via ${p.collectedBy?.name ?? "livreur"})`
            : p.restaurantName,
        by: p.confirmedByName ?? "",
      });
    }
    for (const w of payouts) {
      if (w.status !== "paid" || !onDay(w.paidAt)) continue;
      out.push({
        at: w.paidAt!,
        kind: "Retrait versé",
        method: w.method,
        amount: -w.amount,
        ourRef: w.reference,
        providerRef: w.providerRef ?? "",
        who: `${w.name} · ${w.accountNumber}`,
        by: "",
      });
    }
    for (const r of refunds) {
      if (r.status !== "paid" || !onDay(r.paidAt)) continue;
      out.push({
        at: r.paidAt!,
        kind: "Remboursement",
        method: r.method ?? "",
        amount: -r.amount,
        ourRef: r.reference,
        providerRef: r.providerRef ?? "",
        who: `${r.restaurantName}${r.paidTo ? ` · ${r.paidTo}` : ""}`,
        by: "",
      });
    }
    return out.sort((a, b) => a.at.localeCompare(b.at));
  }, [payments, payouts, refunds, day]);
  const net = (method: string) =>
    rows.filter((r) => r.method === method).reduce((s, r) => s + r.amount, 0);
  const exportDay = () =>
    downloadCsv(
      `diambar-rapprochement-${day}`,
      [
        "Heure",
        "Type",
        "Moyen",
        "Montant (F CFA)",
        "Référence Diambar",
        "Référence transaction",
        "Contrepartie",
        "Confirmé par",
      ],
      rows.map((r) => [
        new Date(r.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        r.kind,
        r.method,
        r.amount,
        r.ourRef,
        r.providerRef,
        r.who,
        r.by,
      ]),
    );
  return (
    <div className="glass space-y-3 rounded-2xl p-4" data-testid="reconciliation">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Rapprochement du jour</h3>
          <p className="text-xs text-muted-foreground">
            À comparer chaque soir avec le relevé du compte marchand et la caisse des espèces.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="w-40"
            aria-label="Jour"
          />
          <Button variant="outline" size="sm" onClick={exportDay} disabled={rows.length === 0}>
            Exporter (CSV)
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
        {["Wave", "Orange Money", "Espèces"].map((m) => (
          <div key={m} className="rounded-xl border border-border p-3">
            <div className="text-xs text-muted-foreground">{m} : solde du jour</div>
            <div className="font-display text-lg font-bold">{formatFCFA(net(m))}</div>
            <div className="text-xs text-muted-foreground">
              {rows.filter((r) => r.method === m && r.amount > 0).length} entrée(s) ·{" "}
              {rows.filter((r) => r.method === m && r.amount < 0).length} sortie(s)
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
