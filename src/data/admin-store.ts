import { useEffect, useSyncExternalStore } from "react";
import {
  platformUsers as seedUsers,
  validationRequests as seedValidations,
  auditLogs as seedLogs,
  moderationQueue as seedModeration,
  commissionTiers as seedTiers,
  deliveryZones as seedZones,
  refundSettings as seedRefundSettings,
  type PlatformUser,
  type PlatformUserStatus,
  type ValidationRequest,
  type AuditLog,
  type AuditModule,
  type AuditLevel,
  type AuditStatus,
  type AuditChange,
  type ModerationItem,
  AUDIT_MODULE_LABEL,
} from "./admin-mocks";
import { useAllDisputes } from "./disputes";
import { useIncidents, useReturns } from "./business";
import {
  farmerNotifActions,
  restaurantNotifActions,
  driverNotifActions,
  productActions,
} from "./store";
import { products, farmers } from "./mocks";

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
const refundSettingsStore = createStore(seedRefundSettings, "diambar:admin-refund-settings");

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
export function useModerationItem(id: string) {
  return useModerationQueue().find((m) => m.id === id) ?? null;
}
export function useCommissionTiers() {
  return useSyncExternalStore(tiersStore.subscribe, tiersStore.get, tiersStore.get);
}
export function useDeliveryZones() {
  return useSyncExternalStore(zonesStore.subscribe, zonesStore.get, zonesStore.get);
}
export function useRefundSettings() {
  return useSyncExternalStore(
    refundSettingsStore.subscribe,
    refundSettingsStore.get,
    refundSettingsStore.get,
  );
}

export const auditActions = {
  /** Journal append-only : c'est la seule action qui écrit dans logsStore —
   * aucune action de modification/suppression n'existe, un événement une
   * fois créé n'est plus jamais changé depuis l'interface. */
  log: (input: {
    action: string;
    target: string;
    module: AuditModule;
    level?: AuditLevel;
    actor?: string;
    status?: AuditStatus;
    reason?: string;
    changes?: AuditChange[];
  }) => {
    logsStore.set((arr) => [
      {
        id: `al_${Date.now()}`,
        at: new Date().toISOString(),
        actor: input.actor ?? "Admin Diambar",
        action: input.action,
        target: input.target,
        level: input.level ?? "info",
        module: input.module,
        status: input.status ?? "success",
        reason: input.reason,
        changes: input.changes,
      },
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
  { u13: "Super Administrateur", u14: "Finance", u15: "Opérations" },
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
    const before = adminRolesStore.get()[userId] ?? "Support";
    adminRolesStore.set((r) => ({ ...r, [userId]: role }));
    auditActions.log({
      action: "Rôle admin modifié",
      target: actor,
      module: "security",
      level: "critical",
      changes: [{ field: "Rôle admin", before, after: role }],
    });
  },
};

// Rôles admin donnant accès réel (pas cosmétique) à un périmètre du journal
// d'audit — "all" pour le super administrateur, sinon la liste exacte des
// modules que ce rôle peut consulter. Un module absent de la liste
// n'apparaît ni dans les filtres ni dans les résultats pour ce rôle.
export const AUDIT_MODULE_ACCESS: Record<AdminRoleName, AuditModule[] | "all"> = {
  "Super Administrateur": "all",
  Finance: ["finance", "refunds", "orders"],
  Opérations: [
    "users",
    "validations",
    "orders",
    "deliveries",
    "incidents",
    "disputes",
    "support",
    "returns",
  ],
  Support: ["support", "disputes", "returns", "users", "messages"],
  Modération: ["moderation", "users"],
};

export function auditModulesFor(role: AdminRoleName): AuditModule[] {
  const access = AUDIT_MODULE_ACCESS[role];
  return access === "all" ? (Object.keys(AUDIT_MODULE_LABEL) as AuditModule[]) : access;
}

/** Résout le rôle admin réel de l'utilisateur connecté, à partir de son
 * email (le seul identifiant stable renvoyé par la session) — pas du nom,
 * qui peut se recouper entre comptes de démo. */
export function useAdminRoleForEmail(email: string): AdminRoleName {
  const users = usePlatformUsers();
  const roles = useAdminRoles();
  const match = users.find((u) => u.email === email);
  if (!match) return "Support";
  return roles[match.id] ?? "Support";
}

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
      auditActions.log({
        action: "Validation de compte approuvée",
        target: nameFor(req.userId),
        module: "validations",
        level: "info",
      });
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
      auditActions.log({
        action: "Validation de compte rejetée",
        target: nameFor(req.userId),
        module: "validations",
        level: "attention",
        reason: note,
      });
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
      auditActions.log({
        action: ok
          ? `Document conforme : ${docLabel}`
          : `Document marqué non conforme : ${docLabel}`,
        target: nameFor(req.userId),
        module: "validations",
        level: ok ? "info" : "attention",
      });
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
    auditActions.log({
      action: `Correction demandée : ${docLabel}`,
      target: nameFor(req.userId),
      module: "validations",
      level: "attention",
      reason: `${reasonText}${comment.trim() ? ` — ${comment.trim()}` : ""}`,
    });
    notifyApplicant(
      req.type,
      "Document à corriger",
      `« ${docLabel} » nécessite une correction : ${noteText}`,
    );
  },
};

