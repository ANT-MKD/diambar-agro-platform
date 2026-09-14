import { createFileRoute, Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/farmer/page-header";
import { SupplierForm } from "@/components/restaurant/supplier-form";
import { useSupplier, supplierActions } from "@/data/store";
import { restaurants } from "@/data/mocks";

export const Route = createFileRoute("/restaurant/suppliers/$supplierId/edit")({
  head: () => ({ meta: [{ title: "Modifier fournisseur · Restaurant" }] }),
  component: EditSupplier,
});

function EditSupplier() {
  const nav = useNavigate();
  const { user } = useRouteContext({ from: "/restaurant" });
  const myRestaurant = restaurants.find((r) => r.name === user.name);
  const { supplierId } = Route.useParams();
  const s = useSupplier(supplierId);
  if (!s || s.restaurantId !== myRestaurant?.id)
    return (
      <div className="glass rounded-2xl p-12 text-center text-muted-foreground">
        Fournisseur introuvable
      </div>
    );

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title={`Modifier ${s.name}`}
        subtitle="Mettez à jour les informations du fournisseur"
        actions={
          <Button asChild variant="outline" className="gap-2">
            <Link to="/restaurant/suppliers/$supplierId" params={{ supplierId }}>
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Link>
          </Button>
        }
      />
      <SupplierForm
        initial={s}
        submitLabel="Enregistrer les modifications"
        onSubmit={(v) => {
          supplierActions.update(supplierId, v);
          toast.success("Fournisseur mis à jour");
          nav({ to: "/restaurant/suppliers/$supplierId", params: { supplierId } });
        }}
        onCancel={() => nav({ to: "/restaurant/suppliers/$supplierId", params: { supplierId } })}
      />
    </div>
  );
}
