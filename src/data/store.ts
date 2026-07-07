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
  type RecurringOrder,
  type Mission,
  type MissionStatus,
} from "./mocks";

type Listener = () => void;

function createStore<T>(initial: T, persistKey?: string) {
  let state = initial;
  if (persistKey && typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(persistKey);
      if (raw) state = JSON.parse(raw) as T;
    } catch { /* ignore */ }
  }
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    set: (next: T | ((prev: T) => T)) => {
      state = typeof next === "function" ? (next as (p: T) => T)(state) : next;
      if (persistKey && typeof window !== "undefined") {
        try { window.localStorage.setItem(persistKey, JSON.stringify(state)); } catch { /* ignore */ }
      }
      listeners.forEach((l) => l());
    },
    subscribe: (l: Listener) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

const productsStore = createStore<Product[]>(seedProducts);
const ordersStore = createStore<Order[]>(seedOrders);
const movementsStore = createStore<StockMovement[]>(seedMovements);
const withdrawalsStore = createStore<Withdrawal[]>(seedWithdrawals);
const restaurantOrdersStore = createStore<RestaurantOrder[]>(seedRestaurantOrders);
const suppliersStore = createStore<Supplier[]>(seedSuppliers);
const farmerNotifsStore = createStore<AppNotification[]>(seedFarmerNotifs);
const restoNotifsStore = createStore<AppNotification[]>(seedRestoNotifs);
const driverNotifsStore = createStore<AppNotification[]>(seedDriverNotifs);
const missionsStore = createStore<Mission[]>(seedMissions, "diambar:missions");
const driverConvosStore = createStore<Conversation[]>(seedDriverConvos, "diambar:driver-convos");
const driverOnlineStore = createStore<boolean>(true, "diambar:driver-online");

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
  return useSyncExternalStore(withdrawalsStore.subscribe, withdrawalsStore.get, withdrawalsStore.get);
}
export function useCart() {
  return useSyncExternalStore(cartStore.subscribe, cartStore.get, cartStore.get);
}

export function useWishlist() {
  return useSyncExternalStore(wishlistStore.subscribe, wishlistStore.get, wishlistStore.get);
}
export function useConversations() {
  return useSyncExternalStore(conversationsStore.subscribe, conversationsStore.get, conversationsStore.get);
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
  return useSyncExternalStore(restaurantOrdersStore.subscribe, restaurantOrdersStore.get, restaurantOrdersStore.get);
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
  return useSyncExternalStore(farmerNotifsStore.subscribe, farmerNotifsStore.get, farmerNotifsStore.get);
}
export function useRestaurantNotifications() {
  return useSyncExternalStore(restoNotifsStore.subscribe, restoNotifsStore.get, restoNotifsStore.get);
}
export function useDriverNotifications() {
  return useSyncExternalStore(driverNotifsStore.subscribe, driverNotifsStore.get, driverNotifsStore.get);
}
export function useMissions() {
  return useSyncExternalStore(missionsStore.subscribe, missionsStore.get, missionsStore.get);
}
export function useMission(id: string) {
  return useMissions().find((m) => m.id === id) ?? null;
}
export function useDriverConversations() {
  return useSyncExternalStore(driverConvosStore.subscribe, driverConvosStore.get, driverConvosStore.get);
}
export function useDriverConversation(id: string) {
  return useDriverConversations().find((c) => c.id === id) ?? null;
}
export function useDriverOnline() {
  return useSyncExternalStore(driverOnlineStore.subscribe, driverOnlineStore.get, driverOnlineStore.get);
}

function makeNotifActions(store: ReturnType<typeof createStore<AppNotification[]>>) {
  return {
    markRead: (id: string) =>
      store.set((arr) => arr.map((n) => (n.id === id ? { ...n, read: true } : n))),
    markAllRead: () => store.set((arr) => arr.map((n) => ({ ...n, read: true }))),
    remove: (id: string) => store.set((arr) => arr.filter((n) => n.id !== id)),
    add: (n: Omit<AppNotification, "id" | "at" | "read"> & { id?: string; at?: string; read?: boolean }) => {
      const id = n.id ?? `n_${Date.now()}`;
      store.set((arr) => [{
        id,
        at: n.at ?? new Date().toISOString(),
        read: n.read ?? false,
        type: n.type,
        title: n.title,
        body: n.body,
      }, ...arr]);
      return id;
    },
  };
}

export const farmerNotifActions = makeNotifActions(farmerNotifsStore);
export const restaurantNotifActions = makeNotifActions(restoNotifsStore);
export const driverNotifActions = makeNotifActions(driverNotifsStore);

export const missionActions = {
  setStatus: (id: string, status: MissionStatus) => {
    missionsStore.set((arr) => arr.map((m) => (m.id === id ? { ...m, status } : m)));
  },
  accept: (id: string, driverId = "d1") => {
    missionsStore.set((arr) => arr.map((m) => (m.id === id ? { ...m, driverId, status: "accepted" } : m)));
  },
  cancel: (id: string) => {
    missionsStore.set((arr) => arr.map((m) => (m.id === id ? { ...m, status: "cancelled" } : m)));
  },
};

export const driverConversationActions = {
  send: (conversationId: string, text: string, from: "me" | "them" = "me") => {
    const msg = { id: `m_${Date.now()}`, from, text, at: new Date().toISOString() };
    driverConvosStore.set((arr) => arr.map((c) => c.id === conversationId ? { ...c, messages: [...c.messages, msg], lastMessage: text, lastAt: msg.at } : c));
  },
  markRead: (conversationId: string) => {
    driverConvosStore.set((arr) => arr.map((c) => c.id === conversationId ? { ...c, unread: 0 } : c));
  },
};

