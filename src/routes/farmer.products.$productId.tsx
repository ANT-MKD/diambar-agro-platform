import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { Pencil, ArrowLeft, ShoppingBag, TrendingUp, Warehouse } from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { StockStatusBadge } from "@/components/farmer/status-badge";
import { KpiCard } from "@/components/farmer/kpi-card";
import { useProduct } from "@/data/store";
import { formatFCFA } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/farmer/products/$productId")({
  head: () => ({ meta: [{ title: "Produit · Diambar Agro" }] }),
  component: ProductDetailPage,
});

function ProductDetailPage() {
  const { productId } = useParams({ from: "/farmer/products/$productId" });
  const product = useProduct(productId);

  if (!product)
    return (
      <div className="glass rounded-2xl p-12 text-center">
        <p className="text-muted-foreground">Produit introuvable</p>
        <Button asChild variant="outline" className="mt-4 gap-2">
          <Link to="/farmer/products">
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Link>
        </Button>
      </div>
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title={product.name}
        subtitle={`${product.category} · ${product.sku}`}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" className="gap-2">
              <Link to="/farmer/products">
                <ArrowLeft className="h-4 w-4" />
                Retour
              </Link>
            </Button>
            <Button asChild className="gap-2">
              <Link to="/farmer/products/$productId/edit" params={{ productId }}>
                <Pencil className="h-4 w-4" />
                Modifier
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass rounded-2xl overflow-hidden">
          <div className="aspect-[16/9] bg-muted">
            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <span className="font-display text-3xl font-bold text-primary">
                  {formatFCFA(product.pricePerKg)}
                </span>
                <span className="text-muted-foreground">/ {product.unit}</span>
              </div>
              <StockStatusBadge status={product.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              Produit issu de la ferme de Mamadou Diallo à Thiès. Cultivé sans pesticides chimiques
              et récolté à maturité.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <KpiCard
            icon={Warehouse}
            label="Stock actuel"
            value={`${product.stock} ${product.unit}`}
            tone="blue"
          />
          <KpiCard
            icon={ShoppingBag}
            label="Commandes ce mois"
            value={String(product.ordersThisMonth)}
            tone="emerald"
          />
          <KpiCard
            icon={TrendingUp}
            label="Valeur du stock"
            value={formatFCFA(product.stock * product.pricePerKg)}
            tone="amber"
          />
          <Button asChild variant="outline" className="w-full">
            <Link to="/farmer/stock/$productId/history" params={{ productId }}>
              Voir historique stock
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
