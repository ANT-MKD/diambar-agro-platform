import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Package,
  ShoppingBag,
  Users,
  FileText,
  LayoutDashboard,
  Plus,
  TrendingUp,
  Warehouse,
  MessageSquare,
  Settings,
  Bell,
  Store,
  Repeat,
} from "lucide-react";
import { useProducts, useOrders, useSuppliers, useRestaurantOrders } from "@/data/store";

type Scope = "farmer" | "restaurant" | "admin" | "all";

export function CommandPalette({ scope = "all" }: { scope?: Scope }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const products = useProducts();
  const orders = useOrders();
  const restoOrders = useRestaurantOrders();
  const suppliers = useSuppliers();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (to: string) => {
    setOpen(false);
    navigate({ to });
  };

  const showFarmer = scope === "farmer" || scope === "all";
  const showResto = scope === "restaurant" || scope === "all";
  const showAdmin = scope === "admin" || scope === "all";

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Rechercher une page, une action, une commande…" />
      <CommandList>
        <CommandEmpty>Aucun résultat.</CommandEmpty>

        {showFarmer && (
          <CommandGroup heading="Agriculteur — Navigation">
            <CommandItem onSelect={() => go("/farmer/dashboard")}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Tableau de bord
            </CommandItem>
            <CommandItem onSelect={() => go("/farmer/products")}>
              <Package className="mr-2 h-4 w-4" />
              Mes produits
            </CommandItem>
            <CommandItem onSelect={() => go("/farmer/stock")}>
              <Warehouse className="mr-2 h-4 w-4" />
              Gestion du stock
            </CommandItem>
            <CommandItem onSelect={() => go("/farmer/orders")}>
              <ShoppingBag className="mr-2 h-4 w-4" />
              Commandes
            </CommandItem>
            <CommandItem onSelect={() => go("/farmer/revenue")}>
              <TrendingUp className="mr-2 h-4 w-4" />
              Revenus
            </CommandItem>
            <CommandItem onSelect={() => go("/farmer/messages")}>
              <MessageSquare className="mr-2 h-4 w-4" />
              Messages
            </CommandItem>
            <CommandItem onSelect={() => go("/farmer/notifications")}>
              <Bell className="mr-2 h-4 w-4" />
              Notifications
            </CommandItem>
            <CommandItem onSelect={() => go("/farmer/settings")}>
              <Settings className="mr-2 h-4 w-4" />
              Paramètres
            </CommandItem>
          </CommandGroup>
        )}

        {showResto && (
          <CommandGroup heading="Restaurant — Navigation">
            <CommandItem onSelect={() => go("/restaurant/dashboard")}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Tableau de bord
            </CommandItem>
            <CommandItem onSelect={() => go("/restaurant/marketplace")}>
              <Store className="mr-2 h-4 w-4" />
              Marketplace
            </CommandItem>
            <CommandItem onSelect={() => go("/restaurant/orders")}>
              <ShoppingBag className="mr-2 h-4 w-4" />
              Mes commandes
            </CommandItem>
            <CommandItem onSelect={() => go("/restaurant/recurring")}>
              <Repeat className="mr-2 h-4 w-4" />
              Récurrentes
            </CommandItem>
            <CommandItem onSelect={() => go("/restaurant/suppliers")}>
              <Users className="mr-2 h-4 w-4" />
              Fournisseurs
            </CommandItem>
            <CommandItem onSelect={() => go("/restaurant/invoices")}>
              <FileText className="mr-2 h-4 w-4" />
              Factures
            </CommandItem>
          </CommandGroup>
        )}

        {showAdmin && (
          <CommandGroup heading="Administration">
            <CommandItem onSelect={() => go("/admin/dashboard")}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Vue d'ensemble
            </CommandItem>
            <CommandItem onSelect={() => go("/admin/users")}>
              <Users className="mr-2 h-4 w-4" />
              Utilisateurs
            </CommandItem>
            <CommandItem onSelect={() => go("/admin/validations")}>
              <Package className="mr-2 h-4 w-4" />
              Validations
            </CommandItem>
            <CommandItem onSelect={() => go("/admin/disputes")}>
              <FileText className="mr-2 h-4 w-4" />
              Litiges
            </CommandItem>
            <CommandItem onSelect={() => go("/admin/finance")}>
              <TrendingUp className="mr-2 h-4 w-4" />
              Finance
            </CommandItem>
            <CommandItem onSelect={() => go("/admin/settings")}>
              <Settings className="mr-2 h-4 w-4" />
              Paramètres plateforme
            </CommandItem>
          </CommandGroup>
        )}

        <CommandSeparator />

        <CommandGroup heading="Actions rapides">
          {showFarmer && (
            <CommandItem onSelect={() => go("/farmer/products/new")}>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau produit
            </CommandItem>
          )}
          {showFarmer && (
            <CommandItem onSelect={() => go("/farmer/stock/movement/new")}>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau mouvement stock
            </CommandItem>
          )}
          {showFarmer && (
            <CommandItem onSelect={() => go("/farmer/revenue/withdraw")}>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau retrait
            </CommandItem>
          )}
          {showResto && (
            <CommandItem onSelect={() => go("/restaurant/suppliers/new")}>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau fournisseur
            </CommandItem>
          )}
          {showResto && (
            <CommandItem onSelect={() => go("/restaurant/checkout")}>
              <Plus className="mr-2 h-4 w-4" />
              Passer commande
            </CommandItem>
          )}
        </CommandGroup>

        {showFarmer && products.length > 0 && (
          <CommandGroup heading="Produits">
            {products.slice(0, 8).map((p) => (
              <CommandItem
                key={p.id}
                value={`produit ${p.name} ${p.sku}`}
                onSelect={() => go(`/farmer/products/${p.id}`)}
              >
                <Package className="mr-2 h-4 w-4" />
                {p.name} <span className="ml-2 text-xs text-muted-foreground">{p.sku}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {showFarmer && orders.length > 0 && (
          <CommandGroup heading="Commandes (agriculteur)">
            {orders.slice(0, 6).map((o) => (
              <CommandItem
                key={o.id}
                value={`commande ${o.reference}`}
                onSelect={() => go(`/farmer/orders/${o.id}`)}
              >
                <ShoppingBag className="mr-2 h-4 w-4" />
                {o.reference} <span className="ml-2 text-xs text-muted-foreground">{o.status}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {showResto && restoOrders.length > 0 && (
          <CommandGroup heading="Commandes (restaurant)">
            {restoOrders.slice(0, 6).map((o) => (
              <CommandItem
                key={o.id}
                value={`commande ${o.reference}`}
                onSelect={() => go(`/restaurant/orders/${o.id}`)}
              >
                <ShoppingBag className="mr-2 h-4 w-4" />
                {o.reference}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {showResto && suppliers.length > 0 && (
          <CommandGroup heading="Fournisseurs">
            {suppliers.slice(0, 6).map((s) => (
              <CommandItem
                key={s.id}
                value={`fournisseur ${s.name}`}
                onSelect={() => go(`/restaurant/suppliers/${s.id}`)}
              >
                <Users className="mr-2 h-4 w-4" />
                {s.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
