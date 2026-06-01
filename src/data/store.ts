import { useSyncExternalStore } from "react";
import {
  products as seedProducts,
  orders as seedOrders,
  stockMovements as seedMovements,
  withdrawals as seedWithdrawals,
  restaurantOrders as seedRestaurantOrders,
  type Product,
  type Order,
  type OrderStatus,
  type StockMovement,
  type Withdrawal,
  type PaymentMethod,
  type RestaurantOrder,
} from "./mocks";

type Listener = () => void;

function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    set: (next: T | ((prev: T) => T)) => {
      state = typeof next === "function" ? (next as (p: T) => T)(state) : next;
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

export type CartLine = { productId: string; qty: number };
const cartStore = createStore<CartLine[]>([]);

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

export function useRestaurantOrders() {
  return useSyncExternalStore(restaurantOrdersStore.subscribe, restaurantOrdersStore.get, restaurantOrdersStore.get);
}
export function useRestaurantOrder(id: string) {
  return useRestaurantOrders().find((o) => o.id === id) ?? null;
}

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