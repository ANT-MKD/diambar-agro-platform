import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Utensils, ShoppingBag, Wallet } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { AdminBadge } from "@/components/admin/admin-badge";
import { formatFCFA, relativeTime } from "@/lib/format";
import { usePlatformUsers } from "@/data/admin-store";
import { useOrders } from "@/data/store";
import { findRestaurantRecord } from "@/lib/user-links";

export const Route = createFileRoute("/admin/users/restaurants")({
  head: () => ({
    meta: [
      { title: "Restaurants — Administration Diambar Agro" },
      { name: "description", content: "Gestion des comptes restaurants de la plateforme." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminRestaurants,
});

function AdminRestaurants() {
  const users = usePlatformUsers().filter((u) => u.role === "restaurant");
  const orders = useOrders();
  const [q, setQ] = useState("");

  const rows = users
    .filter((u) => q === "" || `${u.name} ${u.city}`.toLowerCase().includes(q.toLowerCase()))
    .map((u) => {
      const restaurant = findRestaurantRecord(u);
      const restaurantOrders = restaurant
        ? orders.filter((o) => o.restaurantId === restaurant.id)
        : [];
      const spent = restaurantOrders.reduce((s, o) => s + o.total, 0);
      const lastOrder = [...restaurantOrders].sort((a, b) =>
        a.createdAt < b.createdAt ? 1 : -1,
      )[0];
      return { user: u, restaurant, orderCount: restaurantOrders.length, spent, lastOrder };
    });

  const totalOrders = rows.reduce((s, r) => s + r.orderCount, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Restaurants" subtitle="Établissements qui achètent sur la plateforme" />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Restaurants" value={String(users.length)} icon={Utensils} />
        <StatCard label="Commandes cumulées" value={String(totalOrders)} icon={ShoppingBag} />
        <StatCard label="Dépenses cumulées" value={formatFCFA(totalSpent)} icon={Wallet} />
      </div>

      <div className="glass rounded-2xl p-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un restaurant, une ville…"
          className="w-full h-9 rounded-xl border border-border bg-background px-3 text-sm"
        />
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-3">Restaurant</th>
              <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Type</th>
              <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">Localisation</th>
              <th className="text-right font-medium px-4 py-3 hidden md:table-cell">Commandes</th>
              <th className="text-right font-medium px-4 py-3">Dépensé</th>
              <th className="text-right font-medium px-4 py-3 hidden lg:table-cell">
                Dernière commande
              </th>
              <th className="text-left font-medium px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(({ user, restaurant, orderCount, spent, lastOrder }) => (
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
                  {restaurant?.type ?? "—"}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                  {user.city}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-right text-muted-foreground">
                  {orderCount}
                </td>
                <td className="px-4 py-3 text-right font-medium">{formatFCFA(spent)}</td>
                <td className="px-4 py-3 hidden lg:table-cell text-right text-muted-foreground">
                  {lastOrder ? relativeTime(lastOrder.createdAt) : "—"}
                </td>
                <td className="px-4 py-3">
                  <AdminBadge value={user.status} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  Aucun restaurant ne correspond à cette recherche.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
