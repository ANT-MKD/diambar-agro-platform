import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/farmer/page-header";
import { AdminBadge } from "@/components/admin/admin-badge";
import { formatFCFA } from "@/lib/format";
import { farmers, restaurants } from "@/data/mocks";
import { useOrders } from "@/data/store";

export const Route = createFileRoute("/admin/orders")({
  head: () => ({ meta: [{ title: "Toutes les commandes — Administration Diambar Agro" }, { name: "description", content: "Vue globale des commandes de la plateforme, tous rôles confondus." }, { name: "robots", content: "noindex" }] }),
  component: AdminOrders,
});

function AdminOrders() {
  const orders = useOrders();
  const [q, setQ] = useState("");
  const rows = orders.filter((o) => q === "" || o.reference.toLowerCase().includes(q.toLowerCase()));
  const gmv = rows.reduce((s, o) => s + o.total, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Commandes" subtitle={`${rows.length} commandes · ${formatFCFA(gmv)} de volume`} />
      <div className="glass rounded-2xl p-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une référence…" className="w-full h-9 rounded-xl border border-border bg-background px-3 text-sm" />
      </div>
      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-3">Référence</th>
              <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Producteur</th>
              <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Client</th>
              <th className="text-right font-medium px-4 py-3">Montant</th>
              <th className="text-right font-medium px-4 py-3 hidden lg:table-cell">Commission</th>
              <th className="text-left font-medium px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((o) => (
              <tr key={o.id} className="hover:bg-accent/50 transition">
                <td className="px-4 py-3 font-medium">{o.reference}</td>
                <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{farmers.find((f) => f.id === o.farmerId)?.name ?? "—"}</td>
                <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{restaurants.find((r) => r.id === o.restaurantId)?.name ?? "—"}</td>
                <td className="px-4 py-3 text-right font-medium">{formatFCFA(o.total)}</td>
                <td className="px-4 py-3 text-right hidden lg:table-cell text-muted-foreground">{formatFCFA(Math.round(o.total * 0.1))}</td>
                <td className="px-4 py-3"><AdminBadge value={o.status} label={o.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
