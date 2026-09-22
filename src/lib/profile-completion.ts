import type {
  FarmerFarm,
  FarmerProfile,
  PaymentPrefs,
  RestaurantProfile,
  DriverSettings,
} from "@/data/mocks";

export type CompletionItem = { label: string; done: boolean; href: string };

const filled = (v: string | undefined | null) => Boolean(v && v.trim().length > 0);

export function farmerCompletionItems(
  profile: FarmerProfile,
  farm: FarmerFarm,
  payment: PaymentPrefs,
  twoFaEnabled: boolean,
): CompletionItem[] {
  return [
    { label: "Photo de profil", done: filled(profile.avatar), href: "/farmer/settings/profile" },
    { label: "Bio courte", done: filled(profile.bio), href: "/farmer/settings/profile" },
    { label: "Exploitation renseignée", done: filled(farm.name), href: "/farmer/settings/farm" },
    { label: "Types de production", done: farm.types.length > 0, href: "/farmer/settings/farm" },
    {
      label: "Moyen de paiement configuré",
      done: Boolean(payment.primary),
      href: "/farmer/settings/payments",
    },
    {
      label: "Double authentification activée",
      done: twoFaEnabled,
      href: "/farmer/settings/security",
    },
  ];
}

const RESTAURANT_PROFILE_FIELDS = [
  "displayName",
  "cuisine",
  "phone",
  "email",
  "manager",
  "bio",
  "avatarUrl",
] as const;

const RESTAURANT_FIELD_LABEL: Record<(typeof RESTAURANT_PROFILE_FIELDS)[number], string> = {
  displayName: "Nom affiché",
  cuisine: "Type de cuisine",
  phone: "Téléphone",
  email: "Email",
  manager: "Responsable",
  bio: "Bio",
  avatarUrl: "Photo",
};

export function restaurantCompletionItems(
  profile: RestaurantProfile,
  twoFaEnabled: boolean,
): CompletionItem[] {
  return [
    ...RESTAURANT_PROFILE_FIELDS.map((k) => ({
      label: RESTAURANT_FIELD_LABEL[k],
      done: filled(profile[k] as string),
      href: "/restaurant/settings/profile",
    })),
    {
      label: "Double authentification activée",
      done: twoFaEnabled,
      href: "/restaurant/settings/security",
    },
  ];
}

export function restaurantCompletionPct(profile: RestaurantProfile): number {
  const filledCount = RESTAURANT_PROFILE_FIELDS.filter((k) => filled(profile[k] as string)).length;
  return Math.round((filledCount / RESTAURANT_PROFILE_FIELDS.length) * 100);
}

export function driverCompletionItems(
  settings: DriverSettings,
  documents: { permitVerified: boolean; idVerified: boolean; insuranceVerified: boolean },
  twoFaEnabled: boolean,
): CompletionItem[] {
  return [
    {
      label: "Photo de profil",
      done: filled(settings.profile.avatar),
      href: "/driver/settings/profile",
    },
    {
      label: "Adresse renseignée",
      done: filled(settings.profile.address),
      href: "/driver/settings/profile",
    },
    { label: "Pièce d'identité vérifiée", done: documents.idVerified, href: "/driver/vehicle" },
    { label: "Permis vérifié", done: documents.permitVerified, href: "/driver/vehicle" },
    { label: "Assurance vérifiée", done: documents.insuranceVerified, href: "/driver/vehicle" },
    {
      label: "Moyen de paiement actif",
      done: settings.paymentMethods.some((p) => p.active),
      href: "/driver/settings/payments",
    },
    {
      label: "Double authentification activée",
      done: twoFaEnabled,
      href: "/driver/settings/security",
    },
  ];
}

export function completionPct(items: CompletionItem[]): number {
  if (items.length === 0) return 0;
  return Math.round((items.filter((i) => i.done).length / items.length) * 100);
}
