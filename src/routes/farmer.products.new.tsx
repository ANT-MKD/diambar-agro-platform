import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { ProductForm } from "@/components/farmer/product-form";
import { market } from "@/data/market-remote";

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
        onSubmit={async (d, publish) => {
          const res = await market.saveProductWithPhotos(null, d);
          if (!res.ok) {
            toast.error(res.message);
            return;
          }
          toast.success(publish ? "Produit publié" : "Brouillon enregistré");
          navigate({ to: "/farmer/products" });
        }}
        submitLabel="Publier"
      />
    </div>
  );
}