function moderationItem(id: string) {
  return moderationStore.get().find((m) => m.id === id);
}
function addModerationEvent(id: string, actor: string, label: string) {
  moderationStore.set((arr) =>
    arr.map((m) =>
      m.id === id
        ? { ...m, events: [...m.events, { at: new Date().toISOString(), actor, label }] }
        : m,
    ),
  );
}

export const moderationActions = {
  approve: (id: string) => {
    moderationStore.set((arr) => arr.map((m) => (m.id === id ? { ...m, status: "approved" } : m)));
    addModerationEvent(id, "Admin Diambar", "Produit conservé");
    auditActions.log({ action: "Produit conservé (modération)", target: id, module: "moderation" });
  },
  // Dépublier retire réellement le produit du catalogue (comme un producteur
  // qui le passerait en brouillon), pas seulement l'entrée de la file de
  // modération — sinon le produit resterait visible et commandable.
  unpublish: (id: string) => {
    const m = moderationItem(id);
    if (!m) return;
    moderationStore.set((arr) => arr.map((x) => (x.id === id ? { ...x, status: "removed" } : x)));
    productActions.update(m.productId, { status: "draft" });
    addModerationEvent(id, "Admin Diambar", "Produit dépublié");
    auditActions.log({
      action: "Produit dépublié (modération)",
      target: id,
      module: "moderation",
      level: "attention",
      changes: [{ field: "Statut produit", before: "Publié", after: "Brouillon" }],
    });
  },
  requestChange: (id: string, note: string) => {
    const m = moderationItem(id);
    if (!m) return;
    addModerationEvent(id, "Admin Diambar", `Modification demandée : ${note}`);
    auditActions.log({
      action: "Modification demandée (modération)",
      target: id,
      module: "moderation",
      reason: note,
    });
    farmerNotifActions.add({
      type: "system",
      title: "Modification demandée",
      body: `« ${m.name} » nécessite une modification : ${note}`,
    });
  },
  // Suspendre le producteur est une action distincte de dépublier un seul
  // produit : ça bloque tout son compte, pas uniquement cette annonce.
  suspendFarmer: (id: string) => {
    const m = moderationItem(id);
    if (!m) return;
    const product = products.find((p) => p.id === m.productId);
    const farmer = product ? farmers.find((f) => f.id === product.farmerId) : undefined;
    const account = farmer
      ? usersStore.get().find((u) => u.name === farmer.name)
      : usersStore.get().find((u) => u.name === m.farmer);
    if (account) adminUserActions.setStatus(account.id, "suspended");
    addModerationEvent(id, "Admin Diambar", `Producteur suspendu (${m.farmer})`);
    auditActions.log({
      action: "Producteur suspendu (modération)",
      target: account?.id ?? m.farmer,
      module: "security",
      level: "critical",
      changes: [{ field: "Statut du compte", before: "Actif", after: "Suspendu" }],
    });
  },
};

