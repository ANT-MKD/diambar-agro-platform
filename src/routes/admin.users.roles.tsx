import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  UsersRound,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ROLE_PERMISSIONS,
  can,
  permissionsOfRole,
  useAdminRoleForEmail,
  useAdminRoleList,
  useAdminRoles,
  usePlatformUsers,
  useStaffTeams,
} from "@/data/admin-store";
import { useBaseMode } from "@/data/demo-only";
import { market } from "@/data/market-remote";
import {
  PERMISSION_GROUPS,
  PERMISSION_KEYS,
  PERMISSIONS,
  SUPER_ADMIN_LABEL,
  type AdminRoleView,
  type PermissionKey,
} from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/users/roles")({
  head: () => ({
    meta: [
      { title: "Rôles & permissions — Administration Diambar Agro" },
      {
        name: "description",
        content: "Rôles de l'administration, leurs permissions et les équipes.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminRoles,
});

type Draft = { id?: string; name: string; description: string; permissions: PermissionKey[] };

function AdminRoles() {
  const { user } = useRouteContext({ from: "/admin" });
  const role = useAdminRoleForEmail(user.email);
  const base = useBaseMode();
  const canManageRoles = base && can(role, "security.manage_roles");
  const serverRoles = useAdminRoleList();
  // Sans base : les rôles fournis, en lecture seule.
  const roles: AdminRoleView[] = useMemo(
    () =>
      base
        ? serverRoles
        : Object.entries(ROLE_PERMISSIONS)
            .filter(([name]) => name !== SUPER_ADMIN_LABEL)
            .map(([name, permissions]) => ({
              id: name,
              name,
              description: "",
              permissions: [...permissions],
              system: true,
              members: 0,
            })),
    [base, serverRoles],
  );
  const [draft, setDraft] = useState<Draft | null>(null);
  const mine = permissionsOfRole(role);

  const remove = async (r: AdminRoleView) => {
    const res = await market.adminRoleAction({ action: "delete", id: r.id });
    if (!res.ok) toast.error(res.message);
    else toast.success(`Rôle « ${r.name} » supprimé`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rôles & permissions"
        subtitle="Chaque rôle est un ensemble de permissions, vérifiées par le serveur à chaque action."
        actions={
          canManageRoles ? (
            <Button
              className="gap-2"
              onClick={() => setDraft({ name: "", description: "", permissions: [] })}
            >
              <Plus className="h-4 w-4" />
              Nouveau rôle
            </Button>
          ) : undefined
        }
      />

      {!canManageRoles && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
          <TriangleAlert className="h-5 w-5 shrink-0" />
          <span>
            {base
              ? `Votre rôle (${role}) permet de consulter cette page, pas de la modifier.`
              : "Démonstration : la création de rôles fonctionne avec la base de données."}
          </span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="glass rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">{SUPER_ADMIN_LABEL}</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Toutes les permissions, y compris l'installation de la plateforme. Ne peut pas être
            restreint.
          </p>
          <p className="text-xs font-medium">{PERMISSION_KEYS.length} permissions</p>
        </div>
        {roles.map((r) => (
          <div key={r.id} className="glass rounded-2xl p-5 space-y-2" data-testid="admin-role">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="font-semibold truncate">{r.name}</h2>
                {r.system && (
                  <span className="text-[10px] font-semibold rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                    Rôle fourni
                  </span>
                )}
              </div>
              {canManageRoles && (
                <div className="flex gap-1.5 shrink-0">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    aria-label={`Modifier ${r.name}`}
                    onClick={() =>
                      setDraft({
                        id: r.id,
                        name: r.name,
                        description: r.description,
                        permissions: r.permissions,
                      })
                    }
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {!r.system && (
                    <ConfirmDialog
                      trigger={
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          aria-label={`Supprimer ${r.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      }
                      title={`Supprimer le rôle « ${r.name} » ?`}
                      description={
                        r.members > 0
                          ? `${r.members} administrateur(s) ont ce rôle : donnez-leur d'abord un autre rôle.`
                          : "Le rôle disparaît. Cette action est journalisée."
                      }
                      destructive
                      confirmLabel="Supprimer"
                      onConfirm={() => remove(r)}
                    />
                  )}
                </div>
              )}
            </div>
            {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
            <p className="text-xs font-medium">
              {r.permissions.length} permission{r.permissions.length > 1 ? "s" : ""}
              {base && ` · ${r.members} administrateur${r.members > 1 ? "s" : ""}`}
            </p>
          </div>
        ))}
      </div>

      <PermissionMatrix roles={roles} />
      <TeamsOverview />

      {draft && (
        <RoleEditor
          draft={draft}
          system={!!roles.find((r) => r.id === draft.id)?.system}
          mine={mine}
          superAdmin={role === SUPER_ADMIN_LABEL}
          onClose={() => setDraft(null)}
        />
      )}
    </div>
  );
}

function RoleEditor({
  draft: initial,
  system,
  mine,
  superAdmin,
  onClose,
}: {
  draft: Draft;
  system: boolean;
  mine: readonly PermissionKey[];
  superAdmin: boolean;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  // Hors super admin : on ne donne que des permissions que l'on a (le
  // serveur refuse le reste) ; celles déjà présentes peuvent rester.
  const grantable = (k: PermissionKey) =>
    superAdmin || mine.includes(k) || initial.permissions.includes(k);
  const toggle = (k: PermissionKey, on: boolean) =>
    setDraft((d) => ({
      ...d,
      permissions: on
        ? PERMISSION_KEYS.filter((x) => x === k || d.permissions.includes(x))
        : d.permissions.filter((x) => x !== k),
    }));

  const save = async () => {
    if (draft.name.trim().length < 2) {
      toast.error("Donnez un nom au rôle");
      return;
    }
    if (draft.permissions.length === 0) {
      toast.error("Choisissez au moins une permission");
      return;
    }
    setSaving(true);
    const role = {
      name: draft.name,
      description: draft.description,
      permissions: draft.permissions,
    };
    const res = draft.id
      ? await market.adminRoleAction({ action: "update", id: draft.id, role })
      : await market.adminRoleAction({ action: "create", role });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(draft.id ? "Rôle mis à jour" : "Rôle créé");
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{draft.id ? `Modifier « ${initial.name} »` : "Nouveau rôle"}</DialogTitle>
          <DialogDescription>
            Cochez ce que ce rôle peut faire. Le serveur applique ces permissions à chaque action ;
            les menus suivent.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="role-name" className="text-xs font-medium text-muted-foreground">
                Nom du rôle
              </label>
              <Input
                id="role-name"
                value={draft.name}
                disabled={system}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Ex. Comptabilité"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="role-desc" className="text-xs font-medium text-muted-foreground">
                Description
              </label>
              <Textarea
                id="role-desc"
                rows={1}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="À quoi sert ce rôle"
              />
            </div>
          </div>
          {PERMISSION_GROUPS.map((g) => {
            const allOn = g.keys.every((k) => draft.permissions.includes(k));
            return (
              <div key={g.module} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{g.module}</h3>
                  <button
                    type="button"
                    className="text-[11px] font-medium text-primary hover:underline"
                    onClick={() => {
                      for (const k of g.keys) if (grantable(k)) toggle(k, !allOn);
                    }}
                  >
                    {allOn ? "Tout décocher" : "Tout cocher"}
                  </button>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {g.keys.map((k) => {
                    const id = `perm-${k}`;
                    const allowed = grantable(k);
                    return (
                      <label
                        key={k}
                        htmlFor={id}
                        title={allowed ? undefined : "Votre propre rôle n'a pas cette permission"}
                        className={cn(
                          "flex items-center gap-2 text-sm",
                          !allowed && "opacity-50 cursor-not-allowed",
                        )}
                      >
                        <Checkbox
                          id={id}
                          checked={draft.permissions.includes(k)}
                          disabled={!allowed}
                          onCheckedChange={(v) => toggle(k, v === true)}
                        />
                        {PERMISSIONS[k].label}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} disabled={saving}>
            {draft.id ? "Enregistrer" : "Créer le rôle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PermissionMatrix({ roles }: { roles: AdminRoleView[] }) {
  const columns = [
    { id: "super", name: SUPER_ADMIN_LABEL, permissions: PERMISSION_KEYS },
    ...roles,
  ];
  return (
    <div className="glass rounded-2xl p-5">
      <h2 className="font-semibold flex items-center gap-2">
        <ShieldCheck className="h-4 w-4" />
        Matrice des permissions
      </h2>
      <p className="text-xs text-muted-foreground mt-1">
        Chaque permission bloque à la fois l'affichage et l'exécution de l'action correspondante —
        pas seulement un bouton caché.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 320 + columns.length * 110 }}>
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium py-2 pr-3">Permission</th>
              {columns.map((r) => (
                <th key={r.id} className="text-center font-medium py-2 px-2">
                  {r.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_GROUPS.map((group) => (
              <Fragment key={group.module}>
                <tr className="bg-muted/30">
                  <td
                    colSpan={columns.length + 1}
                    className="px-1 py-1.5 text-[11px] font-semibold text-muted-foreground"
                  >
                    {group.module}
                  </td>
                </tr>
                {group.keys.map((key) => (
                  <tr key={key} className="border-b border-border/60">
                    <td className="py-2 pr-3">{PERMISSIONS[key].label}</td>
                    {columns.map((r) => (
                      <td key={r.id} className="text-center py-2 px-2">
                        {r.permissions.includes(key) ? (
                          <Check className="h-4 w-4 mx-auto text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <X className="h-4 w-4 mx-auto text-muted-foreground/40" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Équipes de l'administration : regroupement libre, donné à chaque
 * administrateur depuis la page Administrateurs. */
function TeamsOverview() {
  const teams = useStaffTeams();
  const roles = useAdminRoles();
  const users = usePlatformUsers();
  const groups = useMemo(() => {
    const map = new Map<string, { id: string; name: string }[]>();
    for (const a of users) {
      const team = a.role === "admin" ? teams[a.id] : undefined;
      if (team) map.set(team, [...(map.get(team) ?? []), { id: a.id, name: a.name }]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, "fr"));
  }, [users, teams]);

  return (
    <div className="glass rounded-2xl p-5">
      <h2 className="font-semibold flex items-center gap-2">
        <UsersRound className="h-4 w-4" />
        Équipes
      </h2>
      <p className="text-xs text-muted-foreground mt-1">
        Regroupement des administrateurs, distinct du rôle : il se choisit pour chacun dans
        Administrateurs.
      </p>
      {groups.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Aucune équipe pour le moment.</p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {groups.map(([team, members]) => (
            <div key={team} className="rounded-xl border border-border p-3">
              <div className="text-sm font-medium">
                {team} · {members.length}
              </div>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {members.map((m) => (
                  <li key={m.id}>
                    {m.name} · {roles[m.id] ?? "—"}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
