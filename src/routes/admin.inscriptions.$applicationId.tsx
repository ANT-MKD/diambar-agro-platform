import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Check, X, Phone, Mail, MessageSquareWarning, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { AdminBadge, RoleBadge } from "@/components/admin/admin-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { relativeTime } from "@/lib/format";
import { auditActions } from "@/data/admin-store";
import {
  decideApplicationFn,
  getApplicationFn,
  type Application,
  type ApplicationDecision,
} from "@/lib/auth/applications";
import { formatSenegalPhone } from "@/lib/auth/helpers";

export const Route = createFileRoute("/admin/inscriptions/$applicationId")({
  head: () => ({
    meta: [
      { title: "Dossier d'inscription — Administration Diambar Agro" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ params }) => getApplicationFn({ data: { id: params.applicationId } }),
  component: ApplicationDetail,
});

const DECISION_COPY: Record<
  ApplicationDecision,
  { done: string; audit: string; level: "info" | "attention" }
> = {
  approve: {
    done: "Compte validé : la personne peut se connecter.",
    audit: "Validation de compte approuvée",
    level: "info",
  },
  needs_correction: {
    done: "Demande de correction enregistrée : elle s'affichera à la connexion.",
    audit: "Correction demandée",
    level: "attention",
  },
  reject: { done: "Dossier refusé.", audit: "Validation de compte rejetée", level: "attention" },
};

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-border/60 last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-right break-words">{value?.trim() || "—"}</dd>
    </div>
  );
}

function SubmittedDetails({ application: a }: { application: Application }) {
  const d = a.submitted.details;
  if (a.account.role === "farmer") {
    return (
      <dl>
        <Row label="Exploitation" value={d.farmName} />
        <Row label="Localisation" value={d.location} />
        <Row label="Superficie" value={d.areaHectares ? `${d.areaHectares} ha` : null} />
        <Row label="Produits" value={d.productTypes?.join(", ")} />
      </dl>
    );
  }
  if (a.account.role === "restaurant") {
    return (
      <dl>
        <Row label="Établissement" value={d.restaurantName} />
        <Row label="Adresse de livraison" value={d.address} />
        <Row label="Téléphone professionnel" value={d.professionalPhone} />
        <Row label="NINEA" value={d.ninea} />
      </dl>
    );
  }
  return (
    <dl>
      <Row label="Véhicule" value={d.vehicleType ?? "Moto"} />
      <Row label="Numéro de permis" value={d.licenseNumber} />
      <Row label="Zones de livraison" value={d.zones?.join(", ")} />
    </dl>
  );
}

