import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Banknote, Check, Clock, Hourglass, Search, Wallet, X } from "lucide-react";
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
import { useAdminPayments, useMerchantNumbers } from "@/data/payments-store";
import { formatFCFA, relativeTime } from "@/lib/format";
import { PAYMENT_STATE_LABEL, type AdminPayment } from "@/lib/market/payment-view";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/payments")({
  head: () => ({ meta: [{ title: "Encaissements — Admin Diambar" }] }),
  component: PaymentsPage,
});

// Encaissements du pilote, sans paiement intégré : l'admin rapproche ce que
// les restaurants déclarent avec ce qu'il voit sur le compte marchand Wave /
// Orange Money, et récupère les espèces encaissées par les livreurs.

type Tab = "check" | "cash" | "unpaid" | "history";

const TABS: { key: Tab; label: string }[] = [
  { key: "check", label: "À vérifier" },
  { key: "cash", label: "Espèces chez les livreurs" },
  { key: "unpaid", label: "Non payés" },
  { key: "history", label: "Historique" },
];

const inTab = (p: AdminPayment, tab: Tab) =>
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
  const merchant = useMerchantNumbers();
  const [tab, setTab] = useState<Tab>("check");
  const [search, setSearch] = useState("");
  const [confirming, setConfirming] = useState<AdminPayment | null>(null);
  const [rejecting, setRejecting] = useState<AdminPayment | null>(null);

  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.key, payments.filter((p) => inTab(p, t.key))])),
    [payments],
  ) as Record<Tab, AdminPayment[]>;

  const list = useMemo(() => {
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
            {t.label} ({counts[t.key].length})
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

      {list.length === 0 ? (
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
  const [busy, setBusy] = useState(false);
  if (!payment) return null;
  const needsRef = payment.mode === "prepaid" && payment.state !== "declared";
  const amount = payment.state === "declared" ? payment.amount : payment.dueNow;
  const submit = async () => {
    if (needsRef && ref.trim().length < 4) {
      toast.error("Indiquez la référence de la transaction vue sur le compte marchand.");
      return;
    }
    setBusy(true);
    const res = await market.confirmPayment(payment.id, needsRef ? ref : undefined);
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
