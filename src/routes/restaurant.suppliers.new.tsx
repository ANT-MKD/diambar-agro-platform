import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/farmer/page-header";
import { SupplierForm } from "@/components/restaurant/supplier-form";
import { supplierActions } from "@/data/store";

export const Route = createFileRoute("/restaurant/suppliers/new")({
  head: () => ({ meta: [{ title: "Nouveau fournisseur · Restaurant" }] }),
  component: NewSupplier,
});

function NewSupplier() {
  const nav = useNavigate();
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
        onSubmit={(v) => {
          const id = supplierActions.create(v);
          toast.success(`Fournisseur « ${v.name} » créé`);
          nav({ to: "/restaurant/suppliers/$supplierId", params: { supplierId: id } });
        }}
        onCancel={() => nav({ to: "/restaurant/suppliers" })}
      />
    </div>
  );
}
