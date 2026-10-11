import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Sprout, ShieldCheck, Package, Wallet } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { AdminBadge } from "@/components/admin/admin-badge";
import { formatFCFA } from "@/lib/format";
import { usePlatformUsers } from "@/data/admin-store";
import { useOrders } from "@/data/store";
import { products } from "@/data/mocks";
import { findFarmerRecord } from "@/lib/user-links";

export const Route = createFileRoute("/admin/users/farmers")({
  head: () => ({
    meta: [
      { title: "Agriculteurs — Administration Diambar Agro" },
      { name: "description", content: "Gestion des comptes producteurs de la plateforme." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminFarmers,
});

function AdminFarmers() {
  const users = usePlatformUsers().filter((u) => u.role === "farmer");
  const orders = useOrders();
  const [q, setQ] = useState("");

  const allRows = users.map((u) => {
    const farmer = findFarmerRecord(u);
    const activeProducts = farmer
      ? products.filter((p) => p.farmerId === farmer.id && p.status === "active").length
      : 0;
    const farmerOrders = farmer ? orders.filter((o) => o.farmerId === farmer.id) : [];
    const revenue = farmerOrders
      .filter((o) => o.status === "delivered")
      .reduce((s, o) => s + o.total, 0);
    return { user: u, farmer, activeProducts, orderCount: farmerOrders.length, revenue };
  });

  const rows = allRows.filter(
    (r) => q === "" || `${r.user.name} ${r.user.city}`.toLowerCase().includes(q.toLowerCase()),
  );

  const verifiedCount = users.filter((u) => u.verified).length;
  const totalActiveProducts = allRows.reduce((s, r) => s + r.activeProducts, 0);
  const totalRevenue = allRows.reduce((s, r) => s + r.revenue, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agriculteurs"
        subtitle="Producteurs inscrits sur la plateforme, leurs produits et leurs ventes"
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Agriculteurs" value={String(users.length)} icon={Sprout} />
        <StatCard label="Vérifiés" value={String(verifiedCount)} icon={ShieldCheck} />
        <StatCard label="Produits actifs" value={String(totalActiveProducts)} icon={Package} />
        <StatCard label="CA livré (cumulé)" value={formatFCFA(totalRevenue)} icon={Wallet} />
      </div>

      <div className="glass rounded-2xl p-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un producteur, une ville…"
          className="w-full h-9 rounded-xl border border-border bg-background px-3 text-sm"
        />
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-3">Producteur</th>
              <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Ferme</th>
              <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">Localisation</th>
              <th className="text-right font-medium px-4 py-3">Produits actifs</th>
              <th className="text-right font-medium px-4 py-3 hidden md:table-cell">Commandes</th>
              <th className="text-right font-medium px-4 py-3">CA livré</th>
              <th className="text-left font-medium px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(({ user, farmer, activeProducts, orderCount, revenue }) => (
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
                  {farmer?.farm ?? "—"}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                  {user.city}
                </td>
                <td className="px-4 py-3 text-right font-medium">{activeProducts}</td>
                <td className="px-4 py-3 hidden md:table-cell text-right text-muted-foreground">
                  {orderCount}
                </td>
                <td className="px-4 py-3 text-right font-medium">{formatFCFA(revenue)}</td>
                <td className="px-4 py-3">
                  <AdminBadge value={user.status} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  Aucun agriculteur ne correspond à cette recherche.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
