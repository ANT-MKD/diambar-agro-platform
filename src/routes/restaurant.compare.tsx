import { createFileRoute, Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { GitCompare, X, ShoppingCart, Check, Minus } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { Button } from "@/components/ui/button";
import { farmers, restaurants } from "@/data/mocks";
import { useProducts, cartActions, useSuppliers } from "@/data/store";
import { formatFCFA } from "@/lib/format";

export const Route = createFileRoute("/restaurant/compare")({
  validateSearch: z.object({ ids: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Comparateur de produits · Restaurant · Diambar Agro" },
      {
        name: "description",
        content:
          "Comparez jusqu'à 3 produits agricoles côte à côte : prix, stock, producteur et disponibilité.",
      },
      { property: "og:title", content: "Comparateur de produits · Diambar Agro" },
      {
        property: "og:description",
        content: "Comparez prix, stock et producteurs avant de commander.",
      },
    ],
  }),
  component: ComparePage,
});

function ComparePage() {
  const { ids } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useRouteContext({ from: "/restaurant" });
  const myRestaurant = restaurants.find((r) => r.name === user.name);
  const suppliers = useSuppliers();
  const suspendedFarmerIds = new Set(
    suppliers
      .filter((s) => s.restaurantId === myRestaurant?.id && s.suspended)
      .map((s) => s.farmerId),
  );
  const products = useProducts();
  const selected: string[] = String(ids ?? "")
    .split(",")
    .filter(Boolean)
    .slice(0, 3);
  const rows = products.filter((p) => selected.includes(p.id));

  const remove = (id: string) => {
    const next = selected.filter((x: string) => x !== id);
    navigate({ to: "/restaurant/compare", search: { ids: next.join(",") || undefined } });
  };

  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Comparateur" subtitle="Comparez jusqu'à 3 produits côte à côte" />
        <EmptyState
          icon={GitCompare}
          title="Aucun produit à comparer"
          description="Ajoutez des produits depuis la marketplace pour les comparer côte à côte."
          action={
            <Link to="/restaurant/marketplace">
              <Button>Parcourir la marketplace</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const cheapest = Math.min(...rows.map((p) => p.pricePerKg));
  const bestStock = Math.max(...rows.map((p) => p.stock));

  return (
    <div className="space-y-6">
      <PageHeader title="Comparateur" subtitle={`${rows.length} produit(s) comparé(s)`} />

      <div className="glass rounded-2xl overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-4 font-medium text-muted-foreground w-40">Critère</th>
              {rows.map((p) => (
                <th key={p.id} className="p-4 text-left align-top">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <img
                        src={p.image}
                        alt={p.name}
                        className="h-20 w-20 rounded-xl object-cover"
                      />
                      <button
                        onClick={() => remove(p.id)}
                        className="grid h-7 w-7 place-items-center rounded-lg hover:bg-accent text-muted-foreground"
                        aria-label={`Retirer ${p.name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <Link
                      to="/restaurant/marketplace/$productId"
                      params={{ productId: p.id }}
                      className="font-semibold hover:text-primary block"
                    >
                      {p.name}
                    </Link>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Row
              label="Prix / kg"
              cells={rows.map((p) => (
                <span className={p.pricePerKg === cheapest ? "font-bold text-primary" : ""}>
                  {formatFCFA(p.pricePerKg)}
                  {p.pricePerKg === cheapest ? " · meilleur prix" : ""}
                </span>
              ))}
            />
            <Row
              label="Catégorie"
              cells={rows.map((p) => (
                <span>{p.category}</span>
              ))}
            />
            <Row
              label="Producteur"
              cells={rows.map((p) => (
                <span>{farmers.find((f) => f.id === p.farmerId)?.farm ?? "—"}</span>
              ))}
            />
            <Row
              label="Stock disponible"
              cells={rows.map((p) => (
                <span className={p.stock === bestStock ? "font-bold text-primary" : ""}>
                  {p.stock} {p.unit}
                </span>
              ))}
            />
            <Row
              label="Disponibilité"
              cells={rows.map((p) =>
                p.stock > 0 ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <Check className="h-4 w-4" /> En stock
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Minus className="h-4 w-4" /> Rupture
                  </span>
                ),
              )}
            />
            <Row
              label="SKU"
              cells={rows.map((p) => (
                <span className="font-mono text-xs">{p.sku}</span>
              ))}
            />
            <Row
              label="Commandes / mois"
              cells={rows.map((p) => (
                <span>{p.ordersThisMonth}</span>
              ))}
            />
            <tr>
              <td className="p-4 font-medium text-muted-foreground">Action</td>
              {rows.map((p) => (
                <td key={p.id} className="p-4">
                  <Button
                    size="sm"
                    disabled={p.stock === 0 || suspendedFarmerIds.has(p.farmerId)}
                    onClick={() => {
                      cartActions.add(p.id, 1);
                      toast.success(`${p.name} ajouté au panier`);
                    }}
                  >
                    <ShoppingCart className="h-4 w-4 mr-1.5" /> Ajouter
                  </Button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <Link to="/restaurant/marketplace">
        <Button variant="outline">Ajouter un autre produit</Button>
      </Link>
    </div>
  );
}

function Row({ label, cells }: { label: string; cells: ReactNode[] }) {
  return (
    <tr className="border-b border-border/60">
      <td className="p-4 font-medium text-muted-foreground">{label}</td>
      {cells.map((c, i) => (
        <td key={i} className="p-4">
          {c}
        </td>
      ))}
    </tr>
  );
}
