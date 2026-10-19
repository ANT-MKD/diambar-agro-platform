import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  LayoutDashboard,
  ShieldCheck,
  Users,
  MapPinned,
  TriangleAlert,
  Lock,
  Wrench,
  UsersRound,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { useBaseMode } from "@/data/demo-only";
import { refreshMarket } from "@/data/market-remote";
import {
  getPlatformParamsFn,
  savePlatformParamsFn,
  type PlatformParams,
} from "@/lib/platform/setup";
import { StatCard } from "@/components/admin/stat-card";
import { SecurityPanel } from "@/components/common/security-panel";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatFCFA, relativeTime } from "@/lib/format";
import {
  platformSettingsActions,
  useCommissionTiers,
  useDeliveryZones,
  useRefundSettings,
  useRefundApprovalTiers,
  useLoginSecurity,
  loginSecurityActions,
  useMaintenanceMode,
  maintenanceActions,
  useStaffTeams,
  useAdminRoleList,
  usePlatformUsers,
  useAdminRoleForEmail,
  useAuditLogs,
  can,
  ADMIN_ROLE_NAMES,
  type AdminRoleName,
} from "@/data/admin-store";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [
      { title: "Paramètres de la plateforme — Administration Diambar Agro" },
      {
        name: "description",
        content: "Centre de configuration de Diambar Agro : plateforme, sécurité, rôles, équipes.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminSettings,
});

const TABS = [
  { key: "overview", label: "Vue d'ensemble", icon: LayoutDashboard },
  { key: "platform", label: "Plateforme", icon: MapPinned },
  { key: "security", label: "Sécurité", icon: ShieldCheck },
  { key: "roles", label: "Rôles & équipes", icon: UsersRound },
  { key: "maintenance", label: "Mode maintenance", icon: Wrench },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function AdminSettings() {
  const { user } = useRouteContext({ from: "/admin" });
  const role = useAdminRoleForEmail(user.email);
  const canEdit = can(role, "settings.edit");
  const [tab, setTab] = useState<TabKey>("overview");
  // Avec la base : les paramètres sont lus et enregistrés sur le serveur.
  const base = useBaseMode();
  const [params, setParams] = useState<PlatformParams | null>(null);
  useEffect(() => {
    if (!base) return;
    getPlatformParamsFn()
      .then(setParams)
      .catch(() => toast.error("Paramètres indisponibles pour le moment."));
  }, [base]);
  // Enregistrements l'un après l'autre, chacun construit au moment de partir
  // avec l'état voulu le plus récent : deux changements rapprochés (message
  // puis interrupteur) ne s'écrasent pas.
  const queue = useRef<Promise<boolean>>(Promise.resolve(true));
  const save = (patch: ParamsPatch | (() => ParamsPatch), done: string) => {
    const run = async () => {
      try {
        const res = await savePlatformParamsFn({
          data: typeof patch === "function" ? patch() : patch,
        });
        if (!res.ok) {
          toast.error(res.message);
          return false;
        }
        setParams(res.params);
        void refreshMarket();
        toast.success(done);
        return true;
      } catch (err) {
        toast.error(
          err instanceof Error && err.message ? err.message : "Enregistrement impossible.",
        );
        return false;
      }
    };
    queue.current = queue.current.then(run, run);
    return queue.current;
  };
  const server = base ? { params, save } : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paramètres de la plateforme"
        subtitle="Configurez le fonctionnement global de Diambar Agro, la sécurité, les rôles et les règles métier."
      />

      {!canEdit && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
          <TriangleAlert className="h-5 w-5 shrink-0" />
          <span>Votre rôle ({role}) permet de consulter cette page, mais pas de la modifier.</span>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 h-10 text-sm font-medium transition",
              tab === t.key
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:bg-accent",
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab onNavigate={setTab} />}
      {tab === "platform" &&
        (server ? (
          <PlatformTabBase canEdit={canEdit} {...server} />
        ) : (
          <PlatformTab canEdit={canEdit} actorName={user.name} />
        ))}
      {tab === "security" && <SecurityTab canEdit={canEdit} server={server} />}
      {tab === "roles" && <RolesTab />}
      {tab === "maintenance" && (
        <MaintenanceTab canEdit={canEdit} actorName={user.name} server={server} />
      )}
    </div>
  );
}

