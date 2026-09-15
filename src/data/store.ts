import { useSyncExternalStore } from "react";
import {
  products as seedProducts,
  orders as seedOrders,
  stockMovements as seedMovements,
  withdrawals as seedWithdrawals,
  restaurantOrders as seedRestaurantOrders,
  suppliers as seedSuppliers,
  notifications as seedFarmerNotifs,
  restaurantNotifications as seedRestoNotifs,
  conversations as seedConversations,
  recurringOrders as seedRecurring,
  missions as seedMissions,
  driverNotifications as seedDriverNotifs,
  driverConversations as seedDriverConvos,
  driverWallet as seedDriverWallet,
  driverVehicle as seedDriverVehicle,
  driverSettings as seedDriverSettings,
  wallets as seedWallets,
  farmerProfile as seedFarmerProfile,
  farmerFarm as seedFarmerFarm,
  paymentPrefs as seedPaymentPrefs,
  teamMembers as seedTeamMembers,
  restaurantBudget as seedRestaurantBudget,
  productReviews as seedProductReviews,
  restaurantProfile as seedRestaurantProfile,
  farmers,
  restaurants,
  type Wallet,
  type FarmerProfile,
  type FarmerFarm,
  type PaymentPrefs,
  type TeamMember,
  type RestaurantBudget,
  type ProductReview,
  type RestaurantProfile,
  type Product,
  type Order,
  type OrderStatus,
  type StockMovement,
  type Withdrawal,
  type PaymentMethod,
  type RestaurantOrder,
  type Supplier,
  type AppNotification,
  type Conversation,
  type ChatAttachment,
  type RecurringOrder,
  type Mission,
  type MissionProofPhoto,
  type MissionStatus,
  type DriverWallet,
  type DriverTx,
  type PaymentMethod as PayMethod,
  type DriverVehicle,
  type VehicleIssue,
  type DriverSettings,
  type DriverPaymentMethod,
} from "./mocks";
import { formatFCFA } from "@/lib/format";
import { cityCoords } from "@/lib/tracking/geo";
import { haversineKm } from "@/lib/tracking/geo-math";

type Listener = () => void;

function createStore<T>(initial: T, persistKey?: string) {
  let state = initial;
  if (persistKey && typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(persistKey);
      if (raw) state = JSON.parse(raw) as T;
    } catch {
      /* ignore */
    }
  }
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    set: (next: T | ((prev: T) => T)) => {
      state = typeof next === "function" ? (next as (p: T) => T)(state) : next;
      if (persistKey && typeof window !== "undefined") {
        try {
          window.localStorage.setItem(persistKey, JSON.stringify(state));
        } catch {
          /* ignore */
        }
      }
      listeners.forEach((l) => l());
    },
    subscribe: (l: Listener) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

const productsStore = createStore<Product[]>(seedProducts, "diambar:products");
const ordersStore = createStore<Order[]>(seedOrders);
const movementsStore = createStore<StockMovement[]>(seedMovements, "diambar:movements");
const withdrawalsStore = createStore<Withdrawal[]>(seedWithdrawals, "diambar:withdrawals");
const restaurantOrdersStore = createStore<RestaurantOrder[]>(seedRestaurantOrders);
const suppliersStore = createStore<Supplier[]>(seedSuppliers, "diambar:suppliers");
const farmerNotifsStore = createStore<AppNotification[]>(seedFarmerNotifs);
const restoNotifsStore = createStore<AppNotification[]>(seedRestoNotifs);
const driverNotifsStore = createStore<AppNotification[]>(seedDriverNotifs);
const missionsStore = createStore<Mission[]>(seedMissions, "diambar:missions");
const driverConvosStore = createStore<Conversation[]>(seedDriverConvos, "diambar:driver-convos");
const driverOnlineStore = createStore<boolean>(true, "diambar:driver-online");
const driverWalletStore = createStore<DriverWallet>(seedDriverWallet, "diambar:driver-wallet");
const driverVehicleStore = createStore<DriverVehicle>(seedDriverVehicle, "diambar:driver-vehicle");
const vehicleIssuesStore = createStore<VehicleIssue[]>([], "diambar:driver-vehicle-issues");
const driverSettingsStore = createStore<DriverSettings>(
  seedDriverSettings,
  "diambar:driver-settings",
);
const walletsStore = createStore<Wallet[]>(seedWallets, "diambar:wallets");
const farmerProfileStore = createStore<FarmerProfile>(seedFarmerProfile, "diambar:farmer-profile");
const farmerFarmStore = createStore<FarmerFarm>(seedFarmerFarm, "diambar:farmer-farm");
const paymentPrefsStore = createStore<PaymentPrefs>(seedPaymentPrefs, "diambar:payment-prefs");
const teamStore = createStore<TeamMember[]>(seedTeamMembers, "diambar:team");
const restaurantBudgetStore = createStore<RestaurantBudget>(
  seedRestaurantBudget,
  "diambar:restaurant-budget",
);
const productReviewsStore = createStore<ProductReview[]>(
  seedProductReviews,
  "diambar:product-reviews",
);
const restaurantProfileStore = createStore<RestaurantProfile>(
  seedRestaurantProfile,
  "diambar:restaurant-profile",
);

