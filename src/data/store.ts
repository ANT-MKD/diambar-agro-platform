import { useMemo, useSyncExternalStore } from "react";
import {
  products as seedProducts,
  orders as seedOrders,
  stockMovements as seedMovements,
  withdrawals as seedWithdrawals,
  transactions as seedTransactions,
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
  drivers as driverPool,
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
  type Transaction,
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
import {
  tierRateForVolume,
  driverCommissionForPayout,
  DRIVER_COMMISSION_RATE,
} from "@/lib/commission";
import { getCommissionTiers, getDeliveryZones, useDeliveryZones } from "./platform-settings";
import { deliveryFeeForZone, zoneForAddress } from "@/lib/pricing";
import {
  currentLoadKg,
  fleetForDriver,
  missionEligibility,
  waitCompensation,
  withinWorkingHours,
  type DriverFleet,
  type Eligibility,
} from "@/lib/mission-eligibility";
import { createStore } from "./persist";
import { getRefundsSnapshot, onRefundPaid, refundActions } from "./finance";
import {
  checkMissionStep,
  checkOrderTransition,
  type OrderActor,
  type TransitionCheck,
} from "@/lib/order-lifecycle";

const productsStore = createStore<Product[]>(seedProducts, "diambar:products");
// Commandes conservées comme le reste : sans ça, un rechargement effaçait les
// commandes alors que leur stock, leur mission et leur paiement restaient.
const ordersStore = createStore<Order[]>(seedOrders, "diambar:orders");
const movementsStore = createStore<StockMovement[]>(seedMovements, "diambar:movements");
const withdrawalsStore = createStore<Withdrawal[]>(seedWithdrawals, "diambar:withdrawals");
const transactionsStore = createStore<Transaction[]>(seedTransactions, "diambar:transactions");
const restaurantOrdersStore = createStore<RestaurantOrder[]>(
  seedRestaurantOrders,
  "diambar:restaurant-orders",
);
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
// Missions disponibles que le livreur connecté a refusées : elles quittent
// sa liste mais restent proposées aux autres livreurs.
const dismissedMissionsStore = createStore<string[]>([], "diambar:driver-dismissed-missions");
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
/** Commission réellement prélevée sur chaque commande livrée. */
export function useRecordedCommissions(): Map<string, number> {
  const txs = useTransactions();
  return useMemo(() => {
    const map = new Map<string, number>();
    for (const t of txs) {
      if (t.kind === "refund_adjustment" || t.gross <= 0) continue;
      map.set(t.orderRef, (map.get(t.orderRef) ?? 0) + t.commission);
    }
    return map;
  }, [txs]);
}

export function useTransactions() {
  return useSyncExternalStore(
    transactionsStore.subscribe,
    transactionsStore.get,
    transactionsStore.get,
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
/** Missions telles que le livreur connecté les voit : sans celles qu'il a
 * refusées tant qu'elles sont encore disponibles. */
export function useDriverMissions() {
  const missions = useMissions();
  const dismissed = useSyncExternalStore(
    dismissedMissionsStore.subscribe,
    dismissedMissionsStore.get,
    dismissedMissionsStore.get,
  );
  return useMemo(
    () => missions.filter((m) => !(m.status === "available" && dismissed.includes(m.id))),
    [missions, dismissed],
  );
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
  /** Confirme qu'un retrait "En attente" est réellement arrivé — jusqu'ici
   * rien ne le faisait jamais sortir de cet état : `pending` ne se
   * résorbait jamais et `withdrawn` restait figé à sa valeur de seed. */
  completeWithdrawal: (txId: string) => {
    driverWalletStore.set((w) => {
      const tx = w.transactions.find((t) => t.id === txId);
      if (!tx || tx.status !== "En attente" || tx.kind !== "withdrawal") return w;
      const amount = Math.abs(tx.amount);
      return {
        ...w,
        pending: Math.max(0, w.pending - amount),
        withdrawn: w.withdrawn + amount,
        transactions: w.transactions.map((t) =>
          t.id === txId ? { ...t, status: "Complété" as const } : t,
        ),
      };
    });
  },
  /** Échec réel du versement : l'argent revient au solde disponible plutôt
   * que de rester bloqué indéfiniment en "pending". */
  failWithdrawal: (txId: string) => {
    driverWalletStore.set((w) => {
      const tx = w.transactions.find((t) => t.id === txId);
      if (!tx || tx.status !== "En attente" || tx.kind !== "withdrawal") return w;
      const amount = Math.abs(tx.amount);
      return {
        ...w,
        balance: w.balance + amount,
        pending: Math.max(0, w.pending - amount),
        transactions: w.transactions.map((t) =>
          t.id === txId ? { ...t, status: "Échec" as const } : t,
        ),
      };
    });
  },
  credit: (label: string, amount: number, kind: DriverTx["kind"] = "mission", ref?: string) => {
    driverWalletStore.set((w) => ({
      ...w,
      balance: w.balance + amount,
      transactions: [
        {
          id: `dtx_${Date.now()}`,
          at: new Date().toISOString(),
          label,
          ref,
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

/** Capacité et conformité réelles du véhicule du livreur connecté. */
export function useMyDriverFleet(): DriverFleet {
  const vehicle = useDriverVehicle();
  const issues = useVehicleIssues();
  return useMemo(() => fleetForDriver("d1", vehicle, issues)!, [vehicle, issues]);
}

/** Éligibilité réelle du livreur connecté pour une mission : conformité et
 * capacité du véhicule, charge des missions déjà acceptées, en ligne ou non. */
export function useMyMissionEligibility(): (m: Mission) => Eligibility {
  const fleet = useMyDriverFleet();
  const missions = useMissions();
  const online = useDriverOnline();
  return useMemo(
    () => (m: Mission) =>
      missionEligibility(m, fleet, {
        currentLoadKg: currentLoadKg(missions, "d1", m.id),
        online,
      }),
    [fleet, missions, online],
  );
}

/** Livreurs vers lesquels l'admin peut réaffecter une course, chacun avec
 * son éligibilité réelle (capacité du véhicule, conformité). */
export function useReassignCandidates(mission: Mission | null | undefined) {
  const vehicle = useDriverVehicle();
  const issues = useVehicleIssues();
  return useMemo(() => {
    if (!mission) return [];
    return driverPool
      .filter((d) => d.id !== mission.driverId)
      .map((d) => {
        const fleet = fleetForDriver(d.id, vehicle, issues);
        const eligibility: Eligibility = fleet
          ? missionEligibility(mission, fleet, {
              currentLoadKg: currentLoadKg(missionsStore.get(), d.id, mission.id),
            })
          : { ok: true };
        return { driver: d, fleet, eligibility };
      });
  }, [mission, vehicle, issues]);
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
export function autoAcceptableMissions(
  missions: Mission[],
  settings: DriverSettings,
  fleet: DriverFleet,
) {
  if (!settings.autoAccept || fleet.status === "blocked") return [];
  const { minPayout, maxWeightKg, acceptedUrgencies, acceptedCities } = settings.criteria;
  // Le réglage du livreur ne peut pas dépasser ce que son véhicule supporte.
  const weightLimit = Math.min(maxWeightKg, fleet.capacityKg);
  let load = currentLoadKg(missions, "d1");
  return missions.filter((m) => {
    const fits =
      m.status === "available" &&
      m.payout >= minPayout &&
      m.weightKg <= weightLimit &&
      load + m.weightKg <= fleet.capacityKg &&
      withinWorkingHours(m.scheduledFor, settings.workingHours) &&
      acceptedUrgencies.includes(m.urgency) &&
      (acceptedCities.length === 0 ||
        acceptedCities.includes(m.pickup.city) ||
        acceptedCities.includes(m.dropoff.city));
    if (fits) load += m.weightKg;
    return fits;
  });
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
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
    teamStore.set((arr) => [...arr, { id, name: "—", email, role, status: "invited", expiresAt }]);
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
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
    restaurantTeamStore.set((arr) => [
      ...arr,
      { id, name: "—", email, role, status: "invited", expiresAt },
    ]);
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

function makeNotifActions(
  store: ReturnType<typeof createStore<AppNotification[]>>,
  // Page à ouvrir déduite de la référence citée (CMD-…, MIS-…) : chaque
  // notification mène directement à l'élément concerné.
  linkFor?: (text: string) => string | undefined,
) {
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
      const id = n.id ?? `n_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
      store.set((arr) => [
        {
          id,
          at: n.at ?? new Date().toISOString(),
          read: n.read ?? false,
          type: n.type,
          title: n.title,
          body: n.body,
          refId: n.refId,
          link: n.link ?? linkFor?.(`${n.title} ${n.body}`),
        },
        ...arr,
      ]);
      return id;
    },
  };
}

const refIn = (text: string, prefix: string) => text.match(new RegExp(`${prefix}-\\d+`))?.[0];

export const farmerNotifActions = makeNotifActions(farmerNotifsStore, (text) => {
  const ref = refIn(text, "CMD");
  const o = ref && ordersStore.get().find((x) => x.reference === ref);
  return o ? `/farmer/orders/${o.id}` : undefined;
});
export const restaurantNotifActions = makeNotifActions(restoNotifsStore, (text) => {
  const ref = refIn(text, "CMD");
  const o = ref && restaurantOrdersStore.get().find((x) => x.reference === ref);
  return o ? `/restaurant/orders/${o.id}` : undefined;
});
export const driverNotifActions = makeNotifActions(driverNotifsStore, (text) => {
  const ref = refIn(text, "MIS");
  const m = ref && missionsStore.get().find((x) => x.reference === ref);
  return m ? `/driver/missions/${m.id}` : undefined;
});

export type AcceptResult = Eligibility | { ok: false; reason: "taken"; message: string };

export const missionActions = {
  /** Étape du livreur sur sa mission. Refusée si la mission n'est pas la
   * sienne ou si l'étape ne suit pas la précédente : une mission livrée ne
   * peut plus changer, donc elle ne paie qu'une fois. */
  setStatus: (
    id: string,
    status: MissionStatus,
    driverId = "d1",
    opts: { code?: string } = {},
  ): TransitionCheck => {
    const current = missionsStore.get().find((m) => m.id === id);
    if (!current) return { ok: false, message: "Mission introuvable." };
    if (current.driverId !== driverId) {
      return { ok: false, message: "Cette mission n'est pas (ou plus) attribuée à vous." };
    }
    const check = checkMissionStep(current.status, status);
    if (!check.ok) return check;

    // Preuves de remise : code du producteur à l'enlèvement, code du
    // restaurant + photo à la livraison. Pas de code, pas de paiement.
    if (status === "loaded") {
      const expected = ordersStore.get().find((o) => o.reference === current.orderRef)?.pickupCode;
      if (expected && opts.code?.trim() !== expected) {
        return { ok: false, message: "Code d'enlèvement incorrect : demandez-le au producteur." };
      }
    }
    if (status === "delivered") {
      const expected = restaurantOrdersStore
        .get()
        .find((o) => o.reference === current.orderRef)?.deliveryCode;
      if (expected && opts.code?.trim() !== expected) {
        return { ok: false, message: "Code de remise incorrect : demandez-le au restaurant." };
      }
      if (!current.proof || current.proof.length === 0) {
        return { ok: false, message: "Ajoutez au moins une photo de la marchandise livrée." };
      }
    }

    const nowIso = new Date().toISOString();
    const closing = status === "loaded" ? "pickup" : status === "delivered" ? "dropoff" : null;
    const updated: Mission = {
      ...current,
      status,
      statusHistory: [...(current.statusHistory ?? []), { status, at: nowIso }],
      waits: current.waits?.map((w) =>
        w.stage === closing && !w.endedAt ? { ...w, endedAt: nowIso } : w,
      ),
    };
    missionsStore.set((arr) => arr.map((m) => (m.id === id ? updated : m)));

    if (status === "loaded") {
      driverNotifActions.add({
        type: "order",
        title: "Marchandise récupérée",
        body: `${updated.reference} · en route vers le restaurant`,
      });
      // L'enlèvement met la commande « en livraison » pour le restaurant et
      // le producteur — plus besoin d'une action manuelle du producteur.
      syncOrderFromMission(updated.orderRef, "delivering");
    }
    if (status === "delivered") {
      // Crédit réel du portefeuille livreur : le montant brut de la mission,
      // puis la commission plateforme déduite séparément (deux écritures
      // liées par la même référence).
      const commission = driverCommissionForPayout(updated.payout);
      driverWalletActions.credit(
        `Mission ${updated.reference}`,
        updated.payout,
        "mission",
        updated.reference,
      );
      driverWalletActions.credit(
        `Commission plateforme (${DRIVER_COMMISSION_RATE}%)`,
        -commission,
        "commission",
        updated.reference,
      );
      driverNotifActions.add({
        type: "payment",
        title: "Paiement reçu",
        body: `+${formatFCFA(updated.payout - commission)} net (${updated.reference})`,
      });
      const waitPay = (updated.waits ?? []).reduce((sum, w) => {
        if (!w.endedAt) return sum;
        const minutes = (new Date(w.endedAt).getTime() - new Date(w.arrivedAt).getTime()) / 60_000;
        return sum + waitCompensation(minutes);
      }, 0);
      if (waitPay > 0) {
        driverWalletActions.credit(
          `Indemnité d'attente ${updated.reference}`,
          waitPay,
          "bonus",
          updated.reference,
        );
      }
      syncOrderFromMission(updated.orderRef, "delivered");
      if (opts.code) {
        restaurantOrdersStore.set((arr) =>
          arr.map((o) =>
            o.reference === updated.orderRef ? { ...o, deliveredWithCode: true } : o,
          ),
        );
      }
    }
    return { ok: true };
  },
  accept: (id: string, driverId = "d1"): AcceptResult => {
    // Premier arrivé, premier servi : une mission déjà prise (ou annulée)
    // entre l'affichage et le clic ne doit jamais être réattribuée.
    const current = missionsStore.get().find((m) => m.id === id);
    if (!current || current.status !== "available") {
      return {
        ok: false,
        reason: "taken",
        message: "Cette mission n'est plus disponible (déjà prise par un autre livreur).",
      };
    }
    const fleet = fleetForDriver(driverId, driverVehicleStore.get(), vehicleIssuesStore.get());
    if (fleet) {
      const eligibility = missionEligibility(current, fleet, {
        currentLoadKg: currentLoadKg(missionsStore.get(), driverId, current.id),
        online: driverId === "d1" ? driverOnlineStore.get() : undefined,
      });
      if (!eligibility.ok) return eligibility;
    }
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
      const driverName = driverPool.find((d) => d.id === driverId)?.name ?? "Un livreur";
      restaurantNotifActions.add({
        type: "order",
        title: "Livreur trouvé",
        body: `${driverName} livrera ${mission.orderRef}`,
      });
      farmerNotifActions.add({
        type: "order",
        title: "Livreur en route",
        body: `${driverName} viendra récupérer ${mission.orderRef} : préparez le code d'enlèvement`,
      });
    }
    return { ok: true };
  },
  // Refuser une mission disponible la retire de la liste de ce livreur
  // seulement : elle reste ouverte aux autres (jamais "cancelled").
  dismiss: (id: string) => {
    dismissedMissionsStore.set((ids) => (ids.includes(id) ? ids : [...ids, id]));
  },
  // Désistement d'une mission déjà acceptée, tant que la marchandise n'est pas
  // chargée : la course retourne dans le bassin des missions disponibles.
  withdraw: (
    id: string,
    reason: string,
    driverId = "d1",
  ): { ok: true } | { ok: false; message: string } => {
    const current = missionsStore.get().find((m) => m.id === id);
    if (!current || current.driverId !== driverId) {
      return { ok: false, message: "Cette mission ne vous est plus attribuée." };
    }
    if (current.status !== "accepted" && current.status !== "pickup") {
      return {
        ok: false,
        message:
          "Désistement impossible une fois la marchandise chargée : signalez plutôt un incident.",
      };
    }
    missionsStore.set((arr) =>
      arr.map((m) =>
        m.id === id
          ? {
              ...m,
              driverId: undefined,
              status: "available",
              statusHistory: [
                ...(m.statusHistory ?? []),
                {
                  status: "available" as MissionStatus,
                  at: new Date().toISOString(),
                  note: `Désistement du livreur : ${reason}`,
                },
              ],
            }
          : m,
      ),
    );
    // Sans ça, l'acceptation automatique la reprendrait aussitôt.
    missionActions.dismiss(id);
    driverNotifActions.add({
      type: "order",
      title: "Désistement enregistré",
      body: `${current.reference} a été remise à disposition des autres livreurs`,
    });
    return { ok: true };
  },
  /** Le livreur signale qu'il est arrivé chez le producteur ou le restaurant :
   * point de départ de l'attente payée. */
  markArrived: (id: string, stage: "pickup" | "dropoff") => {
    const at = new Date().toISOString();
    missionsStore.set((arr) =>
      arr.map((m) =>
        m.id === id && !(m.waits ?? []).some((w) => w.stage === stage)
          ? { ...m, waits: [...(m.waits ?? []), { stage, arrivedAt: at }] }
          : m,
      ),
    );
  },
  attachProof: (id: string, photos: MissionProofPhoto[]) => {
    missionsStore.set((arr) => arr.map((m) => (m.id === id ? { ...m, proof: photos } : m)));
  },
  // Réaffectation depuis l'admin : l'ancien livreur redevient disponible,
  // le nouveau reprend la course là où elle en est (statut "accepted", pas
  // "available" — la collecte a déjà pu être planifiée).
  reassign: (id: string, newDriverId: string): AcceptResult => {
    const before = missionsStore.get().find((m) => m.id === id);
    if (!before) return { ok: false, reason: "taken", message: "Course introuvable." };
    const fleet = fleetForDriver(newDriverId, driverVehicleStore.get(), vehicleIssuesStore.get());
    if (fleet) {
      const eligibility = missionEligibility(before, fleet, {
        currentLoadKg: currentLoadKg(missionsStore.get(), newDriverId, before.id),
      });
      if (!eligibility.ok) return eligibility;
    }
    const previousDriverId = before.driverId;
    missionsStore.set((arr) =>
      arr.map((m) =>
        m.id === id
          ? {
              ...m,
              driverId: newDriverId,
              status: "accepted",
              statusHistory: [
                ...(m.statusHistory ?? []),
                { status: "accepted" as MissionStatus, at: new Date().toISOString() },
              ],
            }
          : m,
      ),
    );
    // Le store de notifications livreur ne modélise qu'un seul livreur
    // connecté ("d1") dans cette démo : on ne notifie donc que si ce
    // livreur précis perd ou reçoit la course, pas les autres du vivier.
    if (previousDriverId === "d1" && newDriverId !== "d1") {
      driverNotifActions.add({
        type: "order",
        title: "Mission réaffectée",
        body: `${before.reference} a été réaffectée à un autre livreur`,
      });
    }
    if (newDriverId === "d1" && previousDriverId !== "d1") {
      driverNotifActions.add({
        type: "order",
        title: "Nouvelle mission affectée",
        body: `${before.reference} vous a été affectée par l'administration`,
      });
    }
    return { ok: true };
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
          ? {
              ...c,
              messages: [...c.messages, msg],
              lastMessage: text,
              lastAt: msg.at,
              // Non-lus côté livreur : seulement les messages reçus.
              unread: from === "them" ? c.unread + 1 : c.unread,
            }
          : c,
      ),
    );
    // Le destinataire est prévenu : restaurant pour un message du livreur,
    // livreur pour une réponse du restaurant (ou de l'admin).
    if (from === "me") {
      restaurantNotifActions.add({
        type: "message",
        title: "Message du livreur",
        body: text.length > 80 ? `${text.slice(0, 80)}…` : text,
        link: "/restaurant/messages",
      });
    } else {
      driverNotifActions.add({
        type: "message",
        title: `Message de ${senderName ?? "l'équipe"}`,
        body: text.length > 80 ? `${text.slice(0, 80)}…` : text,
        link: `/driver/messages/${conversationId}`,
      });
    }
  },
  markRead: (conversationId: string) => {
    driverConvosStore.set((arr) =>
      arr.map((c) => (c.id === conversationId ? { ...c, unread: 0 } : c)),
    );
  },
  setPriority: (conversationId: string, priority: "normal" | "important" | "urgent") => {
    driverConvosStore.set((arr) =>
      arr.map((c) => (c.id === conversationId ? { ...c, priority } : c)),
    );
  },
  setTags: (conversationId: string, tags: string[]) => {
    driverConvosStore.set((arr) => arr.map((c) => (c.id === conversationId ? { ...c, tags } : c)));
  },
  addInternalNote: (conversationId: string, actor: string, text: string) => {
    driverConvosStore.set((arr) =>
      arr.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              internalNotes: [
                ...(c.internalNotes ?? []),
                { id: `note_${Date.now()}`, at: new Date().toISOString(), actor, text },
              ],
            }
          : c,
      ),
    );
  },
  linkTicket: (conversationId: string, ticketId: string) => {
    driverConvosStore.set((arr) =>
      arr.map((c) => (c.id === conversationId ? { ...c, ticketId } : c)),
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

// Rémunération d'une course : une prise en charge fixe, la distance et le
// poids transporté. Avant, seule la distance comptait (120 FCFA/km) : une
// course dans la même ville était payée 100 FCFA.
export const MISSION_PAY = { base: 1000, perKm: 120, perKgOver20: 10, minimum: 1500 };

export function missionPayout(distanceKm: number, weightKg: number): number {
  const raw =
    MISSION_PAY.base +
    distanceKm * MISSION_PAY.perKm +
    Math.max(0, weightKg - 20) * MISSION_PAY.perKgOver20;
  return Math.max(MISSION_PAY.minimum, Math.round(raw / 50) * 50);
}

/** "Le Baobab, Dakar Plateau" -> "Dakar Plateau" (même règle que la
 * résolution de suivi en direct, pour rester cohérent avec elle). */
function lastAddressSegment(address: string): string {
  const parts = address.split(",");
  return parts[parts.length - 1]?.trim() || address;
}

/** Frais d'une livraison vers une adresse du restaurant, selon la zone réglée
 * par l'admin (0 si hors zone). */
export function deliveryFeeFor(address: string): number {
  const zone = zoneForAddress(getDeliveryZones(), restaurantProfileStore.get().city, address);
  return zone ? deliveryFeeForZone(zone) : 0;
}
export function useDeliveryFeeFor(address: string): number {
  const zones = useDeliveryZones();
  const profile = useRestaurantProfile();
  const zone = zoneForAddress(zones, profile.city, address);
  return zone ? deliveryFeeForZone(zone) : 0;
}

export const RECEPTION_WINDOW_MS = 48 * 3600_000;

/** Heure réelle de livraison d'une commande restaurant (dernier passage à
 * « livrée »), ou undefined pour une commande de démo sans historique. */
export function deliveredAtOf(o: RestaurantOrder): string | undefined {
  if (o.status !== "delivered" || o.statusHistory.length < 2) return undefined;
  return [...o.statusHistory].reverse().find((h) => h.status === "delivered")?.at;
}

function fourDigitCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/** Lignes dont la quantité demandée dépasse le stock réel du moment. */
export function stockShortages(items: { productId: string; qty: number }[]) {
  const products = productsStore.get();
  return items
    .map((i) => {
      const p = products.find((x) => x.id === i.productId);
      return {
        productId: i.productId,
        name: p?.name ?? i.productId,
        wanted: i.qty,
        available: p?.stock ?? 0,
      };
    })
    .filter((l) => l.wanted > l.available);
}

// Abonnés à l'annulation d'une commande restaurant (ex. le registre des
// avoirs, qui recrédite un avoir utilisé) — évite une dépendance circulaire
// entre les magasins.
const restaurantOrderCancelListeners = new Set<(o: RestaurantOrder) => void>();
export function onRestaurantOrderCancelled(fn: (o: RestaurantOrder) => void) {
  restaurantOrderCancelListeners.add(fn);
  return () => restaurantOrderCancelListeners.delete(fn);
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
    const missionUrgency = opts?.forceUrgency;
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
      missionUrgency,
      deliveryCode: fourDigitCode(),
    };
    restaurantOrdersStore.set((arr) => [next, ...arr]);

    orderActions.create({
      reference,
      restaurantId: "r1",
      farmerId: o.farmerId,
      items: o.items.map(({ productId, qty, price }) => ({ productId, qty, price })),
      // Le producteur est payé sur la marchandise seule : frais de livraison,
      // promos et avoirs ne touchent jamais ses revenus.
      total: o.subtotal ?? o.items.reduce((sum, i) => sum + i.qty * i.price, 0),
      status: "pending",
      createdAt,
      eta: o.eta,
      deliveryAddress: o.deliveryAddress,
      stockReserved: true,
      pickupCode: fourDigitCode(),
    });
    o.items.forEach((line) => productActions.adjustStock(line.productId, -line.qty));
    farmerNotifActions.add({
      type: "order",
      title: "Nouvelle commande",
      body: `${reference} — ${formatFCFA(o.subtotal ?? o.items.reduce((sum, i) => sum + i.qty * i.price, 0))} · à confirmer`,
    });
    // La mission de livraison n'est ouverte aux livreurs qu'une fois la
    // commande confirmée par le producteur (voir openMissionForOrder).
    return id;
  },
  /** Changement de statut demandé depuis le portail restaurant. */
  setStatus: (
    id: string,
    status: OrderStatus,
    actor: OrderActor = "restaurant",
    note?: string,
  ): TransitionCheck => {
    const order = restaurantOrdersStore.get().find((o) => o.id === id);
    if (!order) return { ok: false, message: "Commande introuvable." };
    return transitionOrder(order.reference, status, actor, note);
  },
  /** Contrôle à la réception : le restaurant refuse tout ou partie d'une
   * ligne (produit abîmé, quantité manquante…) dans les 48 h qui suivent la
   * livraison. Le montant des quantités refusées lui est remboursé
   * automatiquement, à la charge du producteur. Une seule fois par commande. */
  reportReception: (
    id: string,
    lines: { productId: string; refusedQty: number; reason: string }[],
    note?: string,
  ): TransitionCheck => {
    const order = restaurantOrdersStore.get().find((o) => o.id === id);
    if (!order) return { ok: false, message: "Commande introuvable." };
    if (order.status !== "delivered") {
      return { ok: false, message: "La réception se contrôle une fois la commande livrée." };
    }
    if (order.reception) return { ok: false, message: "La réception a déjà été contrôlée." };
    const deliveredAt = deliveredAtOf(order);
    if (deliveredAt && Date.now() - new Date(deliveredAt).getTime() > RECEPTION_WINDOW_MS) {
      return {
        ok: false,
        message: "Le délai de 48 h après la livraison est dépassé : passez par le support.",
      };
    }
    const kept = lines
      .map((l) => {
        const item = order.items.find((i) => i.productId === l.productId);
        return item ? { ...l, refusedQty: Math.min(Math.max(0, l.refusedQty), item.qty) } : null;
      })
      .filter((l): l is NonNullable<typeof l> => !!l && l.refusedQty > 0);
    const amount = kept.reduce((sum, l) => {
      const item = order.items.find((i) => i.productId === l.productId)!;
      return sum + l.refusedQty * item.price;
    }, 0);
    const at = new Date().toISOString();
    restaurantOrdersStore.set((arr) =>
      arr.map((o) =>
        o.id === id ? { ...o, reception: { at, lines: kept, refundedAmount: amount, note } } : o,
      ),
    );
    if (amount > 0) {
      refundActions.create(
        {
          source: "reception",
          orderRef: order.reference,
          bornBy: "farmer",
          requester: restaurants.find((r) => r.id === "r1")?.name ?? "Restaurant",
          amount,
          method:
            order.paymentMethod === "Espèces"
              ? "Wave"
              : (order.paymentMethod as "Wave" | "Orange Money" | "Free Money"),
          reason: `Refus à la réception : ${kept
            .map(
              (l) =>
                `${l.refusedQty} × ${productsStore.get().find((p) => p.id === l.productId)?.name ?? l.productId} (${l.reason})`,
            )
            .join(", ")}`,
        },
        // Règle automatique, plafonnée à la valeur des lignes : pas de
        // décision au cas par cas, donc pas d'attente de validation.
        "approved",
        "Système (réception)",
      );
      farmerNotifActions.add({
        type: "order",
        title: "Refus à la réception",
        body: `${order.reference} : ${formatFCFA(amount)} refusés par le restaurant, déduits de vos revenus`,
      });
      restaurantNotifActions.add({
        type: "payment",
        title: "Remboursement accordé",
        body: `${formatFCFA(amount)} vous seront remboursés (${order.reference})`,
      });
    }
    return { ok: true };
  },
  /** Le restaurant annule tant que le producteur n'a pas commencé à préparer. */
  cancel: (id: string, reason: string): TransitionCheck =>
    restaurantOrderActions.setStatus(id, "cancelled", "restaurant", reason),
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
  preparing: {
    title: "Commande en préparation",
    body: (ref) => `${ref} est en cours de préparation chez le producteur`,
  },
  delivering: {
    title: "Livraison en route",
    body: (ref) => `${ref} a été enlevée par le livreur et arrive`,
  },
  delivered: { title: "Commande livrée", body: (ref) => `${ref} a été livrée` },
  cancelled: { title: "Commande annulée", body: (ref) => `${ref} a été annulée` },
};

/**
 * Crédite une vraie transaction au producteur quand une commande est
 * livrée — auparavant `transactions` était un tableau figé de mocks.ts,
 * jamais alimenté par l'activité réelle des commandes. La commission
 * applique le barème dégressif réel (par palier de volume livré cumulé du
 * producteur, comme sur le tableau de bord admin), pas un pourcentage fixe.
 */
function recordDeliveryTransaction(order: Order, paymentMethod: PaymentMethod) {
  // Une commande ne crédite le producteur qu'une seule fois.
  const alreadyCredited = transactionsStore
    .get()
    .some((t) => t.orderRef === order.reference && t.kind !== "refund_adjustment" && t.gross > 0);
  if (alreadyCredited) return;
  // Barème réel réglé par l'admin, appliqué au volume livré du mois en cours
  // (comme annoncé dans les tarifs) : un changement de taux vaut pour les
  // livraisons suivantes, jamais pour celles déjà créditées.
  const month = new Date().toISOString().slice(0, 7);
  const volume = ordersStore
    .get()
    .filter(
      (o) =>
        o.farmerId === order.farmerId &&
        o.status === "delivered" &&
        o.deliveredAt?.slice(0, 7) === month,
    )
    .reduce((s, o) => s + o.total, 0);
  const rate = tierRateForVolume(getCommissionTiers(), volume);
  const commission = Math.round(order.total * (rate / 100));
  transactionsStore.set((arr) => [
    {
      id: `tx_${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      orderRef: order.reference,
      restaurantId: order.restaurantId,
      farmerId: order.farmerId,
      gross: order.total,
      commission,
      net: order.total - commission,
      method: paymentMethod,
      status: "Payé",
    },
    ...arr,
  ]);
}

export const transactionActions = {
  /**
   * Reprend une partie des revenus déjà versés au producteur suite à un
   * remboursement client dont il est responsable (retour accepté, litige
   * qualité…) — une écriture réelle et traçable dans son historique, pas
   * une simple mutation silencieuse du montant déjà enregistré. Le taux de
   * commission appliqué est le même barème réel que celui de la livraison
   * d'origine, jamais un pourcentage recalculé pour l'occasion.
   */
  recordRefundAdjustment: (input: {
    orderRef: string;
    farmerId: string;
    restaurantId: string;
    method: PaymentMethod;
    amount: number;
    reason: string;
  }) => {
    // Même taux que celui réellement appliqué à la vente d'origine.
    const original = transactionsStore
      .get()
      .find((t) => t.orderRef === input.orderRef && t.kind !== "refund_adjustment" && t.gross > 0);
    const rate = original
      ? (original.commission / original.gross) * 100
      : tierRateForVolume(getCommissionTiers(), 0);
    const commission = Math.round(input.amount * (rate / 100));
    transactionsStore.set((arr) => [
      {
        id: `tx_${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        orderRef: input.orderRef,
        restaurantId: input.restaurantId,
        farmerId: input.farmerId,
        gross: -input.amount,
        commission: -commission,
        net: -(input.amount - commission),
        method: input.method,
        status: "Payé",
        kind: "refund_adjustment",
      },
      ...arr,
    ]);
  },
};

/**
 * Seul point d'entrée pour changer le statut d'une commande, quel que soit le
 * portail : vérifie que l'étape est permise pour cet acteur (table unique de
 * src/lib/order-lifecycle.ts), met à jour la commande côté producteur ET
 * côté restaurant, puis déclenche les effets de l'étape une seule fois.
 */
function transitionOrder(
  reference: string,
  status: OrderStatus,
  actor: OrderActor,
  note?: string,
): TransitionCheck {
  const restoOrder = restaurantOrdersStore.get().find((o) => o.reference === reference);
  const farmerOrder = ordersStore.get().find((o) => o.reference === reference);
  const from = restoOrder?.status ?? farmerOrder?.status;
  if (!from) return { ok: false, message: "Commande introuvable." };
  const check = checkOrderTransition(from, status, actor);
  if (!check.ok) return check;
  applyOrderStatus(reference, status, actor, note);
  return { ok: true };
}

/** Répercute l'avancement d'une mission sur sa commande (enlèvement,
 * livraison). Ne revient jamais en arrière et ne touche pas une commande
 * terminée. */
function syncOrderFromMission(reference: string, status: "delivering" | "delivered") {
  const restoOrder = restaurantOrdersStore.get().find((o) => o.reference === reference);
  const farmerOrder = ordersStore.get().find((o) => o.reference === reference);
  const from = restoOrder?.status ?? farmerOrder?.status;
  if (!from || from === "delivered" || from === "cancelled") return;
  if (status === "delivering" && from === "delivering") return;
  // Livraison confirmée sans enlèvement enregistré (commandes de démo) :
  // on passe par « en livraison » pour garder un historique complet.
  if (status === "delivered" && from !== "delivering") {
    applyOrderStatus(reference, "delivering", "driver");
  }
  applyOrderStatus(reference, status, "driver");
}

function applyOrderStatus(
  reference: string,
  status: OrderStatus,
  actor: OrderActor,
  note?: string,
) {
  const at = new Date().toISOString();
  let restoOrder: RestaurantOrder | undefined;
  restaurantOrdersStore.set((arr) =>
    arr.map((o) => {
      if (o.reference !== reference) return o;
      // Paiement à la livraison : une commande en espèces n'est payée qu'au
      // moment où elle est réellement livrée.
      const settlesCash = status === "delivered" && o.paymentMethod === "Espèces" && !o.paid;
      restoOrder = {
        ...o,
        status,
        statusHistory: [...o.statusHistory, { status, at }],
        paid: settlesCash ? true : o.paid,
        paidAt: settlesCash ? at : o.paidAt,
        cancelReason: status === "cancelled" ? note : o.cancelReason,
      };
      return restoOrder;
    }),
  );
  let farmerOrder: Order | undefined;
  ordersStore.set((arr) =>
    arr.map((o) => {
      if (o.reference !== reference) return o;
      farmerOrder = { ...o, status, deliveredAt: status === "delivered" ? at : o.deliveredAt };
      return farmerOrder;
    }),
  );

  // Le restaurant est prévenu de chaque étape qu'il n'a pas faite lui-même.
  const notif = RESTAURANT_STATUS_NOTIF[status];
  if (notif && actor !== "restaurant") {
    restaurantNotifActions.add({
      type: "order",
      title: notif.title,
      body: note ? `${notif.body(reference)} — ${note}` : notif.body(reference),
    });
  }

  if (status === "confirmed") openMissionForOrder(reference);

  if (status === "delivering") {
    farmerNotifActions.add({
      type: "order",
      title: "Commande enlevée",
      body: `${reference} a été récupérée par le livreur`,
    });
  }

  if (status === "delivered") {
    const order = farmerOrder ?? ordersStore.get().find((o) => o.reference === reference);
    if (order) {
      recordDeliveryTransaction(order, restoOrder?.paymentMethod ?? "Wave");
      farmerNotifActions.add({
        type: "payment",
        title: "Vente créditée",
        body: `${reference} livrée · ${formatFCFA(order.total)} ajoutés à vos revenus (avant commission)`,
      });
    }
  }

  if (status === "cancelled") cancelCascade(reference, actor, note, farmerOrder, restoOrder);
}

/** Ouvre la mission de livraison d'une commande confirmée (une seule fois). */
function openMissionForOrder(reference: string) {
  const exists = missionsStore
    .get()
    .some((m) => m.orderRef === reference && m.status !== "cancelled");
  if (exists) return;
  const farmerOrder = ordersStore.get().find((o) => o.reference === reference);
  const restoOrder = restaurantOrdersStore.get().find((o) => o.reference === reference);
  const source = restoOrder ?? farmerOrder;
  if (!source) return;
  const farmer = farmers.find((f) => f.id === source.farmerId);
  if (!farmer) return;
  const restaurantId = farmerOrder?.restaurantId ?? "r1";
  const restaurant = restaurants.find((r) => r.id === restaurantId);
  const deliveryAddress =
    restoOrder?.deliveryAddress ??
    farmerOrder?.deliveryAddress ??
    (restaurant ? `${restaurant.name}, ${restaurant.city}` : "");
  const eta = restoOrder?.eta ?? farmerOrder?.eta;
  const now = new Date().toISOString();
  const pickupCoords = cityCoords(farmer.city);
  const dropoffCity = lastAddressSegment(deliveryAddress);
  const dropoffCoords = cityCoords(dropoffCity);
  const distanceKm = Math.max(1, Math.round(haversineKm(pickupCoords, dropoffCoords)));
  const estimatedMinutes = Math.max(10, Math.round((distanceKm / 42) * 60));
  const weightKg = source.items.reduce((s, i) => s + i.qty, 0);
  missionsStore.set((arr) => [
    {
      id: `mi_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      reference: `MIS-${4300 + Math.floor(Math.random() * 699)}`,
      orderRef: reference,
      farmerId: source.farmerId,
      restaurantId,
      status: "available",
      pickup: {
        address: `${farmer.farm}, ${farmer.city}`,
        city: farmer.city,
        ...pickupCoords,
        contactPhone: farmer.phone,
      },
      dropoff: {
        address: deliveryAddress,
        city: dropoffCity,
        ...dropoffCoords,
        contactPhone: restaurant?.phone ?? "",
      },
      distanceKm,
      estimatedMinutes,
      payout: missionPayout(distanceKm, weightKg),
      weightKg,
      itemsCount: source.items.length,
      scheduledFor: restoOrder?.slotStart ?? now,
      createdAt: now,
      vehicleType: vehicleForWeight(weightKg),
      urgency:
        restoOrder?.missionUrgency ??
        (restoOrder?.slotStart &&
        new Date(restoOrder.slotStart).getTime() - Date.now() < 36 * 3600_000
          ? "priority"
          : "standard"),
      statusHistory: [{ status: "available", at: now }],
      instructions: restoOrder?.instructions,
    },
    ...arr,
  ]);
}

/**
 * Effets d'une annulation : stock remis, mission retirée aux livreurs,
 * remboursement du restaurant s'il avait déjà payé, parties prévenues.
 */
function cancelCascade(
  reference: string,
  actor: OrderActor,
  note: string | undefined,
  farmerOrder: Order | undefined,
  restoOrder: RestaurantOrder | undefined,
) {
  if (farmerOrder?.stockReserved) {
    farmerOrder.items.forEach((line) => productActions.adjustStock(line.productId, line.qty));
  }

  const at = new Date().toISOString();
  let assignedToMe: Mission | undefined;
  missionsStore.set((arr) =>
    arr.map((m) => {
      if (m.orderRef !== reference || m.status === "delivered" || m.status === "cancelled") {
        return m;
      }
      if (m.driverId === "d1") assignedToMe = m;
      return {
        ...m,
        status: "cancelled",
        statusHistory: [
          ...(m.statusHistory ?? []),
          { status: "cancelled" as MissionStatus, at, note: "Commande annulée" },
        ],
      };
    }),
  );
  if (assignedToMe) {
    driverNotifActions.add({
      type: "order",
      title: "Mission annulée",
      body: `${assignedToMe.reference} : la commande ${reference} a été annulée, inutile de vous déplacer`,
    });
  }

  // Paiement mobile déjà encaissé : remboursement intégral automatique (rien
  // n'a été livré, la plateforme détient encore l'argent). En espèces, rien
  // n'a été payé, donc rien à rembourser.
  if (restoOrder && restoOrder.paid && restoOrder.paymentMethod !== "Espèces") {
    const already = refundsForOrder(reference);
    if (!already) {
      refundActions.create(
        {
          source: "cancellation",
          orderRef: reference,
          bornBy: "platform",
          requester: restaurants.find((r) => r.id === "r1")?.name ?? "Restaurant",
          amount: restoOrder.total,
          method: restoOrder.paymentMethod as "Wave" | "Orange Money" | "Free Money",
          reason: note ? `Commande annulée : ${note}` : "Commande annulée avant livraison",
        },
        "approved",
        "Système (annulation)",
      );
      restaurantNotifActions.add({
        type: "payment",
        title: "Remboursement en cours",
        body: `${formatFCFA(restoOrder.total)} vous seront remboursés sur ${restoOrder.paymentMethod} (${reference})`,
      });
    }
  }

  if (restoOrder) restaurantOrderCancelListeners.forEach((fn) => fn(restoOrder!));

  if (actor !== "farmer") {
    farmerNotifActions.add({
      type: "order",
      title: "Commande annulée",
      body: `${reference} a été annulée${actor === "restaurant" ? " par le restaurant" : ""}${note ? ` — ${note}` : ""}`,
    });
  }
}

function refundsForOrder(reference: string): boolean {
  return getRefundsSnapshot().some((r) => r.orderRef === reference && r.source === "cancellation");
}

/** Changements de statut demandés depuis le portail producteur. */
export const orderActions = {
  /** Le producteur accepte en ajustant les quantités qu'il a vraiment. Selon
   * la préférence du restaurant, la commande est livrée partiellement (la
   * différence lui est remboursée) ou annulée. */
  confirmPartial: (id: string, available: Record<string, number>): TransitionCheck => {
    const order = ordersStore.get().find((o) => o.id === id);
    if (!order) return { ok: false, message: "Commande introuvable." };
    if (order.status !== "pending") {
      return { ok: false, message: "Seule une commande en attente peut être ajustée." };
    }
    const items = order.items.map((i) => ({
      ...i,
      qty: Math.min(i.qty, Math.max(0, Math.floor(available[i.productId] ?? i.qty))),
    }));
    const missing = order.items.reduce((s, i, idx) => s + (i.qty - items[idx].qty) * i.price, 0);
    if (missing === 0) return orderActions.setStatus(id, "confirmed");
    const resto = restaurantOrdersStore.get().find((o) => o.reference === order.reference);
    if (items.every((i) => i.qty === 0) || resto?.shortagePreference === "cancel") {
      return orderActions.setStatus(id, "cancelled", "Quantités indisponibles chez le producteur");
    }
    const kept = items.filter((i) => i.qty > 0);
    // Stock réservé en trop remis en vente.
    if (order.stockReserved) {
      order.items.forEach((i, idx) => {
        const diff = i.qty - items[idx].qty;
        if (diff > 0) productActions.adjustStock(i.productId, diff);
      });
    }
    const newSubtotal = kept.reduce((s, i) => s + i.qty * i.price, 0);
    ordersStore.set((arr) =>
      arr.map((o) => (o.id === id ? { ...o, items: kept, total: newSubtotal } : o)),
    );
    if (resto) {
      restaurantOrdersStore.set((arr) =>
        arr.map((o) =>
          o.id === resto.id
            ? { ...o, items: kept, subtotal: newSubtotal, total: Math.max(0, o.total - missing) }
            : o,
        ),
      );
      if (resto.paid && resto.paymentMethod !== "Espèces") {
        refundActions.create(
          {
            source: "shortage",
            orderRef: order.reference,
            bornBy: "platform",
            requester: restaurants.find((r) => r.id === "r1")?.name ?? "Restaurant",
            amount: missing,
            method: resto.paymentMethod as "Wave" | "Orange Money" | "Free Money",
            reason: "Quantités indisponibles chez le producteur",
          },
          "approved",
          "Système (ajustement producteur)",
        );
      }
      restaurantNotifActions.add({
        type: "order",
        title: "Quantités ajustées",
        body: `${order.reference} : le producteur n'a pas tout, ${formatFCFA(missing)} en moins${resto.paid && resto.paymentMethod !== "Espèces" ? " (remboursés)" : ""}`,
      });
    }
    return orderActions.setStatus(id, "confirmed", "quantités ajustées par le producteur");
  },
  setStatus: (
    id: string,
    status: OrderStatus,
    note?: string,
    actor: OrderActor = "farmer",
  ): TransitionCheck => {
    const order = ordersStore.get().find((o) => o.id === id);
    if (!order) return { ok: false, message: "Commande introuvable." };
    return transitionOrder(order.reference, status, actor, note);
  },
  create: (o: Omit<Order, "id">) => {
    const id = `o${Date.now()}_${Math.floor(Math.random() * 1000)}`;
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
  create: (w: { method: PaymentMethod; amount: number; farmerId?: string }) => {
    const id = `wd${Date.now()}`;
    const fee = Math.round(w.amount * 0.005);
    withdrawalsStore.set((arr) => [
      {
        id,
        farmerId: w.farmerId ?? "f1",
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
  /** Confirme qu'un retrait "En cours" est réellement arrivé — sans ça, le
   * solde disponible (farmer.revenue) le comptait comme déjà retiré à vie,
   * sans jamais libérer ni confirmer la sortie réelle des fonds. */
  markCompleted: (id: string) => {
    withdrawalsStore.set((arr) =>
      arr.map((w) => (w.id === id && w.status === "En cours" ? { ...w, status: "Effectué" } : w)),
    );
  },
  /** Échec réel : le solde redevient disponible (le calcul de `available`
   * exclut déjà les retraits "Échec" du total déjà retiré). */
  markFailed: (id: string) => {
    withdrawalsStore.set((arr) =>
      arr.map((w) => (w.id === id && w.status === "En cours" ? { ...w, status: "Échec" } : w)),
    );
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
  /** « Recommander » : remet dans le panier les produits d'une commande
   * passée, dans la limite du stock actuel. Renvoie les produits manquants. */
  reorder: (items: { productId: string; qty: number }[]) => {
    const unavailable: string[] = [];
    items.forEach((i) => {
      const p = productsStore.get().find((x) => x.id === i.productId);
      if (!p || p.status === "draft" || p.stock <= 0) {
        unavailable.push(p?.name ?? i.productId);
        return;
      }
      cartActions.add(i.productId, i.qty);
    });
    return unavailable;
  },
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
  setPriority: (conversationId: string, priority: "normal" | "important" | "urgent") => {
    conversationsStore.set((arr) =>
      arr.map((c) => (c.id === conversationId ? { ...c, priority } : c)),
    );
  },
  setTags: (conversationId: string, tags: string[]) => {
    conversationsStore.set((arr) => arr.map((c) => (c.id === conversationId ? { ...c, tags } : c)));
  },
  addInternalNote: (conversationId: string, actor: string, text: string) => {
    conversationsStore.set((arr) =>
      arr.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              internalNotes: [
                ...(c.internalNotes ?? []),
                { id: `note_${Date.now()}`, at: new Date().toISOString(), actor, text },
              ],
            }
          : c,
      ),
    );
  },
  linkTicket: (conversationId: string, ticketId: string) => {
    conversationsStore.set((arr) =>
      arr.map((c) => (c.id === conversationId ? { ...c, ticketId } : c)),
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
  const delivery = deliveryFeeFor(ro.deliveryAddress);
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
  const finalDelivery = deliveryFeeFor(ro.deliveryAddress);
  const finalTotal = finalSubtotal + finalDelivery;

  const newOrderId = restaurantOrderActions.create(
    {
      farmerId: ro.farmerId,
      items: effectiveItems.map((it) => ({
        productId: it.productId,
        qty: it.qty,
        price: priceOf(it.productId),
      })),
      subtotal: finalSubtotal,
      deliveryFee: finalDelivery,
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

// Le bénéficiaire d'un remboursement est prévenu quand l'argent part vraiment.
onRefundPaid((r) => {
  const restaurant = restaurants.find((x) => x.id === "r1");
  if (r.requester === restaurant?.name) {
    restaurantNotifActions.add({
      type: "payment",
      title: "Remboursement effectué",
      body: `${formatFCFA(r.amount)} versés sur ${r.method} (${r.reference} · ${r.orderRef})`,
    });
  }
});

/* ------------------------------------------------------------------ */
/* Renouvellement des documents du véhicule (assurance, contrôle        */
/* technique) : le livreur envoie la nouvelle échéance et la photo, un  */
/* admin valide — avant, un document expiré bloquait le livreur à vie. */
/* ------------------------------------------------------------------ */

export type DocRenewal = {
  id: string;
  driverId: string;
  driverName: string;
  doc: "insurance" | "inspection";
  newExpiry: string;
  photos: MissionProofPhoto[];
  status: "pending" | "approved" | "rejected";
  at: string;
  decidedAt?: string;
  decidedBy?: string;
  note?: string;
};

export const DOC_LABEL: Record<DocRenewal["doc"], string> = {
  insurance: "Assurance",
  inspection: "Contrôle technique",
};

const docRenewalsStore = createStore<DocRenewal[]>([], "diambar:driver-doc-renewals");

export function useDocRenewals() {
  return useSyncExternalStore(
    docRenewalsStore.subscribe,
    docRenewalsStore.get,
    docRenewalsStore.get,
  );
}

export const docRenewalActions = {
  submit: (input: {
    doc: DocRenewal["doc"];
    newExpiry: string;
    photos: MissionProofPhoto[];
    driverId?: string;
    driverName?: string;
  }): TransitionCheck => {
    if (input.photos.length === 0) return { ok: false, message: "Ajoutez la photo du document." };
    if (new Date(input.newExpiry).getTime() <= Date.now()) {
      return { ok: false, message: "La nouvelle date d'expiration doit être dans le futur." };
    }
    const driverId = input.driverId ?? "d1";
    docRenewalsStore.set((arr) => [
      {
        id: `doc_${Date.now()}`,
        driverId,
        driverName: input.driverName ?? driverPool.find((d) => d.id === driverId)?.name ?? driverId,
        doc: input.doc,
        newExpiry: input.newExpiry,
        photos: input.photos,
        status: "pending",
        at: new Date().toISOString(),
      },
      ...arr.filter(
        (r) => !(r.driverId === driverId && r.doc === input.doc && r.status === "pending"),
      ),
    ]);
    return { ok: true };
  },
  approve: (id: string, actor: string) => {
    const r = docRenewalsStore.get().find((x) => x.id === id);
    if (!r || r.status !== "pending") return;
    docRenewalsStore.set((arr) =>
      arr.map((x) =>
        x.id === id
          ? { ...x, status: "approved", decidedAt: new Date().toISOString(), decidedBy: actor }
          : x,
      ),
    );
    if (r.driverId === "d1") {
      vehicleActions.update(
        r.doc === "insurance"
          ? { insuranceExpiry: r.newExpiry }
          : { inspectionExpiry: r.newExpiry },
      );
      driverNotifActions.add({
        type: "system",
        title: "Document validé",
        body: `${DOC_LABEL[r.doc]} valable jusqu'au ${new Date(r.newExpiry).toLocaleDateString("fr-FR")}`,
        link: "/driver/vehicle",
      });
    }
  },
  reject: (id: string, actor: string, note: string) => {
    const r = docRenewalsStore.get().find((x) => x.id === id);
    if (!r || r.status !== "pending") return;
    docRenewalsStore.set((arr) =>
      arr.map((x) =>
        x.id === id
          ? {
              ...x,
              status: "rejected",
              decidedAt: new Date().toISOString(),
              decidedBy: actor,
              note,
            }
          : x,
      ),
    );
    if (r.driverId === "d1") {
      driverNotifActions.add({
        type: "system",
        title: "Document refusé",
        body: `${DOC_LABEL[r.doc]} : ${note}`,
        link: "/driver/vehicle",
      });
    }
  },
};
