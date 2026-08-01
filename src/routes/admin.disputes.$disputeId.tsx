import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Check, Send, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { AdminBadge } from "@/components/admin/admin-badge";
import { Button } from "@/components/ui/button";
import { formatFCFA, relativeTime } from "@/lib/format";
import { disputeActions, useDispute } from "@/data/admin-store";

export const Route = createFileRoute("/admin/disputes/$disputeId")({
  head: () => ({ meta: [{ title: "Dossier de litige — Administration Diambar Agro" }, { name: "description", content: "Instruction et résolution d'un litige : historique, montant, décision." }, { name: "robots", content: "noindex" }] }),
  component: DisputeDetail,
});

function DisputeDetail() {
  const { disputeId } = Route.useParams();
  const d = useDispute(disputeId);
  const [text, setText] = useState("");

  if (!d) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <h2 className="font-semibold">Litige introuvable</h2>
        <Link to="/admin/disputes" className="mt-4 inline-block text-sm text-primary">Retour</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/admin/disputes" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Litiges</Link>
      <PageHeader title={`${d.reference} — ${d.reason}`} subtitle={`${d.openedBy} vs ${d.against} · commande ${d.orderRef}`} actions={<AdminBadge value={d.status} />} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="glass rounded-2xl p-5">
            <h2 className="font-semibold">Description</h2>
            <p className="mt-2 text-sm text-muted-foreground">{d.description}</p>
            <div className="mt-4 text-sm">Montant contesté : <span className="font-semibold">{formatFCFA(d.amount)}</span></div>
          </div>

          <div className="glass rounded-2xl p-5">
            <h2 className="font-semibold">Historique</h2>
            <ol className="mt-4 space-y-4">
              {d.timeline.map((t, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                  <div>
                    <div className="text-sm"><span className="font-medium">{t.actor}</span> · <span className="text-[11px] text-muted-foreground">{relativeTime(t.at)}</span></div>
                    <p className="text-sm text-muted-foreground">{t.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; disputeActions.comment(d.id, text.trim()); setText(""); toast.success("Note ajoutée au dossier"); }}
            >
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ajouter une note d'instruction…" className="flex-1 h-9 rounded-xl border border-border bg-background px-3 text-sm" />
              <Button size="sm" type="submit" className="gap-1.5"><Send className="h-4 w-4" />Envoyer</Button>
            </form>
          </div>
        </div>

        <div className="glass rounded-2xl p-5 space-y-2 h-fit">
          <h2 className="font-semibold">Décision</h2>
          <Button className="w-full gap-2" disabled={d.status === "resolved"} onClick={() => { disputeActions.setStatus(d.id, "investigating", "Dossier placé en instruction."); toast.success("Dossier en instruction"); }}>Passer en instruction</Button>
          <Button className="w-full gap-2" variant="outline" disabled={d.status === "resolved"} onClick={() => { disputeActions.setStatus(d.id, "resolved", `Remboursement de ${formatFCFA(d.amount)} validé.`); toast.success("Litige résolu"); }}><Check className="h-4 w-4" />Rembourser et clôturer</Button>
          <Button className="w-full gap-2 text-destructive" variant="outline" disabled={d.status === "rejected"} onClick={() => { disputeActions.setStatus(d.id, "rejected", "Litige rejeté après instruction."); toast.success("Litige rejeté"); }}><X className="h-4 w-4" />Rejeter la réclamation</Button>
        </div>
      </div>
    </div>
  );
}
