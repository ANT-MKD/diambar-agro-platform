import { createFileRoute, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Package, Search } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DisputeForm } from "@/components/disputes/dispute-form";
import { useRestaurantOrders, useMissions } from "@/data/store";
import { suppliers, drivers } from "@/data/mocks";
import { formatFCFA } from "@/lib/format";

export const Route = createFileRoute("/restaurant/disputes/new")({
  head: () => ({
    meta: [
      { title: "Ouvrir un litige — Espace restaurant Diambar Agro" },
      {
        name: "description",
        content: "Sélectionnez la commande concernée et décrivez le problème rencontré.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NewDispute,
});

function NewDispute() {
  const navigate = useNavigate();
  const { user } = useRouteContext({ from: "/restaurant" });
  const orders = useRestaurantOrders();
  const missions = useMissions();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const filteredOrders = useMemo(
    () =>
      [...orders]
        .filter((o) => o.reference.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [orders, q],
  );

  const order = orders.find((o) => o.id === orderId) ?? null;
  const supplier = order ? suppliers.find((s) => s.farmerId === order.farmerId) : null;
  const mission = order ? missions.find((m) => m.orderRef === order.reference) : null;
  const driver = mission?.driverId ? drivers.find((d) => d.id === mission.driverId) : null;

  if (order) {
    return (
      <div className="max-w-2xl space-y-6">
        <PageHeader
          title="Déclarer un litige"
          subtitle={`${order.reference} · ${supplier?.name ?? "Fournisseur"}`}
          actions={
            <Button variant="outline" className="gap-2" onClick={() => setOrderId(null)}>
              <ArrowLeft className="h-4 w-4" />
              Changer de commande
            </Button>
          }
        />
        <DisputeForm
          openedByRole="restaurant"
          openedByName={user.name}
          againstOptions={[
            { role: "farmer", name: supplier?.name ?? "Fournisseur" },
            { role: "driver", name: driver?.name ?? "Livreur (non assigné)" },
            { role: "platform", name: "Plateforme Diambar" },
          ]}
          orderRef={order.reference}
          orderId={order.id}
          hasGpsTrack={order.status === "delivering" || order.status === "delivered"}
          maxAmount={order.total}
          defaultCategory="quality"
          onCancel={() => setOrderId(null)}
          onCreated={(id) =>
            navigate({ to: "/restaurant/disputes/$disputeId", params: { disputeId: id } })
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Déclarer un litige"
        subtitle="1. Sélectionnez la commande concernée"
        actions={
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => navigate({ to: "/restaurant/disputes" })}
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
        }
      />
      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher une commande (ex: CMD-3049)"
          className="pl-9"
        />
      </div>
      {filteredOrders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Aucune commande"
          description="Vous n'avez encore passé aucune commande à contester."
        />
      ) : (
        <div className="space-y-2 max-h-[28rem] overflow-auto">
          {filteredOrders.map((o) => {
            const s = suppliers.find((x) => x.farmerId === o.farmerId);
            return (
              <button
                key={o.id}
                onClick={() => setOrderId(o.id)}
                className="w-full text-left rounded-xl border border-border p-3 hover:bg-accent/40 transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-semibold text-sm">{o.reference}</span>
                  <span className="text-sm font-bold">{formatFCFA(o.total)}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {s?.name ?? "Fournisseur"} · {new Date(o.createdAt).toLocaleDateString("fr-FR")}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
