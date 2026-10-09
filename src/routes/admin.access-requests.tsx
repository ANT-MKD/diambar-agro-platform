import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Inbox, Link2, Loader2, MessageCircle, Phone, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { StatCard } from "@/components/admin/stat-card";
import { Button } from "@/components/ui/button";
import { auditActions } from "@/data/admin-store";
import {
  createInviteFn,
  listAccessRequestsFn,
  setAccessRequestStatusFn,
  type AccessRequest,
  type AccessStatus,
} from "@/lib/access/functions";
import { formatSenegalPhone } from "@/lib/auth/helpers";
import { relativeTime } from "@/lib/format";

export const Route = createFileRoute("/admin/access-requests")({
  head: () => ({
    meta: [
      { title: "Demandes d'accès — Administration Diambar Agro" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccessRequestsPage,
});

const STATUS: Record<AccessStatus, { label: string; tone: string }> = {
  new: { label: "Nouvelle", tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  contacted: { label: "Contacté", tone: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  invited: {
    label: "Invitation envoyée",
    tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  registered: {
    label: "Inscrit",
    tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  declined: { label: "Refusée", tone: "bg-muted text-muted-foreground" },
};
const ROLE_LABEL = { restaurant: "Restaurant", farmer: "Producteur", driver: "Livreur" } as const;
const FILTERS: { id: "open" | AccessStatus | "all"; label: string }[] = [
  { id: "open", label: "À traiter" },
  { id: "invited", label: "Invitées" },
  { id: "registered", label: "Inscrites" },
  { id: "declined", label: "Refusées" },
  { id: "all", label: "Toutes" },
];

/** Pilote en « accès sur demande » : chaque demande envoyée depuis le site
 * arrive ici. L'équipe rappelle la personne, puis génère une invitation
 * personnelle (lien valable 7 jours, à usage unique) pour créer son compte. */
function AccessRequestsPage() {
  const { user } = useRouteContext({ from: "/admin" });
  const [rows, setRows] = useState<AccessRequest[] | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("open");
  const [busy, setBusy] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setRows(await listAccessRequestsFn());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chargement impossible");
      setRows([]);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const c = { new: 0, contacted: 0, invited: 0, registered: 0, declined: 0 };
    for (const r of rows ?? []) c[r.status]++;
    return c;
  }, [rows]);
  const visible = (rows ?? []).filter((r) =>
    filter === "all"
      ? true
      : filter === "open"
        ? r.status === "new" || r.status === "contacted"
        : r.status === filter,
  );

  const replace = (r: AccessRequest) =>
    setRows((prev) => (prev ?? []).map((x) => (x.id === r.id ? r : x)));

  const setStatus = async (r: AccessRequest, status: "contacted" | "declined") => {
    setBusy(r.id);
    try {
      replace(await setAccessRequestStatusFn({ data: { id: r.id, status } }));
      auditActions.log({
        action: status === "contacted" ? "Demande d'accès : contacté" : "Demande d'accès refusée",
        target: r.fullName,
        module: "users",
        actor: user.name,
      });
      toast.success(status === "contacted" ? "Marquée comme contactée" : "Demande refusée");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action impossible");
    } finally {
      setBusy(null);
    }
  };

  const invite = async (r: AccessRequest) => {
    setBusy(r.id);
    try {
      const res = await createInviteFn({ data: { id: r.id } });
      replace(res.request);
      const url = `${window.location.origin}${res.path}`;
      setLinks((l) => ({ ...l, [r.id]: url }));
      // La demande quitte « À traiter » : on suit la carte pour garder le lien visible.
      setFilter("invited");
      auditActions.log({
        action: "Invitation à s'inscrire générée",
        target: r.fullName,
        module: "users",
        actor: user.name,
      });
      toast.success("Invitation prête · envoyez le lien à la personne");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action impossible");
    } finally {
      setBusy(null);
    }
  };

  const whatsappHref = (r: AccessRequest, url: string) =>
    `https://wa.me/221${r.phone}?text=${encodeURIComponent(
      `Bonjour ${r.fullName.split(" ")[0]}, voici votre lien personnel pour créer votre compte Diambar Agro (valable 7 jours) : ${url}`,
    )}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Demandes d'accès"
        subtitle="Pilote en accès sur demande : rappelez chaque personne, puis envoyez-lui son invitation."
        actions={
          <Button variant="outline" size="sm" onClick={() => void load()} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Actualiser
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Nouvelles" value={String(counts.new)} icon={Inbox} />
        <StatCard label="Contactées" value={String(counts.contacted)} icon={Phone} />
        <StatCard label="Invitations envoyées" value={String(counts.invited)} icon={Link2} />
        <StatCard label="Inscrites" value={String(counts.registered)} icon={MessageCircle} />
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrer les demandes">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              filter === f.id ? "bg-primary text-primary-foreground" : "glass hover:bg-accent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {rows === null ? (
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Aucune demande ici"
          description="Les demandes envoyées depuis la page « Demander l'accès » du site apparaissent dans cette liste."
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visible.map((r) => (
            <div key={r.id} className="glass rounded-2xl p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold">{r.fullName}</div>
                  <div className="text-sm text-muted-foreground">
                    {ROLE_LABEL[r.role]}
                    {r.organization ? ` · ${r.organization}` : ""}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS[r.status].tone}`}
                >
                  {STATUS[r.status].label}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Téléphone</dt>
                <dd>
                  <a href={`tel:+221${r.phone}`} className="font-medium hover:underline">
                    +221 {formatSenegalPhone(r.phone)}
                  </a>
                </dd>
                <dt className="text-muted-foreground">Zone</dt>
                <dd>
                  {r.city}
                  {r.area ? ` · ${r.area}` : ""}
                </dd>
                <dt className="text-muted-foreground">Reçue</dt>
                <dd>{relativeTime(r.createdAt)}</dd>
              </dl>
              {r.message && (
                <p className="mt-3 rounded-xl bg-muted/50 px-3 py-2 text-sm">« {r.message} »</p>
              )}
              {links[r.id] && (
                <div className="mt-3 rounded-xl border border-violet-500/30 bg-violet-500/5 p-3 text-sm">
                  <div className="font-medium">
                    Lien d'invitation (valable 7 jours, usage unique)
                  </div>
                  <div className="mt-1 break-all text-xs text-muted-foreground">{links[r.id]}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => {
                        void navigator.clipboard?.writeText(links[r.id]);
                        toast.success("Lien copié");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden /> Copier
                    </Button>
                    <Button asChild size="sm" className="gap-1.5">
                      <a href={whatsappHref(r, links[r.id])} target="_blank" rel="noreferrer">
                        <MessageCircle className="h-3.5 w-3.5" aria-hidden /> Envoyer par WhatsApp
                      </a>
                    </Button>
                  </div>
                </div>
              )}
              {r.status !== "registered" && r.status !== "declined" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {r.status === "new" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === r.id}
                      onClick={() => void setStatus(r, "contacted")}
                    >
                      Marquer contacté
                    </Button>
                  )}
                  <Button size="sm" disabled={busy === r.id} onClick={() => void invite(r)}>
                    {r.status === "invited" ? "Renvoyer une invitation" : "Générer l'invitation"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-rose-500 hover:text-rose-600"
                    disabled={busy === r.id}
                    onClick={() => void setStatus(r, "declined")}
                  >
                    Refuser
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