function OverviewTab({ onNavigate }: { onNavigate: (tab: TabKey) => void }) {
  const maintenance = useMaintenanceMode();
  const admins = usePlatformUsers().filter((u) => u.role === "admin");
  const zones = useDeliveryZones();
  const activeZones = zones.filter((z) => z.active).length;
  const logs = useAuditLogs();
  const refNow =
    logs.length > 0 ? Math.max(...logs.map((l) => new Date(l.at).getTime())) : Date.now();
  const securityAlerts24h = logs.filter(
    (l) =>
      (l.level === "critical" || l.status === "blocked") &&
      refNow - new Date(l.at).getTime() < 24 * 3600_000,
  ).length;
  const recentChanges = logs
    .filter((l) => l.module === "finance" || l.module === "security" || l.module === "system")
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Plateforme"
          value={maintenance.active ? "En maintenance" : "Opérationnelle"}
          icon={maintenance.active ? Wrench : ShieldCheck}
          hint={maintenance.active ? "Portails bloqués" : undefined}
        />
        <StatCard label="Administrateurs" value={String(admins.length)} icon={Users} />
        <StatCard
          label="Zones de livraison actives"
          value={`${activeZones} / ${zones.length}`}
          icon={MapPinned}
        />
        <StatCard
          label="Alertes sécurité (24h)"
          value={String(securityAlerts24h)}
          icon={ShieldAlert}
          hint={securityAlerts24h > 0 ? "À examiner" : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <button
          onClick={() => onNavigate("roles")}
          className="glass rounded-2xl p-5 text-left hover:bg-accent/40 transition"
        >
          <UsersRound className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          <div className="mt-3 font-semibold flex items-center gap-1.5">
            Rôles & équipes <ArrowRight className="h-3.5 w-3.5" />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Rôles et leurs permissions, équipes.</p>
        </button>
        <Link
          to="/admin/users/admins"
          className="glass rounded-2xl p-5 text-left hover:bg-accent/40 transition block"
        >
          <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <div className="mt-3 font-semibold flex items-center gap-1.5">
            Administrateurs <ArrowRight className="h-3.5 w-3.5" />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Comptes admin, rôle et équipe de chacun.
          </p>
        </Link>
        <Link
          to="/admin/logs"
          className="glass rounded-2xl p-5 text-left hover:bg-accent/40 transition block"
        >
          <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <div className="mt-3 font-semibold flex items-center gap-1.5">
            Journal d'audit <ArrowRight className="h-3.5 w-3.5" />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Toute modification ci-dessous y est enregistrée.
          </p>
        </Link>
      </div>

      <div className="glass rounded-2xl p-5">
        <h2 className="font-semibold">Modifications récentes</h2>
        {recentChanges.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Aucune modification récente.</p>
        ) : (
          <div className="mt-3 divide-y divide-border">
            {recentChanges.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="font-medium truncate">{l.action}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {l.target} · par {l.actor}
                  </div>
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0">
                  {relativeTime(l.at)}
                </span>
              </div>
            ))}
          </div>
        )}
        <Link
          to="/admin/logs"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Voir le journal complet <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

type ParamsPatch = Parameters<typeof savePlatformParamsFn>[0]["data"];
type ServerParams = {
  params: PlatformParams | null;
  save: (patch: ParamsPatch | (() => ParamsPatch), done: string) => Promise<boolean>;
};

