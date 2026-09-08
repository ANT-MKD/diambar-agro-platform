import { useSyncExternalStore } from "react";

export type Impersonation = { userId: string; name: string; role: string; startedAt: string } | null;

type Listener = () => void;
const KEY = "diambar:impersonation";

let state: Impersonation = null;
if (typeof window !== "undefined") {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = JSON.parse(raw) as Impersonation;
  } catch { /* ignore */ }
}

const listeners = new Set<Listener>();
function set(next: Impersonation) {
  state = next;
  if (typeof window !== "undefined") {
    try {
      if (next) window.localStorage.setItem(KEY, JSON.stringify(next));
      else window.localStorage.removeItem(KEY);
    } catch { /* ignore */ }
  }
  listeners.forEach((l) => l());
}

export function useImpersonation() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => state,
    () => null as Impersonation,
  );
}

export const impersonationActions = {
  start: (userId: string, name: string, role: string) => set({ userId, name, role, startedAt: new Date().toISOString() }),
  stop: () => set(null),
};
