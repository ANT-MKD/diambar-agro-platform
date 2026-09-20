import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ShieldCheck, Check, X } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { relativeTime } from "@/lib/format";
import {
  usePlatformUsers,
  useAdminRole,
  useAdminRoles,
  adminRoleActions,
  ADMIN_ROLE_NAMES,
  ADMIN_ROLE_PERMISSIONS,
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

const CATEGORIES = ["Utilisateurs", "Finance", "Commandes", "Paramètres"] as const;

function AdminAdmins() {
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
              />
            ))}
            {admins.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                  Aucun compte administrateur.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="glass rounded-2xl p-5">
        <h2 className="font-semibold">Ce que permet chaque rôle</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Configure l'affichage de cette page ; l'application des permissions sur chaque route est
          un chantier séparé.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="text-left font-medium py-2">Rôle</th>
                {CATEGORIES.map((c) => (
                  <th key={c} className="text-center font-medium py-2">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ADMIN_ROLE_NAMES.map((role) => (
                <tr key={role}>
                  <td className="py-2.5 font-medium">{role}</td>
                  {CATEGORIES.map((cat) => {
                    const perm = ADMIN_ROLE_PERMISSIONS[role][cat];
                    return (
                      <td key={cat} className="py-2.5 text-center">
                        <div className="inline-flex items-center gap-2 text-[11px]">
                          <span
                            className={`inline-flex items-center gap-0.5 ${perm.view ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/50"}`}
                          >
                            {perm.view ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                            Voir
                          </span>
                          <span
                            className={`inline-flex items-center gap-0.5 ${perm.edit ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/50"}`}
                          >
                            {perm.edit ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                            Modifier
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AdminRow({
  userId,
  name,
  avatar,
  lastActiveAt,
}: {
  userId: string;
  name: string;
  avatar: string;
  lastActiveAt: string;
}) {
  const role = useAdminRole(userId);

  return (
    <tr className="hover:bg-accent/50 transition">
      <td className="px-4 py-3">
        <Link to="/admin/users/$userId" params={{ userId }} className="flex items-center gap-3">
          <img src={avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
          <div className="font-medium">{name}</div>
        </Link>
      </td>
      <td className="px-4 py-3">
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
      </td>
      <td className="px-4 py-3 hidden md:table-cell text-right text-muted-foreground">
        {relativeTime(lastActiveAt)}
      </td>
    </tr>
  );
}
