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
  LogOut,
  Menu,
  X,
  Shield,
  Search,
  Bell,
  Undo2,
} from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/common/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Breadcrumb } from "@/components/farmer/breadcrumb";
import { CommandPalette } from "@/components/common/command-palette";
import { useDisputes, useValidations } from "@/data/admin-store";

export const Route = createFileRoute("/admin")({ component: AdminLayout });

function AdminLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const validations = useValidations();
  const disputes = useDisputes();
  const pendingValidations = validations.filter((v) => v.status === "pending").length;
  const openDisputes = disputes.filter(
    (d) => d.status === "open" || d.status === "investigating",
  ).length;

  const navSections = [
    {
      label: "PILOTAGE",
      items: [
        { to: "/admin/dashboard", label: "Vue d'ensemble", icon: LayoutDashboard, badge: 0 },
        { to: "/admin/users", label: "Utilisateurs", icon: Users, badge: 0 },
        {
          to: "/admin/validations",
          label: "Validations",
          icon: ShieldCheck,
          badge: pendingValidations,
        },
        { to: "/admin/moderation", label: "Modération", icon: PackageSearch, badge: 0 },
      ],
    },
    {
      label: "OPÉRATIONS",
      items: [
        { to: "/admin/orders", label: "Commandes", icon: ShoppingBag, badge: 0 },
        { to: "/admin/disputes", label: "Litiges", icon: Scale, badge: openDisputes },
        { to: "/admin/finance", label: "Finance", icon: Wallet, badge: 0 },
        { to: "/admin/refunds", label: "Remboursements", icon: Undo2, badge: 0 },
      ],
    },
    {
      label: "PLATEFORME",
      items: [
        { to: "/admin/logs", label: "Journal d'audit", icon: ScrollText, badge: 0 },
        { to: "/admin/settings", label: "Paramètres", icon: Settings, badge: 0 },
      ],
    },
  ];

  const bottomNav = [
    { to: "/admin/dashboard", label: "Accueil", icon: LayoutDashboard },
    { to: "/admin/users", label: "Users", icon: Users },
    { to: "/admin/validations", label: "Validations", icon: ShieldCheck },
    { to: "/admin/disputes", label: "Litiges", icon: Scale },
    { to: "/admin/settings", label: "Plus", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-sidebar">
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
                const active = path === it.to || path.startsWith(it.to + "/");
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
            <img
              src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=80"
              alt=""
              className="h-9 w-9 rounded-full object-cover"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">Admin Diambar</div>
              <div className="text-[11px] text-muted-foreground truncate">Super administrateur</div>
            </div>
            <Link
              to="/login"
              className="grid h-7 w-7 place-items-center rounded-lg hover:bg-accent text-muted-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Link>
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
            to="/admin/validations"
            className="grid h-9 w-9 place-items-center rounded-xl hover:bg-accent relative"
          >
            <Bell className="h-4 w-4" />
            {pendingValidations + openDisputes > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[9px] font-bold rounded-full bg-destructive text-destructive-foreground grid place-items-center">
                {pendingValidations + openDisputes}
              </span>
            )}
          </Link>
          <img
            src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=80"
            alt=""
            className="h-9 w-9 rounded-full object-cover ring-2 ring-primary/40"
          />
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-8 pb-24 lg:pb-8">
          <Outlet />
        </main>
        <CommandPalette scope="admin" />
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 glass-strong border-t border-border grid grid-cols-5 h-16">
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
