import { useEffect, useSyncExternalStore } from "react";
import {
  platformUsers as seedUsers,
  validationRequests as seedValidations,
  auditLogs as seedLogs,
  moderationQueue as seedModeration,
  commissionTiers as seedTiers,
  deliveryZones as seedZones,
  refundSettings as seedRefundSettings,
  refundApprovalTiers as seedRefundApprovalTiers,
  teams as seedTeams,
  type PlatformUser,
  type PlatformUserStatus,
  type ValidationRequest,
  type AuditLog,
  type AuditModule,
  type AuditLevel,
  type AuditStatus,
  type AuditChange,
  type ModerationItem,
  type AdminRoleName,
  type RefundApprovalTier,
  type Team,
  ADMIN_ROLE_NAMES,
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

export { ADMIN_ROLE_NAMES };
export type { AdminRoleName };

// Clés de permission granulaires par module — remplace l'ancienne matrice
// cosmétique (4 catégories Voir/Modifier) qui ne configurait que
// l'affichage de la page Administrateurs. Chaque clé est vérifiée à la fois
// pour l'affichage ET pour bloquer l'appel de l'action du store
// correspondante (pas seulement un bouton caché).
export type PermissionKey =
  | "users.view"
  | "users.edit"
  | "users.suspend"
  | "validations.decide"
  | "moderation.decide"
  | "orders.view"
  | "deliveries.view"
  | "deliveries.reassign"
  | "incidents.decide"
  | "disputes.decide"
  | "support.respond"
  | "returns.decide"
  | "refunds.view"
  | "refunds.approve"
  | "refunds.execute"
  | "finance.view"
  | "finance.edit"
  | "messages.view"
  | "settings.edit"
  | "security.manage_admins"
  | "security.manage_roles"
  | "audit.view"
  | "audit.export";

const ALL_PERMISSIONS: PermissionKey[] = [
  "users.view",
  "users.edit",
  "users.suspend",
  "validations.decide",
  "moderation.decide",
  "orders.view",
  "deliveries.view",
  "deliveries.reassign",
  "incidents.decide",
  "disputes.decide",
  "support.respond",
  "returns.decide",
  "refunds.view",
  "refunds.approve",
  "refunds.execute",
  "finance.view",
  "finance.edit",
  "messages.view",
  "settings.edit",
  "security.manage_admins",
  "security.manage_roles",
  "audit.view",
  "audit.export",
];

// Distinct de AUDIT_MODULE_ACCESS (qui ne fait que scoper la lecture du
// journal d'audit) : ceci autorise ou non l'exécution d'une action.
export const ROLE_PERMISSIONS: Record<AdminRoleName, PermissionKey[]> = {
  "Super Administrateur": ALL_PERMISSIONS,
  Finance: [
    "users.view",
    "orders.view",
    "refunds.view",
    "refunds.approve",
    "refunds.execute",
    "finance.view",
    "finance.edit",
    "audit.view",
    "audit.export",
  ],
  Opérations: [
    "users.view",
    "users.edit",
    "validations.decide",
    "orders.view",
    "deliveries.view",
    "deliveries.reassign",
    "incidents.decide",
    "disputes.decide",
    "support.respond",
    "returns.decide",
    "audit.view",
  ],
  Support: [
    "users.view",
    "orders.view",
    "support.respond",
    "disputes.decide",
    "returns.decide",
    "messages.view",
    "audit.view",
  ],
  Modération: ["users.view", "moderation.decide", "audit.view"],
};

export function can(role: AdminRoleName, key: PermissionKey): boolean {
  return ROLE_PERMISSIONS[role].includes(key);
}

/** Résout can() directement depuis l'email de session — évite de refaire
 * useAdminRoleForEmail + can() à chaque appelant. */
export function useCan(email: string, key: PermissionKey): boolean {
  const role = useAdminRoleForEmail(email);
  return can(role, key);
}

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

const teamsStore = createStore<Team[]>(seedTeams, "diambar:admin-teams");

export function useTeams(): Team[] {
  return useSyncExternalStore(teamsStore.subscribe, teamsStore.get, teamsStore.get);
}

export const teamActions = {
  create: (name: string) => {
    const team: Team = { id: `team_${Date.now()}`, name, memberIds: [] };
    teamsStore.set((arr) => [...arr, team]);
    auditActions.log({ action: "Équipe créée", target: name, module: "security" });
    return team;
  },
  rename: (id: string, name: string) => {
    teamsStore.set((arr) => arr.map((t) => (t.id === id ? { ...t, name } : t)));
  },
  addMember: (id: string, userId: string) => {
    teamsStore.set((arr) =>
      arr.map((t) =>
        t.id === id && !t.memberIds.includes(userId)
          ? { ...t, memberIds: [...t.memberIds, userId] }
          : t,
      ),
    );
  },
  removeMember: (id: string, userId: string) => {
    teamsStore.set((arr) =>
      arr.map((t) =>
        t.id === id ? { ...t, memberIds: t.memberIds.filter((m) => m !== userId) } : t,
      ),
    );
  },
  remove: (id: string) => teamsStore.set((arr) => arr.filter((t) => t.id !== id)),
};

const refundApprovalTiersStore = createStore<RefundApprovalTier[]>(
  seedRefundApprovalTiers,
  "diambar:refund-approval-tiers",
);

export function useRefundApprovalTiers(): RefundApprovalTier[] {
  return useSyncExternalStore(
    refundApprovalTiersStore.subscribe,
    refundApprovalTiersStore.get,
    refundApprovalTiersStore.get,
  );
}

/** Un montant est toujours couvert par un palier : le dernier de la liste a
 * maxAmount = null (pas de plafond). Super Administrateur outrepasse tout
 * palier — c'est le rôle qui approuve déjà tout dans ROLE_PERMISSIONS. */
export function refundTierFor(amount: number, tiers: RefundApprovalTier[]): RefundApprovalTier {
  return (
    tiers.find((t) => t.maxAmount === null || amount <= t.maxAmount) ?? tiers[tiers.length - 1]
  );
}

export function canApproveRefundAmount(
  role: AdminRoleName,
  amount: number,
  tiers: RefundApprovalTier[],
): boolean {
  if (role === "Super Administrateur") return true;
  return refundTierFor(amount, tiers).requiredRole === role;
}

// Périmètre géographique optionnel par compte admin — limité aux villes
// réellement présentes sur les fiches utilisateur (PlatformUser.city), pas
// à une taxonomie de régions administratives inventée. Absent ou vide =
// aucune restriction (accès à toutes les villes).
const adminScopeStore = createStore<Record<string, string[]>>(
  { u15: ["Dakar", "Thiès"] },
  "diambar:admin-scope",
);

export function useAdminScopes(): Record<string, string[]> {
  return useSyncExternalStore(adminScopeStore.subscribe, adminScopeStore.get, adminScopeStore.get);
}

export function useAdminScope(userId: string): string[] {
  return useAdminScopes()[userId] ?? [];
}

export const adminScopeActions = {
  setScope: (userId: string, cities: string[], actor: string) => {
    adminScopeStore.set((s) => ({ ...s, [userId]: cities }));
    auditActions.log({
      action: "Périmètre admin modifié",
      target: actor,
      module: "security",
      level: "important",
      changes: [{ field: "Villes autorisées", before: "—", after: cities.join(", ") || "Toutes" }],
    });
  },
};

/** true si l'utilisateur `city` est dans le périmètre de l'admin `email` —
 * périmètre vide = pas de restriction. */
export function useIsInAdminScope(email: string, city: string | undefined): boolean {
  const users = usePlatformUsers();
  const scopes = useAdminScopes();
  const match = users.find((u) => u.email === email);
  const scope = match ? (scopes[match.id] ?? []) : [];
  if (scope.length === 0) return true;
  return city ? scope.includes(city) : false;
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
  approve: (id: string, actor = "Admin Diambar") => {
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
        actor,
      });
      notifyApplicant(
        req.type,
        "Compte activé",
        "Votre dossier a été validé : vous avez maintenant accès à toutes les fonctionnalités de votre espace.",
      );
    }
  },
  reject: (id: string, note?: string, actor = "Admin Diambar") => {
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
        actor,
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
  setDocStatus: (id: string, docLabel: string, ok: boolean, actor = "Admin Diambar") => {
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
        actor,
      });
    }
  },
  requestCorrection: (
    id: string,
    docLabel: string,
    reasons: string[],
    comment: string,
    actor = "Admin Diambar",
  ) => {
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
      actor,
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
  approve: (id: string, actor = "Admin Diambar") => {
    moderationStore.set((arr) => arr.map((m) => (m.id === id ? { ...m, status: "approved" } : m)));
    addModerationEvent(id, actor, "Produit conservé");
    auditActions.log({
      action: "Produit conservé (modération)",
      target: id,
      module: "moderation",
      actor,
    });
  },
  // Dépublier retire réellement le produit du catalogue (comme un producteur
  // qui le passerait en brouillon), pas seulement l'entrée de la file de
  // modération — sinon le produit resterait visible et commandable.
  unpublish: (id: string, actor = "Admin Diambar") => {
    const m = moderationItem(id);
    if (!m) return;
    moderationStore.set((arr) => arr.map((x) => (x.id === id ? { ...x, status: "removed" } : x)));
    productActions.update(m.productId, { status: "draft" });
    addModerationEvent(id, actor, "Produit dépublié");
    auditActions.log({
      action: "Produit dépublié (modération)",
      target: id,
      module: "moderation",
      level: "attention",
      actor,
      changes: [{ field: "Statut produit", before: "Publié", after: "Brouillon" }],
    });
  },
  requestChange: (id: string, note: string, actor = "Admin Diambar") => {
    const m = moderationItem(id);
    if (!m) return;
    addModerationEvent(id, actor, `Modification demandée : ${note}`);
    auditActions.log({
      action: "Modification demandée (modération)",
      target: id,
      module: "moderation",
      reason: note,
      actor,
    });
    farmerNotifActions.add({
      type: "system",
      title: "Modification demandée",
      body: `« ${m.name} » nécessite une modification : ${note}`,
    });
  },
  // Suspendre le producteur est une action distincte de dépublier un seul
  // produit : ça bloque tout son compte, pas uniquement cette annonce.
  suspendFarmer: (id: string, actor = "Admin Diambar") => {
    const m = moderationItem(id);
    if (!m) return;
    const product = products.find((p) => p.id === m.productId);
    const farmer = product ? farmers.find((f) => f.id === product.farmerId) : undefined;
    const account = farmer
      ? usersStore.get().find((u) => u.name === farmer.name)
      : usersStore.get().find((u) => u.name === m.farmer);
    if (account) adminUserActions.setStatus(account.id, "suspended");
    addModerationEvent(id, actor, `Producteur suspendu (${m.farmer})`);
    auditActions.log({
      action: "Producteur suspendu (modération)",
      target: account?.id ?? m.farmer,
      module: "security",
      level: "critical",
      actor,
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
  setApprovalTierRole: (tierId: string, requiredRole: AdminRoleName) => {
    const before = refundApprovalTiersStore.get().find((t) => t.id === tierId)?.requiredRole;
    refundApprovalTiersStore.set((arr) =>
      arr.map((t) => (t.id === tierId ? { ...t, requiredRole } : t)),
    );
    auditActions.log({
      action: "Palier d'approbation modifié",
      target: tierId,
      module: "security",
      level: "important",
      changes: before ? [{ field: "Rôle requis", before, after: requiredRole }] : undefined,
    });
  },
};

// Sécurité de connexion : seuil d'échecs avant blocage réel, et durée du
// blocage — configurable, appliqué pour de vrai par login.tsx en comptant
// les événements "Connexion échouée" réels du journal d'audit (pas de
// simulation, pas de capture d'IP puisqu'aucune n'existe dans l'app).
const loginSecurityStore = createStore(
  { maxAttempts: 5, lockoutMinutes: 15 },
  "diambar:login-security",
);

export function useLoginSecurity() {
  return useSyncExternalStore(
    loginSecurityStore.subscribe,
    loginSecurityStore.get,
    loginSecurityStore.get,
  );
}

export const loginSecurityActions = {
  setMaxAttempts: (maxAttempts: number) => {
    loginSecurityStore.set((s) => ({ ...s, maxAttempts }));
  },
  setLockoutMinutes: (lockoutMinutes: number) => {
    loginSecurityStore.set((s) => ({ ...s, lockoutMinutes }));
  },
};

const maintenanceStore = createStore(
  { active: false, message: "Diambar Agro est temporairement indisponible pour maintenance." },
  "diambar:maintenance",
);

export function useMaintenanceMode() {
  return useSyncExternalStore(
    maintenanceStore.subscribe,
    maintenanceStore.get,
    maintenanceStore.get,
  );
}

export const maintenanceActions = {
  setActive: (active: boolean, actor: string) => {
    maintenanceStore.set((s) => ({ ...s, active }));
    auditActions.log({
      action: active ? "Mode maintenance activé" : "Mode maintenance désactivé",
      target: actor,
      module: "system",
      level: "critical",
    });
  },
  setMessage: (message: string) => {
    maintenanceStore.set((s) => ({ ...s, message }));
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
