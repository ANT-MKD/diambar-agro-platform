import { createFileRoute, Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { market } from "@/data/market-remote";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/farmer/page-header";
import { SupplierForm } from "@/components/restaurant/supplier-form";
import { supplierActions } from "@/data/store";
import { restaurants } from "@/data/mocks";
import { useMyId } from "@/data/market-mode";

export const Route = createFileRoute("/restaurant/suppliers/new")({
  head: () => ({ meta: [{ title: "Nouveau fournisseur · Restaurant" }] }),
  component: NewSupplier,
});

function NewSupplier() {
  const myRestaurantId = useMyId("restaurant");
  const nav = useNavigate();
  const { user } = useRouteContext({ from: "/restaurant" });
  const myRestaurant = restaurants.find((r) => r.id === myRestaurantId);
  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Nouveau fournisseur"
        subtitle="Ajoutez un producteur à votre carnet"
        actions={
          <Button asChild variant="outline" className="gap-2">
            <Link to="/restaurant/suppliers">
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Link>
          </Button>
        }
      />
      <SupplierForm
        submitLabel="Créer le fournisseur"
        onSubmit={async (v) => {
          if (!myRestaurant) return;
          const res = await market.createSupplier({ ...v, restaurantId: myRestaurant.id });
          if (!res.ok) {
            toast.error(res.message);
            return;
          }
          toast.success(`Fournisseur « ${v.name} » créé`);
          nav({ to: "/restaurant/suppliers/$supplierId", params: { supplierId: res.id } });
        }}
        onCancel={() => nav({ to: "/restaurant/suppliers" })}
      />
    </div>
  );
}