function ApplicationDetail() {
  const { application: a, canDecide } = Route.useLoaderData();
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<ApplicationDecision | null>(null);

  if (!a) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <h2 className="font-semibold">Dossier introuvable</h2>
        <Link to="/admin/validations" className="mt-4 inline-block text-sm text-primary">
          Retour aux validations
        </Link>
      </div>
    );
  }

  const name = `${a.account.firstName} ${a.account.lastName}`;
  const closed = a.status === "approved" || a.status === "rejected";

  const decide = async (decision: ApplicationDecision) => {
    if (decision !== "approve" && note.trim().length < 5) {
      toast.error("Écrivez le message à la personne (5 caractères minimum) : elle le lira.");
      return;
    }
    setBusy(decision);
    try {
      const res = await decideApplicationFn({
        data: { id: a.id, decision, note: decision === "approve" ? undefined : note },
      });
      if (!res.ok) {
        toast.error(res.message);
      } else {
        const copy = DECISION_COPY[decision];
        auditActions.log({
          action: copy.audit,
          target: name,
          module: "validations",
          level: copy.level,
          reason: decision === "approve" ? undefined : note.trim(),
          actor: user.name,
        });
        toast.success(copy.done, {
          description: res.emailed
            ? "La personne a été prévenue par email."
            : "Email non envoyé : prévenez la personne par téléphone.",
        });
        setNote("");
      }
      await router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Action impossible.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <Link
        to="/admin/validations"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Validations
      </Link>

      <PageHeader
        title={name}
        subtitle={`Inscription déposée ${relativeTime(a.submittedAt)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {a.account.phone && (
              <Button variant="outline" size="sm" className="gap-2" asChild>
                <a href={`tel:+221${a.account.phone}`}>
                  <Phone className="h-3.5 w-3.5" aria-hidden />
                  Appeler
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <a href={`mailto:${a.account.email}`}>
                <Mail className="h-3.5 w-3.5" aria-hidden />
                Écrire
              </a>
            </Button>
          </div>
        }
      />

      <div className="glass rounded-2xl p-5 flex flex-wrap items-center gap-4">
        <div
          className="grid h-14 w-14 place-items-center rounded-full bg-primary/15 text-primary text-lg font-semibold"
          aria-hidden
        >
          {a.account.firstName.charAt(0)}
          {a.account.lastName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-lg">{name}</span>
            <RoleBadge role={a.account.role} />
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {a.submitted.city ?? "Ville non précisée"} · {a.account.email}
            {a.account.phone ? ` · +221 ${formatSenegalPhone(a.account.phone)}` : ""}
          </div>
        </div>
        <AdminBadge value={a.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="glass rounded-2xl p-5">
            <h2 className="font-semibold mb-2">Informations déclarées</h2>
            <SubmittedDetails application={a} />
            <p className="mt-3 text-xs text-muted-foreground">
              Email vérifié par code à l'inscription. Le téléphone n'est pas encore vérifié
              automatiquement : appelez la personne pour le confirmer. Les pièces justificatives
              (CNI, permis, NINEA…) pourront être déposées quand l'envoi de fichiers sera ouvert ;
              d'ici là, vérifiez-les par téléphone ou en rendez-vous.
            </p>
          </section>

          <section className="glass rounded-2xl p-5">
            <h2 className="font-semibold mb-3">Historique du dossier</h2>
            <ol className="space-y-2 text-sm">
              <li className="flex gap-3">
                <span className="text-[11px] text-muted-foreground w-24 shrink-0">
                  {relativeTime(a.submittedAt)}
                </span>
                Inscription déposée, téléphone vérifié
              </li>
              {a.decidedAt && (
                <li className="flex gap-3">
                  <span className="text-[11px] text-muted-foreground w-24 shrink-0">
                    {relativeTime(a.decidedAt)}
                  </span>
                  <span>
                    {a.status === "approved"
                      ? "Compte validé"
                      : a.status === "rejected"
                        ? "Dossier refusé"
                        : "Correction demandée"}
                    {a.decidedBy ? ` par ${a.decidedBy}` : ""}
                    {a.note ? ` — « ${a.note} »` : ""}
                  </span>
                </li>
              )}
            </ol>
          </section>
        </div>

        <section className="glass rounded-2xl p-5 space-y-4 h-fit" aria-labelledby="decision">
          <h2 id="decision" className="font-semibold">
            Décision
          </h2>
          {closed ? (
            <p className="text-sm text-muted-foreground">
              Dossier {a.status === "approved" ? "validé" : "refusé"}
              {a.decidedBy ? ` par ${a.decidedBy}` : ""}. La décision est enregistrée dans le
              journal d'audit.
            </p>
          ) : !canDecide ? (
            <p className="text-sm text-muted-foreground">
              Votre rôle permet de consulter ce dossier, pas d'en décider (réservé au super
              administrateur et à l'équipe opérations).
            </p>
          ) : (
            <>
              <Button
                className="w-full gap-2"
                disabled={busy !== null}
                onClick={() => decide("approve")}
              >
                {busy === "approve" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Check className="h-4 w-4" aria-hidden />
                )}
                Valider et activer le compte
              </Button>
              <div>
                <label htmlFor="decision-note" className="text-sm font-medium">
                  Message à la personne
                </label>
                <Textarea
                  id="decision-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  className="mt-1.5"
                  placeholder="Ex. : Merci d'indiquer l'adresse exacte de votre exploitation."
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Obligatoire pour une correction ou un refus : la personne le verra en essayant de
                  se connecter.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={busy !== null}
                  onClick={() => decide("needs_correction")}
                >
                  {busy === "needs_correction" ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <MessageSquareWarning className="h-4 w-4" aria-hidden />
                  )}
                  Demander une correction
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 text-destructive"
                  disabled={busy !== null}
                  onClick={() => decide("reject")}
                >
                  {busy === "reject" ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <X className="h-4 w-4" aria-hidden />
                  )}
                  Refuser le dossier
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
