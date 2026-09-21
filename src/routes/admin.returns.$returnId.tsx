import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  Check,
  X,
  Truck,
  ClipboardCheck,
  Undo2,
  Scale,
  ExternalLink,
  Phone,
  Building2,
  Sprout,
  PackageMinus,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { AdminBadge } from "@/components/admin/admin-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useReturn,
  returnActions,
  returnStage,
  RETURN_STAGE_LABEL,
  RETURN_REASON_LABEL,
  RETURN_RESOLUTION_LABEL,
  farmerForReturn,
  type ReturnResolutionType,
} from "@/data/business";
import {
  useRefunds,
  REFUND_BORN_BY_LABEL,
  REFUND_STATUS_LABEL,
  type RefundBornBy,
} from "@/data/finance";
import { useOrders } from "@/data/store";
import { auditActions } from "@/data/admin-store";
import { drivers, restaurants } from "@/data/mocks";
import { formatFCFA, relativeTime } from "@/lib/format";

export const Route = createFileRoute("/admin/returns/$returnId")({
  head: () => ({
    meta: [
      { title: "Dossier de retour — Administration Diambar Agro" },
      {
        name: "description",
        content: "Récupération, inspection, décision motivée et remboursement d'un retour.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminReturnDetail,
});

const HAPPY_PATH: { key: string; label: string }[] = [
  { key: "pending", label: "Demande" },
  { key: "awaiting_pickup", label: "Décision" },
  { key: "in_pickup", label: "Récupération" },
  { key: "received", label: "Réception" },
  { key: "inspected", label: "Inspection" },
  { key: "resolved", label: "Décision finale" },
  { key: "closed", label: "Clôture" },
];

function AdminReturnDetail() {
  const { returnId } = Route.useParams();
  const r = useReturn(returnId);
  const refunds = useRefunds();
  const orders = useOrders();

  const [pickupDriver, setPickupDriver] = useState(drivers[0]?.id ?? "");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [receivedCondition, setReceivedCondition] = useState("");
  const [inspectionConform, setInspectionConform] = useState<"yes" | "no">("yes");
  const [inspectionNote, setInspectionNote] = useState("");
  const [decisionType, setDecisionType] = useState<ReturnResolutionType>("refund");
  const [decisionBornBy, setDecisionBornBy] = useState<RefundBornBy>("farmer");
  const [decisionAmount, setDecisionAmount] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [escalateNote, setEscalateNote] = useState("");
  const [escalateOpen, setEscalateOpen] = useState(false);

  if (!r) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <h2 className="font-semibold">Retour introuvable</h2>
        <Link to="/admin/returns" className="mt-4 inline-block text-sm text-primary">
          Retour à la liste
        </Link>
      </div>
    );
  }

  const order = orders.find((o) => o.reference === r.orderRef);
  const restaurant = restaurants.find((x) => x.id === r.restaurantId);
  const farmer = farmerForReturn(r);
  const orderedQty = order?.items.find((i) => i.productId === r.productId)?.qty;
  const refund = refunds.find((f) => f.returnId === r.id);
  const stage = returnStage(r);
  const happyIndex = HAPPY_PATH.findIndex((s) => s.key === stage);
  const canPickup = !r.closedAt && r.status !== "refused";
  const canDecide = !r.closedAt && r.status !== "refused" && !r.resolution;
  const canRevise = !r.closedAt && r.resolution && refund && refund.status !== "paid";

  const schedulePickup = () => {
    if (!pickupDate || !pickupDriver) {
      toast.error("Choisissez un livreur et un créneau");
      return;
    }
    const driver = drivers.find((d) => d.id === pickupDriver);
    if (!driver) return;
    returnActions.adminSchedulePickup(r.id, {
      driverId: driver.id,
      driverName: driver.name,
      scheduledFor: new Date(pickupDate).toISOString(),
      address:
        pickupAddress.trim() ||
        `${restaurant?.name ?? r.restaurantName}, ${restaurant?.city ?? ""}`,
    });
    auditActions.log(`Récupération programmée — ${driver.name}`, r.reference, "info");
    toast.success("Récupération programmée");
  };

  const markReceived = () => {
    if (!receivedCondition.trim()) {
      toast.error("Indiquez l'état constaté à la réception");
      return;
    }
    returnActions.adminMarkReceived(r.id, receivedCondition.trim());
    auditActions.log("Produit réceptionné", r.reference, "info");
    toast.success("Produit réceptionné");
  };

  const submitInspection = () => {
    if (!inspectionNote.trim()) {
      toast.error("Indiquez une note d'inspection");
      return;
    }
    returnActions.adminSetInspection(r.id, {
      conform: inspectionConform === "yes",
      note: inspectionNote.trim(),
    });
    auditActions.log(
      inspectionConform === "yes" ? "Inspection : conforme" : "Inspection : non conforme",
      r.reference,
      "info",
    );
    toast.success("Inspection enregistrée");
  };

  const submitDecision = () => {
    if (!decisionNote.trim()) {
      toast.error("Une justification est obligatoire");
      return;
    }
    const amount = decisionAmount.trim() ? Number(decisionAmount) : undefined;
    returnActions.adminResolve(r.id, {
      type: decisionType,
      bornBy: decisionBornBy,
      amount,
      note: decisionNote.trim(),
    });
    auditActions.log(
      `Décision retour : ${RETURN_RESOLUTION_LABEL[decisionType]}`,
      r.reference,
      decisionType === "reject" ? "warning" : "info",
    );
    toast.success("Décision enregistrée");
    setDecisionNote("");
  };

  const submitEscalation = () => {
    if (!escalateNote.trim()) {
      toast.error("Indiquez le motif de l'escalade");
      return;
    }
    returnActions.adminEscalateToDispute(r.id, escalateNote.trim());
    auditActions.log("Retour escaladé en litige", r.reference, "warning");
    toast.success("Retour escaladé en litige");
    setEscalateOpen(false);
    setEscalateNote("");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            Retour {r.reference}
            <AdminBadge value={stage} label={RETURN_STAGE_LABEL[stage]} />
          </span>
        }
        subtitle={`${r.orderRef} · ${RETURN_REASON_LABEL[r.reason]}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to="/admin/returns">
                <ArrowLeft className="h-4 w-4" />
                Retour à la liste
              </Link>
            </Button>
            {restaurant?.phone && (
              <Button asChild variant="outline" size="sm" className="gap-2">
                <a href={`tel:${restaurant.phone}`}>
                  <Phone className="h-4 w-4" />
                  Contacter le client
                </a>
              </Button>
            )}
            {order && (
              <Button asChild variant="outline" size="sm" className="gap-2">
                <Link to="/admin/orders/$orderId" params={{ orderId: order.id }}>
                  Voir la commande
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        }
      />

      {r.status === "refused" ? (
        <div className="glass rounded-2xl p-4 border border-destructive/30 bg-destructive/5">
          <p className="text-sm font-medium text-destructive">Retour refusé</p>
          {r.decisionNote && <p className="text-sm mt-1">{r.decisionNote}</p>}
        </div>
      ) : (
        <div className="glass rounded-2xl p-5 overflow-x-auto">
          <div className="flex items-center min-w-max">
            {HAPPY_PATH.map((s, i) => (
              <div key={s.key} className="flex items-center">
                <div className="flex flex-col items-center gap-1 w-24">
                  {i <= happyIndex ? (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/40" />
                  )}
                  <span
                    className={`text-[11px] text-center ${i <= happyIndex ? "font-medium" : "text-muted-foreground"}`}
                  >
                    {s.label}
                  </span>
                </div>
                {i < HAPPY_PATH.length - 1 && (
                  <div className={`h-0.5 w-10 ${i < happyIndex ? "bg-primary" : "bg-border"}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-2xl p-5 space-y-3">
            <h3 className="font-semibold">Informations générales</h3>
            <div className="grid sm:grid-cols-2 gap-y-2 text-sm">
              <div className="text-muted-foreground">Référence</div>
              <div className="font-medium">{r.reference}</div>
              <div className="text-muted-foreground">Date de demande</div>
              <div className="font-medium">
                {new Date(r.createdAt).toLocaleString("fr-FR", {
                  dateStyle: "long",
                  timeStyle: "short",
                })}
              </div>
              <div className="text-muted-foreground">Motif</div>
              <div className="font-medium">{RETURN_REASON_LABEL[r.reason]}</div>
              <div className="text-muted-foreground">Montant demandé</div>
              <div className="font-medium">{formatFCFA(r.requestedAmount)}</div>
              {r.awardedAmount !== undefined && (
                <>
                  <div className="text-muted-foreground">Montant accordé</div>
                  <div className="font-medium text-emerald-600 dark:text-emerald-400">
                    {formatFCFA(r.awardedAmount)}
                  </div>
                </>
              )}
            </div>
            <p className="pt-2 border-t border-border text-sm">{r.description}</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="glass rounded-2xl p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" />
                Client
              </div>
              <div className="font-medium">{restaurant?.name ?? r.restaurantName}</div>
              {restaurant && <div className="text-xs text-muted-foreground">{restaurant.city}</div>}
            </div>
            <div className="glass rounded-2xl p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Sprout className="h-3.5 w-3.5" />
                Agriculteur
              </div>
              <div className="font-medium">{farmer?.name ?? "—"}</div>
              {farmer && <div className="text-xs text-muted-foreground">{farmer.farm}</div>}
            </div>
            <div className="glass rounded-2xl p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Truck className="h-3.5 w-3.5" />
                Livreur
              </div>
              <div className="font-medium">{r.pickup?.driverName ?? "Non assigné"}</div>
              {r.pickup && (
                <div className="text-xs text-muted-foreground">
                  {new Date(r.pickup.scheduledFor).toLocaleString("fr-FR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <h3 className="font-semibold mb-3">Produit</h3>
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-xl bg-muted">
                <PackageMinus className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="font-medium">{r.productName}</div>
                <div className="text-sm text-muted-foreground">
                  Retourné : {r.qty} {r.unit}
                  {orderedQty !== undefined && ` · Commandé : ${orderedQty} ${r.unit}`}
                </div>
                {orderedQty !== undefined && r.qty > orderedQty && (
                  <div className="text-xs text-destructive mt-0.5">
                    Quantité retournée supérieure à la quantité commandée
                  </div>
                )}
              </div>
            </div>
          </div>

          {r.photos && r.photos.length > 0 && (
            <div className="glass rounded-2xl p-5">
              <h3 className="font-semibold mb-3">Preuves du client ({r.photos.length})</h3>
              <div className="grid sm:grid-cols-3 gap-3">
                {r.photos.map((p) =>
                  p.dataUrl ? (
                    <a
                      key={p.id}
                      href={p.dataUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-xl overflow-hidden border border-border aspect-square"
                    >
                      <img src={p.dataUrl} alt={p.name} className="h-full w-full object-cover" />
                    </a>
                  ) : null,
                )}
              </div>
            </div>
          )}

          {canPickup && (
            <div className="glass rounded-2xl p-5 space-y-3">
              <h3 className="font-semibold">Récupération</h3>
              {!r.pickup ? (
                <div className="space-y-2">
                  <div className="grid sm:grid-cols-2 gap-2">
                    <select
                      value={pickupDriver}
                      onChange={(e) => setPickupDriver(e.target.value)}
                      className="h-9 rounded-xl border border-border bg-background px-3 text-sm"
                    >
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.vehicle})
                        </option>
                      ))}
                    </select>
                    <Input
                      type="datetime-local"
                      value={pickupDate}
                      onChange={(e) => setPickupDate(e.target.value)}
                    />
                  </div>
                  <Input
                    placeholder={`Adresse (${restaurant?.name ?? r.restaurantName}, ${restaurant?.city ?? ""})`}
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                  />
                  <Button size="sm" className="gap-2" onClick={schedulePickup}>
                    <Truck className="h-4 w-4" />
                    Assigner un livreur
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="text-muted-foreground">
                    {r.pickup.driverName} · {r.pickup.address} ·{" "}
                    {new Date(r.pickup.scheduledFor).toLocaleString("fr-FR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </div>
                  {r.pickup.status === "scheduled" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        returnActions.adminMarkPickedUp(r.id);
                        auditActions.log("Produit récupéré chez le client", r.reference, "info");
                      }}
                    >
                      Marquer récupéré
                    </Button>
                  )}
                  {r.pickup.status === "picked_up" && (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="État constaté à la réception"
                        value={receivedCondition}
                        onChange={(e) => setReceivedCondition(e.target.value)}
                      />
                      <Button size="sm" onClick={markReceived}>
                        Marquer réceptionné
                      </Button>
                    </div>
                  )}
                  {r.pickup.status === "received" && (
                    <p className="text-emerald-600 dark:text-emerald-400">
                      Réceptionné {relativeTime(r.pickup.receivedAt!)} — état :{" "}
                      {r.pickup.receivedCondition}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {r.pickup?.status === "received" && (
            <div className="glass rounded-2xl p-5 space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4" />
                Inspection
              </h3>
              {!r.inspection ? (
                <div className="space-y-2">
                  <div className="flex gap-3 text-sm">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        checked={inspectionConform === "yes"}
                        onChange={() => setInspectionConform("yes")}
                      />
                      Conforme au signalement du client
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        checked={inspectionConform === "no"}
                        onChange={() => setInspectionConform("no")}
                      />
                      Non conforme au signalement
                    </label>
                  </div>
                  <Textarea
                    placeholder="Constat détaillé de l'inspection"
                    value={inspectionNote}
                    onChange={(e) => setInspectionNote(e.target.value)}
                  />
                  <Button size="sm" onClick={submitInspection}>
                    Enregistrer l'inspection
                  </Button>
                </div>
              ) : (
                <div className="text-sm">
                  <p className="font-medium">
                    {r.inspection.conform
                      ? "Conforme au signalement du client"
                      : "Non conforme au signalement"}
                  </p>
                  <p className="text-muted-foreground">{r.inspection.note}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {r.inspection.inspectedBy} · {relativeTime(r.inspection.inspectedAt)}
                  </p>
                </div>
              )}
            </div>
          )}

          {(canDecide || canRevise) && (
            <div className="glass rounded-2xl p-5 space-y-3">
              <h3 className="font-semibold">
                {canRevise ? "Réviser la prise en charge" : "Décision"}
              </h3>
              {!canRevise && (
                <div className="grid sm:grid-cols-2 gap-2">
                  <select
                    value={decisionType}
                    onChange={(e) => setDecisionType(e.target.value as ReturnResolutionType)}
                    className="h-9 rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    {(Object.keys(RETURN_RESOLUTION_LABEL) as ReturnResolutionType[]).map((t) => (
                      <option key={t} value={t}>
                        {RETURN_RESOLUTION_LABEL[t]}
                      </option>
                    ))}
                  </select>
                  <Input
                    inputMode="decimal"
                    placeholder={`Montant (défaut ${formatFCFA(r.requestedAmount)})`}
                    value={decisionAmount}
                    onChange={(e) => setDecisionAmount(e.target.value)}
                  />
                </div>
              )}
              {decisionType !== "reject" && (
                <select
                  value={decisionBornBy}
                  onChange={(e) => setDecisionBornBy(e.target.value as RefundBornBy)}
                  className="h-9 rounded-xl border border-border bg-background px-3 text-sm"
                >
                  {(Object.keys(REFUND_BORN_BY_LABEL) as RefundBornBy[]).map((b) => (
                    <option key={b} value={b}>
                      À la charge de : {REFUND_BORN_BY_LABEL[b]}
                    </option>
                  ))}
                </select>
              )}
              <Textarea
                placeholder="Justification de la décision (obligatoire)"
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
              />
              <Button size="sm" className="gap-2" onClick={submitDecision}>
                {decisionType === "reject" ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {canRevise ? "Réviser la prise en charge" : "Enregistrer la décision"}
              </Button>
            </div>
          )}

          {r.resolution && (
            <div className="glass rounded-2xl p-5 space-y-2 text-sm">
              <h3 className="font-semibold">Décision enregistrée</h3>
              <p>
                <span className="font-medium">{RETURN_RESOLUTION_LABEL[r.resolution.type]}</span> —
                à la charge de {REFUND_BORN_BY_LABEL[r.resolution.bornBy]}
              </p>
              <p className="text-muted-foreground">{r.resolution.note}</p>
              <p className="text-xs text-muted-foreground">
                {r.resolution.decidedBy} · {relativeTime(r.resolution.decidedAt)}
              </p>
            </div>
          )}

          <div className="glass rounded-2xl p-5">
            <h3 className="font-semibold mb-3">Historique</h3>
            <ul className="space-y-3 border-l-2 border-border pl-4">
              {r.history.map((h, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                  <div className="text-sm font-medium">{h.text}</div>
                  <div className="text-xs text-muted-foreground">
                    {h.actor} · {relativeTime(h.at)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          {refund && (
            <div className="glass rounded-2xl p-5 space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Undo2 className="h-4 w-4" />
                Remboursement lié
              </h3>
              <div className="text-sm">
                <div className="font-medium">{refund.reference}</div>
                <AdminBadge value={refund.status} label={REFUND_STATUS_LABEL[refund.status]} />
                <div className="mt-1 text-muted-foreground">{formatFCFA(refund.amount)}</div>
              </div>
              <Button asChild size="sm" variant="outline" className="w-full gap-2">
                <Link to="/admin/refunds/$refundId" params={{ refundId: refund.id }}>
                  Voir le dossier
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}

          <div className="glass rounded-2xl p-5 space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Litige
            </h3>
            {r.escalatedDisputeId ? (
              <Button asChild size="sm" variant="outline" className="w-full gap-2">
                <Link to="/admin/disputes/$disputeId" params={{ disputeId: r.escalatedDisputeId }}>
                  Voir le litige
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            ) : r.status !== "refused" ? (
              !escalateOpen ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => setEscalateOpen(true)}
                >
                  Escalader en litige
                </Button>
              ) : (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Motif de l'escalade"
                    value={escalateNote}
                    onChange={(e) => setEscalateNote(e.target.value)}
                  />
                  <Button size="sm" className="w-full" onClick={submitEscalation}>
                    Confirmer l'escalade
                  </Button>
                </div>
              )
            ) : (
              <p className="text-sm text-muted-foreground">Non applicable.</p>
            )}
          </div>

          {(r.resolution || r.status === "refused" || r.status === "credited") && !r.closedAt && (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => {
                returnActions.adminClose(r.id);
                auditActions.log("Dossier retour clôturé", r.reference, "info");
                toast.success("Dossier clôturé");
              }}
            >
              Clôturer le dossier
            </Button>
          )}
          {r.closedAt && (
            <div className="glass rounded-2xl p-4 text-sm text-muted-foreground text-center">
              Dossier clôturé {relativeTime(r.closedAt)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