export type CartLine = { productId: string; qty: number };
const cartStore = createStore<CartLine[]>([], "diambar:cart");

const wishlistStore = createStore<string[]>([], "diambar:wishlist");
const conversationsStore = createStore<Conversation[]>(seedConversations, "diambar:conversations");
const recurringStore = createStore<RecurringOrder[]>(seedRecurring, "diambar:recurring");
const onboardingStore = createStore<Record<string, boolean>>({}, "diambar:onboarding");

export function useProducts() {
  return useSyncExternalStore(productsStore.subscribe, productsStore.get, productsStore.get);
}
export function useProduct(id: string) {
  return useProducts().find((p) => p.id === id) ?? null;
}
export function useOrders() {
  return useSyncExternalStore(ordersStore.subscribe, ordersStore.get, ordersStore.get);
}
export function useOrder(id: string) {
  return useOrders().find((o) => o.id === id) ?? null;
}

export function useMovements() {
  return useSyncExternalStore(movementsStore.subscribe, movementsStore.get, movementsStore.get);
}
export function useWithdrawals() {
  return useSyncExternalStore(
    withdrawalsStore.subscribe,
    withdrawalsStore.get,
    withdrawalsStore.get,
  );
}
export function useCart() {
  return useSyncExternalStore(cartStore.subscribe, cartStore.get, cartStore.get);
}

export function useWishlist() {
  return useSyncExternalStore(wishlistStore.subscribe, wishlistStore.get, wishlistStore.get);
}
export function useConversations() {
  return useSyncExternalStore(
    conversationsStore.subscribe,
    conversationsStore.get,
    conversationsStore.get,
  );
}
export function useConversation(id: string) {
  return useConversations().find((c) => c.id === id) ?? null;
}
export function useRecurring() {
  return useSyncExternalStore(recurringStore.subscribe, recurringStore.get, recurringStore.get);
}
export function useOnboarding() {
  return useSyncExternalStore(onboardingStore.subscribe, onboardingStore.get, onboardingStore.get);
}

export function useRestaurantOrders() {
  return useSyncExternalStore(
    restaurantOrdersStore.subscribe,
    restaurantOrdersStore.get,
    restaurantOrdersStore.get,
  );
}
export function useRestaurantOrder(id: string) {
  return useRestaurantOrders().find((o) => o.id === id) ?? null;
}

export function useSuppliers() {
  return useSyncExternalStore(suppliersStore.subscribe, suppliersStore.get, suppliersStore.get);
}
export function useSupplier(id: string) {
  return useSuppliers().find((s) => s.id === id) ?? null;
}

export function useFarmerNotifications() {
  return useSyncExternalStore(
    farmerNotifsStore.subscribe,
    farmerNotifsStore.get,
    farmerNotifsStore.get,
  );
}
export function useRestaurantNotifications() {
  return useSyncExternalStore(
    restoNotifsStore.subscribe,
    restoNotifsStore.get,
    restoNotifsStore.get,
  );
}
export function useDriverNotifications() {
  return useSyncExternalStore(
    driverNotifsStore.subscribe,
    driverNotifsStore.get,
    driverNotifsStore.get,
  );
}
export function useMissions() {
  return useSyncExternalStore(missionsStore.subscribe, missionsStore.get, missionsStore.get);
}
export function useMission(id: string) {
  return useMissions().find((m) => m.id === id) ?? null;
}
export function getMissionSnapshot(id: string) {
  return missionsStore.get().find((m) => m.id === id) ?? null;
}
export function useDriverConversations() {
  return useSyncExternalStore(
    driverConvosStore.subscribe,
    driverConvosStore.get,
    driverConvosStore.get,
  );
}
export function useDriverConversation(id: string) {
  return useDriverConversations().find((c) => c.id === id) ?? null;
}
export function useDriverOnline() {
  return useSyncExternalStore(
    driverOnlineStore.subscribe,
    driverOnlineStore.get,
    driverOnlineStore.get,
  );
}
export function useDriverWallet() {
  return useSyncExternalStore(
    driverWalletStore.subscribe,
    driverWalletStore.get,
    driverWalletStore.get,
  );
}