/** Onglet Plateforme avec la base : règles d'argent réellement appliquées. */
function PlatformTabBase({ canEdit, params, save }: { canEdit: boolean } & ServerParams) {
  const [tiers, setTiers] = useState(params?.commissionTiers ?? []);
  const [threshold, setThreshold] = useState(String(params?.approvalThreshold ?? ""));
  useEffect(() => {
    if (!params) return;
    setTiers(params.commissionTiers);
    setThreshold(String(params.approvalThreshold ?? ""));
  }, [params]);
  if (!params) {
    return <div className="glass rounded-2xl p-5 text-sm text-muted-foreground">Chargement…</div>;
  }
  const setTier = (i: number, patch: Partial<(typeof tiers)[number]>) =>
    setTiers((list) => list.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-5">
        <h2 className="font-semibold">Barème de commissions</h2>
        <p className="text-xs text-muted-foreground">
          Taux dégressif appliqué au volume livré du producteur dans le mois. Il s'applique aux
          prochaines livraisons.
        </p>
        <div className="mt-4 space-y-3">
          {tiers.map((t, i) => (
            <div
              key={i}
              className="flex flex-wrap items-end gap-3 rounded-xl border border-border p-3"
              data-testid="commission-tier"
            >
              <label className="flex-1 min-w-36 text-[11px] text-muted-foreground">
                Palier
                <input
                  value={t.label}
                  disabled={!canEdit}
                  onChange={(e) => setTier(i, { label: e.target.value })}
                  className="mt-1 w-full h-9 rounded-xl border border-border bg-background px-3 text-sm text-foreground disabled:opacity-50"
                />
              </label>
              <label className="text-[11px] text-muted-foreground">
                De (FCFA)
                <input
                  type="number"
                  min={0}
                  value={t.min}
                  disabled={!canEdit}
                  onChange={(e) => setTier(i, { min: Number(e.target.value) })}
                  className="mt-1 block w-32 h-9 rounded-xl border border-border bg-background px-3 text-sm text-right text-foreground disabled:opacity-50"
                />
              </label>
              <label className="text-[11px] text-muted-foreground">
                À (vide = sans plafond)
                <input
                  type="number"
                  min={0}
                  value={t.max ?? ""}
                  disabled={!canEdit}
                  onChange={(e) => setTier(i, { max: num(e.target.value) })}
                  className="mt-1 block w-32 h-9 rounded-xl border border-border bg-background px-3 text-sm text-right text-foreground disabled:opacity-50"
                />
              </label>
              <label className="text-[11px] text-muted-foreground">
                Taux (%)
                <input
                  type="number"
                  min={0}
                  max={50}
                  step={0.5}
                  value={t.rate}
                  aria-label={`Taux du palier ${t.label}`}
                  disabled={!canEdit}
                  onChange={(e) => setTier(i, { rate: Number(e.target.value) })}
                  className="mt-1 block w-24 h-9 rounded-xl border border-border bg-background px-3 text-sm text-right text-foreground disabled:opacity-50"
                />
              </label>
            </div>
          ))}
        </div>
        {canEdit && (
          <Button
            className="mt-4"
            onClick={() =>
              void save({ commissionTiers: tiers }, "Barème de commissions enregistré")
            }
          >
            Enregistrer le barème
          </Button>
        )}
      </div>

      <div className="glass rounded-2xl p-5">
        <h2 className="font-semibold">Double validation</h2>
        <p className="text-xs text-muted-foreground">
          À partir de ce montant, un retrait ou un remboursement doit être validé par un premier
          administrateur puis versé par un second.
        </p>
        {params.approvalThreshold === null ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Configurez d'abord les moyens de paiement dans l'
            <Link to="/admin/setup" className="text-primary hover:underline">
              assistant de configuration
            </Link>
            .
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="number"
              min={0}
              step={5000}
              value={threshold}
              aria-label="Seuil de double validation"
              disabled={!canEdit}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-40 h-9 rounded-xl border border-border bg-background px-3 text-sm text-right disabled:opacity-50"
            />
            <span className="text-sm text-muted-foreground">FCFA (0 = jamais)</span>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  void save(
                    { approvalThreshold: Math.max(0, Math.round(Number(threshold) || 0)) },
                    "Seuil de double validation enregistré",
                  )
                }
              >
                Enregistrer
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          to="/admin/delivery-pricing"
          className="glass rounded-2xl p-5 hover:bg-accent/40 transition block"
        >
          <div className="font-semibold flex items-center gap-1.5">
            Villes, quartiers et tarifs de livraison <ArrowRight className="h-3.5 w-3.5" />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Frais par distance, paie et commission des livreurs, lieux localisés.
          </p>
        </Link>
        <Link
          to="/admin/setup"
          className="glass rounded-2xl p-5 hover:bg-accent/40 transition block"
        >
          <div className="font-semibold flex items-center gap-1.5">
            Assistant de configuration <ArrowRight className="h-3.5 w-3.5" />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Entreprise, horaires et délais, moyens de paiement, TVA (super administrateur).
          </p>
        </Link>
      </div>
    </div>
  );
}

