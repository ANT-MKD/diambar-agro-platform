import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useMemo } from "react";
import { ChevronRight, Home } from "lucide-react";

const LABELS: Record<string, string> = {
  farmer: "Espace",
  restaurant: "Espace",
  dashboard: "Tableau de bord",
  products: "Produits",
  stock: "Stock",
  orders: "Commandes",
  revenue: "Revenus",
  analytics: "Analytics",
  messages: "Messages",
  notifications: "Notifications",
  settings: "Paramètres",
  new: "Nouveau",
  edit: "Modifier",
  import: "Importer",
  inventory: "Inventaire",
  history: "Historique",
  movement: "Mouvement",
  refuse: "Refus",
  report: "Signalement",
  withdraw: "Retrait",
  withdrawals: "Historique retraits",
  profile: "Profil",
  farm: "Exploitation",
  payments: "Paiement",
  security: "Sécurité",
  subscription: "Abonnement",
  marketplace: "Marché",
  cart: "Panier",
  checkout: "Commande",
  recurring: "Récurrentes",
  favorites: "Favoris",
  farmers: "Agriculteurs",
  expenses: "Dépenses",
  review: "Avis",
  driver: "Espace",
  missions: "Missions",
  earnings: "Revenus",
  vehicle: "Véhicule",
  suppliers: "Fournisseurs",
  invoices: "Factures",
};

export function Breadcrumb() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  // Chemins réellement routables (« /farmer/stock/$productId/history » →
  // motif), pour ne pas faire de lien vers un segment intermédiaire qui
  // n'existe pas (ex. /farmer/stock/p1 → « Page introuvable »).
  const patterns = useMemo(
    () =>
      Object.keys(router.routesByPath).map(
        (p) => new RegExp(`^${p.replace(/\/$/, "").replace(/\$[^/]+/g, "[^/]+")}/?$`),
      ),
    [router],
  );
  const exists = (to: string) => patterns.some((re) => re.test(to));
  const parts = path.split("/").filter(Boolean);
  return (
    <nav className="hidden md:flex items-center text-xs text-muted-foreground gap-1.5">
      <Link to="/" className="hover:text-foreground">
        <Home className="h-3.5 w-3.5" />
      </Link>
      {parts.map((p, i) => {
        const to = "/" + parts.slice(0, i + 1).join("/");
        const isLast = i === parts.length - 1;
        const label =
          LABELS[p] ?? (p.startsWith("$") || /^[a-z0-9]{1,5}\d/.test(p) ? "#" + p.slice(0, 6) : p);
        return (
          <span key={to} className="flex items-center gap-1.5">
            <ChevronRight className="h-3 w-3 opacity-50" />
            {isLast || !exists(to) ? (
              <span className="text-foreground font-medium">{label}</span>
            ) : (
              <Link to={to} className="hover:text-foreground">
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
