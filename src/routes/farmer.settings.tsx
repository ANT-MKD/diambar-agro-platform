import { createFileRoute, Outlet } from "@tanstack/react-router";
import { User, Sprout, CreditCard, Bell, Shield, Users } from "lucide-react";
import { SettingsShell, type SettingsNavItem } from "@/components/common/settings-shell";

export const Route = createFileRoute("/farmer/settings")({ component: SettingsLayout });

export const farmerSettingsNav: SettingsNavItem[] = [
  { to: "/farmer/settings/profile", label: "Profil", icon: User },
  { to: "/farmer/settings/farm", label: "Exploitation", icon: Sprout },
  { to: "/farmer/settings/payments", label: "Paiements", icon: CreditCard },
  { to: "/farmer/settings/notifications", label: "Notifications", icon: Bell },
  { to: "/farmer/settings/security", label: "Sécurité", icon: Shield },
  { to: "/farmer/settings/team", label: "Équipe", icon: Users },
];

function SettingsLayout() {
  return (
    <SettingsShell
      title="Paramètres"
      subtitle="Gérez votre compte et votre exploitation"
      items={farmerSettingsNav}
    >
      <Outlet />
    </SettingsShell>
  );
}
