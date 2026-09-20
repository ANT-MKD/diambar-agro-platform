import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Store,
  ShoppingCart,
  ShoppingBag,
  Repeat,
  Users,
  MessageSquare,
  Bell,
  Settings,
  Menu,
  X,
  UtensilsCrossed,
  Search,
  FileText,
  Scale,
  PiggyBank,
  RotateCcw,
  Star,
  LifeBuoy,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/common/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Breadcrumb } from "@/components/farmer/breadcrumb";
import {
  useCart,
  useRestaurantNotifications,
  recurringOrderActions,
  useRestaurantOrders,
  useConversations,
} from "@/data/store";
import { restaurants } from "@/data/mocks";
import { CommandPalette } from "@/components/common/command-palette";
import { LogoutButton } from "@/components/common/logout-button";
import { requireRole } from "@/lib/auth/functions";

export const Route = createFileRoute("/restaurant")({
  beforeLoad: () => requireRole("restaurant"),
  component: RestaurantLayout,
});

const bottomNav = [
  { to: "/restaurant/dashboard", label: "Accueil", icon: LayoutDashboard },
  { to: "/restaurant/marketplace", label: "Marché", icon: Store },
  { to: "/restaurant/cart", label: "Panier", icon: ShoppingCart, cart: true },
  { to: "/restaurant/orders", label: "Commandes", icon: ShoppingBag },
  { to: "/restaurant/settings", label: "Plus", icon: Settings },
];

