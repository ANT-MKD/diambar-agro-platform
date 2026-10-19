import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, ArrowRight, Copy, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { relativeTime } from "@/lib/format";
import {
  usePlatformUsers,
  useAdminRoles,
  useAdminRoleForEmail,
  useAdminRoleList,
  useStaffRoleIds,
  useStaffTeams,
  adminRoleActions,
  ADMIN_ROLE_NAMES,
  can,
  permissionsOfRole,
  type AdminRoleName,
} from "@/data/admin-store";
import { useBaseMode } from "@/data/demo-only";
import { market, refreshMarket } from "@/data/market-remote";
import { SUPER_ADMIN_LABEL } from "@/lib/auth/permissions";
import { createStaffInviteFn } from "@/lib/platform/setup";

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
  const base = useBaseMode();
  const canManageAdmins = can(currentRole, "security.manage_admins");
  const users = usePlatformUsers();
  const admins = users.filter((u) => u.role === "admin");
  const roles = useAdminRoles();
  const teams = useStaffTeams();
  const superAdminCount = admins.filter(
    (a) => (roles[a.id] ?? "Support") === SUPER_ADMIN_LABEL,
  ).length;
  const teamNames = [...new Set(Object.values(teams))].sort((a, b) => a.localeCompare(b, "fr"));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administrateurs"
        subtitle="Comptes admin de la plateforme, leur rôle et leur équipe"
        actions={
          <Button asChild variant="outline" className="gap-2">
            <Link to="/admin/users/roles">
              <ShieldCheck className="h-4 w-4" />
              Rôles & permissions
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
        <StatCard label="Administrateurs" value={String(admins.length)} icon={ShieldCheck} />
        <StatCard
          label="Super administrateurs"
          value={String(superAdminCount)}
          icon={ShieldCheck}
        />
      </div>

      {base && canManageAdmins && <InviteAdmin currentRole={currentRole} />}

      <div className="glass rounded-2xl overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-3">Administrateur</th>
              <th className="text-left font-medium px-4 py-3">Rôle</th>
              <th className="text-left font-medium px-4 py-3">Équipe</th>
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
                email={a.email}
                avatar={a.avatar}
                lastActiveAt={a.lastActiveAt}
                self={a.email === currentAdmin.email}
                canManage={canManageAdmins}
                currentRole={currentRole}
                teamNames={teamNames}
              />
            ))}
            {admins.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  Aucun compte administrateur.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <datalist id="admin-teams">
        {teamNames.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      <Link
        to="/admin/users/roles"
        className="glass rounded-2xl p-5 flex items-center justify-between gap-3 hover:bg-accent/40 transition"
      >
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Rôles & permissions
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Créer des rôles, choisir leurs permissions, voir les équipes.
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
  email,
  avatar,
  lastActiveAt,
  self,
  canManage,
  currentRole,
  teamNames,
}: {
  userId: string;
  name: string;
  email: string;
  avatar: string;
  lastActiveAt: string;
  self: boolean;
  canManage: boolean;
  currentRole: string;
  teamNames: string[];
}) {
  const base = useBaseMode();
  const roleName = useAdminRoles()[userId] ?? "Support";
  const roleId = useStaffRoleIds()[userId] ?? "";
  const roleList = useAdminRoleList();
  const team = useStaffTeams()[userId] ?? "";
  const [teamDraft, setTeamDraft] = useState(team);
  const iAmSuper = currentRole === SUPER_ADMIN_LABEL;
  const mine = permissionsOfRole(currentRole);
  const isSuper = roleName === SUPER_ADMIN_LABEL;
  // Personne ne change son propre rôle ; seul un super admin touche à un
  // super admin (le serveur applique les mêmes règles).
  const editable = canManage && !self && (iAmSuper || !isSuper);

  const assign = async (value: string) => {
    const res = await market.adminRoleAction({ action: "assign", userId, roleId: value });
    if (!res.ok) toast.error(res.message);
    else toast.success("Rôle mis à jour");
  };
  const saveTeam = async () => {
    if (teamDraft.trim() === team) return;
    const res = await market.adminRoleAction({ action: "team", userId, team: teamDraft });
    if (!res.ok) {
      toast.error(res.message);
      setTeamDraft(team);
    } else toast.success(teamDraft.trim() ? "Équipe enregistrée" : "Équipe retirée");
  };

  return (
    <tr className="hover:bg-accent/50 transition">
      <td className="px-4 py-3">
        <Link to="/admin/users/$userId" params={{ userId }} className="flex items-center gap-3">
          {avatar ? (
            <img src={avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <span className="h-9 w-9 rounded-full bg-muted" />
          )}
          <div className="min-w-0">
            <div className="font-medium truncate">
              {name}
              {self && <span className="ml-1.5 text-xs text-muted-foreground">(vous)</span>}
            </div>
            <div className="text-xs text-muted-foreground truncate">{email}</div>
          </div>
        </Link>
      </td>
      <td className="px-4 py-3">
        {!editable ? (
          <span className="text-sm">{roleName}</span>
        ) : base ? (
          <select
            value={roleId}
            aria-label={`Rôle de ${name}`}
            onChange={(e) => void assign(e.target.value)}
            className="h-9 rounded-xl border border-border bg-background px-3 text-sm"
          >
            {iAmSuper && <option value="super_admin">{SUPER_ADMIN_LABEL}</option>}
            {roleList.map((r) => (
              <option
                key={r.id}
                value={r.id}
                disabled={!iAmSuper && r.permissions.some((p) => !mine.includes(p))}
              >
                {r.name}
              </option>
            ))}
          </select>
        ) : (
          <select
            value={roleName}
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
        )}
      </td>
      <td className="px-4 py-3">
        {base && canManage ? (
          <Input
            value={teamDraft}
            list="admin-teams"
            aria-label={`Équipe de ${name}`}
            placeholder={teamNames.length ? "Choisir ou créer" : "Ex. Dakar Nord"}
            className="h-9 w-44"
            onChange={(e) => setTeamDraft(e.target.value)}
            onBlur={() => void saveTeam()}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
        ) : (
          <span className="text-muted-foreground">{team || "—"}</span>
        )}
      </td>
      <td className="px-4 py-3 hidden md:table-cell text-right text-muted-foreground">
        {relativeTime(lastActiveAt)}
      </td>
    </tr>
  );
}

/** Invitation d'un administrateur avec le rôle choisi (lien signé, 72 h). */
function InviteAdmin({ currentRole }: { currentRole: string }) {
  const roleList = useAdminRoleList();
  const iAmSuper = currentRole === SUPER_ADMIN_LABEL;
  const mine = permissionsOfRole(currentRole);
  const choices = roleList.filter((r) => iAmSuper || r.permissions.every((p) => mine.includes(p)));
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", roleId: "" });
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const roleId = form.roleId || choices[0]?.id || "";

  const invite = async () => {
    setBusy(true);
    try {
      const res = await createStaffInviteFn({ data: { ...form, roleId } });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setLink(res.emailed ? null : `${window.location.origin}${res.path}`);
      toast.success(
        res.emailed ? "Invitation envoyée par e-mail" : "Invitation créée · copiez le lien",
      );
      setForm({ firstName: "", lastName: "", email: "", roleId });
      void refreshMarket();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Invitation impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-5 space-y-3">
      <h2 className="font-semibold flex items-center gap-2">
        <UserPlus className="h-4 w-4" />
        Inviter un administrateur
      </h2>
      <p className="text-xs text-muted-foreground">
        La personne reçoit un lien valable 72 heures pour créer son compte, avec le rôle choisi.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          aria-label="Prénom"
          placeholder="Prénom"
          value={form.firstName}
          onChange={(e) => setForm({ ...form, firstName: e.target.value })}
        />
        <Input
          aria-label="Nom"
          placeholder="Nom"
          value={form.lastName}
          onChange={(e) => setForm({ ...form, lastName: e.target.value })}
        />
        <Input
          aria-label="E-mail"
          type="email"
          placeholder="E-mail"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <select
          aria-label="Rôle de l'invité"
          value={roleId}
          onChange={(e) => setForm({ ...form, roleId: e.target.value })}
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
        >
          {choices.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <Button onClick={invite} disabled={busy || !roleId} className="gap-2">
        <UserPlus className="h-4 w-4" />
        Créer l'invitation
      </Button>
      {link && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            L'envoi d'e-mails n'est pas configuré : transmettez ce lien à la personne invitée.
          </p>
          <div className="flex gap-2">
            <Input readOnly value={link} className="text-xs" aria-label="Lien d'invitation" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Copier le lien"
              onClick={() => {
                void navigator.clipboard?.writeText(link);
                toast.success("Lien copié");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
