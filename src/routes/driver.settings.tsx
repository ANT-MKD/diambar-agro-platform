import { createFileRoute, Outlet } from "@tanstack/react-router";
import {
  User,
  Truck,
  Bell,
  Wallet,
  Shield,
  Lock,
  Palette,
  LifeBuoy,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { SettingsShell, type SettingsNavItem } from "@/components/common/settings-shell";
import { useDriverSettings, useDriverVehicle, useVehicleIssues } from "@/data/store";
import { vehicleCompliance, VEHICLE_STATUS_LABEL } from "@/lib/vehicle-status";
import { driverProfile } from "@/data/mocks";

export const Route = createFileRoute("/driver/settings")({ component: SettingsLayout });

export const driverSettingsNav: SettingsNavItem[] = [
  { to: "/driver/settings/profile", label: "Profil", icon: User, group: "Mon compte" },
  {
    to: "/driver/settings/appearance",
    label: "Langue & apparence",
    icon: Palette,
    group: "Mon compte",
  },
  { to: "/driver/settings/work", label: "Travail & disponibilité", icon: Truck, group: "Activité" },
  { to: "/driver/settings/notifications", label: "Notifications", icon: Bell, group: "Activité" },
  { to: "/driver/settings/payments", label: "Paiements", icon: Wallet, group: "Activité" },
  { to: "/driver/settings/security", label: "Sécurité", icon: Shield, group: "Sécurité" },
  { to: "/driver/settings/privacy", label: "Confidentialité", icon: Lock, group: "Sécurité" },
  { to: "/driver/settings/help", label: "Aide & support", icon: LifeBuoy, group: "Assistance" },
];

function SettingsLayout() {
  const settings = useDriverSettings();
  const vehicle = useDriverVehicle();
  const issues = useVehicleIssues();
  const { status } = vehicleCompliance(vehicle, issues);

  const accountVerified =
    driverProfile.documents.idVerified && driverProfile.documents.permitVerified;
  const paymentsActive = settings.paymentMethods.some((m) => m.active);
  const notifsActive = settings.notif.push || settings.notif.sms || settings.notif.email;

  return (
    <SettingsShell
      title="Paramètres"
      subtitle="Gérez votre compte, votre activité et votre sécurité."
      items={driverSettingsNav}
      statusStrip={
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusBadge
            ok={accountVerified}
            okLabel="Compte vérifié"
            koLabel="Vérification requise"
          />
          <StatusBadge
            ok={paymentsActive}
            okLabel="Paiements actifs"
            koLabel="Aucun moyen de paiement actif"
          />
          <StatusBadge
            ok={status === "ok"}
            okLabel="Véhicule conforme"
            koLabel={VEHICLE_STATUS_LABEL[status]}
          />
          <StatusBadge
            ok={notifsActive}
            okLabel="Notifications actives"
            koLabel="Notifications coupées"
          />
        </div>
      }
    >
      <Outlet />
    </SettingsShell>
  );
}

function StatusBadge({ ok, okLabel, koLabel }: { ok: boolean; okLabel: string; koLabel: string }) {
  const Icon = ok ? CheckCircle2 : AlertTriangle;
  return (
    <div
      className={`glass flex items-center gap-2 rounded-2xl p-3 text-sm font-medium ${ok ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {ok ? okLabel : koLabel}
    </div>
  );
}
