import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { Button } from "@/components/ui/button";
import { DisputeForm } from "@/components/disputes/dispute-form";
import { useRestaurantOrder } from "@/data/store";
import { suppliers } from "@/data/mocks";

export const Route = createFileRoute("/restaurant/orders/$orderId/dispute")({
  head: () => ({ meta: [
    { title: "Ouvrir un litige — Espace restaurant Diambar Agro" },
    { name: "description", content: "Signaler un problème de qualité, quantité, livraison ou paiement sur une commande." },
    { property: "og:title", content: "Ouvrir un litige — Restaurant" },
    { property: "og:description", content: "Signaler un problème sur une commande et ouvrir un dossier." },
    { name: "robots", content: "noindex" },
  ] }),
  component: RestaurantOpenDispute,
});

function RestaurantOpenDispute() {
  const { orderId } = Route.useParams();
  const order = useRestaurantOrder(orderId);
  const navigate = useNavigate();
  if (!order) return <p className="py-12 text-center text-muted-foreground">Commande introuvable</p>;
  const supplier = suppliers.find((s) => s.farmerId === order.farmerId);

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Ouvrir un litige" subtitle={`${order.reference} · ${supplier?.name ?? "Fournisseur"}`} actions={
        <Button variant="outline" className="gap-2" onClick={() => navigate({ to: "/restaurant/orders/$orderId", params: { orderId } })}><ArrowLeft className="h-4 w-4" />Retour</Button>
      } />
      <DisputeForm
        openedByRole="restaurant"
        openedByName="Le Baobab"
        againstOptions={[
          { role: "farmer", name: supplier?.name ?? "Fournisseur" },
          { role: "driver", name: "Livreur assigné" },
          { role: "platform", name: "Plateforme Diambar" },
        ]}
        orderRef={order.reference}
        orderId={order.id}
        hasGpsTrack={order.status === "delivering" || order.status === "delivered"}
        maxAmount={order.total}
        defaultCategory="quality"
        onCancel={() => navigate({ to: "/restaurant/orders/$orderId", params: { orderId } })}
        onCreated={(id) => navigate({ to: "/restaurant/disputes/$disputeId", params: { disputeId: id } })}
      />
    </div>
  );
}
