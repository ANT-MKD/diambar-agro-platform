import { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import {
  platformUsers as seedUsers,
  validationRequests as seedValidations,
  auditLogs as seedLogs,
  moderationQueue as seedModeration,
  refundSettings as seedRefundSettings,
  refundApprovalTiers as seedRefundApprovalTiers,
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
import { products, farmers, type AppNotification } from "./mocks";
import { createStore } from "./persist";
import { isMarketRemote } from "./market-mode";
import { tiersStore, zonesStore, useCommissionTiers, useDeliveryZones } from "./platform-settings";
import {
  auditModulesAllowed,
  PERMISSION_KEYS,
  SUPER_ADMIN_LABEL,
  SYSTEM_ROLES,
  type AdminRoleView,
  type PermissionKey,
} from "@/lib/auth/permissions";

export { useCommissionTiers, useDeliveryZones };

const usersStore = createStore<PlatformUser[]>(seedUsers, "diambar:admin-users");
const validationsStore = createStore<ValidationRequest[]>(
  seedValidations,
  "diambar:admin-validations",
);
const logsStore = createStore<AuditLog[]>(seedLogs, "diambar:admin-logs");
const moderationStore = createStore<ModerationItem[]>(seedModeration, "diambar:admin-moderation");
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
/** Liste des villes desservies, dérivée des mêmes zones de livraison —
 * utilisée par les formulaires d'inscription/profil (agriculteur,
 * restaurant) pour rester alignée avec ce que l'admin configure. */
export function useCities(): string[] {
  return useDeliveryZones().map((z) => z.name);
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
    // Avec une base, le serveur tient le vrai journal (relu avec l'annuaire).
    if (isMarketRemote()) return;
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

export type { PermissionKey };

// Démonstration sans base : la matrice des rôles fournis à l'installation.
export const ROLE_PERMISSIONS: Record<string, readonly PermissionKey[]> = {
  [SUPER_ADMIN_LABEL]: PERMISSION_KEYS,
  ...Object.fromEntries(Object.values(SYSTEM_ROLES).map((r) => [r.name, r.permissions])),
};

// Avec la base : permissions de chaque rôle lues dans l'annuaire (rôles fournis
// et rôles créés par l'équipe), et celles du rôle de la session en attendant.
// Le serveur les vérifie de toute façon à chaque action.
let directoryRoles: Record<string, readonly PermissionKey[]> = {};
let sessionRole: { name: string; permissions: readonly PermissionKey[] } | null = null;

/** Rôle et permissions de la session, lus par le serveur (mise en page admin). */
export function setSessionRolePermissions(name: string, permissions: readonly PermissionKey[]) {
  sessionRole = { name, permissions };
}

export function permissionsOfRole(role: string): readonly PermissionKey[] {
  if (role === SUPER_ADMIN_LABEL) return PERMISSION_KEYS;
  return (
    directoryRoles[role] ??
    (sessionRole?.name === role ? sessionRole.permissions : undefined) ??
    ROLE_PERMISSIONS[role] ??
    []
  );
}

export function can(role: string, key: PermissionKey): boolean {
  return permissionsOfRole(role).includes(key);
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

/** Modules du journal d'audit visibles pour ce rôle (super admin : tous). */
export function auditModulesFor(role: string): AuditModule[] {
  if (role === SUPER_ADMIN_LABEL) return Object.keys(AUDIT_MODULE_LABEL) as AuditModule[];
  return auditModulesAllowed(permissionsOfRole(role)) as AuditModule[];
}

/** Résout le rôle admin réel de l'utilisateur connecté, à partir de son
 * email (le seul identifiant stable renvoyé par la session) — pas du nom,
 * qui peut se recouper entre comptes de démo. */
// Rôle d'équipe du compte connecté, tel que le serveur l'a lu dans l'annuaire
// (base de données), fourni par la mise en page de l'administration. Il prime
// sur la correspondance de démonstration par email : un administrateur réel
// n'existe pas dans les données de démo.
export const SessionStaffContext = createContext<{ email: string; role: AdminRoleName } | null>(
  null,
);

export function useAdminRoleForEmail(email: string): AdminRoleName {
  const sessionStaff = useContext(SessionStaffContext);
  const users = usePlatformUsers();
  const roles = useAdminRoles();
  if (sessionStaff && sessionStaff.email === email) return sessionStaff.role;
  const match = users.find((u) => u.email === email);
  if (!match) return "Support";
  return roles[match.id] ?? "Support";
}

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
    farmerNotifActions.add({
      type: "system",
      title: "Produit retiré du catalogue",
      body: `« ${m.name} » a été dépublié par la modération. Contactez le support pour en savoir plus.`,
    });
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
    farmerNotifActions.add({
      type: "system",
      title: "Compte suspendu",
      body: "Votre compte producteur a été suspendu par la modération. Contactez le support.",
    });
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
  addZone: (name: string, baseFee: number, perKm: number, actor: string) => {
    const id = `dz_${Date.now()}`;
    zonesStore.set((arr) => [...arr, { id, name, baseFee, perKm, active: true }]);
    auditActions.log({
      action: "Ville ajoutée",
      target: name,
      module: "finance",
      actor,
      changes: [{ field: "Ville desservie", before: "—", after: name }],
    });
    return id;
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

/** Mode maintenance lu en base (snapshot) : il décide de l'affichage des portails. */
export function replaceMaintenance(m: { active: boolean; message: string }) {
  maintenanceStore.replace(m);
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
  /** « system » : notification envoyée par le serveur (lien dans refId). */
  kind: "validation" | "dispute" | "moderation" | "incident" | "return" | "system";
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
/** Mode base : notifications envoyées par le serveur au compte admin
 * (catégorie proposée, lieu à localiser, paiement déclaré…). */
const serverNotifsStore = createStore<AppNotification[]>([]);

export function replaceAdminServerNotifications(list: AppNotification[]) {
  serverNotifsStore.replace(list);
}
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
  const serverNotifs = useSyncExternalStore(
    serverNotifsStore.subscribe,
    serverNotifsStore.get,
    serverNotifsStore.get,
  );

  useEffect(() => {
    const persisted = loadPersistedReadIds();
    if (persisted.length > 0) notifsReadStore.set(persisted);
  }, []);

  const items: AdminNotification[] = [
    ...serverNotifs.map((n) => ({
      id: `server-${n.id}`,
      kind: "system" as const,
      refId: n.link ?? "/admin/notifications",
      title: n.title,
      body: n.body,
      at: n.at,
      priority: "attention" as const,
    })),
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

// --- Mode base de données ---------------------------------------------------------------

/** Vrais comptes, rôles de l'équipe et journal d'audit, lus dans la base. */
export function applyAdminDirectory(dir: {
  users: PlatformUser[];
  staffRoles: Record<string, AdminRoleName>;
  staffRoleIds: Record<string, string>;
  staffTeams: Record<string, string>;
  roles: AdminRoleView[];
  logs: AuditLog[];
}) {
  directoryRoles = Object.fromEntries(dir.roles.map((r) => [r.name, r.permissions]));
  rolesStore.replace(dir.roles);
  staffRoleIdsStore.replace(dir.staffRoleIds);
  staffTeamsStore.replace(dir.staffTeams);
  usersStore.replace(dir.users);
  adminRolesStore.replace(dir.staffRoles);
  logsStore.replace(dir.logs);
}

// Rôles de l'administration (base) : liste, rôle attribué et équipe de chacun.
const rolesStore = createStore<AdminRoleView[]>([]);
const staffRoleIdsStore = createStore<Record<string, string>>({});
const staffTeamsStore = createStore<Record<string, string>>({});

export function useAdminRoleList(): AdminRoleView[] {
  return useSyncExternalStore(rolesStore.subscribe, rolesStore.get, rolesStore.get);
}
export function useStaffRoleIds(): Record<string, string> {
  return useSyncExternalStore(
    staffRoleIdsStore.subscribe,
    staffRoleIdsStore.get,
    staffRoleIdsStore.get,
  );
}
export function useStaffTeams(): Record<string, string> {
  return useSyncExternalStore(staffTeamsStore.subscribe, staffTeamsStore.get, staffTeamsStore.get);
}

/** Produits signalés, lus sur le serveur. */
export function replaceModeration(items: ModerationItem[]) {
  moderationStore.replace(items);
}

/** Files de démonstration sans équivalent en base : vides. */
export function clearAdminDemoData() {
  usersStore.replace([]);
  logsStore.replace([]);
  validationsStore.replace([]);
  moderationStore.replace([]);
}
