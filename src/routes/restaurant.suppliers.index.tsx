import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import {
  Star,
  MapPin,
  Heart,
  Plus,
  Search,
  Pencil,
  Ban,
  PlayCircle,
  ShieldCheck,
  Truck,
  Trophy,
  UserPlus,
  GitCompare,
  X,
  ShoppingBag,
  ClipboardList,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { farmers, products, restaurants } from "@/data/mocks";
import {
  useSuppliers,
  useRestaurantOrders,
  useAllProductReviews,
  supplierActions,
  supplierOrderStats,
} from "@/data/store";
import { farmerReviewStats, farmerDeliveryEstimate } from "@/lib/farmer-stats";
import { useReviews as useBusinessReviews } from "@/data/business";
import { formatFCFA } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function qualityScore(
  totalOrders: number,
  favorite: boolean,
  suspended: boolean,
): { score: number; label: string; tone: string } {
  if (suspended) return { score: 0, label: "Suspendu", tone: "bg-rose-500/10 text-rose-500" };
  const base = Math.min(100, 55 + totalOrders * 2 + (favorite ? 15 : 0));
  const label =
    base >= 90 ? "Excellent" : base >= 75 ? "Fiable" : base >= 60 ? "Correct" : "À surveiller";
  const tone =
    base >= 90
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : base >= 75
        ? "bg-blue-500/10 text-blue-500"
        : base >= 60
          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : "bg-rose-500/10 text-rose-500";
  return { score: base, label, tone };
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const Route = createFileRoute("/restaurant/suppliers/")({
  head: () => ({ meta: [{ title: "Fournisseurs · Restaurant" }] }),
  component: SuppliersList,
});

type Tab = "all" | "favorites" | "discover" | "compare";

function SuppliersList() {
  const { user } = useRouteContext({ from: "/restaurant" });
  const myRestaurant = restaurants.find((r) => r.name === user.name);
  const allSuppliers = useSuppliers();
  const orders = useRestaurantOrders();
  const reviews = useAllProductReviews();
  const businessReviews = useBusinessReviews();
  const suppliers = useMemo(
    () => allSuppliers.filter((s) => s.restaurantId === myRestaurant?.id),
    [allSuppliers, myRestaurant],
  );
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [cityFilter, setCityFilter] = useState("Toutes");
  const [categoryFilter, setCategoryFilter] = useState("Toutes");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [showSuspended, setShowSuspended] = useState(true);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const toggleCompare = (farmerId: string) => {
    setCompareIds((prev) => {
      if (prev.includes(farmerId)) return prev.filter((id) => id !== farmerId);
      if (prev.length >= 3) {
        toast.error("Vous pouvez comparer 3 producteurs maximum");
        return prev;
      }
      return [...prev, farmerId];
    });
  };

  const cities = useMemo(() => Array.from(new Set(farmers.map((f) => f.city))), []);
  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category))), []);

  const carnetFarmerIds = new Set(suppliers.map((s) => s.farmerId).filter(Boolean));

  // KPI réels
  const activeCount = suppliers.filter((s) => !s.suspended).length;
  const favoriteCount = suppliers.filter((s) => s.favorite).length;
  const inProgressCount = orders.filter((o) =>
    ["pending", "confirmed", "preparing", "delivering"].includes(o.status),
  ).length;
  const carnetRatings = suppliers
    .filter((s) => s.farmerId)
    .map(
      (s) =>
        farmerReviewStats(
          s.farmerId!,
          products,
          reviews,
          farmers.find((f) => f.id === s.farmerId)?.rating ?? 0,
          businessReviews,
        ).avgRating,
    );
  const avgRating =
    carnetRatings.length > 0 ? carnetRatings.reduce((a, b) => a + b, 0) / carnetRatings.length : 0;
  const totalReviews = suppliers
    .filter((s) => s.farmerId)
    .reduce(
      (s, sup) =>
        s + farmerReviewStats(sup.farmerId!, products, reviews, 0, businessReviews).reviewCount,
      0,
    );

  const filteredSuppliers = useMemo(() => {
    return suppliers
      .filter((s) => (tab === "favorites" ? s.favorite : true))
      .filter((s) => showSuspended || !s.suspended)
      .filter((s) => `${s.name} ${s.contact} ${s.city}`.toLowerCase().includes(q.toLowerCase()))
      .filter((s) => cityFilter === "Toutes" || s.city === cityFilter)
      .filter((s) => {
        if (!verifiedOnly) return true;
        const f = s.farmerId ? farmers.find((x) => x.id === s.farmerId) : null;
        return !!f?.verified;
      })
      .filter((s) => {
        if (categoryFilter === "Toutes") return true;
        const f = s.farmerId ? farmers.find((x) => x.id === s.farmerId) : null;
        return f && products.some((p) => p.farmerId === f.id && p.category === categoryFilter);
      })
      .filter((s) => {
        if (!inStockOnly) return true;
        const f = s.farmerId ? farmers.find((x) => x.id === s.farmerId) : null;
        return f && products.some((p) => p.farmerId === f.id && p.status !== "out");
      });
  }, [suppliers, tab, showSuspended, q, cityFilter, verifiedOnly, categoryFilter, inStockOnly]);

  const discoverable = farmers.filter((f) => !carnetFarmerIds.has(f.id));

  const topFarmers = useMemo(() => {
    return suppliers
      .filter((s) => s.farmerId && !s.suspended)
      .map((s) => {
        const stats = supplierOrderStats(orders, s.farmerId);
        const { avgRating: rating } = farmerReviewStats(
          s.farmerId!,
          products,
          reviews,
          farmers.find((f) => f.id === s.farmerId)?.rating ?? 0,
          businessReviews,
        );
        return { supplier: s, rating, totalOrders: stats.totalOrders };
      })
      .sort((a, b) => b.rating - a.rating || b.totalOrders - a.totalOrders)
      .slice(0, 3);
  }, [suppliers, orders, reviews, businessReviews]);

  const addToCarnet = (farmerId: string) => {
    if (!myRestaurant) return;
    const f = farmers.find((x) => x.id === farmerId);
    if (!f) return;
    supplierActions.create({
      restaurantId: myRestaurant.id,
      farmerId: f.id,
      name: f.farm,
      contact: f.name,
      phone: f.phone,
      email: `contact@${slugify(f.farm)}.sn`,
      city: f.city,
      favorite: false,
    });
    toast.success(`${f.farm} ajouté à votre carnet`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fournisseurs"
        subtitle="Découvrez et gérez vos fournisseurs locaux. Comparez leurs offres et développez vos approvisionnements."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setTab("discover")}>
              <UserPlus className="h-4 w-4" />
              Découvrir des fournisseurs
            </Button>
            <Button asChild className="gap-2">
              <Link to="/restaurant/suppliers/new">
                <Plus className="h-4 w-4" />
                Nouveau fournisseur
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
            <ShieldCheck className="h-3.5 w-3.5" /> Fournisseurs actifs
          </div>
          <div className="text-xl font-bold font-display">{activeCount}</div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
            <Heart className="h-3.5 w-3.5" /> Mes favoris
          </div>
          <div className="text-xl font-bold font-display">{favoriteCount}</div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
            <ClipboardList className="h-3.5 w-3.5" /> Commandes en cours
          </div>
          <div className="text-xl font-bold font-display">{inProgressCount}</div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
            <Star className="h-3.5 w-3.5" /> Note moyenne
          </div>
          <div className="text-xl font-bold font-display">
            {avgRating > 0 ? avgRating.toFixed(1) : "—"} / 5
          </div>
          <div className="text-[10px] text-muted-foreground">
            {totalReviews > 0 ? `Basée sur ${totalReviews} avis` : "Aucun avis pour l'instant"}
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un fournisseur…"
            className="pl-9"
          />
        </div>
        <select
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
        >
          <option value="Toutes">Toutes les régions</option>
          {cities.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
        >
          <option value="Toutes">Toutes les catégories</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <label className="h-10 px-3 rounded-xl border border-border flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(e) => setVerifiedOnly(e.target.checked)}
          />
          Vérifiés
        </label>
        <label className="h-10 px-3 rounded-xl border border-border flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
          />
          En stock
        </label>
        <label className="h-10 px-3 rounded-xl border border-border flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showSuspended}
            onChange={(e) => setShowSuspended(e.target.checked)}
          />
          Afficher les suspendus
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            { key: "all", label: "Tous les fournisseurs", count: suppliers.length },
            { key: "favorites", label: "Mes favoris", count: favoriteCount },
            { key: "discover", label: "Découvrir", count: discoverable.length },
            { key: "compare", label: "Comparer", count: compareIds.length },
          ] as { key: Tab; label: string; count: number }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
              tab === t.key
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-accent text-muted-foreground"
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-6">
        <div>
          {tab !== "discover" && tab !== "compare" && (
            <div className="grid md:grid-cols-2 gap-4">
              {filteredSuppliers.length === 0 && (
                <div className="col-span-full glass rounded-2xl p-12 text-center text-sm text-muted-foreground">
                  Aucun fournisseur trouvé.
                </div>
              )}
              {filteredSuppliers.map((s) => {
                const f = s.farmerId ? farmers.find((x) => x.id === s.farmerId) : null;
                const offer = f ? products.filter((p) => p.farmerId === f.id) : [];
                const stats = supplierOrderStats(orders, s.farmerId);
                const { avgRating: rating, reviewCount } = f
                  ? farmerReviewStats(f.id, products, reviews, f.rating, businessReviews)
                  : { avgRating: 0, reviewCount: 0 };
                const delivery = f
                  ? farmerDeliveryEstimate(f.id, f.city, myRestaurant?.city ?? "", orders)
                  : null;
                return (
                  <div
                    key={s.id}
                    className={`glass rounded-2xl p-5 space-y-3 relative ${s.suspended ? "opacity-60" : ""}`}
                  >
                    <div className="absolute top-3 right-3 flex items-center gap-1.5">
                      {f && (
                        <button
                          onClick={() => toggleCompare(f.id)}
                          aria-label="Comparer"
                          className={`h-7 w-7 rounded-full grid place-items-center border ${compareIds.includes(f.id) ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background/80 hover:bg-accent"}`}
                        >
                          <GitCompare className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {s.suspended && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                          SUSPENDU
                        </span>
                      )}
                    </div>
                    <div className="flex items-start gap-3">
                      <img
                        src={
                          f?.avatar ??
                          "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200"
                        }
                        alt=""
                        className="h-14 w-14 rounded-xl object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-semibold truncate">{s.name}</h3>
                          {s.favorite && (
                            <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500 shrink-0" />
                          )}
                          {f?.verified && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500">
                              <ShieldCheck className="h-3 w-3" /> Vérifié
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {s.city}
                        </div>
                        {f && (
                          <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                            <span className="flex items-center gap-0.5">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                              {rating.toFixed(1)} {reviewCount > 0 ? `(${reviewCount} avis)` : ""}
                            </span>
                            {delivery && (
                              <span className="flex items-center gap-0.5">
                                <Truck className="h-3 w-3" /> {delivery}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-lg font-bold">{stats.totalOrders}</div>
                        <div className="text-[10px] text-muted-foreground">Commandes</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-primary">
                          {formatFCFA(stats.totalSpent).replace(" FCFA", "")}
                        </div>
                        <div className="text-[10px] text-muted-foreground">Dépensé</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold">
                          {stats.lastOrder === "—" ? "—" : stats.lastOrder.slice(5)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">Dernière</div>
                      </div>
                    </div>
                    {(() => {
                      const qs = qualityScore(stats.totalOrders, s.favorite, s.suspended);
                      return (
                        <div
                          className={`rounded-lg px-3 py-2 flex items-center justify-between text-xs font-semibold ${qs.tone}`}
                        >
                          <span>Score qualité · {qs.label}</span>
                          <span className="font-bold">{qs.score}/100</span>
                        </div>
                      );
                    })()}
                    {offer.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {offer.slice(0, 4).map((p) => (
                          <span
                            key={p.id}
                            className="text-[10px] rounded-full bg-muted px-2 py-0.5"
                          >
                            {p.name}
                          </span>
                        ))}
                        {offer.length > 4 && (
                          <span className="text-[10px] rounded-full bg-muted px-2 py-0.5">
                            +{offer.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button asChild variant="outline" size="sm" className="flex-1">
                        <Link to="/restaurant/suppliers/$supplierId" params={{ supplierId: s.id }}>
                          Voir le profil
                        </Link>
                      </Button>
                      {f && (
                        <Button asChild variant="outline" size="sm" className="flex-1">
                          <Link to="/restaurant/marketplace" search={{ supplier: f.id }}>
                            Voir les produits
                          </Link>
                        </Button>
                      )}
                      <Button asChild variant="outline" size="sm">
                        <Link
                          to="/restaurant/suppliers/$supplierId/edit"
                          params={{ supplierId: s.id }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          supplierActions.toggleSuspend(s.id);
                          toast.success(
                            s.suspended ? "Fournisseur réactivé" : "Fournisseur suspendu",
                          );
                        }}
                      >
                        {s.suspended ? (
                          <PlayCircle className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <Ban className="h-3.5 w-3.5 text-destructive" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === "discover" && (
            <div className="space-y-4">
              {discoverable.length === 0 ? (
                <div className="glass rounded-2xl p-12 text-center text-sm text-muted-foreground">
                  Vous suivez déjà tous les producteurs disponibles sur la plateforme.
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {discoverable.map((f) => {
                    const offer = products.filter((p) => p.farmerId === f.id);
                    const { avgRating: rating, reviewCount } = farmerReviewStats(
                      f.id,
                      products,
                      reviews,
                      f.rating,
                      businessReviews,
                    );
                    const delivery = farmerDeliveryEstimate(
                      f.id,
                      f.city,
                      myRestaurant?.city ?? "",
                      orders,
                    );
                    return (
                      <div key={f.id} className="glass rounded-2xl p-5 space-y-3 relative">
                        <button
                          onClick={() => toggleCompare(f.id)}
                          aria-label="Comparer"
                          className={`absolute top-3 right-3 h-7 w-7 rounded-full grid place-items-center border ${compareIds.includes(f.id) ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background/80 hover:bg-accent"}`}
                        >
                          <GitCompare className="h-3.5 w-3.5" />
                        </button>
                        <div className="flex items-start gap-3">
                          <img
                            src={f.avatar}
                            alt=""
                            className="h-14 w-14 rounded-xl object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-semibold truncate">{f.farm}</h3>
                              {f.verified && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500">
                                  <ShieldCheck className="h-3 w-3" /> Vérifié
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {f.city}, Sénégal
                            </div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                              <span className="flex items-center gap-0.5">
                                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                {rating.toFixed(1)} {reviewCount > 0 ? `(${reviewCount} avis)` : ""}
                              </span>
                              <span className="flex items-center gap-0.5">
                                <Truck className="h-3 w-3" /> {delivery}
                              </span>
                            </div>
                          </div>
                        </div>
                        {offer.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {offer.slice(0, 4).map((p) => (
                              <span
                                key={p.id}
                                className="text-[10px] rounded-full bg-muted px-2 py-0.5"
                              >
                                {p.name}
                              </span>
                            ))}
                            {offer.length > 4 && (
                              <span className="text-[10px] rounded-full bg-muted px-2 py-0.5">
                                +{offer.length - 4}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="flex gap-2 pt-1">
                          <Button asChild variant="outline" size="sm" className="flex-1">
                            <Link to="/restaurant/marketplace" search={{ supplier: f.id }}>
                              Voir les produits
                            </Link>
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 gap-1.5"
                            onClick={() => addToCarnet(f.id)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Ajouter à mon carnet
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === "compare" && (
            <div className="space-y-4">
              {compareIds.length === 0 ? (
                <div className="glass rounded-2xl p-12 text-center text-sm text-muted-foreground space-y-3">
                  <p>
                    Cliquez sur l'icône <GitCompare className="h-3.5 w-3.5 inline" /> d'un
                    fournisseur pour l'ajouter à la comparaison.
                  </p>
                  <Button variant="outline" onClick={() => setTab("all")}>
                    Parcourir les fournisseurs
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {compareIds.map((id) => {
                      const f = farmers.find((x) => x.id === id)!;
                      return (
                        <div key={id} className="glass rounded-2xl p-3 flex items-center gap-3">
                          <img
                            src={f.avatar}
                            alt=""
                            className="h-10 w-10 rounded-lg object-cover"
                          />
                          <span className="flex-1 text-sm font-medium truncate">{f.farm}</span>
                          <button
                            onClick={() => toggleCompare(id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <Button asChild className="gap-2">
                    <Link to="/restaurant/suppliers/compare" search={{ ids: compareIds.join(",") }}>
                      <GitCompare className="h-4 w-4" />
                      Voir la comparaison complète
                    </Link>
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center gap-1.5 font-display font-bold text-sm mb-3">
              <Trophy className="h-4 w-4 text-amber-500" />
              Top fournisseurs
            </div>
            {topFarmers.length === 0 && (
              <p className="text-xs text-muted-foreground">Pas encore assez de données.</p>
            )}
            <div className="space-y-3">
              {topFarmers.map(({ supplier: s, rating, totalOrders }, i) => {
                const f = farmers.find((x) => x.id === s.farmerId);
                return (
                  <Link
                    key={s.id}
                    to="/restaurant/suppliers/$supplierId"
                    params={{ supplierId: s.id }}
                    className="flex items-center gap-2 hover:bg-accent/40 rounded-lg p-1.5 -m-1.5"
                  >
                    <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                    <img src={f?.avatar} alt="" className="h-8 w-8 rounded-lg object-cover" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{s.name}</div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                        {rating.toFixed(1)} · {totalOrders} cmd
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="glass rounded-2xl p-4 space-y-2">
            <div className="font-display font-bold text-sm">Vous cherchez un produit précis ?</div>
            <p className="text-xs text-muted-foreground">
              Parcourez la marketplace pour trouver le bon fournisseur.
            </p>
            <Button asChild variant="outline" className="w-full gap-2">
              <Link to="/restaurant/marketplace">
                <ShoppingBag className="h-4 w-4" />
                Explorer la marketplace
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