export const driverWalletActions = {
  withdraw: (amount: number, method: PayMethod) => {
    const tx: DriverTx = {
      id: `dtx_${Date.now()}`,
      at: new Date().toISOString(),
      label: `Retrait ${method}`,
      kind: "withdrawal",
      amount: -Math.abs(amount),
      method,
      status: "En attente",
    };
    driverWalletStore.set((w) => ({
      ...w,
      balance: Math.max(0, w.balance - Math.abs(amount)),
      pending: w.pending + Math.abs(amount),
      transactions: [tx, ...w.transactions],
    }));
    return tx.id;
  },
  credit: (label: string, amount: number, kind: DriverTx["kind"] = "mission") => {
    driverWalletStore.set((w) => ({
      ...w,
      balance: w.balance + amount,
      transactions: [
        {
          id: `dtx_${Date.now()}`,
          at: new Date().toISOString(),
          label,
          kind,
          amount,
          status: "Complété",
        },
        ...w.transactions,
      ],
    }));
  },
  reset: () => driverWalletStore.set(seedDriverWallet),
};

export function useDriverVehicle() {
  return useSyncExternalStore(
    driverVehicleStore.subscribe,
    driverVehicleStore.get,
    driverVehicleStore.get,
  );
}

export function useVehicleIssues() {
  return useSyncExternalStore(
    vehicleIssuesStore.subscribe,
    vehicleIssuesStore.get,
    vehicleIssuesStore.get,
  );
}

export const vehicleActions = {
  update: (patch: Partial<DriverVehicle>) => driverVehicleStore.set((v) => ({ ...v, ...patch })),
  setPhoto: (dataUrl: string) => driverVehicleStore.set((v) => ({ ...v, photo: dataUrl })),
  scheduleMaintenance: (date: string) =>
    driverVehicleStore.set((v) => ({ ...v, nextMaintenanceAt: date })),
  reportIssue: (description: string) => {
    const issue: VehicleIssue = {
      id: `vi_${Date.now()}`,
      description,
      at: new Date().toISOString(),
      status: "reported",
    };
    vehicleIssuesStore.set((arr) => [issue, ...arr]);
    return issue.id;
  },
};

export function useDriverSettings() {
  return useSyncExternalStore(
    driverSettingsStore.subscribe,
    driverSettingsStore.get,
    driverSettingsStore.get,
  );
}

export const driverSettingsActions = {
  updateProfile: (patch: Partial<DriverSettings["profile"]>) =>
    driverSettingsStore.set((s) => ({ ...s, profile: { ...s.profile, ...patch } })),
  setWorkPrefs: (patch: { radius?: number; autoAccept?: boolean }) =>
    driverSettingsStore.set((s) => ({ ...s, ...patch })),
  setNotif: (patch: Partial<DriverSettings["notif"]>) =>
    driverSettingsStore.set((s) => ({ ...s, notif: { ...s.notif, ...patch } })),
  setPayoutFrequency: (frequency: DriverSettings["payoutFrequency"]) =>
    driverSettingsStore.set((s) => ({ ...s, payoutFrequency: frequency })),
  addPaymentMethod: (method: DriverPaymentMethod["method"], label: string) => {
    const id = `pm_${Date.now()}`;
    driverSettingsStore.set((s) => ({
      ...s,
      paymentMethods: [
        ...s.paymentMethods.map((m) => ({ ...m, active: false })),
        { id, method, label, active: true },
      ],
    }));
    return id;
  },
  setActivePaymentMethod: (id: string) =>
    driverSettingsStore.set((s) => ({
      ...s,
      paymentMethods: s.paymentMethods.map((m) => ({ ...m, active: m.id === id })),
    })),
};

export function useWallets() {
  return useSyncExternalStore(walletsStore.subscribe, walletsStore.get, walletsStore.get);
}

