import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  MoreVertical,
  Eye,
  Ban,
  CheckCircle2,
  UserCog,
  Users,
  UserCheck,
  UserX,
  Sparkles,
  Download,
} from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { AdminBadge, RoleBadge } from "@/components/admin/admin-badge";
import { formatFCFA, relativeTime } from "@/lib/format";
import { adminUserActions, auditActions, usePlatformUsers } from "@/data/admin-store";
import { impersonationActions } from "@/data/impersonation";
import { downloadCsv } from "@/lib/export";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/common/confirm-dialog";

export const Route = createFileRoute("/admin/users/")({
  head: () => ({
    meta: [
      { title: "Utilisateurs — Administration Diambar Agro" },
      {
        name: "description",
        content: "Gestion des comptes agriculteurs, restaurants et livreurs.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminUsers,
});

const ROLES = ["all", "farmer", "restaurant", "driver", "admin"] as const;
const STATUSES = ["all", "active", "pending", "suspended", "rejected"] as const;

function AdminUsers() {
  const users = usePlatformUsers();
  const [q, setQ] = useState("");
  const [role, setRole] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const rows = users.filter(
    (u) =>
      (role === "all" || u.role === role) &&
      (status === "all" || u.status === status) &&
      (q === "" || `${u.name} ${u.email} ${u.city}`.toLowerCase().includes(q.toLowerCase())),
  );

  const active = users.filter((u) => u.status === "active").length;
  const pending = users.filter((u) => u.status === "pending").length;
  const suspended = users.filter((u) => u.status === "suspended").length;
  // Les comptes de démo couvrent quelques mois figés dans le passé : "ce
  // mois" est ancré sur le mois d'inscription le plus récent réellement
  // présent dans les données, plutôt que sur l'horloge système.
  const latestJoin = users.reduce((a, b) => (a.joinedAt > b.joinedAt ? a : b), users[0]);
  const newThisMonth = latestJoin
    ? users.filter((u) => u.joinedAt.slice(0, 7) === latestJoin.joinedAt.slice(0, 7)).length
    : 0;

  const suspend = (u: (typeof users)[number], reason?: string) => {
    adminUserActions.setStatus(u.id, "suspended");
    auditActions.log(
      reason ? `Compte suspendu — motif : ${reason}` : "Compte suspendu",
      u.name,
      "critical",
    );
    toast.success("Compte suspendu");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tous les utilisateurs"
        subtitle="Gérez les comptes, les rôles et les accès à la plateforme"
        actions={
          <Button
            variant="outline"
            className="gap-2"
            onClick={() =>
              downloadCsv(
                "utilisateurs-diambar",
                [
                  "Nom",
                  "Email",
                  "Téléphone",
                  "Rôle",
                  "Ville",
                  "Statut",
                  "Volume FCFA",
                  "Commandes",
                ],
                rows.map((u) => [
                  u.name,
                  u.email,
                  u.phone,
                  u.role,
                  u.city,
                  u.status,
                  u.gmv,
                  u.orders,
                ]),
              )
            }
          >
            <Download className="h-4 w-4" />
            Exporter CSV
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Tous les utilisateurs" value={String(users.length)} icon={Users} />
        <StatCard label="Actifs" value={String(active)} icon={UserCheck} />
        <StatCard label="En attente" value={String(pending)} icon={UserCog} />
        <StatCard label="Suspendus" value={String(suspended)} icon={UserX} />
        <StatCard label="Nouveaux ce mois" value={String(newThisMonth)} icon={Sparkles} />
      </div>

      <div className="glass rounded-2xl p-4 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un nom, email, ville…"
          className="flex-1 min-w-52 h-9 rounded-xl border border-border bg-background px-3 text-sm"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="h-9 rounded-xl border border-border bg-background px-3 text-sm"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r === "all" ? "Tous les rôles" : r}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-xl border border-border bg-background px-3 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "Tous les statuts" : s}
            </option>
          ))}
        </select>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-3">Compte</th>
              <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Rôle</th>
              <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">Ville</th>
              <th className="text-right font-medium px-4 py-3 hidden lg:table-cell">Volume</th>
              <th className="text-left font-medium px-4 py-3">Statut</th>
              <th className="text-right font-medium px-4 py-3 hidden md:table-cell">Activité</th>
              <th className="text-right font-medium px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((u) => (
              <tr key={u.id} className="hover:bg-accent/50 transition">
                <td className="px-4 py-3">
                  <Link
                    to="/admin/users/$userId"
                    params={{ userId: u.id }}
                    className="flex items-center gap-3"
                  >
                    <img src={u.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{u.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{u.email}</div>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <RoleBadge role={u.role} />
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{u.city}</td>
                <td className="px-4 py-3 hidden lg:table-cell text-right font-medium">
                  {formatFCFA(u.gmv)}
                </td>
                <td className="px-4 py-3">
                  <AdminBadge value={u.status} />
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-right text-[11px] text-muted-foreground">
                  {relativeTime(u.lastActiveAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link to="/admin/users/$userId" params={{ userId: u.id }}>
                          Voir le profil
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          impersonationActions.start(u.id, u.name, u.role);
                          auditActions.log("Impersonation démarrée", u.name, "critical");
                          toast.success(`Vous naviguez en tant que ${u.name}`);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                        Voir en tant que
                      </DropdownMenuItem>
                      {u.status === "active" ? (
                        <ConfirmDialog
                          trigger={
                            <DropdownMenuItem
                              onSelect={(e) => e.preventDefault()}
                              className="text-destructive"
                            >
                              <Ban className="h-4 w-4" />
                              Suspendre
                            </DropdownMenuItem>
                          }
                          title={`Suspendre ${u.name} ?`}
                          description="Le compte perdra immédiatement l'accès à la plateforme. Cette action est journalisée."
                          confirmLabel="Suspendre"
                          destructive
                          onConfirm={() => suspend(u)}
                        />
                      ) : (
                        <DropdownMenuItem
                          onClick={() => {
                            adminUserActions.setStatus(u.id, "active");
                            auditActions.log("Compte réactivé", u.name);
                            toast.success("Compte activé");
                          }}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Réactiver
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  Aucun compte ne correspond à ces filtres.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
