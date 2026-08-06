import { ReactNode, useState } from "react";
import { AlertTriangle, Gavel, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatFCFA, relativeTime } from "@/lib/format";
import { DisputeStatusBadge, PriorityBadge, SlaBadge } from "./dispute-badges";
import { DisputeThread } from "./dispute-thread";
import {
  DISPUTE_CATEGORIES, PARTY_LABEL, SUPPORT_AGENTS, disputeActions, outcomeLabel, slaRemaining,
  type Dispute, type DisputeOutcome, type DisputeParty,
} from "@/data/disputes";

export function DisputeDetailView({ dispute: d, role, name, canDecide = false, links, breadcrumb }: {
  dispute: Dispute; role: DisputeParty; name: string; canDecide?: boolean; links?: ReactNode; breadcrumb?: ReactNode;
}) {
  const [outcome, setOutcome] = useState<DisputeOutcome>("refund");
  const [granted, setGranted] = useState(String(d.claimedAmount));
  const [liable, setLiable] = useState<DisputeParty>(d.againstRole);
  const [reason, setReason] = useState("");
  const closed = d.status === "resolved" || d.status === "rejected";
  const sla = slaRemaining(d);

  return (
    <div className="space-y-6">
      {breadcrumb}
      <PageHeader
        title={`${d.reference} — ${DISPUTE_CATEGORIES[d.category]?.label ?? d.category}`}
        subtitle={`${d.subcategory} · ${d.openedByName} (${PARTY_LABEL[d.openedByRole]}) contre ${d.againstName} (${PARTY_LABEL[d.againstRole]}) · commande ${d.orderRef}`}
        actions={<div className="flex flex-wrap items-center gap-2"><SlaBadge dispute={d} /><PriorityBadge priority={d.priority} /><DisputeStatusBadge status={d.status} /></div>}
      />

      {!closed && sla.overdue && (
        <div className="flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>Délai de réponse dépassé ({sla.label}) — escalade niveau {d.escalations + 1} recommandée.</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="glass rounded-2xl p-5">
            <h2 className="font-semibold">Réclamation</h2>
            <p className="mt-2 text-sm text-muted-foreground">{d.description}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Field label="Montant réclamé" value={formatFCFA(d.claimedAmount)} />
              <Field label="Montant accordé" value={d.grantedAmount === null ? "En attente de décision" : formatFCFA(d.grantedAmount)} />
              <Field label="Partie responsable" value={d.liableParty ? PARTY_LABEL[d.liableParty] : "Non déterminée"} />
              <Field label="Canal d'origine" value={d.channel === "app" ? "Application" : d.channel === "whatsapp" ? "WhatsApp" : d.channel === "email" ? "E-mail" : "Téléphone"} />
              <Field label="Agent assigné" value={d.assignee ?? "Non assigné"} />
              <Field label="Escalades" value={`Niveau ${d.escalations}`} />
            </div>
          </div>

          {d.decision && (
            <div className="glass rounded-2xl border border-emerald-500/30 p-5">
              <h2 className="flex items-center gap-2 font-semibold"><Gavel className="h-4 w-4" />Décision motivée</h2>
              <div className="mt-2 text-sm">{outcomeLabel(d.decision.outcome)} · <b>{formatFCFA(d.decision.grantedAmount)}</b> à la charge de <b>{PARTY_LABEL[d.decision.debitedParty]}</b></div>
              <p className="mt-1 text-sm text-muted-foreground">{d.decision.reason}</p>
              <div className="mt-2 text-[11px] text-muted-foreground">Rendue par {d.decision.by} · {relativeTime(d.decision.at)}</div>
            </div>
          )}

          <DisputeThread dispute={d} role={role} name={name} canPostInternal={canDecide} readOnly={closed} />
        </div>

        <div className="space-y-4">
          <div className="glass rounded-2xl p-5">
            <h2 className="font-semibold">Éléments liés</h2>
            <div className="mt-3 space-y-2 text-sm">{links ?? <span className="text-muted-foreground">Aucun élément lié.</span>}</div>
          </div>

          <div className="glass rounded-2xl p-5">
            <h2 className="flex items-center gap-2 font-semibold"><Paperclip className="h-4 w-4" />Pièces jointes ({d.attachments.length})</h2>
            <div className="mt-3 space-y-2">
              {d.attachments.length === 0 && <p className="text-sm text-muted-foreground">Aucune pièce jointe.</p>}
              {d.attachments.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-xl border border-border p-2">
                  {a.dataUrl && a.mime.startsWith("image/")
                    ? <img src={a.dataUrl} alt={a.name} className="h-10 w-10 rounded-lg object-cover" />
                    : <span className="grid h-10 w-10 place-items-center rounded-lg bg-muted text-[10px] text-muted-foreground">{a.mime.includes("pdf") ? "PDF" : "IMG"}</span>}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium">{a.name}</div>
                    <div className="text-[11px] text-muted-foreground">{(a.size / 1024).toFixed(0)} Ko · {a.by}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <h2 className="font-semibold">Historique des états</h2>
            <ol className="mt-3 space-y-3">
              {d.events.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div>
                    <div className="text-sm font-medium">{e.label}</div>
                    <div className="text-[11px] text-muted-foreground">{e.actor} · {relativeTime(e.at)}{e.detail ? ` · ${e.detail}` : ""}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {canDecide && !closed && (
            <div className="glass space-y-3 rounded-2xl p-5">
              <h2 className="font-semibold">Instruction & décision</h2>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => { disputeActions.setStatus(d.id, "investigating"); toast.success("Dossier en instruction"); }}>Instruire</Button>
                <Button variant="outline" size="sm" onClick={() => { disputeActions.setStatus(d.id, "awaiting_response", "Support Diambar", `Réponse demandée à ${d.againstName}`); toast.success("Réponse demandée"); }}>Demander une réponse</Button>
              </div>
              <div className="space-y-1.5">
                <Label>Assigner à</Label>
                <Select value={d.assignee ?? ""} onValueChange={(v) => { disputeActions.assign(d.id, v); toast.success("Dossier assigné"); }}>
                  <SelectTrigger><SelectValue placeholder="Choisir un agent" /></SelectTrigger>
                  <SelectContent>{SUPPORT_AGENTS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={() => { disputeActions.escalate(d.id, "Escalade manuelle par le support"); toast.success("Dossier escaladé"); }}>Escalader (SLA 12h)</Button>

              <div className="space-y-1.5 border-t border-border pt-3">
                <Label>Issue</Label>
                <Select value={outcome} onValueChange={(v) => setOutcome(v as DisputeOutcome)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["refund", "partial", "credit", "goodwill", "rejected"] as DisputeOutcome[]).map((o) => <SelectItem key={o} value={o}>{outcomeLabel(o)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Montant accordé (FCFA)</Label>
                <Input type="number" min={0} value={granted} onChange={(e) => setGranted(e.target.value)} disabled={outcome === "rejected"} />
              </div>
              <div className="space-y-1.5">
                <Label>Partie débitée</Label>
                <Select value={liable} onValueChange={(v) => setLiable(v as DisputeParty)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(["farmer", "driver", "restaurant", "platform"] as DisputeParty[]).map((p) => <SelectItem key={p} value={p}>{PARTY_LABEL[p]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Motivation de la décision</Label>
                <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Preuves retenues, règle appliquée…" />
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  if (reason.trim().length < 10) { toast.error("Motivez la décision"); return; }
                  const amount = outcome === "rejected" ? 0 : Number(granted) || 0;
                  disputeActions.resolve(d.id, { outcome, grantedAmount: amount, liableParty: liable, reason: reason.trim() });
                  toast.success(amount > 0 ? `Décision enregistrée · avoir de ${formatFCFA(amount)} émis` : "Réclamation rejetée");
                }}
              >
                Rendre la décision
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}