export const walletActions = {
  setPhone: (method: PaymentMethod, phone: string) =>
    walletsStore.set((arr) => arr.map((w) => (w.method === method ? { ...w, phone } : w))),
};

export function useFarmerProfile() {
  return useSyncExternalStore(
    farmerProfileStore.subscribe,
    farmerProfileStore.get,
    farmerProfileStore.get,
  );
}

export const farmerProfileActions = {
  update: (patch: Partial<FarmerProfile>) => farmerProfileStore.set((s) => ({ ...s, ...patch })),
};

export function useFarmerFarm() {
  return useSyncExternalStore(farmerFarmStore.subscribe, farmerFarmStore.get, farmerFarmStore.get);
}

export const farmerFarmActions = {
  update: (patch: Partial<FarmerFarm>) => farmerFarmStore.set((s) => ({ ...s, ...patch })),
};

export function usePaymentPrefs() {
  return useSyncExternalStore(
    paymentPrefsStore.subscribe,
    paymentPrefsStore.get,
    paymentPrefsStore.get,
  );
}

export const paymentPrefsActions = {
  setPrimary: (primary: PaymentMethod) => paymentPrefsStore.set((s) => ({ ...s, primary })),
  setThreshold: (withdrawThreshold: number) =>
    paymentPrefsStore.set((s) => ({ ...s, withdrawThreshold })),
};

export function useTeam() {
  return useSyncExternalStore(teamStore.subscribe, teamStore.get, teamStore.get);
}

export const teamActions = {
  invite: (email: string, role: TeamMember["role"]) => {
    const id = `t_${Date.now()}`;
    teamStore.set((arr) => [...arr, { id, name: "—", email, role, status: "invited" }]);
    return id;
  },
  setRole: (id: string, role: TeamMember["role"]) =>
    teamStore.set((arr) => arr.map((m) => (m.id === id ? { ...m, role } : m))),
  remove: (id: string) => teamStore.set((arr) => arr.filter((m) => m.id !== id)),
};

export function useRestaurantBudget() {
  return useSyncExternalStore(
    restaurantBudgetStore.subscribe,
    restaurantBudgetStore.get,
    restaurantBudgetStore.get,
  );
}

export const restaurantBudgetActions = {
  setMonthly: (monthly: number) => restaurantBudgetStore.set({ monthly }),
};

export function useProductReviews(productId: string) {
  const all = useSyncExternalStore(
    productReviewsStore.subscribe,
    productReviewsStore.get,
    productReviewsStore.get,
  );
  return all.filter((r) => r.productId === productId);
}

export const productReviewActions = {
  add: (input: { productId: string; restaurantName: string; rating: number; text: string }) => {
    const review: ProductReview = {
      ...input,
      id: `rv_${Date.now()}`,
      at: new Date().toISOString(),
    };
    productReviewsStore.set((arr) => [review, ...arr]);
  },
};

export function useRestaurantProfile() {
  return useSyncExternalStore(
    restaurantProfileStore.subscribe,
    restaurantProfileStore.get,
    restaurantProfileStore.get,
  );
}

export const restaurantProfileActions = {
  update: (patch: Partial<RestaurantProfile>) =>
    restaurantProfileStore.set((s) => ({ ...s, ...patch })),
};

function makeNotifActions(store: ReturnType<typeof createStore<AppNotification[]>>) {
  return {
    markRead: (id: string) =>
      store.set((arr) => arr.map((n) => (n.id === id ? { ...n, read: true } : n))),
    markAllRead: () => store.set((arr) => arr.map((n) => ({ ...n, read: true }))),
    markUnread: (id: string) =>
      store.set((arr) => arr.map((n) => (n.id === id ? { ...n, read: false } : n))),
    toggleRead: (id: string) =>
      store.set((arr) => arr.map((n) => (n.id === id ? { ...n, read: !n.read } : n))),
    clearRead: () => store.set((arr) => arr.filter((n) => !n.read)),
    remove: (id: string) => store.set((arr) => arr.filter((n) => n.id !== id)),
    add: (
      n: Omit<AppNotification, "id" | "at" | "read"> & { id?: string; at?: string; read?: boolean },
    ) => {
      const id = n.id ?? `n_${Date.now()}`;
      store.set((arr) => [
        {
          id,
          at: n.at ?? new Date().toISOString(),
          read: n.read ?? false,
          type: n.type,
          title: n.title,
          body: n.body,
        },
        ...arr,
      ]);
      return id;
    },
  };
}

