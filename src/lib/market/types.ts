import type {
  AppNotification,
  DriverWallet,
  Transaction,
  Withdrawal,
  Mission,
  Order,
  PaymentMethod,
  Product,
  RestaurantOrder,
  Role,
} from "@/data/mocks";
import type { InvoiceView } from "./documents-view";
import type { AdminPayment, AdminPayout, AdminRefund, MerchantNumbers } from "./payment-view";

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
export type MarketAccount = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  createdAt: string;
  /** Producteur : exploitation déclarée à l'inscription. */
  farm?: { name: string; address: string; city: string; areaHa: number | null };
  /** Livreur : véhicule enregistré. */
  vehicle?: { type: string; capacityKg: number; plate: string };
  /** Restaurant : informations de facturation. */
  billing?: { ninea: string; email: string };
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

export type MarketSnapshot = {
  me: { id: string; role: Role };
  account: MarketAccount;
  /** Catégories de produits (liste de l'équipe et propositions des producteurs). */
  categories: MarketCategory[];
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
