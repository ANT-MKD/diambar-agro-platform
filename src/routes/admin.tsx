import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  PackageSearch,
  ShoppingBag,
  Scale,
  Wallet,
  ScrollText,
  Settings,
  Menu,
  X,
  Shield,
  Search,
  Bell,
  Undo2,
  LifeBuoy,
  Truck,
  BarChart3,
  MessageSquare,
  TriangleAlert,
  Sprout,
  Utensils,
  UserCog,
  PackageMinus,
} from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/common/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Breadcrumb } from "@/components/farmer/breadcrumb";
import { CommandPalette } from "@/components/common/command-palette";
import { LogoutButton } from "@/components/common/logout-button";
import {
  useAdminNotifications,
  useAdminRoleForEmail,
  useValidations,
  can,
  type PermissionKey,
} from "@/data/admin-store";
import { useAllDisputes } from "@/data/disputes";
import { useConversations, useDriverConversations } from "@/data/store";
import { useIncidents, useReturns } from "@/data/business";
import { useRefunds } from "@/data/finance";
import { useSupportTickets } from "@/data/support";
import { requireRole } from "@/lib/auth/functions";

export const Route = createFileRoute("/admin")({
  beforeLoad: () => requireRole("admin"),
  component: AdminLayout,
});

function AdminLayout() {
  const { user } = Route.useRouteContext();
  const adminRole = useAdminRoleForEmail(user.email);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const validations = useValidations();
  const disputes = useAllDisputes();
  const incidents = useIncidents();
  const refunds = useRefunds();
  const returns = useReturns();
  const supportTickets = useSupportTickets();
  const notifications = useAdminNotifications();
  const farmerConvos = useConversations();
  const driverConvos = useDriverConversations();
  const pendingValidations = validations.filter((v) => v.status === "pending").length;
  const openDisputes = disputes.filter(
    (d) => d.status === "open" || d.status === "investigating",
  ).length;
  const escalatedIncidents = incidents.filter((i) => i.status === "escalated").length;
  const refundsToHandle = refunds.filter(
    (r) => r.status === "pending" || r.status === "failed",
  ).length;
  const pendingReturns = returns.filter(
    (r) => r.status === "pending" || (r.pickup?.status === "received" && !r.inspection),
  ).length;
  const openTickets = supportTickets.filter((t) => t.status === "open").length;
  const unreadNotifications = notifications.filter((n) => !n.read).length;
  const unreadMessages =
    farmerConvos.reduce((s, c) => s + c.unread, 0) + driverConvos.reduce((s, c) => s + c.unread, 0);

  const navSectionsAll: {
    label: string;
    items: {
      to: string;
      label: string;
      icon: typeof LayoutDashboard;
      badge: number;
      permission?: PermissionKey;
    }[];
  }[] = [
    {
      label: "PILOTAGE",
      items: [
        { to: "/admin/dashboard", label: "Vue d'ensemble", icon: LayoutDashboard, badge: 0 },
        { to: "/admin/analytics", label: "Analytics", icon: BarChart3, badge: 0 },
        {
          to: "/admin/validations",
          label: "Validations",
          icon: ShieldCheck,
          badge: pendingValidations,
          permission: "validations.decide",
        },
        {
          to: "/admin/moderation",
          label: "Modération",
          icon: PackageSearch,
          badge: 0,
          permission: "moderation.decide",
        },
      ],
    },
    {
      label: "UTILISATEURS",
      items: [
        {
          to: "/admin/users",
          label: "Tous les utilisateurs",
          icon: Users,
          badge: 0,
          permission: "users.view",
        },
        {
          to: "/admin/users/farmers",
          label: "Agriculteurs",
          icon: Sprout,
          badge: 0,
          permission: "users.view",
        },
        {
          to: "/admin/users/restaurants",
          label: "Restaurants",
          icon: Utensils,
          badge: 0,
          permission: "users.view",
        },
        {
          to: "/admin/users/drivers",
          label: "Livreurs",
          icon: Truck,
          badge: 0,
          permission: "users.view",
        },
        {
          to: "/admin/users/admins",
          label: "Administrateurs",
          icon: UserCog,
          badge: 0,
          permission: "security.manage_admins",
        },
      ],
    },
    {
      label: "OPÉRATIONS",
      items: [
        {
          to: "/admin/orders",
          label: "Commandes",
          icon: ShoppingBag,
          badge: 0,
          permission: "orders.view",
        },
        {
          to: "/admin/deliveries",
          label: "Livraisons",
          icon: Truck,
          badge: 0,
          permission: "deliveries.view",
        },
        {
          to: "/admin/incidents",
          label: "Incidents",
          icon: TriangleAlert,
          badge: escalatedIncidents,
          permission: "incidents.decide",
        },
        {
          to: "/admin/disputes",
          label: "Litiges",
          icon: Scale,
          badge: openDisputes,
          permission: "disputes.decide",
        },
        {
          to: "/admin/support",
          label: "Support",
          icon: LifeBuoy,
          badge: openTickets,
          permission: "support.respond",
        },
        {
          to: "/admin/finance",
          label: "Finance",
          icon: Wallet,
          badge: 0,
          permission: "finance.view",
        },
        {
          to: "/admin/refunds",
          label: "Remboursements",
          icon: Undo2,
          badge: refundsToHandle,
          permission: "refunds.view",
        },
        {
          to: "/admin/returns",
          label: "Retours",
          icon: PackageMinus,
          badge: pendingReturns,
          permission: "returns.decide",
        },
        {
          to: "/admin/messages",
          label: "Messages",
          icon: MessageSquare,
          badge: unreadMessages,
          permission: "messages.view",
        },
        {
          to: "/admin/notifications",
          label: "Notifications",
          icon: Bell,
          badge: unreadNotifications,
        },
      ],
    },
    {
      label: "PLATEFORME",
      items: [
        {
          to: "/admin/logs",
          label: "Journal d'audit",
          icon: ScrollText,
          badge: 0,
          permission: "audit.view",
        },
        { to: "/admin/settings", label: "Paramètres", icon: Settings, badge: 0 },
      ],
    },
  ];

  // Filtrage réel par rôle : un item nécessitant une permission que le rôle
  // n'a pas n'apparaît pas dans la nav (pas seulement grisé) — et une
  // section qui n'a plus aucun item visible disparaît entièrement.
  const navSections = navSectionsAll
    .map((section) => ({
      ...section,
      items: section.items.filter((it) => !it.permission || can(adminRole, it.permission)),
    }))
    .filter((section) => section.items.length > 0);

  // Certaines entrées (ex. "Tous les utilisateurs") ont maintenant des
  // sous-pages sœurs dont le chemin les préfixe ("/admin/users/farmers"…) :
  // un simple startsWith ferait s'allumer les deux à la fois. On ne retient
  // le préfixe que si aucune autre entrée, plus précise, ne correspond déjà.
  const allPaths = navSections.flatMap((s) => s.items.map((it) => it.to));
  const isNavActive = (to: string) => {
    if (path === to) return true;
    if (!path.startsWith(to + "/")) return false;
    return !allPaths.some(
      (other) => other !== to && other.startsWith(to + "/") && path.startsWith(other),
    );
  };

  const bottomNav = [
    { to: "/admin/dashboard", label: "Accueil", icon: LayoutDashboard },
    { to: "/admin/users", label: "Users", icon: Users },
    { to: "/admin/validations", label: "Validations", icon: ShieldCheck },
    { to: "/admin/disputes", label: "Litiges", icon: Scale },
    { to: "/admin/settings", label: "Plus", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-sidebar print:hidden">
        <div className="p-5 space-y-3">
          <Logo />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 px-2 py-0.5 text-[10px] font-semibold">
            <Shield className="h-3 w-3" /> Administration
          </span>
        </div>
        <nav className="flex-1 px-3 space-y-4 overflow-auto scrollbar-thin">
          {navSections.map((section) => (
            <div key={section.label} className="space-y-1">
              <div className="px-3 text-[10px] font-semibold text-muted-foreground/70 tracking-wider">
                {section.label}
              </div>
              {section.items.map((it) => {
                const active = isNavActive(it.to);
                return (
                  <Link
                    key={it.to}
                    to={it.to}
                    className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${active ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                  >
                    <it.icon className="h-4 w-4" />
                    <span className="flex-1">{it.label}</span>
                    {it.badge > 0 && (
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
              <div className="text-[11px] text-muted-foreground truncate">{adminRole}</div>
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
        <header className="sticky top-0 z-30 glass-strong border-b border-border flex items-center gap-3 px-4 lg:px-6 h-14 print:hidden">
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
            to="/admin/notifications"
            className="grid h-9 w-9 place-items-center rounded-xl hover:bg-accent relative"
          >
            <Bell className="h-4 w-4" />
            {unreadNotifications > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[9px] font-bold rounded-full bg-destructive text-destructive-foreground grid place-items-center">
                {unreadNotifications}
              </span>
            )}
          </Link>
          <img
            src={user.avatar}
            alt=""
            className="h-9 w-9 rounded-full object-cover ring-2 ring-primary/40"
          />
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-8 pb-24 lg:pb-8 print:p-0 print:overflow-visible">
          <Outlet />
        </main>
        <CommandPalette scope="admin" />
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 glass-strong border-t border-border grid grid-cols-5 h-16 print:hidden">
          {bottomNav.map((it) => {
            const active = path === it.to || path.startsWith(it.to + "/");
            return (
              <Link
                key={it.to}
                to={it.to}
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                <it.icon className="h-4 w-4" />
                {it.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
