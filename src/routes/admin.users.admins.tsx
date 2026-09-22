import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { toast } from "sonner";
import { ShieldCheck, ArrowRight, MapPinned } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/format";
import {
  usePlatformUsers,
  useAdminRole,
  useAdminRoles,
  useAdminScope,
  useAdminRoleForEmail,
  useTeams,
  adminRoleActions,
  ADMIN_ROLE_NAMES,
  can,
  type AdminRoleName,
} from "@/data/admin-store";

export const Route = createFileRoute("/admin/users/admins")({
  head: () => ({
    meta: [
      { title: "Administrateurs — Administration Diambar Agro" },
      {
        name: "description",
        content: "Comptes administrateurs de la plateforme et rôles associés.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminAdmins,
});

function AdminAdmins() {
  const { user: currentAdmin } = useRouteContext({ from: "/admin" });
  const currentRole = useAdminRoleForEmail(currentAdmin.email);
  const canManageAdmins = can(currentRole, "security.manage_admins");
  const admins = usePlatformUsers().filter((u) => u.role === "admin");
  const roles = useAdminRoles();
  const superAdminCount = admins.filter(
    (a) => (roles[a.id] ?? "Support") === "Super Administrateur",
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administrateurs"
        subtitle="Comptes admin de la plateforme et rôles d'accès"
        actions={
          <Button asChild variant="outline" className="gap-2">
            <Link to="/admin/users/roles">
              <ShieldCheck className="h-4 w-4" />
              Rôles & permissions
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Administrateurs" value={String(admins.length)} icon={ShieldCheck} />
        <StatCard
          label="Super administrateurs"
          value={String(superAdminCount)}
          icon={ShieldCheck}
        />
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-3">Administrateur</th>
              <th className="text-left font-medium px-4 py-3">Rôle</th>
              <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">Équipe</th>
              <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">Périmètre</th>
              <th className="text-right font-medium px-4 py-3 hidden md:table-cell">
                Dernière connexion
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {admins.map((a) => (
              <AdminRow
                key={a.id}
                userId={a.id}
                name={a.name}
                avatar={a.avatar}
                lastActiveAt={a.lastActiveAt}
                canManage={canManageAdmins}
              />
            ))}
            {admins.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  Aucun compte administrateur.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Link
        to="/admin/users/roles"
        className="glass rounded-2xl p-5 flex items-center justify-between gap-3 hover:bg-accent/40 transition"
      >
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Matrice des permissions par rôle
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Voir en détail ce que chaque rôle peut faire, gérer les équipes et le périmètre
            géographique des administrateurs.
          </p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </Link>
    </div>
  );
}

function AdminRow({
  userId,
  name,
  avatar,
  lastActiveAt,
  canManage,
}: {
  userId: string;
  name: string;
  avatar: string;
  lastActiveAt: string;
  canManage: boolean;
}) {
  const role = useAdminRole(userId);
  const scope = useAdminScope(userId);
  const teams = useTeams();
  const team = teams.find((t) => t.memberIds.includes(userId));

  return (
    <tr className="hover:bg-accent/50 transition">
      <td className="px-4 py-3">
        <Link to="/admin/users/$userId" params={{ userId }} className="flex items-center gap-3">
          <img src={avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
          <div className="font-medium">{name}</div>
        </Link>
      </td>
      <td className="px-4 py-3">
        {canManage ? (
          <select
            value={role}
            onChange={(e) => {
              adminRoleActions.setRole(userId, e.target.value as AdminRoleName, name);
              toast.success(`Rôle mis à jour : ${e.target.value}`);
            }}
            className="h-9 rounded-xl border border-border bg-background px-3 text-sm"
          >
            {ADMIN_ROLE_NAMES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm">{role}</span>
        )}
      </td>
      <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{team?.name ?? "—"}</td>
      <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
        {role === "Super Administrateur" ? (
          "Toutes les villes"
        ) : scope.length === 0 ? (
          "Aucune restriction"
        ) : (
          <span className="inline-flex items-center gap-1">
            <MapPinned className="h-3 w-3" />
            {scope.join(", ")}
          </span>
        )}
      </td>
      <td className="px-4 py-3 hidden md:table-cell text-right text-muted-foreground">
        {relativeTime(lastActiveAt)}
      </td>
    </tr>
  );
}
