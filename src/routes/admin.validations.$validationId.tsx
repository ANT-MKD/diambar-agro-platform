import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Check, FileText, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { AdminBadge, RoleBadge } from "@/components/admin/admin-badge";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/format";
import { usePlatformUser, useValidation, validationActions } from "@/data/admin-store";

export const Route = createFileRoute("/admin/validations/$validationId")({
  head: () => ({ meta: [{ title: "Dossier de validation — Administration Diambar Agro" }, { name: "description", content: "Examen des pièces justificatives et décision d'activation du compte." }, { name: "robots", content: "noindex" }] }),
  component: ValidationDetail,
});

function ValidationDetail() {
  const { validationId } = Route.useParams();
  const v = useValidation(validationId);
  const user = usePlatformUser(v?.userId ?? "");
  const navigate = useNavigate();
  const [note, setNote] = useState("");

  if (!v) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <h2 className="font-semibold">Dossier introuvable</h2>
        <Link to="/admin/validations" className="mt-4 inline-block text-sm text-primary">Retour</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/admin/validations" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Validations</Link>
      <PageHeader title={`Dossier ${user?.name ?? v.userId}`} subtitle={`Déposé ${relativeTime(v.submittedAt)}`} actions={<div className="flex items-center gap-2"><RoleBadge role={v.type} /><AdminBadge value={v.status} /></div>} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass rounded-2xl p-5 lg:col-span-2 space-y-3">
          <h2 className="font-semibold">Pièces justificatives</h2>
          {v.docs.map((d) => (
            <div key={d.label} className="flex items-center gap-3 rounded-xl border border-border p-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-muted-foreground"><FileText className="h-4 w-4" /></div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{d.label}</div>
                <div className="text-[11px] text-muted-foreground truncate">{d.file}</div>
              </div>
              <AdminBadge value={d.ok ? "approved" : "pending"} label={d.ok ? "Lisible" : "À revoir"} />
            </div>
          ))}
          {v.note && <p className="text-sm text-muted-foreground">Note : {v.note}</p>}
        </div>

        <div className="glass rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold">Décision</h2>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="Motif ou commentaire interne…" className="w-full rounded-xl border border-border bg-background p-3 text-sm" />
          <div className="flex flex-col gap-2">
            <Button disabled={v.status !== "pending"} className="gap-2" onClick={() => { validationActions.approve(v.id); toast.success("Compte validé et activé"); navigate({ to: "/admin/validations" }); }}>
              <Check className="h-4 w-4" />Approuver le compte
            </Button>
            <Button disabled={v.status !== "pending"} variant="outline" className="gap-2 text-destructive" onClick={() => { validationActions.reject(v.id, note || undefined); toast.success("Dossier rejeté"); navigate({ to: "/admin/validations" }); }}>
              <X className="h-4 w-4" />Rejeter le dossier
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">L'approbation active immédiatement le compte et notifie le demandeur.</p>
        </div>
      </div>
    </div>
  );
}
