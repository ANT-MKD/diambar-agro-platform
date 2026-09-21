import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  Check,
  X,
  FileText,
  Image as ImageIcon,
  Phone,
  Mail,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { AdminBadge, RoleBadge } from "@/components/admin/admin-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { relativeTime } from "@/lib/format";
import {
  usePlatformUser,
  useValidation,
  useAuditLogs,
  validationActions,
} from "@/data/admin-store";
import type { ValidationDoc } from "@/data/admin-mocks";

export const Route = createFileRoute("/admin/validations/$validationId")({
  head: () => ({
    meta: [
      { title: "Dossier de validation — Administration Diambar Agro" },
      {
        name: "description",
        content: "Examen des pièces justificatives et décision d'activation du compte.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ValidationDetail,
});

const CORRECTION_REASONS = [
  "Document illisible",
  "Document expiré",
  "Document incomplet",
  "Informations incohérentes",
  "Mauvaise photo",
  "Autre",
];

// Chaque type de compte soumet ses pièces dans le même ordre logique
// (identité -> activité -> pièce complémentaire), donc la position dans le
// tableau suffit à rattacher un document à une étape du parcours, sans
// avoir besoin d'un champ "catégorie" qui n'existe pas dans les données.
type Step = "identity" | "activity" | "other";
function stepForIndex(i: number): Step {
  if (i === 0) return "identity";
  if (i === 1) return "activity";
  return "other";
}
function stepDocsOk(docs: ValidationDoc[], step: Step) {
  const relevant = docs.filter((_, i) => stepForIndex(i) === step);
  return relevant.length === 0 || relevant.every((d) => d.ok);
}
function fileIcon(file: string) {
  return /\.(jpe?g|png|webp)$/i.test(file) ? ImageIcon : FileText;
}

function ValidationDetail() {
  const { validationId } = Route.useParams();
  const v = useValidation(validationId);
  const user = usePlatformUser(v?.userId ?? "");
  const auditLogs = useAuditLogs();
  const navigate = useNavigate();
  const [note, setNote] = useState("");
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionDoc, setCorrectionDoc] = useState("");
  const [reasons, setReasons] = useState<string[]>([]);
  const [comment, setComment] = useState("");

  if (!v) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <h2 className="font-semibold">Dossier introuvable</h2>
        <Link to="/admin/validations" className="mt-4 inline-block text-sm text-primary">
          Retour
        </Link>
      </div>
    );
  }

  const closed = v.status === "approved" || v.status === "rejected";
  const allDocsOk = v.docs.every((d) => d.ok);
  const okCount = v.docs.filter((d) => d.ok).length;

  const STEPS: { key: Step | "verification" | "activation"; label: string; done: boolean }[] = [
    { key: "identity", label: "Identité", done: stepDocsOk(v.docs, "identity") },
    { key: "activity", label: "Activité", done: stepDocsOk(v.docs, "activity") },
    { key: "other", label: "Documents", done: stepDocsOk(v.docs, "other") },
    { key: "verification", label: "Vérification", done: allDocsOk },
    { key: "activation", label: "Activation", done: v.status === "approved" },
  ];

  // Historique réel : les entrées du journal d'audit dont la cible mentionne
  // ce demandeur (format "Nom (id)" déjà utilisé par auditActions.log).
  const history = user ? auditLogs.filter((l) => l.target.includes(user.name)).slice(0, 6) : [];

  const openCorrection = (docLabel?: string) => {
    setCorrectionDoc(docLabel ?? v.docs[0]?.label ?? "");
    setReasons([]);
    setComment("");
    setCorrectionOpen(true);
  };

  const toggleReason = (r: string) =>
    setReasons((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  const submitCorrection = () => {
    if (!correctionDoc || reasons.length === 0) {
      toast.error("Choisissez au moins un motif");
      return;
    }
    validationActions.requestCorrection(v.id, correctionDoc, reasons, comment);
    toast.success("Demande de correction envoyée au demandeur");
    setCorrectionOpen(false);
  };

  const approve = () => {
    validationActions.approve(v.id);
    toast.success("Compte validé et activé");
    navigate({ to: "/admin/validations" });
  };
  const reject = () => {
    validationActions.reject(v.id, note.trim() || undefined);
    toast.success("Dossier rejeté");
    navigate({ to: "/admin/validations" });
  };

  return (
    <div className="space-y-6">
      <Link
        to="/admin/validations"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Validations
      </Link>

      <PageHeader
        title={`Dossier #${v.id.toUpperCase()}`}
        subtitle={`Soumis ${relativeTime(v.submittedAt)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {user?.phone && (
              <Button variant="outline" size="sm" className="gap-2" asChild>
                <a href={`tel:${user.phone}`}>
                  <Phone className="h-3.5 w-3.5" />
                  Appeler
                </a>
              </Button>
            )}
            {user?.email && (
              <Button variant="outline" size="sm" className="gap-2" asChild>
                <a href={`mailto:${user.email}`}>
                  <Mail className="h-3.5 w-3.5" />
                  Contacter
                </a>
              </Button>
            )}
            {!closed && (
              <Button variant="outline" size="sm" onClick={() => openCorrection()}>
                Demander une correction
              </Button>
            )}
          </div>
        }
      />

      <div className="glass rounded-2xl p-5 flex flex-wrap items-center gap-4">
        <img src={user?.avatar} alt="" className="h-14 w-14 rounded-full object-cover" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-lg">{user?.name ?? v.userId}</span>
            <RoleBadge role={v.type} />
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {user?.city} {user?.email ? `· ${user.email}` : ""}{" "}
            {user?.phone ? `· ${user.phone}` : ""}
          </div>
        </div>
        <AdminBadge value={v.status} />
      </div>

      <div className="glass rounded-2xl p-5 overflow-x-auto">
        <h2 className="font-semibold mb-4">Progression de validation</h2>
        <ol className="flex items-center min-w-[560px]">
          {STEPS.map((s, i) => (
            <li key={s.key} className="flex-1 flex items-center">
              <div className="flex flex-col items-center gap-1.5 flex-1">
                <div
                  className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold shrink-0 ${
                    s.done
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground border border-border"
                  }`}
                >
                  {s.done ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span
                  className={`text-[11px] font-medium text-center ${s.done ? "" : "text-muted-foreground"}`}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-px flex-1 -mt-5 ${s.done ? "bg-primary" : "bg-border"}`} />
              )}
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          <h2 className="font-semibold">Pièces justificatives</h2>
          {v.docs.map((d) => {
            const Icon = fileIcon(d.file);
            const expanded = expandedDoc === d.label;
            return (
              <div key={d.label} className="glass rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedDoc(expanded ? null : d.label)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-accent/30 transition"
                >
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-muted-foreground shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{d.label}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{d.file}</div>
                  </div>
                  <AdminBadge
                    value={d.ok ? "approved" : "pending"}
                    label={d.ok ? "Conforme" : "À revoir"}
                  />
                  {expanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </button>
                {expanded && (
                  <div className="border-t border-border p-4 space-y-3">
                    <div className="rounded-xl border border-dashed border-border h-32 grid place-items-center text-muted-foreground">
                      <div className="text-center">
                        <Icon className="h-6 w-6 mx-auto mb-1" />
                        <span className="text-xs">{d.file}</span>
                      </div>
                    </div>
                    {!d.ok && d.note && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        {d.note}
                      </p>
                    )}
                    {!closed && (
                      <div className="flex gap-2">
                        {d.ok ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2 text-destructive"
                            onClick={() => openCorrection(d.label)}
                          >
                            <X className="h-3.5 w-3.5" />
                            Marquer comme non conforme
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="gap-2"
                            onClick={() => {
                              validationActions.setDocStatus(v.id, d.label, true);
                              toast.success(`${d.label} marqué conforme`);
                            }}
                          >
                            <Check className="h-3.5 w-3.5" />
                            Marquer conforme
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {history.length > 0 && (
            <div className="glass rounded-2xl p-5">
              <h2 className="font-semibold mb-3">Historique du dossier</h2>
              <ul className="space-y-2">
                {history.map((l) => (
                  <li key={l.id} className="flex items-start gap-2 text-sm">
                    <span className="text-[11px] text-muted-foreground shrink-0 w-20">
                      {relativeTime(l.at)}
                    </span>
                    <span className="flex-1">{l.action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="glass rounded-2xl p-5 space-y-4 h-fit">
          <h2 className="font-semibold">Décision</h2>
          {allDocsOk ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                <CheckCircle2 className="h-4 w-4" />
                Dossier complet
              </div>
              <p className="text-xs text-muted-foreground">
                {v.docs.length}/{v.docs.length} document(s) obligatoire(s) validé(s).
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold text-sm">
                <AlertTriangle className="h-4 w-4" />
                Dossier incomplet
              </div>
              <p className="text-xs text-muted-foreground">
                {okCount}/{v.docs.length} document(s) conforme(s) — le compte ne peut pas encore
                être activé.
              </p>
            </div>
          )}

          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Motif interne (utilisé en cas de refus)…"
            disabled={closed}
          />

          <div className="flex flex-col gap-2">
            <Button disabled={closed || !allDocsOk} className="gap-2" onClick={approve}>
              <Check className="h-4 w-4" />
              Approuver et activer le compte
            </Button>
            <Button
              disabled={closed}
              variant="outline"
              className="gap-2 text-destructive"
              onClick={reject}
            >
              <X className="h-4 w-4" />
              Refuser le dossier
            </Button>
          </div>

          {closed ? (
            <p className="text-[11px] text-muted-foreground">
              Dossier déjà {v.status === "approved" ? "approuvé" : "refusé"} — action enregistrée
              dans le journal d'audit.
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              L'approbation active immédiatement le compte et notifie le demandeur.
            </p>
          )}
        </div>
      </div>

      <Dialog open={correctionOpen} onOpenChange={setCorrectionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demander une correction</DialogTitle>
            <DialogDescription>
              Le demandeur reçoit une notification avec le motif indiqué.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Document concerné</label>
              <Select value={correctionDoc} onValueChange={setCorrectionDoc}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {v.docs.map((d) => (
                    <SelectItem key={d.label} value={d.label}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Motif</label>
              {CORRECTION_REASONS.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={reasons.includes(r)} onCheckedChange={() => toggleReason(r)} />
                  {r}
                </label>
              ))}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Commentaire</label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="Veuillez envoyer une photo plus nette…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectionOpen(false)}>
              Annuler
            </Button>
            <Button onClick={submitCorrection}>Envoyer la demande</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
