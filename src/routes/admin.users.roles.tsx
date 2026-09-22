import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { Check, X, Plus, UsersRound, MapPinned, ShieldCheck, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ADMIN_ROLE_NAMES,
  ROLE_PERMISSIONS,
  usePlatformUsers,
  useAdminRoles,
  useAdminRoleForEmail,
  useTeams,
  teamActions,
  useAdminScopes,
  adminScopeActions,
  can,
  type PermissionKey,
  type AdminRoleName,
} from "@/data/admin-store";

export const Route = createFileRoute("/admin/users/roles")({
  head: () => ({
    meta: [
      { title: "Rôles & permissions — Administration Diambar Agro" },
      {
        name: "description",
        content: "Matrice de permissions par rôle, équipes et périmètre des administrateurs.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminRoles,
});

const PERMISSION_GROUPS: { module: string; keys: PermissionKey[] }[] = [
  { module: "Utilisateurs", keys: ["users.view", "users.edit", "users.suspend"] },
  { module: "Validations & modération", keys: ["validations.decide", "moderation.decide"] },
  {
    module: "Commandes & livraisons",
    keys: ["orders.view", "deliveries.view", "deliveries.reassign"],
  },
  { module: "Incidents & litiges", keys: ["incidents.decide", "disputes.decide"] },
  { module: "Support & retours", keys: ["support.respond", "returns.decide"] },
  { module: "Remboursements", keys: ["refunds.view", "refunds.approve", "refunds.execute"] },
  { module: "Finance", keys: ["finance.view", "finance.edit"] },
  { module: "Messages", keys: ["messages.view"] },
  {
    module: "Paramètres & sécurité",
    keys: ["settings.edit", "security.manage_admins", "security.manage_roles"],
  },
  { module: "Journal d'audit", keys: ["audit.view", "audit.export"] },
];

const PERMISSION_LABEL: Record<PermissionKey, string> = {
  "users.view": "Voir les utilisateurs",
  "users.edit": "Modifier les utilisateurs",
  "users.suspend": "Suspendre un compte",
  "validations.decide": "Traiter les validations",
  "moderation.decide": "Traiter la modération",
  "orders.view": "Voir les commandes",
  "deliveries.view": "Voir les livraisons",
  "deliveries.reassign": "Réaffecter une course",
  "incidents.decide": "Traiter les incidents",
  "disputes.decide": "Traiter les litiges",
  "support.respond": "Répondre au support",
  "returns.decide": "Traiter les retours",
  "refunds.view": "Voir les remboursements",
  "refunds.approve": "Approuver un remboursement",
  "refunds.execute": "Exécuter un remboursement",
  "finance.view": "Voir les données financières",
  "finance.edit": "Modifier commissions/zones",
  "messages.view": "Voir les messages",
  "settings.edit": "Modifier les Paramètres",
  "security.manage_admins": "Gérer les comptes admin",
  "security.manage_roles": "Gérer les rôles",
  "audit.view": "Voir le journal d'audit",
  "audit.export": "Exporter le journal d'audit",
};

function AdminRoles() {
  const { user } = useRouteContext({ from: "/admin" });
  const role = useAdminRoleForEmail(user.email);
  const canManageRoles = can(role, "security.manage_roles");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rôles & permissions"
        subtitle="Ce que chaque rôle admin peut réellement faire, les équipes et le périmètre géographique."
      />

      {!canManageRoles && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
          <TriangleAlert className="h-5 w-5 shrink-0" />
          <span>Votre rôle ({role}) permet de consulter cette page, pas de la modifier.</span>
        </div>
      )}

      <PermissionMatrix />
      <ScopeSection canManage={canManageRoles} actorName={user.name} />
      <TeamsSection canManage={canManageRoles} />
    </div>
  );
}

function PermissionMatrix() {
  return (
    <div className="glass rounded-2xl p-5">
      <h2 className="font-semibold flex items-center gap-2">
        <ShieldCheck className="h-4 w-4" />
        Matrice des permissions
      </h2>
      <p className="text-xs text-muted-foreground mt-1">
        5 rôles système. Chaque permission bloque à la fois l'affichage et l'exécution de l'action
        correspondante — pas seulement un bouton caché.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium py-2 pr-3">Permission</th>
              {ADMIN_ROLE_NAMES.map((r) => (
                <th key={r} className="text-center font-medium py-2 px-2">
                  {r}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_GROUPS.map((group) => (
              <Fragment key={group.module}>
                <tr className="bg-muted/30">
                  <td
                    colSpan={ADMIN_ROLE_NAMES.length + 1}
                    className="px-1 py-1.5 text-[11px] font-semibold text-muted-foreground"
                  >
                    {group.module}
                  </td>
                </tr>
                {group.keys.map((key) => (
                  <tr key={key} className="border-b border-border/60">
                    <td className="py-2 pr-3">{PERMISSION_LABEL[key]}</td>
                    {ADMIN_ROLE_NAMES.map((r) => {
                      const granted = ROLE_PERMISSIONS[r].includes(key);
                      return (
                        <td key={r} className="text-center py-2 px-2">
                          {granted ? (
                            <Check className="h-4 w-4 mx-auto text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <X className="h-4 w-4 mx-auto text-muted-foreground/40" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-[11px] text-muted-foreground">
        Rôles personnalisés : pas encore disponible — le modèle de rôle est aujourd'hui une liste
        fermée de 5 valeurs utilisée dans tout le moteur de permissions. L'ouvrir à des rôles créés
        à la volée est un chantier séparé (retouche du typage et de tous les points d'application),
        pas ajouté ici pour éviter une fonctionnalité à moitié câblée.
      </p>
    </div>
  );
}

function ScopeSection({ canManage, actorName }: { canManage: boolean; actorName: string }) {
  const admins = usePlatformUsers().filter((u) => u.role === "admin");
  const roles = useAdminRoles();
  const scopes = useAdminScopes();
  const allCities = Array.from(
    new Set(
      usePlatformUsers()
        .map((u) => u.city)
        .filter(Boolean),
    ),
  ).sort();
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="glass rounded-2xl p-5">
      <h2 className="font-semibold flex items-center gap-2">
        <MapPinned className="h-4 w-4" />
        Périmètre géographique
      </h2>
      <p className="text-xs text-muted-foreground mt-1">
        Limite un administrateur non Super Administrateur aux villes cochées (vide = aucune
        restriction). Basé sur les villes réellement présentes sur les fiches utilisateur.
      </p>
      <div className="mt-4 space-y-2">
        {admins.map((a) => {
          const adminRole = roles[a.id] ?? "Support";
          const scope = scopes[a.id] ?? [];
          const editing = editingId === a.id;
          return (
            <div key={a.id} className="rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <img src={a.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                  <div>
                    <div className="text-sm font-medium">{a.name}</div>
                    <div className="text-[11px] text-muted-foreground">{adminRole}</div>
                  </div>
                </div>
                {canManage && adminRole !== "Super Administrateur" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingId(editing ? null : a.id)}
                  >
                    {editing ? "Fermer" : "Modifier"}
                  </Button>
                )}
                {adminRole === "Super Administrateur" && (
                  <span className="text-[11px] text-muted-foreground">Toutes les villes</span>
                )}
              </div>
              {!editing && adminRole !== "Super Administrateur" && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {scope.length === 0 ? (
                    <span className="text-[11px] text-muted-foreground">
                      Aucune restriction (toutes les villes)
                    </span>
                  ) : (
                    scope.map((c) => (
                      <span
                        key={c}
                        className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {c}
                      </span>
                    ))
                  )}
                </div>
              )}
              {editing && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {allCities.map((city) => {
                    const checked = scope.includes(city);
                    return (
                      <button
                        key={city}
                        onClick={() => {
                          const next = checked ? scope.filter((c) => c !== city) : [...scope, city];
                          adminScopeActions.setScope(a.id, next, actorName);
                        }}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                          checked
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:bg-accent",
                        )}
                      >
                        {city}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TeamsSection({ canManage }: { canManage: boolean }) {
  const teams = useTeams();
  const admins = usePlatformUsers().filter((u) => u.role === "admin");
  const [newTeamName, setNewTeamName] = useState("");

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold flex items-center gap-2">
          <UsersRound className="h-4 w-4" />
          Équipes
        </h2>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Regroupement des administrateurs, distinct du rôle.
      </p>

      <div className="mt-4 space-y-3">
        {teams.map((t) => (
          <div key={t.id} className="rounded-xl border border-border p-3">
            <div className="text-sm font-medium">{t.name}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {admins.map((a) => {
                const inTeam = t.memberIds.includes(a.id);
                return (
                  <button
                    key={a.id}
                    disabled={!canManage}
                    onClick={() =>
                      inTeam
                        ? teamActions.removeMember(t.id, a.id)
                        : teamActions.addMember(t.id, a.id)
                    }
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-60",
                      inTeam
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:bg-accent",
                    )}
                  >
                    <img src={a.avatar} alt="" className="h-4 w-4 rounded-full object-cover" />
                    {a.name}
                  </button>
                );
              })}
              {admins.length === 0 && (
                <span className="text-xs text-muted-foreground">Aucun administrateur.</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {canManage && (
        <div className="mt-4 flex gap-2">
          <Input
            placeholder="Nom de la nouvelle équipe"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
          />
          <Button
            className="gap-2 shrink-0"
            onClick={() => {
              if (!newTeamName.trim()) {
                toast.error("Indiquez un nom d'équipe");
                return;
              }
              teamActions.create(newTeamName.trim());
              setNewTeamName("");
              toast.success("Équipe créée");
            }}
          >
            <Plus className="h-4 w-4" />
            Créer
          </Button>
        </div>
      )}
    </div>
  );
}
