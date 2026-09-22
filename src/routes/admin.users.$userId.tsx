import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Trash2,
  Eye,
  ShieldCheck,
  ArrowUpRight,
  ShoppingBag,
  Scale,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { AdminBadge, RoleBadge } from "@/components/admin/admin-badge";
import { DisputeStatusBadge } from "@/components/disputes/dispute-badges";
import { Button } from "@/components/ui/button";
import { formatFCFA, relativeTime } from "@/lib/format";
import {
  adminUserActions,
  auditActions,
  usePlatformUser,
  useValidations,
  useAuditLogs,
  useAdminRoleForEmail,
  can,
} from "@/data/admin-store";
import { impersonationActions } from "@/data/impersonation";
import { useAllDisputes } from "@/data/disputes";
import { useOrders, useMissions } from "@/data/store";
import { products } from "@/data/mocks";
import { AUDIT_LEVEL_DOT } from "@/data/admin-mocks";
import { findFarmerRecord, findRestaurantRecord, findDriverRecord } from "@/lib/user-links";
import { MISSION_BADGE } from "@/lib/driver-day";

export const Route = createFileRoute("/admin/users/$userId")({
  head: () => ({
    meta: [
      { title: "Fiche utilisateur — Administration Diambar Agro" },
      {
        name: "description",
        content: "Détail d'un compte : activité, volume, statut et actions de modération.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminUserDetail,
});

const TABS = ["Vue d'ensemble", "Commandes", "Litiges", "Activité"] as const;

function AdminUserDetail() {
  const { userId } = Route.useParams();
  const { user: currentAdmin } = useRouteContext({ from: "/admin" });
  const currentAdminRole = useAdminRoleForEmail(currentAdmin.email);
  const canSuspend = can(currentAdminRole, "users.suspend");
  const user = usePlatformUser(userId);
  const validations = useValidations();
  const disputes = useAllDisputes();
  const logs = useAuditLogs();
  const orders = useOrders();
  const missions = useMissions();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Vue d'ensemble");

  if (!user) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <h2 className="font-semibold">Compte introuvable</h2>
        <Link to="/admin/users" className="mt-4 inline-block text-sm text-primary">
          Retour à la liste
        </Link>
      </div>
    );
  }

  const validation = validations.find((v) => v.userId === user.id);
  const farmer = findFarmerRecord(user);
  const restaurant = findRestaurantRecord(user);
  const driver = findDriverRecord(user);
  const isDriver = user.role === "driver";

  const userDisputes = disputes.filter(
    (d) => d.openedByName === user.name || d.againstName === user.name,
  );
  const userLogs = logs.filter((l) => l.target === user.name || l.actor === user.name);
  const userOrders = farmer
    ? orders.filter((o) => o.farmerId === farmer.id)
    : restaurant
      ? orders.filter((o) => o.restaurantId === restaurant.id)
      : [];
  const userMissions = driver ? missions.filter((m) => m.driverId === driver.id) : [];
  const activeProducts = farmer
    ? products.filter((p) => p.farmerId === farmer.id && p.status === "active").length
    : 0;
  const deliveredMissions = userMissions.filter((m) => m.status === "delivered").length;

  return (
    <div className="space-y-6">
      <Link
        to="/admin/users"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Utilisateurs
      </Link>
      <PageHeader
        title={user.name}
        subtitle={`${user.email} · ${user.phone}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => {
                impersonationActions.start(user.id, user.name, user.role);
                auditActions.log({
                  action: "Impersonation démarrée",
                  target: user.name,
                  module: "security",
                  level: "critical",
                });
                toast.success(`Vous naviguez en tant que ${user.name}`);
              }}
            >
              <Eye className="h-4 w-4" />
              Voir en tant que
            </Button>
            {canSuspend && user.status !== "active" && (
              <Button
                size="sm"
                className="gap-2"
                onClick={() => {
                  adminUserActions.setStatus(user.id, "active");
                  auditActions.log({
                    action: "Compte réactivé",
                    target: user.name,
                    module: "security",
                    changes: [{ field: "Statut du compte", before: user.status, after: "active" }],
                  });
                  toast.success("Compte activé");
                }}
              >
                <CheckCircle2 className="h-4 w-4" />
                Activer
              </Button>
            )}
            {canSuspend && user.status === "active" && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => {
                  adminUserActions.setStatus(user.id, "suspended");
                  auditActions.log({
                    action: "Compte suspendu",
                    target: user.name,
                    module: "security",
                    level: "critical",
                    changes: [
                      { field: "Statut du compte", before: user.status, after: "suspended" },
                    ],
                  });
                  toast.success("Compte suspendu");
                }}
              >
                <Ban className="h-4 w-4" />
                Suspendre
              </Button>
            )}
            {canSuspend && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2 text-destructive"
                onClick={() => {
                  adminUserActions.setStatus(user.id, "rejected");
                  auditActions.log({
                    action: "Compte rejeté",
                    target: user.name,
                    module: "security",
                    level: "critical",
                    changes: [
                      { field: "Statut du compte", before: user.status, after: "rejected" },
                    ],
                  });
                  toast.success("Compte rejeté");
                }}
              >
                <Trash2 className="h-4 w-4" />
                Rejeter
              </Button>
            )}
          </div>
        }
      />

      <div className="glass inline-flex flex-wrap gap-1 rounded-2xl p-1.5">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`h-9 rounded-xl px-3 text-sm font-medium transition ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
          >
            {t}
            {t === "Litiges" && userDisputes.length > 0 && ` (${userDisputes.length})`}
          </button>
        ))}
      </div>

      {tab === "Vue d'ensemble" && (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="glass rounded-2xl p-5 flex items-center gap-4">
              <img src={user.avatar} alt="" className="h-16 w-16 rounded-2xl object-cover" />
              <div className="space-y-1.5">
                <RoleBadge role={user.role} />
                <AdminBadge value={user.status} />
                <div className="text-xs text-muted-foreground">
                  {user.city} · inscrit le {user.joinedAt}
                </div>
              </div>
            </div>
            <div className="glass rounded-2xl p-5">
              <div className="text-xs text-muted-foreground">
                {isDriver ? "Missions livrées" : "Volume généré"}
              </div>
              <div className="font-display text-2xl font-bold mt-1">
                {isDriver ? deliveredMissions : formatFCFA(user.gmv)}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {isDriver
                  ? `${userMissions.length} mission(s) au total`
                  : `${user.orders} commandes`}
              </div>
            </div>
            <div className="glass rounded-2xl p-5">
              <div className="text-xs text-muted-foreground">Note moyenne</div>
              <div className="font-display text-2xl font-bold mt-1">{user.rating || "—"}</div>
              <div className="text-xs text-muted-foreground mt-2">
                Dernière activité {relativeTime(user.lastActiveAt)}
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <h2 className="font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-violet-500" />
              Vérification
            </h2>
            {validation ? (
              <Link
                to="/admin/validations/$validationId"
                params={{ validationId: validation.id }}
                className="mt-3 flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-accent transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">
                    Dossier de validation · {validation.docs.length} document(s)
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Déposé {relativeTime(validation.submittedAt)}
                  </div>
                </div>
                <AdminBadge value={validation.status} />
                <ArrowUpRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </Link>
            ) : (
              <div className="mt-3 flex items-center justify-between rounded-xl border border-border p-3 text-sm">
                <span className="text-muted-foreground">
                  Aucun dossier de validation déposé pour ce compte.
                </span>
                <AdminBadge
                  value={user.verified ? "approved" : "pending"}
                  label={user.verified ? "Identité vérifiée" : "Non vérifiée"}
                />
              </div>
            )}
          </div>

          {(farmer || restaurant || driver) && (
            <div className="glass rounded-2xl p-5">
              <h2 className="font-semibold">Activité opérationnelle</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {farmer && (
                  <>
                    <MiniStat label="Produits actifs" value={String(activeProducts)} />
                    <MiniStat label="Commandes" value={String(userOrders.length)} />
                    <MiniStat label="Ferme" value={farmer.farm} />
                  </>
                )}
                {restaurant && (
                  <>
                    <MiniStat label="Commandes" value={String(userOrders.length)} />
                    <MiniStat
                      label="Dépensé"
                      value={formatFCFA(userOrders.reduce((s, o) => s + o.total, 0))}
                    />
                    <MiniStat label="Type" value={restaurant.type} />
                  </>
                )}
                {driver && (
                  <>
                    <MiniStat label="Véhicule" value={driver.vehicle} />
                    <MiniStat label="Missions livrées" value={String(deliveredMissions)} />
                    <MiniStat label="Missions au total" value={String(userMissions.length)} />
                  </>
                )}
              </div>
            </div>
          )}
          {!farmer && !restaurant && !driver && user.role !== "admin" && (
            <div className="glass rounded-2xl p-5 text-sm text-muted-foreground">
              Aucune donnée opérationnelle : ce compte n'est pas (ou plus) actif sur la plateforme.
            </div>
          )}
        </div>
      )}

      {tab === "Commandes" && (
        <div className="glass rounded-2xl overflow-hidden">
          {isDriver ? (
            userMissions.length === 0 ? (
              <EmptyState
                icon={ShoppingBag}
                title="Aucune mission"
                description="Ce livreur n'a aucune mission."
              />
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-4 py-3">Mission</th>
                    <th className="text-left font-medium px-4 py-3">Trajet</th>
                    <th className="text-right font-medium px-4 py-3">Montant</th>
                    <th className="text-left font-medium px-4 py-3">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {userMissions.map((m) => (
                    <tr key={m.id}>
                      <td className="px-4 py-3 font-medium">{m.reference}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {m.pickup.city} → {m.dropoff.city}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{formatFCFA(m.payout)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${MISSION_BADGE[m.status].className}`}
                        >
                          {MISSION_BADGE[m.status].label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : userOrders.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="Aucune commande"
              description="Aucune commande pour ce compte."
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Référence</th>
                  <th className="text-right font-medium px-4 py-3">Montant</th>
                  <th className="text-left font-medium px-4 py-3">Statut</th>
                  <th className="text-right font-medium px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {userOrders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-3 font-medium">{o.reference}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatFCFA(o.total)}</td>
                    <td className="px-4 py-3">
                      <AdminBadge value={o.status} label={o.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {relativeTime(o.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "Litiges" &&
        (userDisputes.length === 0 ? (
          <EmptyState
            icon={Scale}
            title="Aucun litige"
            description="Ce compte n'est impliqué dans aucun litige."
          />
        ) : (
          <div className="space-y-3">
            {userDisputes.map((d) => (
              <Link
                key={d.id}
                to="/admin/disputes/$disputeId"
                params={{ disputeId: d.id }}
                className="glass flex flex-wrap items-center gap-3 rounded-2xl p-4 hover:bg-accent/40 transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium">
                    {d.reference} · {d.subcategory}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {d.openedByName} vs {d.againstName} · {relativeTime(d.openedAt)}
                  </div>
                </div>
                <span className="font-medium">{formatFCFA(d.claimedAmount)}</span>
                <DisputeStatusBadge status={d.status} />
              </Link>
            ))}
          </div>
        ))}

      {tab === "Activité" &&
        (userLogs.length === 0 ? (
          <EmptyState
            icon={History}
            title="Aucune activité"
            description="Aucun événement journalisé pour ce compte."
          />
        ) : (
          <div className="glass rounded-2xl divide-y divide-border">
            {userLogs.map((l) => (
              <div key={l.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className={`h-2 w-2 rounded-full ${AUDIT_LEVEL_DOT[l.level]}`} />
                <span className="flex-1">
                  {l.action} — <span className="text-muted-foreground">{l.actor}</span>
                </span>
                <span className="text-[11px] text-muted-foreground">{relativeTime(l.at)}</span>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold mt-0.5 truncate">{value}</div>
    </div>
  );
}
