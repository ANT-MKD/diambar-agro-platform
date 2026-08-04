import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/farmer/page-header";
import { AdminBadge, RoleBadge } from "@/components/admin/admin-badge";
import { formatFCFA, relativeTime } from "@/lib/format";
import { usePlatformUsers } from "@/data/admin-store";

export const Route = createFileRoute("/admin/users/")({
  head: () => ({ meta: [{ title: "Utilisateurs — Administration Diambar Agro" }, { name: "description", content: "Gestion des comptes agriculteurs, restaurants et livreurs." }, { name: "robots", content: "noindex" }] }),
  component: AdminUsers,
});

const ROLES = ["all", "farmer", "restaurant", "driver", "admin"] as const;
const STATUSES = ["all", "active", "pending", "suspended", "rejected"] as const;

function AdminUsers() {
  const users = usePlatformUsers();
  const [q, setQ] = useState("");
  const [role, setRole] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const rows = users.filter((u) =>
    (role === "all" || u.role === role) &&
    (status === "all" || u.status === status) &&
    (q === "" || `${u.name} ${u.email} ${u.city}`.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Utilisateurs" subtitle={`${users.length} comptes sur la plateforme`} />
      <div className="glass rounded-2xl p-4 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un nom, email, ville…" className="flex-1 min-w-52 h-9 rounded-xl border border-border bg-background px-3 text-sm" />
        <select value={role} onChange={(e) => setRole(e.target.value)} className="h-9 rounded-xl border border-border bg-background px-3 text-sm">
          {ROLES.map((r) => <option key={r} value={r}>{r === "all" ? "Tous les rôles" : r}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-xl border border-border bg-background px-3 text-sm">
          {STATUSES.map((s) => <option key={s} value={s}>{s === "all" ? "Tous les statuts" : s}</option>)}
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
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((u) => (
              <tr key={u.id} className="hover:bg-accent/50 transition">
                <td className="px-4 py-3">
                  <Link to="/admin/users/$userId" params={{ userId: u.id }} className="flex items-center gap-3">
                    <img src={u.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{u.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{u.email}</div>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3 hidden md:table-cell"><RoleBadge role={u.role} /></td>
                <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{u.city}</td>
                <td className="px-4 py-3 hidden lg:table-cell text-right font-medium">{formatFCFA(u.gmv)}</td>
                <td className="px-4 py-3"><AdminBadge value={u.status} /></td>
                <td className="px-4 py-3 hidden md:table-cell text-right text-[11px] text-muted-foreground">{relativeTime(u.lastActiveAt)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Aucun compte ne correspond à ces filtres.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
