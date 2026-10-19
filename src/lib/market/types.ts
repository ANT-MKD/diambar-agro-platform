import type { Maintenance } from "@/lib/platform/params";
import type { CommissionTierSetting } from "@/lib/platform/setup-model";
import type {
  AppNotification,
  Conversation,
  DriverConversation,
  DriverWallet,
  Transaction,
  Withdrawal,
  Mission,
  Order,
  PaymentMethod,
  Product,
  RecurringOrder,
  RestaurantOrder,
  Role,
} from "@/data/mocks";
import type { InvoiceView } from "./documents-view";
import type { CreditNote, Dispute } from "@/data/disputes";
import type { SupportTicket } from "@/data/support";
import type { Incident, ReturnRequest, Review } from "@/data/business";
import type { ModerationItem } from "@/data/admin-mocks";
import type { ChangeRequestView, DocRenewalView, DriverFleetView } from "./fleet-view";
import type { AdminPayment, AdminPayout, AdminRefund, MerchantNumbers } from "./payment-view";
import type { DeliveryHours, DriverPay } from "@/lib/platform-rules";

// Données de la place de marché envoyées par le serveur (mode base de
// données), dans la forme qu'utilisent déjà les écrans : produits, commandes
// côté producteur et côté restaurant, missions. Chaque compte ne reçoit que
// ce qui le concerne.

export type DirectoryFarmer = {
  id: string;
  name: string;
  city: string;
  farm: string;
  phone: string;
  avatar: string;
  rating: number;
  products: number;
  verified: boolean;
};

export type DirectoryRestaurant = {
  id: string;
  name: string;
  city: string;
  type: string;
  phone: string;
  avatar: string;
};

export type DirectoryDriver = {
  id: string;
  name: string;
  vehicle: string;
  rating: number;
  missions: number;
  phone: string;
  avatar: string;
};

export type MarketZone = {
  id: string;
  name: string;
  baseFee: number;
  perKm: number;
  active: boolean;
};

/** Compte connecté, tel qu'enregistré : remplace les profils de démonstration. */
/** Préférences personnelles enregistrées avec le compte. */
export type UserPreferences = {
  /** Types de notifications coupés (« order », « stock »). */
  mutedNotifications: string[];
  newsletter: boolean;
  /** Numéros qui reçoivent les retraits (9 chiffres), et le moyen préféré. */
  payout: { wave: string; orangeMoney: string; primary: "wave" | "orange_money" };
};

export type ReceptionHoursSetting = Record<string, { open: boolean; from: string; to: string }>;

// --- Modifications du profil (Paramètres) ---

export type AccountPatch = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  city?: string;
};

export type PreferencesPatch = {
  mutedNotifications?: string[];
  newsletter?: boolean;
  payout?: { wave?: string; orangeMoney?: string; primary?: "wave" | "orange_money" };
};

export type RestaurantPatch = {
  name?: string;
  cuisine?: string;
  description?: string;
  contactName?: string;
  capacity?: number | null;
  address?: string;
  ninea?: string;
  billingEmail?: string;
  receptionHours?: ReceptionHoursSetting;
};

export type FarmPatch = {
  name?: string;
  address?: string;
  areaHa?: number | null;
  certification?: "none" | "bio" | "raisonnee" | "globalgap";
  productionTypes?: string[];
  description?: string;
  lang?: "fr" | "wo";
};

export type MarketAccount = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  createdAt: string;
  /** Photo de profil (adresse publique), vide sans photo. */
  avatarUrl: string;
  preferences: UserPreferences;
  /** Producteur : exploitation. */
  farm?: {
    name: string;
    address: string;
    city: string;
    areaHa: number | null;
    certification: "none" | "bio" | "raisonnee" | "globalgap";
    productionTypes: string[];
    description: string;
    lang: "fr" | "wo";
  };
  /** Livreur : véhicule enregistré et adresse. */
  vehicle?: { type: string; capacityKg: number; plate: string };
  driver?: { address: string };
  /** Restaurant : facturation et fiche de l'établissement. */
  billing?: { ninea: string; email: string };
  restaurant?: {
    name: string;
    cuisine: string;
    description: string;
    contactName: string;
    capacity: number | null;
    address: string;
    receptionHours: ReceptionHoursSetting | null;
    paymentTermsDays: number;
  };
};

/** Catégorie de produits : officielle, ou proposée par un producteur. */
export type MarketCategory = {
  id: string;
  name: string;
  status: "approved" | "proposed";
  productCount: number;
  /** Catégorie proposée : exploitation qui l'a créée, et quand. */
  proposedBy?: string;
  proposedAt?: string;
};

/** Unité de vente utilisée par des produits. */
export type MarketUnit = { name: string; productCount: number };

