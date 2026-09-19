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
  vehicleMaintenanceHistory as seedMaintenanceHistory,
  vehicleIssues as seedVehicleIssues,
  driverSettings as seedDriverSettings,
  wallets as seedWallets,
  farmerProfile as seedFarmerProfile,
  farmerFarm as seedFarmerFarm,
  paymentPrefs as seedPaymentPrefs,
  teamMembers as seedTeamMembers,
  restaurantTeamMembers as seedRestaurantTeamMembers,
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
  type RestaurantTeamMember,
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
  type DriverConversation,
  type ChatAttachment,
  type RecurringOrder,
  type RecurringOrderItem,
  type RecurringOrderException,
  type RecurringOrderEventKind,
  type RecurringOrderPendingAction,
  type Mission,
  type MissionProofPhoto,
  type MissionStatus,
  type DriverWallet,
  type DriverTx,
  type PaymentMethod as PayMethod,
  type DriverVehicle,
  type VehicleIssue,
  type VehicleIssueType,
  type VehicleIssueSeverity,
  type MaintenanceEntry,
  type VehicleChangeRequest,
  type VehicleChangeReason,
  type MissionProofPhoto as Attachment,
  type DriverSettings,
  type DriverPaymentMethod,
  type WeekDay,
  type WorkingHours,
} from "./mocks";
import { formatFCFA } from "@/lib/format";
import { cityCoords } from "@/lib/tracking/geo";
import { haversineKm } from "@/lib/tracking/geo-math";
import { computeNextOccurrence, applyHolidayShift, itemsSubtotal } from "@/lib/recurring-engine";

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
// Sans persistance, le centre de notifications perdait tout son historique
// (et l'état lu/non lu) au moindre rechargement — un comportement honnête
// nulle part ailleurs dans l'app (messages, litiges, retours, avis sont
// tous persistés).
const farmerNotifsStore = createStore<AppNotification[]>(
  seedFarmerNotifs,
  "diambar:farmer-notifications",
);
const restoNotifsStore = createStore<AppNotification[]>(
  seedRestoNotifs,
  "diambar:restaurant-notifications",
);
const driverNotifsStore = createStore<AppNotification[]>(
  seedDriverNotifs,
  "diambar:driver-notifications",
);
const missionsStore = createStore<Mission[]>(seedMissions, "diambar:missions");
const driverConvosStore = createStore<DriverConversation[]>(
  seedDriverConvos,
  "diambar:driver-convos",
);
const driverOnlineStore = createStore<boolean>(true, "diambar:driver-online");
const driverWalletStore = createStore<DriverWallet>(seedDriverWallet, "diambar:driver-wallet");
const driverVehicleStore = createStore<DriverVehicle>(seedDriverVehicle, "diambar:driver-vehicle");
const vehicleIssuesStore = createStore<VehicleIssue[]>(
  seedVehicleIssues,
  "diambar:driver-vehicle-issues",
);
const maintenanceHistoryStore = createStore<MaintenanceEntry[]>(
  seedMaintenanceHistory,
  "diambar:driver-vehicle-maintenance",
);
const vehicleChangeRequestsStore = createStore<VehicleChangeRequest[]>(
  [],
  "diambar:driver-vehicle-change-requests",
);
const driverSettingsStore = createStore<DriverSettings>(
  seedDriverSettings,
  "diambar:driver-settings",
);
const walletsStore = createStore<Wallet[]>(seedWallets, "diambar:wallets");
const farmerProfileStore = createStore<FarmerProfile>(seedFarmerProfile, "diambar:farmer-profile");
const farmerFarmStore = createStore<FarmerFarm>(seedFarmerFarm, "diambar:farmer-farm");
const paymentPrefsStore = createStore<PaymentPrefs>(seedPaymentPrefs, "diambar:payment-prefs");
const teamStore = createStore<TeamMember[]>(seedTeamMembers, "diambar:team");
const restaurantTeamStore = createStore<RestaurantTeamMember[]>(
  seedRestaurantTeamMembers,
  "diambar:restaurant-team",
);
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
export function useRecurringOrders() {
  return useSyncExternalStore(recurringStore.subscribe, recurringStore.get, recurringStore.get);
}
export function useRecurringOrder(id: string) {
  return useRecurringOrders().find((r) => r.id === id) ?? null;
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
/** Lecture directe (hors React) pour retrouver la vraie référence d'une
 * commande juste après sa création, sans changer la signature historique
 * de restaurantOrderActions.create() utilisée à plusieurs endroits. */
export function getRestaurantOrderById(id: string) {
  return restaurantOrdersStore.get().find((o) => o.id === id) ?? null;
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

const VEHICLE_ISSUE_TO_CONDITION: Partial<
  Record<VehicleIssueType, keyof DriverVehicle["condition"]>
> = {
  tires: "tires",
  brakes: "brakes",
  battery: "battery",
  engine: "oil",
  lights: "lights",
};

export function useMaintenanceHistory() {
  return useSyncExternalStore(
    maintenanceHistoryStore.subscribe,
    maintenanceHistoryStore.get,
    maintenanceHistoryStore.get,
  );
}

export function useVehicleChangeRequests() {
  return useSyncExternalStore(
    vehicleChangeRequestsStore.subscribe,
    vehicleChangeRequestsStore.get,
    vehicleChangeRequestsStore.get,
  );
}

export const vehicleActions = {
  update: (patch: Partial<DriverVehicle>) => driverVehicleStore.set((v) => ({ ...v, ...patch })),
  setPhoto: (dataUrl: string) => driverVehicleStore.set((v) => ({ ...v, photo: dataUrl })),
  setPhotos: (photos: Attachment[]) => driverVehicleStore.set((v) => ({ ...v, photos })),
  updateMileage: (mileageKm: number) => driverVehicleStore.set((v) => ({ ...v, mileageKm })),
  scheduleMaintenance: (date: string) =>
    driverVehicleStore.set((v) => ({ ...v, nextMaintenanceAt: date })),
  logMaintenance: (label: string) => {
    const vehicle = driverVehicleStore.get();
    const entry: MaintenanceEntry = {
      id: `vm_${Date.now()}`,
      label,
      at: new Date().toISOString(),
      mileageKm: vehicle.mileageKm,
      status: "done",
    };
    maintenanceHistoryStore.set((arr) => [entry, ...arr]);
    return entry.id;
  },
  reportIssue: (input: {
    type: VehicleIssueType;
    severity: VehicleIssueSeverity;
    description: string;
    photos?: Attachment[];
  }) => {
    const reference = `INC-VH-${25 + vehicleIssuesStore.get().length}`;
    const issue: VehicleIssue = {
      id: `vi_${Date.now()}`,
      reference,
      type: input.type,
      severity: input.severity,
      description: input.description,
      at: new Date().toISOString(),
      status: "reported",
      photos: input.photos,
    };
    vehicleIssuesStore.set((arr) => [issue, ...arr]);
    // Le point du véhicule concerné passe "à vérifier" tant que l'incident
    // n'est pas résolu — pas de capteur, juste le reflet du signalement.
    const conditionKey = VEHICLE_ISSUE_TO_CONDITION[input.type];
    if (conditionKey) {
      driverVehicleStore.set((v) => ({
        ...v,
        condition: { ...v.condition, [conditionKey]: "check" },
      }));
    }
    return issue;
  },
  resolveIssue: (id: string) => {
    const issue = vehicleIssuesStore.get().find((i) => i.id === id);
    vehicleIssuesStore.set((arr) =>
      arr.map((i) => (i.id === id ? { ...i, status: "resolved" } : i)),
    );
    if (issue) {
      const conditionKey = VEHICLE_ISSUE_TO_CONDITION[issue.type];
      if (conditionKey) {
        driverVehicleStore.set((v) => ({
          ...v,
          condition: { ...v.condition, [conditionKey]: "good" },
        }));
      }
    }
  },
  requestChange: (input: {
    reason: VehicleChangeReason;
    newVehicle: VehicleChangeRequest["newVehicle"];
    docs: Attachment[];
  }) => {
    const reference = `VH-2026-${42 + vehicleChangeRequestsStore.get().length}`;
    const req: VehicleChangeRequest = {
      id: `vcr_${Date.now()}`,
      reference,
      reason: input.reason,
      newVehicle: input.newVehicle,
      docs: input.docs,
      status: "pending",
      submittedAt: new Date().toISOString(),
    };
    vehicleChangeRequestsStore.set((arr) => [req, ...arr]);
    return req;
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
  setCriteria: (patch: Partial<DriverSettings["criteria"]>) =>
    driverSettingsStore.set((s) => ({ ...s, criteria: { ...s.criteria, ...patch } })),
  setWorkingDay: (day: WeekDay, patch: Partial<WorkingHours[WeekDay]>) =>
    driverSettingsStore.set((s) => ({
      ...s,
      workingHours: { ...s.workingHours, [day]: { ...s.workingHours[day], ...patch } },
    })),
  setLocationSharing: (v: boolean) =>
    driverSettingsStore.set((s) => ({ ...s, locationSharing: v })),
};

/** Missions "available" qui correspondent réellement aux critères
 * d'acceptation automatique du livreur (rémunération, poids, type, ville) —
 * aucune notion de distance en temps réel : le livreur n'a pas de position
 * GPS suivie hors mission, donc on ne compare que des critères vérifiables. */
export function autoAcceptableMissions(missions: Mission[], settings: DriverSettings) {
  if (!settings.autoAccept) return [];
  const { minPayout, maxWeightKg, acceptedUrgencies, acceptedCities } = settings.criteria;
  return missions.filter(
    (m) =>
      m.status === "available" &&
      m.payout >= minPayout &&
      m.weightKg <= maxWeightKg &&
      acceptedUrgencies.includes(m.urgency) &&
      (acceptedCities.length === 0 ||
        acceptedCities.includes(m.pickup.city) ||
        acceptedCities.includes(m.dropoff.city)),
  );
}

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

export function useRestaurantTeam() {
  return useSyncExternalStore(
    restaurantTeamStore.subscribe,
    restaurantTeamStore.get,
    restaurantTeamStore.get,
  );
}

export const restaurantTeamActions = {
  invite: (email: string, role: RestaurantTeamMember["role"]) => {
    const id = `rt_${Date.now()}`;
    restaurantTeamStore.set((arr) => [...arr, { id, name: "—", email, role, status: "invited" }]);
    return id;
  },
  setRole: (id: string, role: RestaurantTeamMember["role"]) =>
    restaurantTeamStore.set((arr) => arr.map((m) => (m.id === id ? { ...m, role } : m))),
  remove: (id: string) => restaurantTeamStore.set((arr) => arr.filter((m) => m.id !== id)),
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

export function useAllProductReviews() {
  return useSyncExternalStore(
    productReviewsStore.subscribe,
    productReviewsStore.get,
    productReviewsStore.get,
  );
}
export function useProductReviews(productId: string) {
  return useAllProductReviews().filter((r) => r.productId === productId);
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
          refId: n.refId,
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
        updated = {
          ...m,
          status,
          statusHistory: [...(m.statusHistory ?? []), { status, at: new Date().toISOString() }],
        };
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
      arr.map((m) =>
        m.id === id
          ? {
              ...m,
              driverId,
              status: "accepted",
              statusHistory: [
                ...(m.statusHistory ?? []),
                { status: "accepted" as MissionStatus, at: new Date().toISOString() },
              ],
            }
          : m,
      ),
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
  startOrGet: (restaurantId: string) => {
    const existing = driverConvosStore.get().find((c) => c.restaurantId === restaurantId);
    if (existing) return existing.id;
    const id = `dc_${Date.now()}`;
    driverConvosStore.set((arr) => [
      {
        id,
        restaurantId,
        lastMessage: "",
        lastAt: new Date().toISOString(),
        unread: 0,
        messages: [],
      },
      ...arr,
    ]);
    return id;
  },
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
    o: Omit<
      RestaurantOrder,
      "id" | "reference" | "createdAt" | "status" | "statusHistory" | "paid" | "paidAt"
    >,
    opts?: { forceUrgency?: Mission["urgency"] },
  ) => {
    const id = `ro_${Date.now()}`;
    const reference = `CMD-${String(3100 + Math.floor(Math.random() * 899)).padStart(4, "0")}`;
    const createdAt = new Date().toISOString();
    // Wave / Orange Money / Free Money : un vrai gateway confirmerait le
    // paiement à l'instant de la commande, donc la facture est payée dès
    // la création. En espèces, rien n'est réellement encaissé avant la
    // livraison : `paid` ne bascule que dans setStatus() ci-dessous.
    const paidNow = o.paymentMethod !== "Espèces";
    const next: RestaurantOrder = {
      ...o,
      id,
      reference,
      status: "pending",
      createdAt,
      statusHistory: [{ status: "pending", at: createdAt }],
      paid: paidNow,
      paidAt: paidNow ? createdAt : undefined,
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
          urgency:
            opts?.forceUrgency ?? (o.eta?.startsWith("Aujourd'hui") ? "priority" : "standard"),
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
        // Paiement à la livraison réel : une commande en espèces n'est
        // considérée payée qu'au moment où elle passe effectivement à
        // "delivered", jamais avant.
        const settlesCash = status === "delivered" && o.paymentMethod === "Espèces" && !o.paid;
        updated = {
          ...o,
          status,
          statusHistory: [...o.statusHistory, { status, at }],
          paid: settlesCash ? true : o.paid,
          paidAt: settlesCash ? at : o.paidAt,
        };
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
      arr.map((o) => {
        if (o.reference !== updated!.reference) return o;
        const settlesCash = status === "delivered" && o.paymentMethod === "Espèces" && !o.paid;
        return {
          ...o,
          status,
          statusHistory: [...o.statusHistory, { status, at }],
          paid: settlesCash ? true : o.paid,
          paidAt: settlesCash ? at : o.paidAt,
        };
      }),
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
    from: "restaurant" | "farmer" | "admin",
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
    const conv = conversationsStore.get().find((c) => c.id === conversationId);
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
    if (!conv) return;
    // Notifie réellement le destinataire, avec un lien direct vers cette
    // conversation — auparavant, envoyer un message ne prévenait jamais
    // personne.
    const restaurant = restaurants.find((r) => r.id === conv.restaurantId);
    const farmer = farmers.find((f) => f.id === conv.farmerId);
    const preview = text || attachment?.name || "Pièce jointe";
    if (from !== "farmer" && farmer) {
      farmerNotifActions.add({
        type: "message",
        title: `Message de ${restaurant?.name ?? "un restaurant"}`,
        body: preview,
        refId: conversationId,
      });
    }
    if (from !== "restaurant" && restaurant) {
      restaurantNotifActions.add({
        type: "message",
        title: `Message de ${farmer?.name ?? "un producteur"}`,
        body: preview,
        refId: conversationId,
      });
    }
  },
  /** Retrouve la conversation réelle restaurant↔producteur, ou en crée une
   * nouvelle vide si le restaurant n'a encore jamais écrit à ce
   * fournisseur — un restaurant peut ainsi avoir une conversation par
   * fournisseur de son carnet, pas un seul producteur codé en dur. */
  startOrGet: (restaurantId: string, farmerId: string) => {
    const existing = conversationsStore
      .get()
      .find((c) => c.restaurantId === restaurantId && c.farmerId === farmerId);
    if (existing) return existing.id;
    const id = `c_${Date.now()}`;
    conversationsStore.set((arr) => [
      {
        id,
        restaurantId,
        farmerId,
        lastMessage: "",
        lastAt: new Date().toISOString(),
        unread: 0,
        messages: [],
      },
      ...arr,
    ]);
    return id;
  },
  markRead: (conversationId: string) => {
    conversationsStore.set((arr) =>
      arr.map((c) => (c.id === conversationId ? { ...c, unread: 0 } : c)),
    );
  },
};

function pushHistory(
  ro: RecurringOrder,
  kind: RecurringOrderEventKind,
  message: string,
): RecurringOrder {
  return {
    ...ro,
    history: [
      ...ro.history,
      {
        id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        at: new Date().toISOString(),
        kind,
        message,
      },
    ],
  };
}

function endReached(ro: RecurringOrder): boolean {
  if (ro.end.type === "after_count") return ro.generatedOrderIds.length >= ro.end.count;
  if (ro.end.type === "on_date")
    return ro.nextRunAt != null && new Date(ro.nextRunAt) > new Date(ro.end.date);
  return false;
}

/** Traite une seule échéance échue d'une commande récurrente : applique
 * les exceptions (saut/remplacement), évalue les règles sur les vraies
 * données actuelles (prix, stock, budget), puis génère une vraie commande
 * via le pont restaurantOrderActions.create() déjà utilisé partout
 * ailleurs, ou pose une action en attente si une règle l'exige. */
function processOccurrenceInner(
  ro: RecurringOrder,
  bypass?: RecurringOrderPendingAction["kind"],
): RecurringOrder {
  const occurrenceDate = ro.nextRunAt!;
  const occDay = occurrenceDate.slice(0, 10);

  const skip = ro.exceptions.find((e) => e.type === "skip" && e.occurrenceDate === occDay);
  if (skip) {
    let next = pushHistory(
      ro,
      "skipped",
      `Occurrence du ${occDay} ignorée (${skip.reason ?? "sautée"}).`,
    );
    const nextRun = computeNextOccurrence(next, new Date(occurrenceDate));
    next = { ...next, nextRunAt: nextRun ? nextRun.toISOString() : null };
    return next;
  }

  const override = ro.exceptions.find((e) => e.type === "override" && e.occurrenceDate === occDay);
  const items = override?.items ?? ro.items;

  // Jour non ouvré
  const scheduled = new Date(occurrenceDate);
  const holiday = applyHolidayShift(scheduled, ro.rules.onNonBusinessDay);
  if (holiday.needsConfirmation && bypass !== "non_business_day") {
    return {
      ...pushHistory(
        ro,
        "rule_triggered",
        `${occDay} tombe un jour non ouvré : confirmation demandée.`,
      ),
      status: "problem",
      pendingAction: {
        kind: "non_business_day",
        detail: `La commande prévue le ${occDay} tombe un jour non ouvré.`,
        occurrenceDate: occDay,
      },
    };
  }
  if (holiday.date.getTime() !== scheduled.getTime()) {
    ro = pushHistory(
      ro,
      "shifted",
      `Décalée du ${occDay} au ${holiday.date.toISOString().slice(0, 10)} (jour non ouvré).`,
    );
  }

  const liveProducts = productsStore.get();
  const priceOf = (id: string) => liveProducts.find((p) => p.id === id)?.pricePerKg ?? 0;
  const stockOfProduct = (id: string) => liveProducts.find((p) => p.id === id)?.stock ?? 0;

  // Règle stock
  const outOfStock = items.filter((it) => stockOfProduct(it.productId) < it.qty);
  if (
    outOfStock.length > 0 &&
    ro.rules.onOutOfStock === "ask_confirmation" &&
    bypass !== "out_of_stock"
  ) {
    const names = outOfStock
      .map((it) => liveProducts.find((p) => p.id === it.productId)?.name ?? it.productId)
      .join(", ");
    return {
      ...pushHistory(
        ro,
        "rule_triggered",
        `Stock insuffisant pour : ${names}. Confirmation demandée.`,
      ),
      status: "problem",
      pendingAction: {
        kind: "out_of_stock",
        detail: `Stock insuffisant pour : ${names}.`,
        occurrenceDate: occDay,
      },
    };
  }
  let effectiveItems = items;
  if (outOfStock.length > 0 && ro.rules.onOutOfStock === "cancel_item") {
    effectiveItems = items.filter((it) => stockOfProduct(it.productId) >= it.qty);
  }
  if (
    outOfStock.length > 0 &&
    ro.rules.onOutOfStock === "replace_equivalent" &&
    bypass !== "out_of_stock"
  ) {
    const unresolved: string[] = [];
    effectiveItems = items.map((it) => {
      if (stockOfProduct(it.productId) >= it.qty) return it;
      const original = liveProducts.find((p) => p.id === it.productId);
      const equivalent = liveProducts.find(
        (p) =>
          p.id !== it.productId &&
          p.farmerId === ro.farmerId &&
          p.category === original?.category &&
          p.status !== "out" &&
          p.status !== "draft" &&
          p.stock >= it.qty &&
          !items.some((other) => other.productId === p.id),
      );
      if (!equivalent) {
        unresolved.push(original?.name ?? it.productId);
        return it;
      }
      return { productId: equivalent.id, qty: it.qty, referencePrice: equivalent.pricePerKg };
    });
    if (unresolved.length > 0) {
      // Aucun équivalent réel disponible chez ce producteur : on ne peut
      // pas remplacer silencieusement, il faut trancher.
      return {
        ...pushHistory(
          ro,
          "rule_triggered",
          `Aucun équivalent disponible pour : ${unresolved.join(", ")}. Confirmation demandée.`,
        ),
        status: "problem",
        pendingAction: {
          kind: "out_of_stock",
          detail: `Rupture sans équivalent disponible : ${unresolved.join(", ")}.`,
          occurrenceDate: occDay,
        },
      };
    }
    const replaced = items
      .filter((it) => stockOfProduct(it.productId) < it.qty)
      .map((it) => liveProducts.find((p) => p.id === it.productId)?.name)
      .filter(Boolean);
    if (replaced.length > 0) {
      ro = pushHistory(
        ro,
        "rule_triggered",
        `Remplacé par un équivalent : ${replaced.join(", ")}.`,
      );
    }
  }
  if (outOfStock.length > 0 && ro.rules.onOutOfStock === "cancel_all") {
    let next = pushHistory(
      ro,
      "rule_triggered",
      "Rupture de stock : commande annulée pour cette échéance.",
    );
    const nextRun = computeNextOccurrence(next, new Date(occurrenceDate));
    next = { ...next, nextRunAt: nextRun ? nextRun.toISOString() : null };
    return next;
  }

  if (effectiveItems.length === 0) {
    const next = pushHistory(
      ro,
      "rule_triggered",
      "Aucun article disponible : commande annulée pour cette échéance.",
    );
    const nextRun = computeNextOccurrence(next, new Date(occurrenceDate));
    return { ...next, nextRunAt: nextRun ? nextRun.toISOString() : null };
  }

  // Règle prix
  const priceHike = effectiveItems.find((it) => {
    const current = priceOf(it.productId);
    return current > it.referencePrice * (1 + ro.rules.priceIncreaseThresholdPct / 100);
  });
  if (priceHike) {
    const p = liveProducts.find((x) => x.id === priceHike.productId);
    const pct = Math.round(
      ((priceOf(priceHike.productId) - priceHike.referencePrice) / priceHike.referencePrice) * 100,
    );
    if (ro.rules.onPriceIncrease === "suspend") {
      return {
        ...pushHistory(
          ro,
          "rule_triggered",
          `Prix de ${p?.name} en hausse de ${pct}% : récurrence suspendue.`,
        ),
        status: "paused",
        pauseReason: `Prix de ${p?.name} en hausse de ${pct}%`,
      };
    }
    if (ro.rules.onPriceIncrease === "ask_confirmation" && bypass !== "price_increase") {
      return {
        ...pushHistory(
          ro,
          "rule_triggered",
          `Prix de ${p?.name} en hausse de ${pct}% (seuil ${ro.rules.priceIncreaseThresholdPct}%). Confirmation demandée.`,
        ),
        status: "problem",
        pendingAction: {
          kind: "price_increase",
          detail: `${p?.name} : ${priceHike.referencePrice} → ${priceOf(priceHike.productId)} FCFA/kg (+${pct}%).`,
          occurrenceDate: occDay,
        },
      };
    }
    // auto_continue (règle), ou confirmation manuelle donnée par le restaurant : on journalise et on continue
    ro = pushHistory(
      ro,
      "rule_triggered",
      bypass === "price_increase"
        ? `Prix de ${p?.name} en hausse de ${pct}% — commande confirmée malgré tout par le restaurant.`
        : `Prix de ${p?.name} en hausse de ${pct}% — poursuite automatique (règle).`,
    );
  }

  const subtotal = itemsSubtotal(effectiveItems, priceOf);
  const delivery = Math.round(subtotal * 0.03);
  const total = subtotal + delivery;

  // Règle budget
  if (total > ro.rules.maxBudget) {
    if (ro.rules.onBudgetExceeded === "cancel") {
      const next = pushHistory(
        ro,
        "rule_triggered",
        `Budget maximum dépassé (${total} > ${ro.rules.maxBudget} FCFA) : commande annulée.`,
      );
      const nextRun = computeNextOccurrence(next, new Date(occurrenceDate));
      return { ...next, nextRunAt: nextRun ? nextRun.toISOString() : null };
    }
    if (ro.rules.onBudgetExceeded === "ask_confirmation" && bypass !== "budget_exceeded") {
      return {
        ...pushHistory(
          ro,
          "rule_triggered",
          `Budget maximum dépassé (${total} > ${ro.rules.maxBudget} FCFA). Confirmation demandée.`,
        ),
        status: "problem",
        pendingAction: {
          kind: "budget_exceeded",
          detail: `Total estimé ${total} FCFA > budget maximum ${ro.rules.maxBudget} FCFA.`,
          occurrenceDate: occDay,
        },
      };
    }
    if (ro.rules.onBudgetExceeded === "ask_confirmation" && bypass === "budget_exceeded") {
      // Confirmation manuelle donnée par le restaurant : on commande tel quel,
      // sans réduire les quantités (ce n'est pas la règle configurée).
      ro = pushHistory(
        ro,
        "rule_triggered",
        `Budget maximum dépassé (${total} > ${ro.rules.maxBudget} FCFA) — commande confirmée malgré tout par le restaurant.`,
      );
    } else if (ro.rules.onBudgetExceeded === "reduce_quantities") {
      const ratio = ro.rules.maxBudget / total;
      effectiveItems = effectiveItems.map((it) => ({
        ...it,
        qty: Math.max(1, Math.floor(it.qty * ratio)),
      }));
      ro = pushHistory(
        ro,
        "rule_triggered",
        "Quantités réduites automatiquement pour respecter le budget maximum.",
      );
    }
  }

  const finalSubtotal = itemsSubtotal(effectiveItems, priceOf);
  const finalDelivery = Math.round(finalSubtotal * 0.03);
  const finalTotal = finalSubtotal + finalDelivery;

  const newOrderId = restaurantOrderActions.create(
    {
      farmerId: ro.farmerId,
      items: effectiveItems.map((it) => ({
        productId: it.productId,
        qty: it.qty,
        price: priceOf(it.productId),
      })),
      total: finalTotal,
      deliveryAddress: ro.deliveryAddress,
      paymentMethod: ro.paymentMethod,
      eta: ro.deliverySlot,
    },
    { forceUrgency: ro.deliveryMode === "express" ? "priority" : undefined },
  );

  const order = restaurantOrdersStore.get().find((o) => o.id === newOrderId);
  let next = pushHistory(
    ro,
    "generated",
    `Commande ${order?.reference ?? newOrderId} générée automatiquement (${formatFCFA(finalTotal)}).`,
  );
  next = { ...next, generatedOrderIds: [...next.generatedOrderIds, newOrderId] };

  if (endReached(next)) {
    return { ...next, status: "ended", nextRunAt: null };
  }
  const nextRun = computeNextOccurrence(next, new Date(occurrenceDate));
  return { ...next, nextRunAt: nextRun ? nextRun.toISOString() : null };
}

/** Enveloppe processOccurrenceInner() pour notifier réellement le
 * restaurant dès qu'une échéance produit un résultat qui compte pour lui :
 * une nouvelle alerte à traiter, ou une commande générée en silence.
 * Sans ça, le restaurant ne l'apprenait qu'en revenant sur cette page. */
function processOccurrence(
  ro: RecurringOrder,
  bypass?: RecurringOrderPendingAction["kind"],
): RecurringOrder {
  const result = processOccurrenceInner(ro, bypass);
  if (result.pendingAction && result.pendingAction !== ro.pendingAction) {
    restaurantNotifActions.add({
      type: "order",
      title: `Action requise · ${result.name}`,
      body: result.pendingAction.detail,
    });
  } else if (result.generatedOrderIds.length > ro.generatedOrderIds.length) {
    const newOrderId = result.generatedOrderIds[result.generatedOrderIds.length - 1];
    const order = restaurantOrdersStore.get().find((o) => o.id === newOrderId);
    restaurantNotifActions.add({
      type: "order",
      title: "Commande récurrente générée",
      body: `${result.name} — ${order?.reference ?? newOrderId} (${order ? formatFCFA(order.total) : ""})`,
    });
  }
  return result;
}

export const recurringOrderActions = {
  create: (
    input: Omit<
      RecurringOrder,
      | "id"
      | "restaurantId"
      | "status"
      | "nextRunAt"
      | "generatedOrderIds"
      | "exceptions"
      | "history"
      | "pendingAction"
      | "createdAt"
    >,
  ) => {
    const id = `rec_${Date.now()}`;
    const createdAt = new Date().toISOString();
    const next: RecurringOrder = {
      ...input,
      id,
      restaurantId: "r1",
      status: "active",
      nextRunAt: input.firstRunAt,
      generatedOrderIds: [],
      exceptions: [],
      history: [
        {
          id: `rev_${Date.now()}`,
          at: createdAt,
          kind: "generated",
          message: "Commande récurrente créée.",
        },
      ],
      pendingAction: null,
      createdAt,
    };
    recurringStore.set((arr) => [next, ...arr]);
    return id;
  },
  update: (id: string, patch: Partial<RecurringOrder>) =>
    recurringStore.set((arr) => arr.map((r) => (r.id === id ? { ...r, ...patch } : r))),
  pause: (id: string, reason: string, pausedUntil?: string) =>
    recurringStore.set((arr) =>
      arr.map((r) =>
        r.id === id
          ? pushHistory(
              { ...r, status: "paused", pauseReason: reason, pausedUntil },
              "paused",
              `Mise en pause : ${reason}.`,
            )
          : r,
      ),
    ),
  resume: (id: string) =>
    recurringStore.set((arr) =>
      arr.map((r) => {
        if (r.id !== id) return r;
        const nextRun = computeNextOccurrence(r, new Date());
        return pushHistory(
          {
            ...r,
            status: "active",
            pauseReason: undefined,
            pausedUntil: undefined,
            nextRunAt: nextRun ? nextRun.toISOString() : r.nextRunAt,
          },
          "resumed",
          "Récurrence réactivée.",
        );
      }),
    ),
  cancel: (id: string, mode: "future_only" | "full") =>
    recurringStore.set((arr) =>
      arr.map((r) =>
        r.id === id
          ? pushHistory(
              { ...r, status: "ended", nextRunAt: null },
              "cancelled",
              mode === "future_only"
                ? "Prochaines commandes annulées (historique conservé)."
                : "Récurrence annulée définitivement (historique conservé).",
            )
          : r,
      ),
    ),
  skipNextOccurrence: (id: string, reason?: string) =>
    recurringStore.set((arr) =>
      arr.map((r) => {
        if (r.id !== id || !r.nextRunAt) return r;
        const occDay = r.nextRunAt.slice(0, 10);
        const exception: RecurringOrderException = {
          id: `exc_${Date.now()}`,
          type: "skip",
          occurrenceDate: occDay,
          reason,
          createdAt: new Date().toISOString(),
        };
        const withExc = { ...r, exceptions: [...r.exceptions, exception] };
        return processOccurrence(withExc);
      }),
    ),
  overrideNextOccurrence: (id: string, items: RecurringOrderItem[]) =>
    recurringStore.set((arr) =>
      arr.map((r) => {
        if (r.id !== id || !r.nextRunAt) return r;
        const occDay = r.nextRunAt.slice(0, 10);
        const exception: RecurringOrderException = {
          id: `exc_${Date.now()}`,
          type: "override",
          occurrenceDate: occDay,
          items,
          createdAt: new Date().toISOString(),
        };
        return pushHistory(
          { ...r, exceptions: [...r.exceptions, exception] },
          "rule_triggered",
          `Occurrence du ${occDay} modifiée exceptionnellement.`,
        );
      }),
    ),
  resolvePendingAction: (id: string, action: "confirm" | "cancel_occurrence") =>
    recurringStore.set((arr) =>
      arr.map((r) => {
        if (r.id !== id || !r.pendingAction) return r;
        if (action === "cancel_occurrence" && r.nextRunAt) {
          const occDay = r.nextRunAt.slice(0, 10);
          const exception: RecurringOrderException = {
            id: `exc_${Date.now()}`,
            type: "skip",
            occurrenceDate: occDay,
            reason: "Refusée suite à alerte",
            createdAt: new Date().toISOString(),
          };
          const withExc = pushHistory(
            {
              ...r,
              exceptions: [...r.exceptions, exception],
              status: "active",
              pendingAction: null,
            },
            "skipped",
            "Occurrence annulée suite à l'alerte.",
          );
          return processOccurrence(withExc);
        }
        // confirm : on lève le blocage et on retraite l'échéance immédiatement,
        // en indiquant au moteur de ne pas re-bloquer sur la même règle.
        const bypassedKind = r.pendingAction.kind;
        const unblocked = pushHistory(
          { ...r, status: "active", pendingAction: null },
          "confirmed",
          "Alerte confirmée par le restaurant : traitement de la commande.",
        );
        return processOccurrence(unblocked, bypassedKind);
      }),
    ),
  remove: (id: string) => recurringStore.set((arr) => arr.filter((r) => r.id !== id)),
  /** Vérifie toutes les récurrences actives et traite celles dont
   * l'échéance est passée. À appeler à chaque chargement du portail
   * restaurant : c'est ce qui tient lieu de "scheduler" dans une appli
   * sans backend/cron — la commande est réellement générée dès que
   * quelqu'un ouvre l'application après l'heure prévue, pas seulement
   * simulée visuellement. */
  tick: () => {
    recurringStore.set((arr) =>
      arr.map((r) => {
        if (r.status !== "active" || !r.nextRunAt) return r;
        let current = r;
        let guard = 0;
        while (
          current.status === "active" &&
          current.nextRunAt &&
          new Date(current.nextRunAt) <= new Date() &&
          guard < 12
        ) {
          current = processOccurrence(current);
          guard++;
        }
        return current;
      }),
    );
  },
};

export const onboardingActions = {
  toggle: (key: string) => onboardingStore.set((m) => ({ ...m, [key]: !m[key] })),
  set: (key: string, done: boolean) => onboardingStore.set((m) => ({ ...m, [key]: done })),
  dismiss: (key: string) => onboardingStore.set((m) => ({ ...m, [`__dismiss_${key}`]: true })),
};
