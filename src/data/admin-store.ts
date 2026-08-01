import { useSyncExternalStore } from "react";
import {
  platformUsers as seedUsers,
  validationRequests as seedValidations,
  disputes as seedDisputes,
  auditLogs as seedLogs,
  moderationQueue as seedModeration,
  commissionTiers as seedTiers,
  deliveryZones as seedZones,
  type PlatformUser,
  type PlatformUserStatus,
  type ValidationRequest,
  type Dispute,
  type AuditLog,
  type ModerationItem,
} from "./admin-mocks";

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

const usersStore = createStore<PlatformUser[]>(seedUsers, "diambar:admin-users");
const validationsStore = createStore<ValidationRequest[]>(seedValidations, "diambar:admin-validations");
const disputesStore = createStore<Dispute[]>(seedDisputes, "diambar:admin-disputes");
const logsStore = createStore<AuditLog[]>(seedLogs, "diambar:admin-logs");
const moderationStore = createStore<ModerationItem[]>(seedModeration, "diambar:admin-moderation");
const tiersStore = createStore(seedTiers, "diambar:admin-tiers");
const zonesStore = createStore(seedZones, "diambar:admin-zones");

export function usePlatformUsers() {
  return useSyncExternalStore(usersStore.subscribe, usersStore.get, usersStore.get);
}
export function usePlatformUser(id: string) {
  return usePlatformUsers().find((u) => u.id === id) ?? null;
}
export function useValidations() {
  return useSyncExternalStore(validationsStore.subscribe, validationsStore.get, validationsStore.get);
}
export function useValidation(id: string) {
  return useValidations().find((v) => v.id === id) ?? null;
}
export function useDisputes() {
  return useSyncExternalStore(disputesStore.subscribe, disputesStore.get, disputesStore.get);
}
export function useDispute(id: string) {
  return useDisputes().find((d) => d.id === id) ?? null;
}
export function useAuditLogs() {
  return useSyncExternalStore(logsStore.subscribe, logsStore.get, logsStore.get);
}
export function useModerationQueue() {
  return useSyncExternalStore(moderationStore.subscribe, moderationStore.get, moderationStore.get);
}
export function useCommissionTiers() {
  return useSyncExternalStore(tiersStore.subscribe, tiersStore.get, tiersStore.get);
}
export function useDeliveryZones() {
  return useSyncExternalStore(zonesStore.subscribe, zonesStore.get, zonesStore.get);
}

export const auditActions = {
  log: (action: string, target: string, level: AuditLog["level"] = "info", actor = "Admin Diambar") => {
    logsStore.set((arr) => [{ id: `al_${Date.now()}`, at: new Date().toISOString(), actor, action, target, level }, ...arr]);
  },
};

export const adminUserActions = {
  setStatus: (id: string, status: PlatformUserStatus) => {
    usersStore.set((arr) => arr.map((u) => (u.id === id ? { ...u, status } : u)));
  },
  setVerified: (id: string, verified: boolean) => {
    usersStore.set((arr) => arr.map((u) => (u.id === id ? { ...u, verified } : u)));
  },
  remove: (id: string) => usersStore.set((arr) => arr.filter((u) => u.id !== id)),
};

export const validationActions = {
  approve: (id: string) => {
    const req = validationsStore.get().find((v) => v.id === id);
    validationsStore.set((arr) => arr.map((v) => (v.id === id ? { ...v, status: "approved" } : v)));
    if (req) {
      adminUserActions.setStatus(req.userId, "active");
      adminUserActions.setVerified(req.userId, true);
      auditActions.log("Validation de compte approuvée", req.userId, "info");
    }
  },
  reject: (id: string, note?: string) => {
    const req = validationsStore.get().find((v) => v.id === id);
    validationsStore.set((arr) => arr.map((v) => (v.id === id ? { ...v, status: "rejected", note } : v)));
    if (req) {
      adminUserActions.setStatus(req.userId, "rejected");
      auditActions.log("Validation de compte rejetée", req.userId, "warning");
    }
  },
};

export const disputeActions = {
  setStatus: (id: string, status: Dispute["status"], text?: string) => {
    disputesStore.set((arr) =>
      arr.map((d) =>
        d.id === id
          ? {
              ...d,
              status,
              timeline: [...d.timeline, { at: new Date().toISOString(), actor: "Support Diambar", text: text ?? `Statut mis à jour : ${status}` }],
            }
          : d,
      ),
    );
    auditActions.log("Litige mis à jour", id, status === "resolved" ? "info" : "warning");
  },
  comment: (id: string, text: string) => {
    disputesStore.set((arr) =>
      arr.map((d) => (d.id === id ? { ...d, timeline: [...d.timeline, { at: new Date().toISOString(), actor: "Support Diambar", text }] } : d)),
    );
  },
};

export const moderationActions = {
  approve: (id: string) => {
    moderationStore.set((arr) => arr.map((m) => (m.id === id ? { ...m, status: "approved" } : m)));
    auditActions.log("Produit approuvé (modération)", id, "info");
  },
  remove: (id: string) => {
    moderationStore.set((arr) => arr.map((m) => (m.id === id ? { ...m, status: "removed" } : m)));
    auditActions.log("Produit retiré (modération)", id, "warning");
  },
};

export const platformSettingsActions = {
  setTierRate: (id: string, rate: number) => {
    tiersStore.set((arr) => arr.map((t) => (t.id === id ? { ...t, rate } : t)));
    auditActions.log("Commission modifiée", id, "info");
  },
  toggleZone: (id: string) => {
    zonesStore.set((arr) => arr.map((z) => (z.id === id ? { ...z, active: !z.active } : z)));
    auditActions.log("Zone de livraison modifiée", id, "info");
  },
  setZoneFee: (id: string, baseFee: number) => {
    zonesStore.set((arr) => arr.map((z) => (z.id === id ? { ...z, baseFee } : z)));
  },
};