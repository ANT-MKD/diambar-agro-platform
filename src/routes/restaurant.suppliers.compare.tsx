import { createFileRoute, Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { GitCompare, X, ShieldCheck, Check, Minus } from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/components/farmer/page-header";
import { EmptyState } from "@/components/farmer/empty-state";
import { Button } from "@/components/ui/button";
import { farmers, restaurants } from "@/data/mocks";
import { useProducts, useAllProductReviews, useRestaurantOrders, useSuppliers } from "@/data/store";
import { farmerReviewStats, farmerDeliveryEstimate } from "@/lib/farmer-stats";

export const Route = createFileRoute("/restaurant/suppliers/compare")({
  validateSearch: z.object({ ids: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Comparateur de fournisseurs · Restaurant · Diambar Agro" },
      {
        name: "description",
        content:
          "Comparez jusqu'à 3 producteurs côte à côte : note, catalogue et délai de livraison.",
      },
    ],
  }),
  component: SuppliersComparePage,
});

function SuppliersComparePage() {
  const { ids } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useRouteContext({ from: "/restaurant" });
  const myRestaurant = restaurants.find((r) => r.name === user.name);
  const products = useProducts();
  const reviews = useAllProductReviews();
  const orders = useRestaurantOrders();
  const suppliers = useSuppliers();

  const selected: string[] = String(ids ?? "")
    .split(",")
    .filter(Boolean)
    .slice(0, 3);
  const rows = farmers.filter((f) => selected.includes(f.id));

  const remove = (id: string) => {
    const next = selected.filter((x) => x !== id);
    navigate({ to: "/restaurant/suppliers/compare", search: { ids: next.join(",") || undefined } });
  };

  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Comparateur de fournisseurs"
          subtitle="Comparez jusqu'à 3 producteurs côte à côte"
        />
        <EmptyState
          icon={GitCompare}
          title="Aucun fournisseur à comparer"
          description="Sélectionnez des fournisseurs depuis la page Fournisseurs pour les comparer côte à côte."
          action={
            <Link to="/restaurant/suppliers">
              <Button>Voir mes fournisseurs</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const stats = rows.map((f) => {
    const offer = products.filter((p) => p.farmerId === f.id);
    const { avgRating, reviewCount } = farmerReviewStats(f.id, products, reviews, f.rating);
    const delivery = farmerDeliveryEstimate(f.id, f.city, myRestaurant?.city ?? "", orders);
    const inCarnet = suppliers.some(
      (s) => s.restaurantId === myRestaurant?.id && s.farmerId === f.id,
    );
    return { farmer: f, offer, avgRating, reviewCount, delivery, inCarnet };
  });

  const bestRating = Math.max(...stats.map((s) => s.avgRating));
  const mostProducts = Math.max(...stats.map((s) => s.offer.length));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comparateur de fournisseurs"
        subtitle={`${rows.length} fournisseur(s) comparé(s)`}
      />

      <div className="glass rounded-2xl overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-4 font-medium text-muted-foreground w-40">Critère</th>
              {stats.map(({ farmer: f }) => (
                <th key={f.id} className="p-4 text-left align-top">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <img
                        src={f.avatar}
                        alt={f.farm}
                        className="h-16 w-16 rounded-xl object-cover"
                      />
                      <button
                        onClick={() => remove(f.id)}
                        className="grid h-7 w-7 place-items-center rounded-lg hover:bg-accent text-muted-foreground"
                        aria-label={`Retirer ${f.farm}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="font-semibold">{f.farm}</div>
                    <div className="text-[11px] text-muted-foreground">{f.city}, Sénégal</div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Row
              label="Note"
              cells={stats.map((s) => (
                <span className={s.avgRating === bestRating ? "font-bold text-primary" : ""}>
                  ★ {s.avgRating.toFixed(1)} {s.avgRating === bestRating ? "· meilleure note" : ""}
                </span>
              ))}
            />
            <Row
              label="Avis"
              cells={stats.map((s) => (
                <span>{s.reviewCount > 0 ? `${s.reviewCount} avis` : "Aucun avis"}</span>
              ))}
            />
            <Row
              label="Vérifié"
              cells={stats.map((s) =>
                s.farmer.verified ? (
                  <span className="inline-flex items-center gap-1 text-blue-500">
                    <ShieldCheck className="h-4 w-4" /> Vérifié
                  </span>
                ) : (
                  <span className="text-muted-foreground">Non vérifié</span>
                ),
              )}
            />
            <Row
              label="Produits au catalogue"
              cells={stats.map((s) => (
                <span className={s.offer.length === mostProducts ? "font-bold text-primary" : ""}>
                  {s.offer.length}
                </span>
              ))}
            />
            <Row
              label="Délai de livraison estimé"
              cells={stats.map((s) => (
                <span>{s.delivery}</span>
              ))}
            />
            <Row
              label="Déjà dans mon carnet"
              cells={stats.map((s) =>
                s.inCarnet ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <Check className="h-4 w-4" /> Oui
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Minus className="h-4 w-4" /> Non
                  </span>
                ),
              )}
            />
            <tr>
              <td className="p-4 font-medium text-muted-foreground">Catalogue</td>
              {stats.map((s) => (
                <td key={s.farmer.id} className="p-4">
                  <div className="flex flex-wrap gap-1">
                    {s.offer.slice(0, 5).map((p) => (
                      <span key={p.id} className="text-[10px] rounded-full bg-muted px-2 py-0.5">
                        {p.name}
                      </span>
                    ))}
                  </div>
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-4 font-medium text-muted-foreground">Action</td>
              {stats.map((s) => (
                <td key={s.farmer.id} className="p-4">
                  <Button asChild size="sm">
                    <Link to="/restaurant/marketplace" search={{ supplier: s.farmer.id }}>
                      Voir les produits
                    </Link>
                  </Button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <Link to="/restaurant/suppliers">
        <Button variant="outline">Ajouter un autre fournisseur</Button>
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