export const farmerNotifActions = makeNotifActions(farmerNotifsStore);
export const restaurantNotifActions = makeNotifActions(restoNotifsStore);
export const driverNotifActions = makeNotifActions(driverNotifsStore);

export const missionActions = {
  setStatus: (id: string, status: MissionStatus) => {
    let updated: Mission | undefined;
    missionsStore.set((arr) =>
      arr.map((m) => {
        if (m.id !== id) return m;
        updated = { ...m, status };
        return updated;
      }),
    );
    if (!updated) return;

    if (status === "loaded") {
      driverNotifActions.add({
        type: "order",
        title: "Marchandise récupérée",
        body: `${updated.reference} · en route vers le restaurant`,
      });
    }
    if (status === "delivered") {
      driverNotifActions.add({
        type: "payment",
        title: "Paiement programmé",
        body: `Wave · +${formatFCFA(updated.payout)} (${updated.reference})`,
      });
      // Ferme la boucle : la commande liée (agriculteur -> restaurant) passe
      // aussi en "livrée", avec ses propres notifications en cascade.
      const order = ordersStore.get().find((o) => o.reference === updated!.orderRef);
      if (order) orderActions.setStatus(order.id, "delivered");
    }
  },
  accept: (id: string, driverId = "d1") => {
    missionsStore.set((arr) =>
      arr.map((m) => (m.id === id ? { ...m, driverId, status: "accepted" } : m)),
    );
    const mission = missionsStore.get().find((m) => m.id === id);
    if (mission) {
      driverNotifActions.add({
        type: "order",
        title: "Mission acceptée",
        body: `${mission.reference} ajoutée à vos missions en cours`,
      });
    }
  },
  cancel: (id: string) => {
    missionsStore.set((arr) => arr.map((m) => (m.id === id ? { ...m, status: "cancelled" } : m)));
  },
  attachProof: (id: string, photos: MissionProofPhoto[]) => {
    missionsStore.set((arr) => arr.map((m) => (m.id === id ? { ...m, proof: photos } : m)));
  },
};

export const driverConversationActions = {
  send: (conversationId: string, text: string, from: "me" | "them" = "me", senderName?: string) => {
    const msg = { id: `m_${Date.now()}`, from, text, at: new Date().toISOString(), senderName };
    driverConvosStore.set((arr) =>
      arr.map((c) =>
        c.id === conversationId
          ? { ...c, messages: [...c.messages, msg], lastMessage: text, lastAt: msg.at }
          : c,
      ),
    );
  },
  markRead: (conversationId: string) => {
    driverConvosStore.set((arr) =>
      arr.map((c) => (c.id === conversationId ? { ...c, unread: 0 } : c)),
    );
  },
};

export const driverOnlineActions = {
  toggle: () => driverOnlineStore.set((v) => !v),
  set: (v: boolean) => driverOnlineStore.set(v),
};

// Un fournisseur du carnet lié à un vrai producteur (farmerId) doit afficher
// ses vraies statistiques de commande, pas des totaux saisis une fois à la
// création et jamais mis à jour. Sans farmerId (fournisseur hors plateforme),
// il n'existe par définition aucune commande réelle à agréger.
export function supplierOrderStats(orders: RestaurantOrder[], farmerId?: string) {
  if (!farmerId) return { totalOrders: 0, totalSpent: 0, lastOrder: "—" };
  const matching = orders.filter((o) => o.farmerId === farmerId);
  if (matching.length === 0) return { totalOrders: 0, totalSpent: 0, lastOrder: "—" };
  const totalOrders = matching.length;
  const totalSpent = matching.reduce((s, o) => s + o.total, 0);
  const lastOrder = matching
    .reduce((latest, o) => (o.createdAt > latest ? o.createdAt : latest), matching[0].createdAt)
    .slice(0, 10);
  return { totalOrders, totalSpent, lastOrder };
}

