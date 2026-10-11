import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  Warehouse,
  ShoppingBag,
  TrendingUp,
  BarChart3,
  MessageSquare,
  Bell,
  Settings,
  Menu,
  X,
  Sprout,
  Search,
  Scale,
  RotateCcw,
  LifeBuoy,
} from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/common/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Breadcrumb } from "@/components/farmer/breadcrumb";
import { CommandPalette } from "@/components/common/command-palette";
import { LogoutButton } from "@/components/common/logout-button";
import { useFarmerNotifications, useOrders, useConversations } from "@/data/store";
import { useMaintenanceMode } from "@/data/admin-store";
import { MaintenanceScreen } from "@/components/common/maintenance-screen";
import { requireRole } from "@/lib/auth/functions";

export const Route = createFileRoute("/farmer")({
  beforeLoad: () => requireRole("farmer"),
  component: FarmerLayout,
});

const MY_FARMER_ID = "f1";

const bottomNav = [
  { to: "/farmer/dashboard", label: "Accueil", icon: LayoutDashboard },
  { to: "/farmer/products", label: "Produits", icon: Package },
  { to: "/farmer/orders", label: "Commandes", icon: ShoppingBag },
  { to: "/farmer/messages", label: "Messages", icon: MessageSquare },
];

function FarmerLayout() {
  const { user } = Route.useRouteContext();
  const maintenance = useMaintenanceMode();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const notifs = useFarmerNotifications();
  const unread = notifs.filter((n) => !n.read).length;
  const pendingOrders = useOrders().filter(
    (o) => o.farmerId === MY_FARMER_ID && o.status === "pending",
  ).length;
  const unreadMessages = useConversations()
    .filter((c) => c.farmerId === MY_FARMER_ID)
    .reduce((s, c) => s + c.unread, 0);

  const navSections = [
    {
      label: "NAVIGATION",
      items: [
        { to: "/farmer/dashboard", label: "Tableau de bord", icon: LayoutDashboard, badge: 0 },
        { to: "/farmer/disputes", label: "Litiges", icon: Scale, badge: 0 },
        { to: "/farmer/products", label: "Mes Produits", icon: Package, badge: 0 },
        { to: "/farmer/stock", label: "Gestion du Stock", icon: Warehouse, badge: 0 },
        { to: "/farmer/orders", label: "Commandes", icon: ShoppingBag, badge: pendingOrders },
        { to: "/farmer/returns", label: "Retours & avoirs", icon: RotateCcw, badge: 0 },
        { to: "/farmer/revenue", label: "Mes Revenus", icon: TrendingUp, badge: 0 },
        { to: "/farmer/analytics", label: "Analytics", icon: BarChart3, badge: 0 },
        { to: "/farmer/messages", label: "Messages", icon: MessageSquare, badge: unreadMessages },
        { to: "/farmer/notifications", label: "Notifications", icon: Bell, badge: 0 },
      ],
    },
    {
      label: "COMPTE",
      items: [
        { to: "/farmer/support", label: "Support", icon: LifeBuoy, badge: 0 },
        { to: "/farmer/settings", label: "Paramètres", icon: Settings, badge: 0 },
      ],
    },
  ];

  if (maintenance.active) {
    return <MaintenanceScreen message={maintenance.message} />;
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-sidebar">
        <div className="p-5 space-y-3">
          <Logo />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold">
            <Sprout className="h-3 w-3" /> Agriculteur
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
                return (
                  <Link
                    key={it.to}
                    to={it.to}
                    className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${active ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                  >
                    <it.icon className="h-4 w-4" />
                    <span className="flex-1">{it.label}</span>
                    {"badge" in it && !!it.badge && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground">
                        {it.badge}
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
              <div className="text-[11px] text-muted-foreground truncate">Agriculteur</div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
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
                      className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium hover:bg-accent"
                    >
                      <it.icon className="h-5 w-5" />
                      <span className="flex-1">{it.label}</span>
                      {"badge" in it && !!it.badge && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground">
                          {it.badge}
                        </span>
                      )}
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
              // Dispatch a fake ⌘K to open the palette
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
            to="/farmer/notifications"
            className="grid h-9 w-9 place-items-center rounded-xl hover:bg-accent relative"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[9px] font-bold rounded-full bg-destructive text-destructive-foreground grid place-items-center">
                {unread}
              </span>
            )}
          </Link>
          <img
            src={user.avatar}
            alt=""
            className="h-9 w-9 rounded-full object-cover ring-2 ring-primary/40"
          />
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-8 pb-24 lg:pb-8">
          <Outlet />
        </main>
        <CommandPalette scope="farmer" />
        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 glass-strong border-t border-border grid grid-cols-5 h-16">
          {bottomNav.map((it) => {
            const active = path === it.to || path.startsWith(it.to + "/");
            return (
              <Link
                key={it.to}
                to={it.to}
                className={`flex flex-col items-center justify-center gap-0.5 text-[11px] ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                <it.icon className="h-5 w-5" />
                {it.label}
              </Link>
            );
          })}
          {/* « Plus » ouvre le menu complet : stock, revenus, retours,
              litiges… n'étaient accessibles que par le menu hamburger. */}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 text-[11px] text-muted-foreground"
          >
            <Menu className="h-5 w-5" />
            Plus
          </button>
        </nav>
      </div>
    </div>
  );
}
