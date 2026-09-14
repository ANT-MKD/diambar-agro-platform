import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { Button } from "@/components/ui/button";
import { DisputeForm } from "@/components/disputes/dispute-form";
import { useOrder, useFarmerProfile } from "@/data/store";
import { restaurants } from "@/data/mocks";

export const Route = createFileRoute("/farmer/orders/$orderId/dispute")({
  head: () => ({
    meta: [
      { title: "Ouvrir un litige — Espace producteur Diambar Agro" },
      {
        name: "description",
        content: "Ouvrir un dossier de litige officiel sur une commande producteur.",
      },
      { property: "og:title", content: "Ouvrir un litige — Producteur" },
      {
        property: "og:description",
        content: "Ouvrir un dossier de litige officiel sur une commande.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FarmerOpenDispute,
});

function FarmerOpenDispute() {
  const { orderId } = Route.useParams();
  const order = useOrder(orderId);
  const profile = useFarmerProfile();
  const navigate = useNavigate();
  if (!order)
    return <p className="py-12 text-center text-muted-foreground">Commande introuvable</p>;
  const r = restaurants.find((x) => x.id === order.restaurantId);

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Ouvrir un litige"
        subtitle={`${order.reference} · ${r?.name ?? "Restaurant"}`}
        actions={
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => navigate({ to: "/farmer/orders/$orderId", params: { orderId } })}
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
        }
      />
      <DisputeForm
        openedByRole="farmer"
        openedByName={`${profile.firstName} ${profile.lastName}`}
        againstOptions={[
          { role: "restaurant", name: r?.name ?? "Restaurant" },
          { role: "driver", name: "Livreur assigné" },
          { role: "platform", name: "Plateforme Diambar" },
        ]}
        orderRef={order.reference}
        orderId={order.id}
        hasGpsTrack={Boolean(order.driverId)}
        maxAmount={order.total}
        defaultCategory="payment"
        onCancel={() => navigate({ to: "/farmer/orders/$orderId", params: { orderId } })}
        onCreated={(id) =>
          navigate({ to: "/farmer/disputes/$disputeId", params: { disputeId: id } })
        }
      />
    </div>
  );
}