export const driverOnlineActions = {
  toggle: () => driverOnlineStore.set((v) => !v),
  set: (v: boolean) => driverOnlineStore.set(v),
};

export const supplierActions = {
  create: (s: Omit<Supplier, "id" | "totalOrders" | "totalSpent" | "lastOrder" | "suspended"> & { suspended?: boolean }) => {
    const id = `sup_${Date.now()}`;
    const next: Supplier = { ...s, id, suspended: s.suspended ?? false, lastOrder: "—", totalOrders: 0, totalSpent: 0 };
    suppliersStore.set((arr) => [next, ...arr]);
    return id;
  },
  update: (id: string, patch: Partial<Supplier>) => {
    suppliersStore.set((arr) => arr.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  },
  toggleSuspend: (id: string) => {
    suppliersStore.set((arr) => arr.map((s) => (s.id === id ? { ...s, suspended: !s.suspended } : s)));
  },
  toggleFavorite: (id: string) => {
    suppliersStore.set((arr) => arr.map((s) => (s.id === id ? { ...s, favorite: !s.favorite } : s)));
  },
  remove: (id: string) => {
    suppliersStore.set((arr) => arr.filter((s) => s.id !== id));
  },
};

export const restaurantOrderActions = {
  create: (o: Omit<RestaurantOrder, "id" | "reference" | "createdAt" | "status">) => {
    const id = `ro_${Date.now()}`;
    const reference = `CMD-${String(3100 + Math.floor(Math.random() * 899)).padStart(4, "0")}`;
    const next: RestaurantOrder = { ...o, id, reference, status: "pending", createdAt: new Date().toISOString() };
    restaurantOrdersStore.set((arr) => [next, ...arr]);
    return id;
  },
  setStatus: (id: string, status: OrderStatus) => {
    restaurantOrdersStore.set((arr) => arr.map((o) => (o.id === id ? { ...o, status } : o)));
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
    productsStore.set((arr) => arr.map((p) => (p.id === id ? recomputeStatus({ ...p, ...patch }) : p)));
  },
  remove: (id: string) => {
    productsStore.set((arr) => arr.filter((p) => p.id !== id));
  },
  adjustStock: (id: string, delta: number, _reason?: string) => {
    productsStore.set((arr) => arr.map((p) => (p.id === id ? recomputeStatus({ ...p, stock: Math.max(0, p.stock + delta) }) : p)));
  },
  setStock: (id: string, stock: number) => {
    productsStore.set((arr) => arr.map((p) => (p.id === id ? recomputeStatus({ ...p, stock: Math.max(0, stock) }) : p)));
  },
};

export const orderActions = {
  setStatus: (id: string, status: OrderStatus) => {
    ordersStore.set((arr) => arr.map((o) => (o.id === id ? { ...o, status } : o)));
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
    withdrawalsStore.set((arr) => [{
      id,
      date: new Date().toISOString().slice(0, 10),
      method: w.method,
      amount: w.amount,
      fee,
      status: "En cours",
      reference: `WD-${id.slice(-4).toUpperCase()}`,
    }, ...arr]);
    return id;
  },
};

export const cartActions = {
  add: (productId: string, qty = 1) => {
    cartStore.set((arr) => {
      const existing = arr.find((l) => l.productId === productId);
      if (existing) return arr.map((l) => l.productId === productId ? { ...l, qty: l.qty + qty } : l);
      return [...arr, { productId, qty }];
    });
  },
  setQty: (productId: string, qty: number) => {
    cartStore.set((arr) => qty <= 0 ? arr.filter((l) => l.productId !== productId) : arr.map((l) => l.productId === productId ? { ...l, qty } : l));
  },
  remove: (productId: string) => {
    cartStore.set((arr) => arr.filter((l) => l.productId !== productId));
  },
  clear: () => cartStore.set([]),
};

export const wishlistActions = {
  toggle: (productId: string) => {
    wishlistStore.set((arr) => arr.includes(productId) ? arr.filter((x) => x !== productId) : [...arr, productId]);
  },
  remove: (productId: string) => wishlistStore.set((arr) => arr.filter((x) => x !== productId)),
  clear: () => wishlistStore.set([]),
};

export const conversationActions = {
  send: (conversationId: string, text: string, from: "me" | "them" = "me") => {
    const msg = { id: `m_${Date.now()}`, from, text, at: new Date().toISOString() };
    conversationsStore.set((arr) => arr.map((c) => c.id === conversationId ? { ...c, messages: [...c.messages, msg], lastMessage: text, lastAt: msg.at } : c));
  },
  markRead: (conversationId: string) => {
    conversationsStore.set((arr) => arr.map((c) => c.id === conversationId ? { ...c, unread: 0 } : c));
  },
};

export const recurringActions = {
  toggle: (id: string) => recurringStore.set((arr) => arr.map((r) => r.id === id ? { ...r, active: !r.active } : r)),
  skipNext: (id: string) => recurringStore.set((arr) => arr.map((r) => {
    if (r.id !== id) return r;
    const d = new Date(r.nextDelivery === "—" ? Date.now() : r.nextDelivery);
    const days = r.frequency === "weekly" ? 7 : r.frequency === "biweekly" ? 14 : 30;
    d.setDate(d.getDate() + days);
    return { ...r, nextDelivery: d.toISOString().slice(0, 10) };
  })),
  remove: (id: string) => recurringStore.set((arr) => arr.filter((r) => r.id !== id)),
};

export const onboardingActions = {
  toggle: (key: string) => onboardingStore.set((m) => ({ ...m, [key]: !m[key] })),
  set: (key: string, done: boolean) => onboardingStore.set((m) => ({ ...m, [key]: done })),
  dismiss: (key: string) => onboardingStore.set((m) => ({ ...m, [`__dismiss_${key}`]: true })),
};