export type MarketSnapshot = {
  me: { id: string; role: Role };
  account: MarketAccount;
  /** Catégories de produits (liste de l'équipe et propositions des producteurs). */
  categories: MarketCategory[];
  /** Unités de vente utilisées par les produits. */
  units: MarketUnit[];
  /** Restaurant : ses commandes récurrentes (vide pour les autres rôles). */
  recurringOrders: RecurringOrder[];
  /** Litiges de la personne (tous pour l'équipe). */
  disputes: Dispute[];
  /** Équipe : membres à qui confier un litige. */
  disputeStaff: { id: string; name: string }[];
  /** Avoirs du restaurant (tous pour l'équipe). */
  creditNotes: CreditNote[];
  /** Messagerie : fils restaurant ↔ producteur, et livreur ↔ restaurant. */
  conversations: Conversation[];
  driverConversations: DriverConversation[];
  /** Demandes d'aide (toutes pour l'équipe support). */
  supportTickets: SupportTicket[];
  /** Avis après livraison (notes de tous, détail des siens ; tout pour l'équipe). */
  reviews: Review[];
  /** Retours produit du restaurant ou du producteur (tous pour l'équipe retours). */
  returns: ReturnRequest[];
  /** Incidents de course du livreur (tous pour l'équipe). */
  incidents: Incident[];
  /** Équipe : produits signalés. */
  moderation: ModerationItem[];
  /** Livreur : véhicule, problèmes, entretiens, documents, disponibilité. */
  fleet: DriverFleetView | null;
  /** Restaurant : fournisseurs, produits favoris et budget d'achat. */
  book: {
    suppliers: import("@/data/mocks").Supplier[];
    favorites: string[];
    budget: import("@/data/budget").BudgetState | null;
  } | null;
  /** Membre d'équipe connecté (rôle et droits), ou null pour le titulaire. */
  team: import("./team").TeamSession | null;
  /** Titulaire : membres de son équipe et leurs dernières actions. */
  teamMembers: import("./team").TeamMemberView[];
  teamActivity: import("./team").TeamActivity[];
  /** Équipe : documents et changements de véhicule à vérifier. */
  fleetQueue: { renewals: DocRenewalView[]; changeRequests: ChangeRequestView[] };
  products: Product[];
  orders: Order[];
  restaurantOrders: RestaurantOrder[];
  missions: Mission[];
  directory: {
    farmers: DirectoryFarmer[];
    restaurants: DirectoryRestaurant[];
    drivers: DirectoryDriver[];
  };
  /** Zones livrées et leurs frais (réglés par l'admin). */
  zones: MarketZone[];
  rules: {
    cutoffHour: number;
    minOrderPerProducer: number;
    receptionWindowHours: number;
    paymentDeadlineHour: number;
    /** Plus petit retrait possible. */
    minPayout: number;
    /** Heures de livraison possibles (heure de Dakar). */
    deliveryHours: DeliveryHours;
    /** Paie des livreurs, commission et choix du véhicule. */
    driverPay: DriverPay;
    /** Villes ouvertes par l'admin. */
    cities: string[];
    /** Moyens de paiement ouverts par l'admin. */
    paymentMethods: PaymentMethod[];
    /** Numéros marchands où payer (restaurant et admin seulement). */
    merchant: MerchantNumbers | null;
  };
  /** Admin : paiements des commandes chargées (à vérifier, espèces, historique). */
  payments?: AdminPayment[];
  /** Producteur : ventes créditées, retraits, solde (grand livre). */
  wallet?: {
    transactions: Transaction[];
    withdrawals: Withdrawal[];
    balance: number;
    available: number;
  };
  /** Mode maintenance réglé par l'administration (les portails l'affichent). */
  maintenance?: Maintenance;
  /** Barème de commissions des producteurs (admin, producteur). */
  commissionTiers?: CommissionTierSetting[];
  /** Admin : revenus de tous les producteurs (vente, commission), pour la finance. */
  platformTransactions?: Transaction[];
  /** Livreur : gains et retraits (grand livre). */
  driverWallet?: DriverWallet;
  /** Admin : ce que Diambar doit à chaque producteur et livreur. */
  accounts?: AdminAccount[];
  /** Admin : retraits demandés et récents. */
  payouts?: AdminPayout[];
  /** Admin : remboursements des commandes chargées. */
  refunds?: AdminRefund[];
  /** Restaurant (et admin) : factures émises. */
  invoices?: InvoiceView[];
  /** Établissement du restaurant connecté (adresse de livraison par défaut). */
  restaurant: { name: string; address: string; city: string } | null;
  notifications: AppNotification[];
  generatedAt: string;
};

export type ActionResult = { ok: true } | { ok: false; message: string };

/** Solde d'un producteur ou d'un livreur, vu par l'admin. */
export type AdminAccount = {
  userId: string;
  role: "farmer" | "driver";
  name: string;
  phone: string;
  /** Somme des écritures (versements payés déduits). */
  balance: number;
  /** Retraits demandés, pas encore payés. */
  reserved: number;
  /** Livreur : espèces encaissées, pas encore remises à Diambar. */
  cashHeld: number;
  available: number;
};