function RestaurantLayout() {
  const { user } = Route.useRouteContext();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const cart = useCart();
  const cartCount = cart.reduce((s, l) => s + l.qty, 0);
  const [open, setOpen] = useState(false);
  const notifs = useRestaurantNotifications();
  const unread = notifs.filter((n) => !n.read).length;
  const myRestaurant = restaurants.find((r) => r.name === user.name);
  const pendingOrders = useRestaurantOrders().filter((o) => o.status === "pending").length;
  const unreadMessages = useConversations()
    .filter((c) => c.restaurantId === myRestaurant?.id)
    .reduce((s, c) => s + c.unread, 0);
  // Il n'existe pas de vrai scheduler côté serveur dans cette démo : on
  // vérifie donc les commandes récurrentes en retard à chaque ouverture du
  // portail restaurant, et on les traite réellement à ce moment-là plutôt
  // que d'attendre une exécution qui ne se déclencherait jamais seule.
  useEffect(() => {
    recurringOrderActions.tick();
  }, []);

  const navSections = [
    {
      label: "NAVIGATION",
      items: [
        { to: "/restaurant/dashboard", label: "Tableau de bord", icon: LayoutDashboard, badge: 0 },
        { to: "/restaurant/marketplace", label: "Marketplace", icon: Store, badge: 0 },
        { to: "/restaurant/cart", label: "Panier", icon: ShoppingCart, cart: true, badge: 0 },
        {
          to: "/restaurant/orders",
          label: "Mes Commandes",
          icon: ShoppingBag,
          badge: pendingOrders,
        },
        { to: "/restaurant/recurring", label: "Commandes récurrentes", icon: Repeat, badge: 0 },
        { to: "/restaurant/suppliers", label: "Fournisseurs", icon: Users, badge: 0 },
        { to: "/restaurant/invoices", label: "Factures", icon: FileText, badge: 0 },
        { to: "/restaurant/budget", label: "Budget d'achat", icon: PiggyBank, badge: 0 },
        { to: "/restaurant/returns", label: "Retours & avoirs", icon: RotateCcw, badge: 0 },
        { to: "/restaurant/reviews", label: "Évaluations", icon: Star, badge: 0 },
        { to: "/restaurant/disputes", label: "Litiges", icon: Scale, badge: 0 },
        {
          to: "/restaurant/messages",
          label: "Messages",
          icon: MessageSquare,
          badge: unreadMessages,
        },
        { to: "/restaurant/notifications", label: "Notifications", icon: Bell, badge: 0 },
      ],
    },
    {
      label: "COMPTE",
      items: [
        { to: "/restaurant/support", label: "Support", icon: LifeBuoy, badge: 0 },
        { to: "/restaurant/settings", label: "Paramètres", icon: Settings, badge: 0 },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-sidebar">
        <div className="p-5 space-y-3">
          <Logo />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold">
            <UtensilsCrossed className="h-3 w-3" /> Restaurant
          </span>
        </div>
        <nav className="flex-1 px-3 space-y-4 overflow-auto scrollbar-thin">
          {navSections.map((section) => (
            <div key={section.label} className="space-y-1">
              <div className="px-3 text-[10px] font-semibold text-muted-foreground/70 tracking-wider">
                {section.label}
              </div>
              {section.items.map((it) => {
                const active = path === it.to || path.startsWith(it.to + "/");
                const badge = "cart" in it && it.cart ? cartCount : "badge" in it ? it.badge : 0;
                return (
                  <Link
                    key={it.to}
                    to={it.to}
                    className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${active ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                  >
                    <it.icon className="h-4 w-4" />
                    <span className="flex-1">{it.label}</span>
                    {!!badge && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground">
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-border">
          <div className="glass rounded-xl p-3 flex items-center gap-3">
            <img src={user.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{user.name}</div>
              <div className="text-[11px] text-muted-foreground truncate">Restaurant</div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-sidebar border-r border-border p-4 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <Logo />
              <button onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-4">
              {navSections.map((s) => (
                <div key={s.label} className="space-y-1">
                  <div className="px-3 text-[10px] font-semibold text-muted-foreground/70 tracking-wider">
                    {s.label}
                  </div>
                  {s.items.map((it) => (
                    <Link
                      key={it.to}
                      to={it.to}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-accent"
                    >
                      <it.icon className="h-4 w-4" />
                      {it.label}
                    </Link>
                  ))}
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 glass-strong border-b border-border flex items-center gap-3 px-4 lg:px-6 h-14">
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-accent"
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <Breadcrumb />
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
            }}
            className="flex-1 max-w-xs ml-auto hidden md:flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 h-8 text-xs text-muted-foreground hover:bg-muted transition"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="flex-1">Rechercher…</span>
            <kbd className="text-[10px] font-mono rounded border border-border px-1.5 py-0.5">
              ⌘K
            </kbd>
          </button>
          <ThemeToggle />
          <Link
            to="/restaurant/notifications"
            className="relative grid h-9 w-9 place-items-center rounded-xl hover:bg-accent"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[9px] font-bold rounded-full bg-destructive text-destructive-foreground grid place-items-center">
                {unread}
              </span>
            )}
          </Link>
          <Link
            to="/restaurant/cart"
            className="relative grid h-9 w-9 place-items-center rounded-xl hover:bg-accent"
          >
            <ShoppingCart className="h-4 w-4" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] font-bold rounded-full bg-destructive text-destructive-foreground grid place-items-center">
                {cartCount}
              </span>
            )}
          </Link>
          <img
            src={user.avatar}
            alt=""
            className="h-9 w-9 rounded-full object-cover ring-2 ring-amber-500/40"
          />
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-8 pb-24 lg:pb-8">
          <Outlet />
        </main>
        <CommandPalette scope="restaurant" />
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 glass-strong border-t border-border grid grid-cols-5 h-16">
          {bottomNav.map((it) => {
            const active = path === it.to || path.startsWith(it.to + "/");
            const badge = "cart" in it && it.cart ? cartCount : 0;
            return (
              <Link
                key={it.to}
                to={it.to}
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] relative ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                <it.icon className="h-4 w-4" />
                {it.label}
                {!!badge && (
                  <span className="absolute top-2 right-6 h-4 min-w-4 px-1 text-[9px] font-bold rounded-full bg-destructive text-destructive-foreground grid place-items-center">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
