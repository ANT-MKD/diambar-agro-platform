import type {
  AppNotification,
  Mission,
  Order,
  PaymentMethod,
  Product,
  RestaurantOrder,
  Role,
} from "@/data/mocks";
import type { AdminPayment, MerchantNumbers } from "./payment-view";

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

export type MarketSnapshot = {
  me: { id: string; role: Role };
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
  /** Établissement du restaurant connecté (adresse de livraison par défaut). */
  restaurant: { name: string; address: string; city: string } | null;
  notifications: AppNotification[];
  generatedAt: string;
};

export type ActionResult = { ok: true } | { ok: false; message: string };
