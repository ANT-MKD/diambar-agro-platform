import { useEffect, useSyncExternalStore } from "react";
import {
  platformUsers as seedUsers,
  validationRequests as seedValidations,
  auditLogs as seedLogs,
  moderationQueue as seedModeration,
  commissionTiers as seedTiers,
  deliveryZones as seedZones,
  type PlatformUser,
  type PlatformUserStatus,
  type ValidationRequest,
  type AuditLog,
  type ModerationItem,
} from "./admin-mocks";
import { useAllDisputes } from "./disputes";
import { useIncidents } from "./business";
import { farmerNotifActions, restaurantNotifActions, driverNotifActions } from "./store";

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

const usersStore = createStore<PlatformUser[]>(seedUsers, "diambar:admin-users");
const validationsStore = createStore<ValidationRequest[]>(
  seedValidations,
  "diambar:admin-validations",
);
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
  return useSyncExternalStore(
    validationsStore.subscribe,
    validationsStore.get,
    validationsStore.get,
  );
}
export function useValidation(id: string) {
  return useValidations().find((v) => v.id === id) ?? null;
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
  log: (
    action: string,
    target: string,
    level: AuditLog["level"] = "info",
    actor = "Admin Diambar",
  ) => {
    logsStore.set((arr) => [
      { id: `al_${Date.now()}`, at: new Date().toISOString(), actor, action, target, level },
      ...arr,
    ]);
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

export type AdminRoleName =
  "Super Administrateur" | "Finance" | "Opérations" | "Support" | "Modération";

export const ADMIN_ROLE_NAMES: AdminRoleName[] = [
  "Super Administrateur",
  "Finance",
  "Opérations",
  "Support",
  "Modération",
];

export type AdminPermissionCategory = "Utilisateurs" | "Finance" | "Commandes" | "Paramètres";

/**
 * Détermine ce que chaque rôle admin peut voir/modifier — configure
 * l'affichage de la page Administrateurs, ce n'est pas (encore) un moteur
 * qui bloque les routes : un vrai RBAC appliqué partout serait un chantier
 * séparé, plus large que cette page.
 */
export const ADMIN_ROLE_PERMISSIONS: Record<
  AdminRoleName,
  Record<AdminPermissionCategory, { view: boolean; edit: boolean }>
> = {
  "Super Administrateur": {
    Utilisateurs: { view: true, edit: true },
    Finance: { view: true, edit: true },
    Commandes: { view: true, edit: true },
    Paramètres: { view: true, edit: true },
  },
  Finance: {
    Utilisateurs: { view: true, edit: false },
    Finance: { view: true, edit: true },
    Commandes: { view: true, edit: false },
    Paramètres: { view: false, edit: false },
  },
  Opérations: {
    Utilisateurs: { view: true, edit: false },
    Finance: { view: false, edit: false },
    Commandes: { view: true, edit: true },
    Paramètres: { view: false, edit: false },
  },
  Support: {
    Utilisateurs: { view: true, edit: false },
    Finance: { view: false, edit: false },
    Commandes: { view: true, edit: false },
    Paramètres: { view: false, edit: false },
  },
  Modération: {
    Utilisateurs: { view: true, edit: false },
    Finance: { view: false, edit: false },
    Commandes: { view: false, edit: false },
    Paramètres: { view: false, edit: false },
  },
};

const adminRolesStore = createStore<Record<string, AdminRoleName>>(
  { u13: "Super Administrateur" },
  "diambar:admin-roles",
);

export function useAdminRoles(): Record<string, AdminRoleName> {
  return useSyncExternalStore(adminRolesStore.subscribe, adminRolesStore.get, adminRolesStore.get);
}

export function useAdminRole(userId: string): AdminRoleName {
  return useAdminRoles()[userId] ?? "Support";
}

export const adminRoleActions = {
  setRole: (userId: string, role: AdminRoleName, actor: string) => {
    adminRolesStore.set((r) => ({ ...r, [userId]: role }));
    auditActions.log(`Rôle admin changé pour "${role}"`, actor, "critical");
  },
};

function notifyApplicant(type: ValidationRequest["type"], title: string, body: string) {
  const actions =
    type === "farmer"
      ? farmerNotifActions
      : type === "driver"
        ? driverNotifActions
        : restaurantNotifActions;
  actions.add({ type: "system", title, body });
}

function nameFor(userId: string) {
  return usersStore.get().find((u) => u.id === userId)?.name ?? userId;
}

export const validationActions = {
  approve: (id: string) => {
    const req = validationsStore.get().find((v) => v.id === id);
    validationsStore.set((arr) => arr.map((v) => (v.id === id ? { ...v, status: "approved" } : v)));
    if (req) {
      adminUserActions.setStatus(req.userId, "active");
      adminUserActions.setVerified(req.userId, true);
      auditActions.log("Validation de compte approuvée", nameFor(req.userId), "info");
      notifyApplicant(
        req.type,
        "Compte activé",
        "Votre dossier a été validé : vous avez maintenant accès à toutes les fonctionnalités de votre espace.",
      );
    }
  },
  reject: (id: string, note?: string) => {
    const req = validationsStore.get().find((v) => v.id === id);
    validationsStore.set((arr) =>
      arr.map((v) => (v.id === id ? { ...v, status: "rejected", note } : v)),
    );
    if (req) {
      adminUserActions.setStatus(req.userId, "rejected");
      auditActions.log("Validation de compte rejetée", nameFor(req.userId), "warning");
      notifyApplicant(
        req.type,
        "Dossier refusé",
        note
          ? `Votre dossier d'inscription a été refusé : ${note}`
          : "Votre dossier d'inscription a été refusé.",
      );
    }
  },
  setDocStatus: (id: string, docLabel: string, ok: boolean) => {
    const req = validationsStore.get().find((v) => v.id === id);
    validationsStore.set((arr) =>
      arr.map((v) =>
        v.id === id
          ? {
              ...v,
              docs: v.docs.map((d) =>
                d.label === docLabel ? { ...d, ok, note: ok ? undefined : d.note } : d,
              ),
            }
          : v,
      ),
    );
    if (req) {
      auditActions.log(
        ok ? `Document conforme : ${docLabel}` : `Document marqué non conforme : ${docLabel}`,
        nameFor(req.userId),
        ok ? "info" : "warning",
      );
    }
  },
  requestCorrection: (id: string, docLabel: string, reasons: string[], comment: string) => {
    const req = validationsStore.get().find((v) => v.id === id);
    if (!req) return;
    const reasonText = reasons.length ? reasons.join(", ") : "Autre";
    const noteText = comment.trim() ? `${reasonText} — ${comment.trim()}` : reasonText;
    validationsStore.set((arr) =>
      arr.map((v) =>
        v.id === id
          ? {
              ...v,
              status: "needs_correction",
              docs: v.docs.map((d) =>
                d.label === docLabel ? { ...d, ok: false, note: noteText } : d,
              ),
            }
          : v,
      ),
    );
    auditActions.log(
      `Correction demandée : ${docLabel} (${reasonText})`,
      nameFor(req.userId),
      "warning",
    );
    notifyApplicant(
      req.type,
      "Document à corriger",
      `« ${docLabel} » nécessite une correction : ${noteText}`,
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

export type AdminNotification = {
  id: string;
  kind: "validation" | "dispute" | "moderation" | "incident";
  refId: string;
  title: string;
  body: string;
  at: string;
};

// Starts empty on both server and first client render (unlike createStore's
// persistKey option, which reads localStorage synchronously at module load
// and would make the client's first paint disagree with the SSR markup).
// The localStorage value is loaded after mount instead, in a useEffect below.
const notifsReadStore = createStore<string[]>([]);
const NOTIFS_READ_KEY = "diambar:admin-notifs-read";

function loadPersistedReadIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(NOTIFS_READ_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function persistReadIds(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NOTIFS_READ_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

/**
 * Pas de store de notifications dédié : la liste est dérivée en direct des
 * files d'attente réelles (validations, litiges, modération) plutôt que
 * dupliquée dans un store parallèle qui pourrait se désynchroniser.
 */
export function useAdminNotifications(): (AdminNotification & { read: boolean })[] {
  const validations = useValidations();
  const disputes = useAllDisputes();
  const moderation = useModerationQueue();
  const incidents = useIncidents();
  const readIds = useSyncExternalStore(
    notifsReadStore.subscribe,
    notifsReadStore.get,
    notifsReadStore.get,
  );

  useEffect(() => {
    const persisted = loadPersistedReadIds();
    if (persisted.length > 0) notifsReadStore.set(persisted);
  }, []);

  const items: AdminNotification[] = [
    ...validations
      .filter((v) => v.status === "pending")
      .map((v) => ({
        id: `validation-${v.id}`,
        kind: "validation" as const,
        refId: v.id,
        title: "Validation en attente",
        body: `Dossier ${v.type} à examiner (${v.docs.length} document(s))`,
        at: v.submittedAt,
      })),
    ...disputes
      .filter((d) => d.status === "open" || d.status === "investigating")
      .map((d) => ({
        id: `dispute-${d.id}`,
        kind: "dispute" as const,
        refId: d.id,
        title: "Litige ouvert",
        body: `${d.reference} — ${d.subcategory} (${d.openedByName} vs ${d.againstName})`,
        at: d.openedAt,
      })),
    ...moderation
      .filter((m) => m.status === "pending")
      .map((m) => ({
        id: `moderation-${m.id}`,
        kind: "moderation" as const,
        refId: m.id,
        title: "Produit signalé",
        body: `${m.name} — ${m.reason}`,
        at: m.reportedAt,
      })),
    ...incidents
      .filter((i) => i.status === "escalated")
      .map((i) => ({
        id: `incident-${i.id}`,
        kind: "incident" as const,
        refId: i.id,
        title: "Incident escaladé au support",
        body: `${i.reference} — mission ${i.missionRef}, indemnité demandée ${i.compensationRequested.toLocaleString("fr-FR")} FCFA`,
        at: i.createdAt,
      })),
  ];

  return items
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .map((n) => ({ ...n, read: readIds.includes(n.id) }));
}

export const adminNotifActions = {
  markRead: (id: string) => {
    notifsReadStore.set((arr) => {
      const next = arr.includes(id) ? arr : [...arr, id];
      persistReadIds(next);
      return next;
    });
  },
  markAllRead: (ids: string[]) => {
    notifsReadStore.set((arr) => {
      const next = Array.from(new Set([...arr, ...ids]));
      persistReadIds(next);
      return next;
    });
  },
};
