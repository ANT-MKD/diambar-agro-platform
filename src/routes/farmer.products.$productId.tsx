import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Pencil,
  ArrowLeft,
  ShoppingBag,
  TrendingUp,
  Warehouse,
  History,
  Plus,
  Minus,
} from "lucide-react";
import { PageHeader } from "@/components/farmer/page-header";
import { StockStatusBadge } from "@/components/farmer/status-badge";
import { KpiCard } from "@/components/farmer/kpi-card";
import { useProduct, useMovements, useOrders } from "@/data/store";
import { restaurants } from "@/data/mocks";
import { formatFCFA, relativeTime } from "@/lib/format";
import { CATEGORY_COLOR } from "@/lib/category-colors";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/farmer/products/$productId")({
  head: () => ({ meta: [{ title: "Produit · Diambar Agro" }] }),
  component: ProductDetailPage,
});

function ProductDetailPage() {
  const { productId } = useParams({ from: "/farmer/products/$productId" });
  const product = useProduct(productId);
  const movements = useMovements();
  const orders = useOrders();

  const recentMovements = useMemo(() => {
    if (!product) return [];
    return movements.filter((m) => m.productId === product.id).slice(0, 4);
  }, [movements, product]);

  const recentOrders = useMemo(() => {
    if (!product) return [];
    return orders
      .filter((o) => o.items.some((it) => it.productId === product.id))
      .slice(0, 4)
      .map((o) => ({
        order: o,
        item: o.items.find((it) => it.productId === product.id)!,
        restaurant: restaurants.find((r) => r.id === o.restaurantId),
      }));
  }, [orders, product]);

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
            <span className="inline-flex items-center gap-1.5 text-sm rounded-full border border-border px-2.5 py-1">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: CATEGORY_COLOR[product.category] ?? "#94a3b8" }}
              />
              {product.category}
            </span>
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>
                  Stock · {product.stock} {product.unit}
                </span>
                <span>min {product.minStock}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full ${product.stock === 0 ? "bg-rose-500" : product.stock < product.minStock ? "bg-amber-500" : "bg-emerald-500"}`}
                  style={{
                    width: `${Math.min(100, Math.round((product.stock / Math.max(1, product.minStock * 2)) * 100))}%`,
                  }}
                />
              </div>
            </div>
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

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Derniers mouvements de stock</h3>
            <Link
              to="/farmer/stock/$productId/history"
              params={{ productId }}
              className="text-xs text-primary font-medium"
            >
              Voir tout
            </Link>
          </div>
          {recentMovements.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucun mouvement</p>
          ) : (
            <div className="space-y-3">
              {recentMovements.map((m) => (
                <div key={m.id} className="flex items-start gap-3">
                  <div
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                      m.type === "in"
                        ? "bg-emerald-500/10 text-emerald-500"
                        : m.type === "out"
                          ? "bg-rose-500/10 text-rose-500"
                          : "bg-blue-500/10 text-blue-500"
                    }`}
                  >
                    {m.type === "in" ? (
                      <Plus className="h-4 w-4" />
                    ) : m.type === "out" ? (
                      <Minus className="h-4 w-4" />
                    ) : (
                      <History className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {m.type === "out" ? "-" : "+"}
                      {m.qty} {product.unit} · {m.reason}
                    </div>
                    <div className="text-xs text-muted-foreground">{m.operator}</div>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                    {relativeTime(m.at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass rounded-2xl p-5">
          <h3 className="font-semibold mb-4">Commandes récentes</h3>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Aucune commande pour ce produit
            </p>
          ) : (
            <div className="space-y-3">
              {recentOrders.map(({ order, item, restaurant }) => (
                <Link
                  key={order.id}
                  to="/farmer/orders/$orderId"
                  params={{ orderId: order.id }}
                  className="flex items-center gap-3 rounded-xl border border-border p-3 hover:border-primary/40 transition"
                >
                  <img
                    src={restaurant?.avatar}
                    alt=""
                    className="h-9 w-9 rounded-lg object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{restaurant?.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {order.reference} · ×{item.qty} {product.unit}
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-primary shrink-0">
                    {formatFCFA(item.qty * item.price)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
