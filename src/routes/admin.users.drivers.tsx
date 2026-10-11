import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Truck, PackageCheck, Star } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { AdminBadge } from "@/components/admin/admin-badge";
import { usePlatformUsers } from "@/data/admin-store";
import { useMissions } from "@/data/store";
import { findDriverRecord } from "@/lib/user-links";
import type { MissionStatus } from "@/data/mocks";

export const Route = createFileRoute("/admin/users/drivers")({
  head: () => ({
    meta: [
      { title: "Livreurs — Administration Diambar Agro" },
      { name: "description", content: "Gestion des comptes livreurs et de leur activité." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminDrivers,
});

const ACTIVE_STATUSES: MissionStatus[] = ["accepted", "pickup", "loaded"];

function AdminDrivers() {
  const users = usePlatformUsers().filter((u) => u.role === "driver");
  const missions = useMissions();
  const [q, setQ] = useState("");

  const allRows = users.map((u) => {
    const driver = findDriverRecord(u);
    const driverMissions = driver ? missions.filter((m) => m.driverId === driver.id) : [];
    const delivered = driverMissions.filter((m) => m.status === "delivered").length;
    const isOnMission = driverMissions.some((m) => ACTIVE_STATUSES.includes(m.status));
    const liveStatus = u.status !== "active" ? null : isOnMission ? "En livraison" : "Disponible";
    return { user: u, driver, missionCount: driverMissions.length, delivered, liveStatus };
  });

  const rows = allRows.filter(
    (r) => q === "" || r.user.name.toLowerCase().includes(q.toLowerCase()),
  );

  const totalDelivered = allRows.reduce((s, r) => s + r.delivered, 0);
  const ratings = allRows.map((r) => r.driver?.rating).filter((r): r is number => !!r);
  const avgRating = ratings.length
    ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
    : "—";

  return (
    <div className="space-y-6">
      <PageHeader title="Livreurs" subtitle="Roster des livreurs et leur activité de livraison" />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Livreurs" value={String(users.length)} icon={Truck} />
        <StatCard label="Livraisons réussies" value={String(totalDelivered)} icon={PackageCheck} />
        <StatCard label="Note moyenne" value={String(avgRating)} icon={Star} />
      </div>

      <div className="glass rounded-2xl p-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un livreur…"
          className="w-full h-9 rounded-xl border border-border bg-background px-3 text-sm"
        />
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-3">Livreur</th>
              <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Véhicule</th>
              <th className="text-right font-medium px-4 py-3 hidden md:table-cell">
                Livraisons réussies
              </th>
              <th className="text-right font-medium px-4 py-3 hidden lg:table-cell">
                Missions au total
              </th>
              <th className="text-right font-medium px-4 py-3">Note</th>
              <th className="text-left font-medium px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(({ user, driver, missionCount, delivered, liveStatus }) => (
              <tr key={user.id} className="hover:bg-accent/50 transition">
                <td className="px-4 py-3">
                  <Link
                    to="/admin/users/$userId"
                    params={{ userId: user.id }}
                    className="flex items-center gap-3"
                  >
                    <img src={user.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{user.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{user.phone}</div>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                  {driver?.vehicle ?? "—"}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-right font-medium">
                  {delivered}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-right text-muted-foreground">
                  {missionCount}
                </td>
                <td className="px-4 py-3 text-right font-medium">{driver?.rating ?? "—"}</td>
                <td className="px-4 py-3">
                  {liveStatus ? (
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${liveStatus === "En livraison" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"}`}
                    >
                      {liveStatus}
                    </span>
                  ) : (
                    <AdminBadge value={user.status} />
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  Aucun livreur ne correspond à cette recherche.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