export const supplierActions = {
  create: (
    s: Omit<Supplier, "id" | "totalOrders" | "totalSpent" | "lastOrder" | "suspended"> & {
      suspended?: boolean;
    },
  ) => {
    const id = `sup_${Date.now()}`;
    const next: Supplier = {
      ...s,
      id,
      suspended: s.suspended ?? false,
      lastOrder: "—",
      totalOrders: 0,
      totalSpent: 0,
    };
    suppliersStore.set((arr) => [next, ...arr]);
    return id;
  },
  update: (id: string, patch: Partial<Supplier>) => {
    suppliersStore.set((arr) => arr.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  },
  toggleSuspend: (id: string) => {
    suppliersStore.set((arr) =>
      arr.map((s) => (s.id === id ? { ...s, suspended: !s.suspended } : s)),
    );
  },
  toggleFavorite: (id: string) => {
    suppliersStore.set((arr) =>
      arr.map((s) => (s.id === id ? { ...s, favorite: !s.favorite } : s)),
    );
  },
  remove: (id: string) => {
    suppliersStore.set((arr) => arr.filter((s) => s.id !== id));
  },
};

function vehicleForWeight(kg: number): Mission["vehicleType"] {
  if (kg > 80) return "Camion";
  if (kg > 30) return "Camionnette";
  return "Moto";
}

/** "Le Baobab, Dakar Plateau" -> "Dakar Plateau" (même règle que la
 * résolution de suivi en direct, pour rester cohérent avec elle). */
function lastAddressSegment(address: string): string {
  const parts = address.split(",");
  return parts[parts.length - 1]?.trim() || address;
}

export const restaurantOrderActions = {
  /** Passe commande auprès d'un agriculteur : crée aussi la commande côté
   * agriculteur (même référence), déduit le stock, notifie l'agriculteur, et
   * ouvre une vraie mission de livraison disponible pour un livreur. Sans ce
   * pont, la commande restait invisible côté producteur et aucun livreur réel
   * ne pouvait jamais être associé à la livraison (le suivi affichait un nom
   * de livreur codé en dur, sans rapport avec une vraie affectation). */
  create: (
    o: Omit<RestaurantOrder, "id" | "reference" | "createdAt" | "status" | "statusHistory">,
  ) => {
    const id = `ro_${Date.now()}`;
    const reference = `CMD-${String(3100 + Math.floor(Math.random() * 899)).padStart(4, "0")}`;
    const createdAt = new Date().toISOString();
    const next: RestaurantOrder = {
      ...o,
      id,
      reference,
      status: "pending",
      createdAt,
      statusHistory: [{ status: "pending", at: createdAt }],
    };
    restaurantOrdersStore.set((arr) => [next, ...arr]);

    orderActions.create({
      reference,
      restaurantId: "r1",
      farmerId: o.farmerId,
      items: o.items.map(({ productId, qty, price }) => ({ productId, qty, price })),
      total: o.total,
      status: "pending",
      createdAt,
    });
    o.items.forEach((line) => productActions.adjustStock(line.productId, -line.qty));
    farmerNotifActions.add({
      type: "order",
      title: "Nouvelle commande",
      body: `${reference} — ${formatFCFA(o.total)}`,
    });

    const farmer = farmers.find((f) => f.id === o.farmerId);
    const restaurant = restaurants.find((r) => r.id === "r1");
    if (farmer) {
      const pickupCoords = cityCoords(farmer.city);
      const dropoffCity = lastAddressSegment(o.deliveryAddress);
      const dropoffCoords = cityCoords(dropoffCity);
      const distanceKm = Math.max(1, Math.round(haversineKm(pickupCoords, dropoffCoords)));
      const estimatedMinutes = Math.max(10, Math.round((distanceKm / 42) * 60));
      const weightKg = o.items.reduce((s, i) => s + i.qty, 0);
      const payout = Math.round((distanceKm * 120) / 50) * 50;
      missionsStore.set((arr) => [
        {
          id: `mi_${Date.now()}`,
          reference: `MIS-${4300 + Math.floor(Math.random() * 699)}`,
          orderRef: reference,
          farmerId: o.farmerId,
          restaurantId: "r1",
          status: "available",
          pickup: {
            address: `${farmer.farm}, ${farmer.city}`,
            city: farmer.city,
            ...pickupCoords,
            contactPhone: farmer.phone,
          },
          dropoff: {
            address: o.deliveryAddress,
            city: dropoffCity,
            ...dropoffCoords,
            contactPhone: restaurant?.phone ?? "",
          },
          distanceKm,
          estimatedMinutes,
          payout,
          weightKg,
          itemsCount: o.items.length,
          scheduledFor: createdAt,
          createdAt,
          vehicleType: vehicleForWeight(weightKg),
          urgency: o.eta?.startsWith("Aujourd'hui") ? "priority" : "standard",
        },
        ...arr,
      ]);
    }

    return id;
  },
  setStatus: (id: string, status: OrderStatus) => {
    let updated: RestaurantOrder | undefined;
    const at = new Date().toISOString();
    restaurantOrdersStore.set((arr) =>
      arr.map((o) => {
        if (o.id !== id) return o;
        updated = { ...o, status, statusHistory: [...o.statusHistory, { status, at }] };
        return updated;
      }),
    );
    if (!updated) return;

    // Répercute côté agriculteur sans repasser par orderActions.setStatus
    // (qui propagerait dans l'autre sens et boucler à l'infini).
    ordersStore.set((arr) =>
      arr.map((o) => (o.reference === updated!.reference ? { ...o, status } : o)),
    );
    if (status === "cancelled") {
      farmerNotifActions.add({
        type: "order",
        title: "Commande annulée",
        body: `${updated.reference} a été annulée par le restaurant`,
      });
    }
  },
};

function recomputeStatus(p: Product): Product {
  if (p.status === "draft") return p;
  const status: Product["status"] = p.stock === 0 ? "out" : p.stock < p.minStock ? "low" : "active";
  return { ...p, status };
}

export const productActions = {
  create: (p: Omit<Product, "id">) => {
    const id = `p${Date.now()}`;
    productsStore.set((arr) => [recomputeStatus({ ...p, id }), ...arr]);
    return id;
  },
  update: (id: string, patch: Partial<Product>) => {
    productsStore.set((arr) =>
      arr.map((p) => (p.id === id ? recomputeStatus({ ...p, ...patch }) : p)),
    );
  },
  remove: (id: string) => {
    productsStore.set((arr) => arr.filter((p) => p.id !== id));
  },
  adjustStock: (id: string, delta: number, _reason?: string) => {
    productsStore.set((arr) =>
      arr.map((p) =>
        p.id === id ? recomputeStatus({ ...p, stock: Math.max(0, p.stock + delta) }) : p,
      ),
    );
  },
  setStock: (id: string, stock: number) => {
    productsStore.set((arr) =>
      arr.map((p) => (p.id === id ? recomputeStatus({ ...p, stock: Math.max(0, stock) }) : p)),
    );
  },
};

const RESTAURANT_STATUS_NOTIF: Partial<
  Record<OrderStatus, { title: string; body: (ref: string) => string }>
> = {
  confirmed: {
    title: "Commande confirmée",
    body: (ref) => `${ref} est confirmée par le producteur`,
  },
  delivering: { title: "Livraison en route", body: (ref) => `${ref} est en cours de livraison` },
  delivered: { title: "Commande livrée", body: (ref) => `${ref} a été livrée` },
  cancelled: { title: "Commande annulée", body: (ref) => `${ref} a été annulée par le producteur` },
};

export const orderActions = {
  setStatus: (id: string, status: OrderStatus, note?: string) => {
    let updated: Order | undefined;
    ordersStore.set((arr) =>
      arr.map((o) => {
        if (o.id !== id) return o;
        updated = { ...o, status };
        return updated;
      }),
    );
    if (!updated) return;

    // Répercute côté restaurant sans repasser par restaurantOrderActions.setStatus.
    const at = new Date().toISOString();
    restaurantOrdersStore.set((arr) =>
      arr.map((o) =>
        o.reference === updated!.reference
          ? { ...o, status, statusHistory: [...o.statusHistory, { status, at }] }
          : o,
      ),
    );
    const notif = RESTAURANT_STATUS_NOTIF[status];
    if (notif) {
      restaurantNotifActions.add({
        type: "order",
        title: notif.title,
        body: note ? `${notif.body(updated.reference)} — ${note}` : notif.body(updated.reference),
      });
    }
  },
  create: (o: Omit<Order, "id">) => {
    const id = `o${Date.now()}`;
    ordersStore.set((arr) => [{ ...o, id }, ...arr]);
    return id;
  },
};

export const movementActions = {
  create: (m: Omit<StockMovement, "id" | "at"> & { at?: string }) => {
    const id = `sm${Date.now()}`;
    const at = m.at ?? new Date().toISOString();
    movementsStore.set((arr) => [{ ...m, id, at }, ...arr]);
    const delta = m.type === "in" ? m.qty : m.type === "out" ? -m.qty : 0;
    if (m.type === "adjust") {
      productActions.setStock(m.productId, m.qty);
    } else if (delta !== 0) {
      productActions.adjustStock(m.productId, delta, m.reason);
    }
    return id;
  },
};

export const withdrawalActions = {
  create: (w: { method: PaymentMethod; amount: number }) => {
    const id = `wd${Date.now()}`;
    const fee = Math.round(w.amount * 0.005);
    withdrawalsStore.set((arr) => [
      {
        id,
        date: new Date().toISOString().slice(0, 10),
        method: w.method,
        amount: w.amount,
        fee,
        status: "En cours",
        reference: `WD-${id.slice(-4).toUpperCase()}`,
      },
      ...arr,
    ]);
    return id;
  },
};

function stockOf(productId: string) {
  return productsStore.get().find((p) => p.id === productId)?.stock ?? Infinity;
}

export const cartActions = {
  // Retourne la quantité réellement appliquée (peut être plafonnée au stock
  // réel du producteur), pour que l'UI puisse prévenir l'utilisateur.
  add: (productId: string, qty = 1) => {
    const max = stockOf(productId);
    let applied = 0;
    cartStore.set((arr) => {
      const existing = arr.find((l) => l.productId === productId);
      const nextQty = Math.min(max, (existing?.qty ?? 0) + qty);
      applied = nextQty;
      if (existing) return arr.map((l) => (l.productId === productId ? { ...l, qty: nextQty } : l));
      return [...arr, { productId, qty: nextQty }];
    });
    return applied;
  },
  setQty: (productId: string, qty: number) => {
    const max = stockOf(productId);
    const capped = Math.min(qty, max);
    cartStore.set((arr) =>
      capped <= 0
        ? arr.filter((l) => l.productId !== productId)
        : arr.map((l) => (l.productId === productId ? { ...l, qty: capped } : l)),
    );
    return capped;
  },
  remove: (productId: string) => {
    cartStore.set((arr) => arr.filter((l) => l.productId !== productId));
  },
  clear: () => cartStore.set([]),
};

export const wishlistActions = {
  toggle: (productId: string) => {
    wishlistStore.set((arr) =>
      arr.includes(productId) ? arr.filter((x) => x !== productId) : [...arr, productId],
    );
  },
  remove: (productId: string) => wishlistStore.set((arr) => arr.filter((x) => x !== productId)),
  clear: () => wishlistStore.set([]),
};

export const conversationActions = {
  send: (
    conversationId: string,
    text: string,
    from: "me" | "them" = "me",
    senderName?: string,
    attachment?: ChatAttachment,
  ) => {
    const msg = {
      id: `m_${Date.now()}`,
      from,
      text,
      at: new Date().toISOString(),
      senderName,
      attachment,
    };
    conversationsStore.set((arr) =>
      arr.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              messages: [...c.messages, msg],
              lastMessage: text || attachment?.name || "Pièce jointe",
              lastAt: msg.at,
            }
          : c,
      ),
    );
  },
  markRead: (conversationId: string) => {
    conversationsStore.set((arr) =>
      arr.map((c) => (c.id === conversationId ? { ...c, unread: 0 } : c)),
    );
  },
};

export const recurringActions = {
  toggle: (id: string) =>
    recurringStore.set((arr) => arr.map((r) => (r.id === id ? { ...r, active: !r.active } : r))),
  skipNext: (id: string) =>
    recurringStore.set((arr) =>
      arr.map((r) => {
        if (r.id !== id) return r;
        const d = new Date(r.nextDelivery === "—" ? Date.now() : r.nextDelivery);
        const days = r.frequency === "weekly" ? 7 : r.frequency === "biweekly" ? 14 : 30;
        d.setDate(d.getDate() + days);
        return { ...r, nextDelivery: d.toISOString().slice(0, 10) };
      }),
    ),
  remove: (id: string) => recurringStore.set((arr) => arr.filter((r) => r.id !== id)),
};

export const onboardingActions = {
  toggle: (key: string) => onboardingStore.set((m) => ({ ...m, [key]: !m[key] })),
  set: (key: string, done: boolean) => onboardingStore.set((m) => ({ ...m, [key]: done })),
  dismiss: (key: string) => onboardingStore.set((m) => ({ ...m, [`__dismiss_${key}`]: true })),
};