export const platformSettingsActions = {
  setTierRate: (id: string, rate: number) => {
    const before = tiersStore.get().find((t) => t.id === id)?.rate;
    tiersStore.set((arr) => arr.map((t) => (t.id === id ? { ...t, rate } : t)));
    auditActions.log({
      action: "Commission modifiée",
      target: id,
      module: "finance",
      level: "important",
      changes:
        before !== undefined
          ? [{ field: "Taux commission", before: `${before} %`, after: `${rate} %` }]
          : undefined,
    });
  },
  toggleZone: (id: string) => {
    const before = zonesStore.get().find((z) => z.id === id)?.active;
    zonesStore.set((arr) => arr.map((z) => (z.id === id ? { ...z, active: !z.active } : z)));
    auditActions.log({
      action: "Zone de livraison modifiée",
      target: id,
      module: "finance",
      changes:
        before !== undefined
          ? [
              {
                field: "Zone active",
                before: before ? "Active" : "Inactive",
                after: before ? "Inactive" : "Active",
              },
            ]
          : undefined,
    });
  },
  setZoneFee: (id: string, baseFee: number) => {
    const before = zonesStore.get().find((z) => z.id === id)?.baseFee;
    zonesStore.set((arr) => arr.map((z) => (z.id === id ? { ...z, baseFee } : z)));
    auditActions.log({
      action: "Frais de livraison modifiés",
      target: id,
      module: "finance",
      changes:
        before !== undefined
          ? [{ field: "Frais de base", before: `${before} FCFA`, after: `${baseFee} FCFA` }]
          : undefined,
    });
  },
  setRefundJustificationThreshold: (amount: number) => {
    const before = refundSettingsStore.get().justificationThreshold;
    refundSettingsStore.set((s) => ({ ...s, justificationThreshold: amount }));
    auditActions.log({
      action: "Seuil de justification des remboursements modifié",
      target: "Remboursements",
      module: "finance",
      level: "important",
      changes: [
        { field: "Seuil de justification", before: `${before} FCFA`, after: `${amount} FCFA` },
      ],
    });
  },
};

export type AdminNotificationPriority = "info" | "attention" | "important" | "urgent";

export type AdminNotification = {
  id: string;
  kind: "validation" | "dispute" | "moderation" | "incident" | "return";
  refId: string;
  title: string;
  body: string;
  at: string;
  priority: AdminNotificationPriority;
};

// Priorité dérivée d'un champ réel déjà présent sur le dossier d'origine
// (priorité du litige, gravité de l'incident…), jamais inventée au niveau
// de la notification — même logique que INCIDENT_TYPE_SEVERITY.
const DISPUTE_PRIORITY_TO_NOTIF: Record<string, AdminNotificationPriority> = {
  high: "urgent",
  medium: "important",
  low: "attention",
};
const INCIDENT_SEVERITY_TO_NOTIF: Record<string, AdminNotificationPriority> = {
  critical: "urgent",
  high: "urgent",
  medium: "important",
  low: "attention",
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
  const returns = useReturns();
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
        priority: "attention" as const,
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
        priority: DISPUTE_PRIORITY_TO_NOTIF[d.priority] ?? "attention",
      })),
    ...moderation
      .filter((m) => m.status === "pending")
      .map((m) => {
        const latest = m.reports[m.reports.length - 1];
        return {
          id: `moderation-${m.id}`,
          kind: "moderation" as const,
          refId: m.id,
          title: "Produit signalé",
          body: `${m.name} — ${latest?.reason ?? "Signalement"}`,
          at: latest?.at ?? m.events[0]?.at ?? new Date().toISOString(),
          priority: "important" as const,
        };
      }),
    ...incidents
      .filter((i) => i.status === "escalated")
      .map((i) => ({
        id: `incident-${i.id}`,
        kind: "incident" as const,
        refId: i.id,
        title: "Incident escaladé au support",
        body: `${i.reference} — mission ${i.missionRef}, indemnité demandée ${i.compensationRequested.toLocaleString("fr-FR")} FCFA`,
        at: i.createdAt,
        priority: INCIDENT_SEVERITY_TO_NOTIF[i.severity] ?? "important",
      })),
    ...returns
      .filter((r) => r.status === "pending")
      .map((r) => ({
        id: `return-${r.id}`,
        kind: "return" as const,
        refId: r.id,
        title: "Retour à traiter",
        body: `${r.reference} — ${r.restaurantName}, ${r.requestedAmount.toLocaleString("fr-FR")} FCFA demandés`,
        at: r.createdAt,
        priority: "attention" as const,
      })),
    ...returns
      .filter((r) => r.pickup?.status === "received" && !r.inspection)
      .map((r) => ({
        id: `return-inspect-${r.id}`,
        kind: "return" as const,
        refId: r.id,
        title: "Retour à inspecter",
        body: `${r.reference} — produit réceptionné, inspection en attente`,
        at: r.pickup!.receivedAt!,
        priority: "important" as const,
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
