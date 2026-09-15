import { createFileRoute, useNavigate, useRouteContext } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { Button } from "@/components/ui/button";
import { DisputeForm } from "@/components/disputes/dispute-form";
import { useRestaurantOrder, useMissions } from "@/data/store";
import { suppliers, drivers } from "@/data/mocks";

export const Route = createFileRoute("/restaurant/orders_/$orderId/dispute")({
  head: () => ({
    meta: [
      { title: "Ouvrir un litige — Espace restaurant Diambar Agro" },
      {
        name: "description",
        content:
          "Signaler un problème de qualité, quantité, livraison ou paiement sur une commande.",
      },
      { property: "og:title", content: "Ouvrir un litige — Restaurant" },
      {
        property: "og:description",
        content: "Signaler un problème sur une commande et ouvrir un dossier.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RestaurantOpenDispute,
});

function RestaurantOpenDispute() {
  const { orderId } = Route.useParams();
  const { user } = useRouteContext({ from: "/restaurant" });
  const order = useRestaurantOrder(orderId);
  const missions = useMissions();
  const navigate = useNavigate();
  if (!order)
    return <p className="py-12 text-center text-muted-foreground">Commande introuvable</p>;
  const supplier = suppliers.find((s) => s.farmerId === order.farmerId);
  const mission = missions.find((m) => m.orderRef === order.reference);
  const driver = mission?.driverId ? drivers.find((d) => d.id === mission.driverId) : null;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Ouvrir un litige"
        subtitle={`${order.reference} · ${supplier?.name ?? "Fournisseur"}`}
        actions={
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => navigate({ to: "/restaurant/orders/$orderId", params: { orderId } })}
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
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
        onCancel={() => navigate({ to: "/restaurant/orders/$orderId", params: { orderId } })}
        onCreated={(id) =>
          navigate({ to: "/restaurant/disputes/$disputeId", params: { disputeId: id } })
        }
      />
    </div>
  );
}
