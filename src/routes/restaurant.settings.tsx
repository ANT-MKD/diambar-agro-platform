import { createFileRoute, Outlet } from "@tanstack/react-router";
import { User, Building2, CreditCard, Bell, Shield, Users } from "lucide-react";
import { SettingsShell, type SettingsNavItem } from "@/components/common/settings-shell";

export const Route = createFileRoute("/restaurant/settings")({
  component: RestaurantSettingsLayout,
});

const nav: SettingsNavItem[] = [
  { to: "/restaurant/settings/profile", label: "Profil", icon: User },
  { to: "/restaurant/settings/establishment", label: "Établissement", icon: Building2 },
  { to: "/restaurant/settings/payments", label: "Paiements", icon: CreditCard },
  { to: "/restaurant/settings/notifications", label: "Notifications", icon: Bell },
  { to: "/restaurant/settings/security", label: "Sécurité", icon: Shield },
  { to: "/restaurant/settings/team", label: "Équipe", icon: Users },
];

function RestaurantSettingsLayout() {
  return (
    <SettingsShell title="Paramètres" subtitle="Gérez votre compte restaurant" items={nav}>
      <Outlet />
    </SettingsShell>
  );
}
