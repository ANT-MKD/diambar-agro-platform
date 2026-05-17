import { useSyncExternalStore } from "react";
import { products as seedProducts, orders as seedOrders, type Product, type Order, type OrderStatus } from "./mocks";

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