function PlatformTab({ canEdit, actorName }: { canEdit: boolean; actorName: string }) {
  const tiers = useCommissionTiers();
  const zones = useDeliveryZones();
  const refundSettings = useRefundSettings();
  const approvalTiers = useRefundApprovalTiers();
  const approverRoles = ADMIN_ROLE_NAMES.filter((r) => can(r, "refunds.approve"));
  const [newCity, setNewCity] = useState({ name: "", baseFee: "2000", perKm: "100" });

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-5">
        <h2 className="font-semibold">Barème de commissions</h2>
        <p className="text-xs text-muted-foreground">
          Taux dégressif appliqué au volume mensuel du producteur.
        </p>
        <div className="mt-4 space-y-3">
          {tiers.map((t) => (
            <div
              key={t.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3"
            >
              <div className="flex-1 min-w-40">
                <div className="text-sm font-medium">{t.label}</div>
                <div className="text-[11px] text-muted-foreground">{t.range}</div>
              </div>
              <input
                type="number"
                min={0}
                max={30}
                value={t.rate}
                disabled={!canEdit}
                onChange={(e) => platformSettingsActions.setTierRate(t.id, Number(e.target.value))}
                className="w-20 h-9 rounded-xl border border-border bg-background px-3 text-sm text-right disabled:opacity-50"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
        <h2 className="font-semibold">Villes desservies</h2>
        <p className="text-xs text-muted-foreground">
          Source unique utilisée à la fois pour la tarification livraison ci-dessous et pour les
          listes "Ville" des formulaires d'inscription et de profil (agriculteur, restaurant).
          Activez une ville pour ouvrir les commandes correspondantes.
        </p>
        <div className="mt-4 space-y-3">
          {zones.map((z) => (
            <div
              key={z.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3"
            >
              <div className="flex-1 min-w-40">
                <div className="text-sm font-medium">{z.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  Base {formatFCFA(z.baseFee)} · {z.perKm} FCFA/km
                </div>
              </div>
              <input
                type="number"
                min={0}
                step={500}
                value={z.baseFee}
                disabled={!canEdit}
                onChange={(e) => platformSettingsActions.setZoneFee(z.id, Number(e.target.value))}
                className="w-28 h-9 rounded-xl border border-border bg-background px-3 text-sm text-right disabled:opacity-50"
              />
              <Switch
                checked={z.active}
                disabled={!canEdit}
                onCheckedChange={() => {
                  platformSettingsActions.toggleZone(z.id);
                  toast.success(z.active ? "Zone désactivée" : "Zone activée");
                }}
              />
            </div>
          ))}
        </div>
        {canEdit && (
          <div className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-border p-3">
            <div className="flex-1 min-w-40">
              <label className="text-[11px] text-muted-foreground">Nouvelle ville</label>
              <input
                value={newCity.name}
                onChange={(e) => setNewCity({ ...newCity, name: e.target.value })}
                placeholder="Ex. Kaolack"
                className="mt-1 w-full h-9 rounded-xl border border-border bg-background px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Frais de base</label>
              <input
                type="number"
                min={0}
                step={500}
                value={newCity.baseFee}
                onChange={(e) => setNewCity({ ...newCity, baseFee: e.target.value })}
                className="mt-1 w-28 h-9 rounded-xl border border-border bg-background px-3 text-sm text-right"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">FCFA/km</label>
              <input
                type="number"
                min={0}
                step={5}
                value={newCity.perKm}
                onChange={(e) => setNewCity({ ...newCity, perKm: e.target.value })}
                className="mt-1 w-24 h-9 rounded-xl border border-border bg-background px-3 text-sm text-right"
              />
            </div>
            <Button
              size="sm"
              onClick={() => {
                const name = newCity.name.trim();
                if (!name) {
                  toast.error("Indiquez le nom de la ville");
                  return;
                }
                if (zones.some((z) => z.name.toLowerCase() === name.toLowerCase())) {
                  toast.error("Cette ville existe déjà");
                  return;
                }
                platformSettingsActions.addZone(
                  name,
                  Number(newCity.baseFee) || 0,
                  Number(newCity.perKm) || 0,
                  actorName,
                );
                toast.success(`${name} ajoutée`);
                setNewCity({ name: "", baseFee: "2000", perKm: "100" });
              }}
            >
              Ajouter une ville
            </Button>
          </div>
        )}
      </div>

      <div className="glass rounded-2xl p-5">
        <h2 className="font-semibold">Remboursements</h2>
        <p className="text-xs text-muted-foreground">
          Au-delà de ce montant, une justification écrite devient obligatoire pour approuver un
          remboursement ou un geste commercial.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
          <div className="flex-1 min-w-40">
            <div className="text-sm font-medium">Seuil de justification obligatoire</div>
            <div className="text-[11px] text-muted-foreground">
              Actuellement {formatFCFA(refundSettings.justificationThreshold)}
            </div>
          </div>
          <input
            type="number"
            min={0}
            step={5000}
            defaultValue={refundSettings.justificationThreshold}
            disabled={!canEdit}
            onBlur={(e) => {
              const value = Number(e.target.value);
              if (Number.isFinite(value) && value >= 0) {
                platformSettingsActions.setRefundJustificationThreshold(value);
                toast.success("Seuil mis à jour");
              }
            }}
            className="w-32 h-9 rounded-xl border border-border bg-background px-3 text-sm text-right disabled:opacity-50"
          />
          <span className="text-sm text-muted-foreground">FCFA</span>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Paliers d'approbation : rôle minimum requis pour approuver selon le montant. Limité aux
          rôles ayant la permission d'approuver un remboursement.
        </p>
        <div className="mt-2 space-y-2">
          {approvalTiers.map((t) => (
            <div
              key={t.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3"
            >
              <div className="flex-1 min-w-40 text-sm font-medium">{t.label}</div>
              <select
                value={t.requiredRole}
                disabled={!canEdit}
                onChange={(e) =>
                  platformSettingsActions.setApprovalTierRole(t.id, e.target.value as AdminRoleName)
                }
                className="h-9 rounded-xl border border-border bg-background px-3 text-sm disabled:opacity-50"
              >
                {approverRoles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SecurityTab({ canEdit, server }: { canEdit: boolean; server: ServerParams | null }) {
  const local = useLoginSecurity();
  const current = server?.params?.loginSecurity ?? local;
  const { maxAttempts, lockoutMinutes } = current;
  // Réglage voulu : les deux champs peuvent changer coup sur coup.
  const wanted = useRef(current);
  useEffect(() => {
    wanted.current = { maxAttempts, lockoutMinutes };
  }, [maxAttempts, lockoutMinutes]);
  const setRule = (patch: Partial<typeof local>) => {
    if (!server) {
      if (patch.maxAttempts !== undefined) loginSecurityActions.setMaxAttempts(patch.maxAttempts);
      if (patch.lockoutMinutes !== undefined)
        loginSecurityActions.setLockoutMinutes(patch.lockoutMinutes);
      return;
    }
    wanted.current = { ...wanted.current, ...patch };
    void server.save(() => ({ loginSecurity: wanted.current }), "Blocage de connexion mis à jour");
  };

  return (
    <div className="space-y-6">
      <SecurityPanel
        title="Sécurité de votre compte"
        description="Mot de passe, double authentification et sessions actives sur ce compte administrateur."
      />

      <div className="glass rounded-2xl p-5">
        <h2 className="font-semibold flex items-center gap-2">
          <Lock className="h-4 w-4" />
          Blocage après échecs de connexion
        </h2>
        <p className="text-xs text-muted-foreground">
          Réellement appliqué à la connexion : au-delà de ce nombre d'échecs pour un même email dans
          la fenêtre indiquée, la tentative suivante est bloquée.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-xl border border-border p-3">
            <div className="flex-1 text-sm font-medium">Tentatives autorisées</div>
            <input
              type="number"
              min={1}
              max={20}
              key={`max-${maxAttempts}`}
              defaultValue={maxAttempts}
              aria-label="Tentatives autorisées"
              disabled={!canEdit || (!!server && !server.params)}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (Number.isInteger(v) && v !== maxAttempts) setRule({ maxAttempts: v });
              }}
              className="w-20 h-9 rounded-xl border border-border bg-background px-3 text-sm text-right disabled:opacity-50"
            />
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border p-3">
            <div className="flex-1 text-sm font-medium">Durée du blocage</div>
            <input
              type="number"
              min={1}
              max={1440}
              key={`lock-${lockoutMinutes}`}
              defaultValue={lockoutMinutes}
              aria-label="Durée du blocage"
              disabled={!canEdit || (!!server && !server.params)}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (Number.isInteger(v) && v !== lockoutMinutes) setRule({ lockoutMinutes: v });
              }}
              className="w-20 h-9 rounded-xl border border-border bg-background px-3 text-sm text-right disabled:opacity-50"
            />
            <span className="text-sm text-muted-foreground">min</span>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
        <h2 className="font-semibold">Rôle admin</h2>
        <p className="text-xs text-muted-foreground">
          Chaque rôle admin a des permissions réelles, vérifiées par le serveur — configurez-les
          depuis{" "}
          <Link to="/admin/users/roles" className="text-primary hover:underline">
            Rôles & équipes
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

function RolesTab() {
  const teams = new Set(Object.values(useStaffTeams()));
  const roles = useAdminRoleList();
  const admins = usePlatformUsers().filter((u) => u.role === "admin");

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Rôles, permissions & équipes</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {roles.length + 1} rôles (dont super administrateur), {teams.size} équipe
            {teams.size > 1 ? "s" : ""}, {admins.length} administrateur
            {admins.length > 1 ? "s" : ""}.
          </p>
        </div>
        <Button asChild size="sm" className="gap-2">
          <Link to="/admin/users/roles">
            Gérer <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function MaintenanceTab({
  canEdit,
  actorName,
  server,
}: {
  canEdit: boolean;
  actorName: string;
  server: ServerParams | null;
}) {
  const local = useMaintenanceMode();
  const maintenance = server?.params?.maintenance ?? local;
  const [message, setMessage] = useState(maintenance.message);
  useEffect(() => setMessage(maintenance.message), [maintenance.message]);
  const ready = !server || !!server.params;
  // État voulu (interrupteur et message) : le message enregistré en quittant
  // le champ ne doit pas annuler l'interrupteur actionné juste après.
  const wanted = useRef(maintenance);
  useEffect(() => {
    wanted.current = { active: maintenance.active, message: maintenance.message };
  }, [maintenance.active, maintenance.message]);

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Mode maintenance
            </h2>
            <p className="mt-1 text-xs text-muted-foreground max-w-md">
              Quand activé, les portails agriculteur, restaurant et livreur affichent le message
              ci-dessous au lieu de l'application — les administrateurs restent connectés.
            </p>
          </div>
          <Switch
            checked={maintenance.active}
            disabled={!canEdit || !ready}
            aria-label="Mode maintenance"
            onCheckedChange={(checked) => {
              if (server) {
                wanted.current = {
                  active: checked,
                  message: message.trim() || wanted.current.message,
                };
                void server.save(
                  () => ({ maintenance: wanted.current }),
                  checked ? "Mode maintenance activé" : "Mode maintenance désactivé",
                );
                return;
              }
              maintenanceActions.setActive(checked, actorName);
              toast.success(checked ? "Mode maintenance activé" : "Mode maintenance désactivé");
            }}
          />
        </div>
        {maintenance.active && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            Les 3 portails non-admin sont actuellement bloqués.
          </div>
        )}
        <div className="mt-4 space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Message affiché aux utilisateurs
          </label>
          <Textarea
            value={message}
            disabled={!canEdit || !ready}
            aria-label="Message de maintenance"
            onChange={(e) => setMessage(e.target.value)}
            onBlur={() => {
              if (!message.trim() || message.trim() === wanted.current.message) return;
              if (server) {
                wanted.current = { ...wanted.current, message: message.trim() };
                void server.save(
                  () => ({ maintenance: wanted.current }),
                  "Message de maintenance mis à jour",
                );
                return;
              }
              maintenanceActions.setMessage(message.trim());
              toast.success("Message de maintenance mis à jour");
            }}
          />
        </div>
      </div>
    </div>
  );
}
