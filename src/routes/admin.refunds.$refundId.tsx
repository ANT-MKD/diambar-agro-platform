import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  X,
  Banknote,
  RotateCcw,
  ExternalLink,
  ImageIcon,
  TriangleAlert,
} from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatFCFA, relativeTime } from "@/lib/format";
import { commissionForAmount, deliveredVolumeByFarmer } from "@/lib/commission";
import { auditActions, useCommissionTiers } from "@/data/admin-store";
import {
  useRefund,
  refundActions,
  refundedTotalForOrder,
  useRefunds,
  REFUND_SOURCE_LABEL,
  REFUND_STATUS_LABEL,
  type RefundMethod,
  type RefundStatus,
} from "@/data/finance";
import { useOrders, useMissions } from "@/data/store";
import { useAllDisputes } from "@/data/disputes";
import { useIncidents, useReturns } from "@/data/business";
import { useRefundSettings } from "@/data/admin-store";

export const Route = createFileRoute("/admin/refunds/$refundId")({
  head: () => ({
    meta: [
      { title: "Dossier de remboursement — Administration Diambar Agro" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminRefundDetail,
});

const STATUS_CLASS: Record<RefundStatus, string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  approved: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  paid: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  failed: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

const METHODS: RefundMethod[] = ["Wave", "Orange Money", "Free Money", "Virement"];

function AdminRefundDetail() {
  const { refundId } = Route.useParams();
  const refund = useRefund(refundId);
  const allRefunds = useRefunds();
  const orders = useOrders();
  const missions = useMissions();
  const disputes = useAllDisputes();
  const incidents = useIncidents();
  const returns = useReturns();
  const tiers = useCommissionTiers();
  const settings = useRefundSettings();

  const [note, setNote] = useState("");
  const [deciding, setDeciding] = useState(false);
  const [retryOpen, setRetryOpen] = useState(false);
  const [retryMethod, setRetryMethod] = useState<RefundMethod>("Wave");

  if (!refund) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <h2 className="font-semibold">Dossier introuvable</h2>
        <Link to="/admin/refunds" className="mt-4 inline-block text-sm text-primary">
          Retour
        </Link>
      </div>
    );
  }

  const order = orders.find((o) => o.reference === refund.orderRef);
  const mission = order ? missions.find((m) => m.orderRef === order.reference) : undefined;
  const dispute = refund.disputeId ? disputes.find((d) => d.id === refund.disputeId) : undefined;
  const incident = refund.incidentId
    ? incidents.find((i) => i.id === refund.incidentId)
    : undefined;
  const returnReq = refund.returnId ? returns.find((r) => r.id === refund.returnId) : undefined;

  const volumeByFarmer = order ? deliveredVolumeByFarmer(orders) : undefined;
  const commission =
    order && volumeByFarmer
      ? commissionForAmount(order, tiers, volumeByFarmer, refund.amount)
      : null;
  const farmerShare = commission !== null ? refund.amount - commission : null;

  const alreadyRefunded = refundedTotalForOrder(allRefunds, refund.orderRef, refund.id);
  const refundableBalance = order ? order.total - alreadyRefunded : null;
  const overBalance =
    refundableBalance !== null && refund.status === "pending" && refund.amount > refundableBalance;

  const proofs = dispute?.attachments ?? returnReq?.photos ?? [];

  const startDeciding = () => {
    setNote("");
    setDeciding(true);
  };

  const approve = () => {
    if (overBalance) {
      toast.error("Montant supérieur au solde remboursable de cette commande");
      return;
    }
    if (refund.amount > settings.justificationThreshold && !note.trim()) {
      toast.error(
        `Une justification est obligatoire au-delà de ${formatFCFA(settings.justificationThreshold)}`,
      );
      return;
    }
    refundActions.approve(refund.id, note || undefined);
    auditActions.log("Remboursement approuvé", refund.reference, "info");
    toast.success("Remboursement approuvé");
    setDeciding(false);
    setNote("");
  };

  const reject = () => {
    if (!note.trim()) {
      toast.error("Indiquez un motif de rejet");
      return;
    }
    refundActions.reject(refund.id, note);
    auditActions.log("Remboursement rejeté", refund.reference, "warning");
    toast.success("Remboursement rejeté");
    setDeciding(false);
    setNote("");
  };

  const markPaid = () => {
    refundActions.markPaid(refund.id);
    auditActions.log("Remboursement exécuté", refund.reference, "info");
    toast.success("Remboursement exécuté", {
      description: `${formatFCFA(refund.amount)} via ${refund.method}`,
    });
  };

  const markFailed = () => {
    const reason = window.prompt("Motif de l'échec ?");
    if (!reason) return;
    refundActions.markFailed(refund.id, reason);
    auditActions.log("Remboursement en échec", refund.reference, "warning");
    toast.error("Remboursement marqué en échec");
  };

  const retry = () => {
    refundActions.retry(refund.id, retryMethod);
    auditActions.log("Nouvelle tentative de remboursement", refund.reference, "info");
    toast.success("Dossier repassé en cours");
    setRetryOpen(false);
  };

  return (
    <div className="space-y-6">
      <Link
        to="/admin/refunds"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Remboursements
      </Link>

      <PageHeader
        title={`Remboursement ${refund.reference}`}
        subtitle={`${REFUND_SOURCE_LABEL[refund.source]} · Commande ${refund.orderRef} · Soumis ${relativeTime(refund.createdAt)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_CLASS[refund.status]}`}
            >
              {REFUND_STATUS_LABEL[refund.status]}
            </span>
            {refund.status === "pending" && !deciding && (
              <Button size="sm" onClick={startDeciding}>
                Traiter le dossier
              </Button>
            )}
            {refund.status === "approved" && (
              <>
                <Button size="sm" className="gap-2" onClick={markPaid}>
                  <Banknote className="h-4 w-4" />
                  Marquer comme remboursé
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 text-destructive"
                  onClick={markFailed}
                >
                  <X className="h-4 w-4" />
                  Marquer en échec
                </Button>
              </>
            )}
            {refund.status === "failed" && (
              <Button size="sm" className="gap-2" onClick={() => setRetryOpen(true)}>
                <RotateCcw className="h-4 w-4" />
                Réessayer
              </Button>
            )}
          </div>
        }
      />

      {overBalance && (
        <div className="flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <TriangleAlert className="h-5 w-5 shrink-0" />
          <span>
            ⚠️ Montant supérieur au solde remboursable de cette commande (
            {formatFCFA(refundableBalance ?? 0)} disponible sur {formatFCFA(order?.total ?? 0)}).
          </span>
        </div>
      )}

      {deciding && (
        <div className="glass rounded-2xl p-5 space-y-3">
          <h3 className="font-semibold">Décision</h3>
          {refund.amount > settings.justificationThreshold && (
            <p className="text-xs text-destructive">
              Justification obligatoire au-delà de {formatFCFA(settings.justificationThreshold)}.
            </p>
          )}
          <Textarea
            placeholder="Note de décision"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="gap-2" onClick={approve}>
              <Check className="h-4 w-4" />
              Approuver
            </Button>
            <Button size="sm" variant="destructive" className="gap-2" onClick={reject}>
              <X className="h-4 w-4" />
              Rejeter
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDeciding(false)}>
              Annuler
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass rounded-2xl p-5 space-y-2.5">
          <h2 className="font-semibold">Résumé financier</h2>
          <Row label="Commande" value={refund.orderRef} />
          <Row label="Montant commande" value={order ? formatFCFA(order.total) : "—"} />
          <Row label="Montant demandé" value={formatFCFA(refund.amount)} />
          <Row label="Méthode" value={refund.method} />
          <Row label="Bénéficiaire" value={refund.requester} />
          <Row label="Référence dossier" value={refund.reference} />
        </div>

        <div className="glass rounded-2xl p-5 space-y-2.5">
          <h2 className="font-semibold">Pourquoi le remboursement ?</h2>
          <Row label="Origine" value={REFUND_SOURCE_LABEL[refund.source]} />
          <p className="text-sm">{refund.reason}</p>
          {refund.note && (
            <p className="text-xs text-muted-foreground">Note de décision : {refund.note}</p>
          )}
          <Row label="Créé le" value={new Date(refund.createdAt).toLocaleString("fr-FR")} />
          {refund.decidedAt && (
            <Row label="Décidé le" value={new Date(refund.decidedAt).toLocaleString("fr-FR")} />
          )}
        </div>

        <div className="glass rounded-2xl p-5 space-y-2">
          <h2 className="font-semibold">Connexions</h2>
          {order && (
            <Link
              to="/admin/orders/$orderId"
              params={{ orderId: order.id }}
              className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-xs hover:bg-accent"
            >
              Commande {refund.orderRef}
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </Link>
          )}
          {mission && (
            <Link
              to="/admin/deliveries/$missionId"
              params={{ missionId: mission.id }}
              className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-xs hover:bg-accent"
            >
              Livraison {mission.reference}
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </Link>
          )}
          {dispute && (
            <Link
              to="/admin/disputes/$disputeId"
              params={{ disputeId: dispute.id }}
              className="flex items-center justify-between rounded-xl border border-destructive/30 px-3 py-2 text-xs text-destructive hover:bg-destructive/5"
            >
              Litige {dispute.reference}
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
          {incident && (
            <Link
              to="/admin/incidents/$incidentId"
              params={{ incidentId: incident.id }}
              className="flex items-center justify-between rounded-xl border border-amber-500/30 px-3 py-2 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-500/5"
            >
              Incident {incident.reference}
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
          {returnReq && (
            <Link
              to="/admin/returns"
              className="flex items-center justify-between rounded-xl border border-blue-500/30 px-3 py-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-500/5"
            >
              Retour {returnReq.reference}
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
          {!order && !dispute && !incident && !returnReq && (
            <p className="text-xs text-muted-foreground">Aucun élément lié trouvé.</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold">Calcul du remboursement</h2>
          {order && commission !== null && farmerShare !== null ? (
            <div className="space-y-1.5 text-sm">
              <Row label="Montant commande" value={formatFCFA(order.total)} />
              <Row label="Montant concerné" value={formatFCFA(refund.amount)} />
              <div className="border-t border-border pt-1.5 mt-1.5" />
              <Row label="Commission plateforme (au prorata)" value={formatFCFA(commission)} />
              <Row label="Montant agriculteur concerné" value={formatFCFA(farmerShare)} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Commande introuvable — calcul de commission indisponible.
            </p>
          )}
          {refundableBalance !== null && (
            <div className="rounded-xl border border-border p-3 text-xs space-y-1">
              <Row label="Déjà remboursé (hors ce dossier)" value={formatFCFA(alreadyRefunded)} />
              <Row label="Solde remboursable" value={formatFCFA(refundableBalance)} />
            </div>
          )}
        </div>

        <div className="glass rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold">Preuves</h2>
          {proofs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune preuve jointe au dossier source.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {proofs.map((p) => (
                <div key={p.id} className="rounded-xl border border-border overflow-hidden">
                  {p.dataUrl && p.mime.startsWith("image/") ? (
                    <img src={p.dataUrl} alt={p.name} className="h-24 w-full object-cover" />
                  ) : (
                    <div className="h-24 w-full grid place-items-center bg-muted text-muted-foreground">
                      <ImageIcon className="h-6 w-6" />
                    </div>
                  )}
                  <div className="p-2 text-[11px] truncate text-muted-foreground">{p.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
        <h2 className="font-semibold mb-3">Historique des décisions</h2>
        <ol className="space-y-3 border-l-2 border-border pl-4">
          {refund.history.map((h, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
              <div className="text-sm font-medium">{h.text}</div>
              <div className="text-[11px] text-muted-foreground">
                {h.actor} · {relativeTime(h.at)}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {retryOpen && (
        <div className="glass rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold">Réessayer le remboursement</h2>
          <Select value={retryMethod} onValueChange={(v) => setRetryMethod(v as RefundMethod)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button size="sm" className="gap-2" onClick={retry}>
              <RotateCcw className="h-4 w-4" />
              Confirmer
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRetryOpen(false)}>
              Annuler
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
