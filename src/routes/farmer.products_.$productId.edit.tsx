import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { ProductForm } from "@/components/farmer/product-form";
import { useProduct, productActions } from "@/data/store";

export const Route = createFileRoute("/farmer/products_/$productId/edit")({
  head: () => ({ meta: [{ title: "Modifier produit · Diambar Agro" }] }),
  component: EditProductPage,
});

function EditProductPage() {
  const { productId } = useParams({ from: "/farmer/products_/$productId/edit" });
  const navigate = useNavigate();
  const product = useProduct(productId);
  if (!product)
    return <p className="text-center text-muted-foreground py-12">Produit introuvable</p>;
  const { id: _id, ordersThisMonth: _o, ...rest } = product;
  return (
    <div className="space-y-6">
      <PageHeader title={`Modifier — ${product.name}`} />
      <ProductForm
        initial={{ ...rest, photos: product.photos?.length ? product.photos : [product.image] }}
        onSubmit={(d) => {
          productActions.update(productId, d);
          toast.success("Produit mis à jour");
          navigate({ to: "/farmer/products/$productId", params: { productId } });
        }}
        submitLabel="Enregistrer"
      />
    </div>
  );
}
