import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Truck,
  Wallet,
  History,
  MessageSquare,
  Bell,
  Settings,
  Menu,
  X,
  Search,
  Zap,
  ZapOff,
  Car,
  Scale,
  Navigation,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/common/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Breadcrumb } from "@/components/farmer/breadcrumb";
import { LogoutButton } from "@/components/common/logout-button";
import {
  useDriverNotifications,
  useDriverOnline,
  driverOnlineActions,
  useMissions,
  useDriverSettings,
  useDriverConversations,
  missionActions,
  autoAcceptableMissions,
  useMyDriverFleet,
} from "@/data/store";
import { driverProfile } from "@/data/mocks";
import { useMaintenanceMode } from "@/data/admin-store";
import { MaintenanceScreen } from "@/components/common/maintenance-screen";
import { requireRole } from "@/lib/auth/functions";

export const Route = createFileRoute("/driver")({
  beforeLoad: () => requireRole("driver"),
  component: DriverLayout,
});

const MY_DRIVER_ID = "d1";

const bottomNav = [
  { to: "/driver/dashboard", label: "Accueil", icon: LayoutDashboard },
  { to: "/driver/missions", label: "Missions", icon: Truck },
  { to: "/driver/wallet", label: "Revenus", icon: Wallet },
  { to: "/driver/messages", label: "Messages", icon: MessageSquare },
  { to: "/driver/settings", label: "Plus", icon: Settings },
];

function DriverLayout() {
  const { user } = Route.useRouteContext();
  const maintenance = useMaintenanceMode();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const notifs = useDriverNotifications();
  const online = useDriverOnline();
  const unread = notifs.filter((n) => !n.read).length;
  const missions = useMissions();
  const settings = useDriverSettings();
  const fleet = useMyDriverFleet();
  const activeMissions = missions.filter(
    (m) => m.driverId === MY_DRIVER_ID && ["accepted", "pickup", "loaded"].includes(m.status),
  ).length;
  const unreadMessages = useDriverConversations().reduce((s, c) => s + c.unread, 0);

  // Acceptation automatique réelle : dès qu'une mission "disponible" respecte
  // les critères enregistrés dans Paramètres, elle est acceptée pour de bon.
  useEffect(() => {
    if (!online) return;
    const matches = autoAcceptableMissions(missions, settings, fleet);
    for (const m of matches) {
      if (!missionActions.accept(m.id).ok) continue;
      toast.success(
        `${m.reference} acceptée automatiquement · ${m.payout.toLocaleString("fr-FR")} FCFA`,
      );
    }
  }, [missions, settings, online, fleet]);

  const toggleOnline = () => {
    driverOnlineActions.toggle();
    toast.success(
      online
        ? "Vous êtes hors-ligne · aucune mission ne vous sera proposée"
        : "Vous êtes en ligne · missions activées",
    );
  };

  const navSections = [
    {
      label: "NAVIGATION",
      items: [
        { to: "/driver/dashboard", label: "Tableau de bord", icon: LayoutDashboard, badge: 0 },
        { to: "/driver/missions", label: "Missions", icon: Truck, badge: activeMissions },
        { to: "/driver/routes", label: "Tournées", icon: Navigation, badge: 0 },
        { to: "/driver/history", label: "Historique", icon: History, badge: 0 },
        { to: "/driver/wallet", label: "Portefeuille", icon: Wallet, badge: 0 },
        { to: "/driver/incidents", label: "Incidents", icon: TriangleAlert, badge: 0 },
        { to: "/driver/disputes", label: "Litiges", icon: Scale, badge: 0 },
        { to: "/driver/messages", label: "Messages", icon: MessageSquare, badge: unreadMessages },
        { to: "/driver/notifications", label: "Notifications", icon: Bell, badge: 0 },
      ],
    },
    {
      label: "COMPTE",
      items: [
        { to: "/driver/vehicle", label: "Véhicule", icon: Car, badge: 0 },
        { to: "/driver/settings", label: "Paramètres", icon: Settings, badge: 0 },
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-2 py-0.5 text-[10px] font-semibold">
            <Truck className="h-3 w-3" /> Livreur
          </span>
        </div>

        <div className="px-4 pb-3">
          <button
            onClick={toggleOnline}
            className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
              online
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                : "bg-muted text-muted-foreground border border-border"
            }`}
          >
            <span className="flex items-center gap-2">
              {online ? <Zap className="h-3.5 w-3.5" /> : <ZapOff className="h-3.5 w-3.5" />}
              {online ? "En ligne" : "Hors-ligne"}
            </span>
            <span
              className={`h-2 w-2 rounded-full ${online ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`}
            />
          </button>
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
                    {"badge" in it && it.badge && (
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
              <div className="text-[11px] text-muted-foreground truncate">
                Livreur · ★ {driverProfile.rating}
              </div>
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
            <button
              onClick={toggleOnline}
              className={`w-full mb-4 flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold ${online ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30" : "bg-muted text-muted-foreground border border-border"}`}
            >
              <span className="flex items-center gap-2">
                {online ? <Zap className="h-3.5 w-3.5" /> : <ZapOff className="h-3.5 w-3.5" />}
                {online ? "En ligne" : "Hors-ligne"}
              </span>
              <span
                className={`h-2 w-2 rounded-full ${online ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`}
              />
            </button>
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
            <span className="flex-1">Rechercher une mission…</span>
            <kbd className="text-[10px] font-mono rounded border border-border px-1.5 py-0.5">
              ⌘K
            </kbd>
          </button>
          {/* Toggle on/off mobile */}
          <button
            onClick={toggleOnline}
            className={`lg:hidden inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${online ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`}
            />
            {online ? "En ligne" : "Hors-ligne"}
          </button>
          <ThemeToggle />
          <Link
            to="/driver/notifications"
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
            className="h-9 w-9 rounded-full object-cover ring-2 ring-blue-500/40"
          />
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-8 pb-24 lg:pb-8">
          <Outlet />
        </main>
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
