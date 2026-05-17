import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { ProductForm } from "@/components/farmer/product-form";
import { productActions } from "@/data/store";

export const Route = createFileRoute("/farmer/products/new")({
  head: () => ({ meta: [{ title: "Nouveau produit · Diambar Agro" }] }),
  component: NewProductPage,
});

function NewProductPage() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <PageHeader title="Nouveau produit" subtitle="Ajoutez un produit à votre catalogue" />
      <ProductForm
        onSubmit={(d, publish) => {
          productActions.create({ ...d, ordersThisMonth: 0 });
          toast.success(publish ? "Produit publié" : "Brouillon enregistré");
          navigate({ to: "/farmer/products" });
        }}
        submitLabel="Publier"
      />
    </div>
  );
}