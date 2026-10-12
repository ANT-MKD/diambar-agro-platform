// Assistant de configuration de la plateforme (première connexion du super
// administrateur) : étapes et forme des réglages. Partagé par le serveur et
// les écrans.

export const SETUP_STEPS = [
  { key: "security", label: "Sécurité", hint: "Protéger le compte super administrateur" },
  { key: "company", label: "Entreprise", hint: "Nom légal, NINEA, adresse : factures et mentions" },
  { key: "zone", label: "Zone pilote", hint: "Ville et quartiers livrés, frais de livraison" },
  {
    key: "orders",
    label: "Règles de commande",
    hint: "Heure limite, minimum, délai de réclamation",
  },
  { key: "money", label: "Commission et TVA", hint: "Barème de commission, TVA" },
  { key: "payments", label: "Paiements", hint: "Numéros marchands Wave / Orange Money, espèces" },
  { key: "catalog", label: "Catalogue", hint: "Catégories de produits proposées" },
  { key: "team", label: "Équipe", hint: "Inviter les autres administrateurs" },
] as const;

export type SetupStepKey = (typeof SETUP_STEPS)[number]["key"];

export type PlatformSetup = {
  startedAt?: string;
  /** Date de validation de chaque étape. */
  steps?: Partial<Record<SetupStepKey, string>>;
  completedAt?: string;
  /** Base de démonstration : configuration considérée comme faite. */
  demo?: boolean;
};

export type CompanyInfo = {
  legalName: string;
  tradeName: string;
  ninea: string;
  rccm: string;
  address: string;
  email: string;
  phone: string;
};

export type OrderRules = {
  cutoffHour: number;
  minOrderPerProducer: number;
  receptionWindowHours: number;
  /** Paiement Wave / Orange Money attendu au plus tard la veille du créneau
   * à cette heure (et dans les 24 h après la commande) ; sinon annulée. */
  paymentDeadlineHour: number;
};

export type CommissionTierSetting = {
  label: string;
  rate: number;
  min: number;
  max: number | null;
};

export type TvaSetting = { enabled: boolean; rate: number };

export type PaymentMethodsSetting = {
  wave: { enabled: boolean; number: string };
  orangeMoney: { enabled: boolean; number: string };
  /** driverLimit : espèces non remises au-delà desquelles un livreur
   * n'accepte plus de course payée en espèces. */
  cashOnDelivery: { enabled: boolean; driverLimit?: number };
};

export type PilotZone = {
  city: string;
  baseFee: number;
  perKmFee: number;
  zones: string[];
};

export type StaffSummary = {
  email: string;
  name: string;
  staffRole: "super_admin" | "operations" | "finance" | "support" | null;
  status: string;
};

export type SetupSnapshot = {
  demoMode: boolean;
  /** Les codes de vérification peuvent-ils être reçus (SMS/email branché, ou démo) ? */
  codeDeliveryAvailable: boolean;
  /** missing : pas d'envoi ; test_sender : adresse de test de Resend (n'envoie
   * qu'au propriétaire du compte) ; ready : domaine vérifié. */
  emailStatus: "missing" | "test_sender" | "ready";
  /** Inscriptions publiques possibles : démo, ou emails vers n'importe qui. */
  registrationsCanOpen: boolean;
  setup: PlatformSetup;
  registrationsOpen: boolean;
  me: { email: string; twoFaEnabled: boolean };
  company: CompanyInfo | null;
  orders: OrderRules;
  money: { tiers: CommissionTierSetting[]; tva: TvaSetting };
  payments: PaymentMethodsSetting | null;
  zone: PilotZone | null;
  categories: { name: string; used: boolean }[];
  team: StaffSummary[];
};

export function setupProgress(setup: PlatformSetup): { done: number; total: number } {
  const total = SETUP_STEPS.length;
  if (setup.demo || setup.completedAt) return { done: total, total };
  const done = SETUP_STEPS.filter((s) => setup.steps?.[s.key]).length;
  return { done, total };
}

/** Quartiers proposés pour Dakar (zone pilote), modifiables dans l'assistant. */
export const DAKAR_ZONES = [
  "Plateau",
  "Médina",
  "Fann – Point E – Amitié",
  "Mermoz – Sacré-Cœur",
  "Ouakam",
  "Ngor",
  "Almadies",
  "Yoff",
  "Grand Yoff",
  "Parcelles Assainies",
  "HLM",
  "Pikine",
  "Guédiawaye",
  "Keur Massar",
  "Rufisque",
];
