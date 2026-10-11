import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { FileCheck2, Check, X } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { auditActions } from "@/data/admin-store";
import { DOC_LABEL, docRenewalActions, useDocRenewals } from "@/data/store";
import { relativeTime } from "@/lib/format";

export const Route = createFileRoute("/admin/documents")({
  head: () => ({
    meta: [
      { title: "Documents livreurs — Administration Diambar Agro" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DriverDocumentsPage,
});

/** Validation des documents renouvelés par les livreurs (assurance,
 * contrôle technique) : sans elle, un livreur dont un document a expiré
 * resterait bloqué pour toujours. */
function DriverDocumentsPage() {
  const { user } = useRouteContext({ from: "/admin" });
  const renewals = useDocRenewals();
  const pending = renewals.filter((r) => r.status === "pending");
  const done = renewals.filter((r) => r.status !== "pending").slice(0, 20);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const approve = (id: string, label: string) => {
    docRenewalActions.approve(id, user.name);
    auditActions.log({
      action: "Document livreur validé",
      target: id,
      module: "deliveries",
      actor: user.name,
      changes: [{ field: "Document", before: "En attente", after: label }],
    });
    toast.success("Document validé · le livreur est prévenu");
  };
  const reject = (id: string) => {
    const note = (notes[id] ?? "").trim();
    if (note.length < 5) return toast.error("Indiquez le motif du refus");
    docRenewalActions.reject(id, user.name, note);
    auditActions.log({
      action: "Document livreur refusé",
      target: id,
      module: "deliveries",
      actor: user.name,
      reason: note,
    });
    toast.success("Document refusé · le livreur est prévenu");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents livreurs"
        subtitle="Assurances et contrôles techniques renouvelés, à vérifier avant qu'ils ne comptent."
      />
      {pending.length === 0 ? (
        <EmptyState
          icon={FileCheck2}
          title="Aucun document à vérifier"
          description="Les renouvellements envoyés par les livreurs apparaîtront ici."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {pending.map((r) => (
            <div key={r.id} className="glass rounded-2xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{DOC_LABEL[r.doc]}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.driverName} · envoyé {relativeTime(r.at)}
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="text-xs text-muted-foreground">Nouvelle échéance</div>
                  <div className="font-semibold">
                    {new Date(r.newExpiry).toLocaleDateString("fr-FR")}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {r.photos.map((p) =>
                  p.dataUrl && p.mime.startsWith("image/") ? (
                    <a key={p.id} href={p.dataUrl} target="_blank" rel="noreferrer">
                      <img
                        src={p.dataUrl}
                        alt={p.name}
                        className="aspect-square w-full rounded-lg object-cover border border-border"
                      />
                    </a>
                  ) : (
                    <div
                      key={p.id}
                      className="aspect-square rounded-lg border border-border grid place-items-center text-[10px] p-2 text-center break-all text-muted-foreground"
                    >
                      {p.name}
                    </div>
                  ),
                )}
              </div>
              <Input
                placeholder="Motif en cas de refus (illisible, date incohérente…)"
                value={notes[r.id] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
              />
              <div className="flex gap-2">
                <Button className="flex-1 gap-1" onClick={() => approve(r.id, DOC_LABEL[r.doc])}>
                  <Check className="h-4 w-4" />
                  Valider
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 gap-1 text-rose-600"
                  onClick={() => reject(r.id)}
                >
                  <X className="h-4 w-4" />
                  Refuser
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {done.length > 0 && (
        <div className="glass rounded-2xl p-4">
          <h3 className="font-semibold mb-2 text-sm">Décisions récentes</h3>
          <ul className="space-y-1 text-sm">
            {done.map((r) => (
              <li key={r.id} className="flex justify-between gap-2">
                <span>
                  {r.driverName} · {DOC_LABEL[r.doc]}
                </span>
                <span className={r.status === "approved" ? "text-emerald-600" : "text-rose-600"}>
                  {r.status === "approved" ? "Validé" : `Refusé — ${r.note}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
