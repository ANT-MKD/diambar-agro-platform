import { useSyncExternalStore } from "react";
import { ensureDataVersion } from "./persist";

export type BudgetState = {
  monthly: number;
  alertThreshold: number; // pourcentage
  categories: { key: string; label: string; allocated: number }[];
};

type Listener = () => void;
const KEY = "diambar:restaurant-budget";

const initial: BudgetState = {
  monthly: 1200000,
  alertThreshold: 80,
  categories: [
    { key: "legumes", label: "Légumes", allocated: 450000 },
    { key: "fruits", label: "Fruits", allocated: 220000 },
    { key: "cereales", label: "Céréales & tubercules", allocated: 260000 },
    { key: "proteines", label: "Volaille & protéines", allocated: 200000 },
    { key: "autres", label: "Autres", allocated: 70000 },
  ],
};

let state: BudgetState = initial;
if (typeof window !== "undefined") {
  ensureDataVersion();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...initial, ...(JSON.parse(raw) as BudgetState) };
  } catch {
    /* ignore */
  }
}

const listeners = new Set<Listener>();
function set(next: (p: BudgetState) => BudgetState) {
  state = next(state);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }
  listeners.forEach((l) => l());
}

export function useBudget() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

export const budgetActions = {
  setMonthly: (v: number) => set((s) => ({ ...s, monthly: Math.max(0, v) })),
  setThreshold: (v: number) =>
    set((s) => ({ ...s, alertThreshold: Math.min(100, Math.max(10, v)) })),
  setCategory: (key: string, allocated: number) =>
    set((s) => ({
      ...s,
      categories: s.categories.map((c) =>
        c.key === key ? { ...c, allocated: Math.max(0, allocated) } : c,
      ),
    })),
  reset: () => set(() => initial),
};

/** Historique de dépenses mensuelles (mock) */
export const budgetHistory = [
  { month: "Déc", spent: 980000, budget: 1100000 },
  { month: "Jan", spent: 1045000, budget: 1100000 },
  { month: "Fév", spent: 890000, budget: 1100000 },
  { month: "Mar", spent: 1160000, budget: 1200000 },
  { month: "Avr", spent: 1075000, budget: 1200000 },
  { month: "Mai", spent: 842000, budget: 1200000 },
];
