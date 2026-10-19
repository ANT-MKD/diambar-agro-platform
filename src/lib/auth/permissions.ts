// Permissions de l'administration : une seule liste, partagée par le serveur
// (qui les applique à chaque action) et par les écrans (qui n'affichent que
// ce qui est permis). Un rôle est un ensemble de permissions ; le super
// administrateur les a toutes et ne peut pas être restreint.

export const PERMISSIONS = {
  "users.view": { group: "Utilisateurs", label: "Voir les utilisateurs" },
  "users.edit": { group: "Utilisateurs", label: "Modifier les utilisateurs" },
  "users.suspend": { group: "Utilisateurs", label: "Suspendre ou réactiver un compte" },
  "validations.decide": { group: "Validations & modération", label: "Traiter les inscriptions" },
  "moderation.decide": {
    group: "Validations & modération",
    label: "Modérer les produits et les avis",
  },
  "catalog.manage": {
    group: "Validations & modération",
    label: "Gérer les catégories et les unités",
  },
  "orders.view": { group: "Commandes & livraisons", label: "Voir les commandes" },
  "orders.manage": { group: "Commandes & livraisons", label: "Changer le statut d'une commande" },
  "deliveries.view": { group: "Commandes & livraisons", label: "Voir les livraisons" },
  "deliveries.reassign": { group: "Commandes & livraisons", label: "Réaffecter une course" },
  "drivers.verify": {
    group: "Commandes & livraisons",
    label: "Vérifier les documents et véhicules des livreurs",
  },
  "pricing.edit": { group: "Commandes & livraisons", label: "Modifier les tarifs de livraison" },
  "incidents.decide": { group: "Incidents & litiges", label: "Traiter les incidents" },
  "disputes.decide": { group: "Incidents & litiges", label: "Traiter les litiges" },
  "support.respond": { group: "Support & retours", label: "Répondre au support" },
  "returns.decide": { group: "Support & retours", label: "Traiter les retours" },
  "messages.view": { group: "Support & retours", label: "Lire et répondre aux messages" },
  "refunds.view": { group: "Argent", label: "Voir les remboursements" },
  "refunds.approve": { group: "Argent", label: "Approuver un remboursement" },
  "refunds.execute": { group: "Argent", label: "Verser un remboursement" },
  "finance.view": { group: "Argent", label: "Voir les données financières" },
  "finance.edit": {
    group: "Argent",
    label: "Confirmer les paiements et verser les retraits",
  },
  "settings.edit": { group: "Paramètres & sécurité", label: "Modifier les paramètres" },
  "security.manage_admins": {
    group: "Paramètres & sécurité",
    label: "Inviter les administrateurs et leur donner un rôle",
  },
  "security.manage_roles": {
    group: "Paramètres & sécurité",
    label: "Créer et modifier les rôles",
  },
  "audit.view": { group: "Journal d'audit", label: "Voir le journal d'audit" },
  "audit.export": { group: "Journal d'audit", label: "Exporter le journal d'audit" },
} as const satisfies Record<string, { group: string; label: string }>;

export type PermissionKey = keyof typeof PERMISSIONS;

export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as PermissionKey[];

export function isPermissionKey(key: string): key is PermissionKey {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, key);
}

/** Permissions regroupées par module, dans l'ordre d'affichage. */
export const PERMISSION_GROUPS: { module: string; keys: PermissionKey[] }[] = (() => {
  const groups: { module: string; keys: PermissionKey[] }[] = [];
  for (const key of PERMISSION_KEYS) {
    const module = PERMISSIONS[key].group;
    const g = groups.find((x) => x.module === module);
    if (g) g.keys.push(key);
    else groups.push({ module, keys: [key] });
  }
  return groups;
})();

export const SUPER_ADMIN_LABEL = "Super Administrateur";

/** Rôles fournis à l'installation (modifiables, pas supprimables). La base
 * garde la version à jour ; cette liste sert à la création et à la
 * démonstration sans base. */
export const SYSTEM_ROLES = {
  operations: {
    name: "Opérations",
    description: "Inscriptions, commandes, livraisons, incidents, litiges et retours.",
    permissions: [
      "users.view",
      "users.edit",
      "validations.decide",
      "moderation.decide",
      "catalog.manage",
      "orders.view",
      "orders.manage",
      "deliveries.view",
      "deliveries.reassign",
      "drivers.verify",
      "pricing.edit",
      "incidents.decide",
      "disputes.decide",
      "support.respond",
      "returns.decide",
      "messages.view",
      "audit.view",
    ],
  },
  finance: {
    name: "Finance",
    description: "Encaissements, retraits, remboursements et données financières.",
    permissions: [
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
  },
  support: {
    name: "Support",
    description: "Support, messages, litiges et retours.",
    permissions: [
      "users.view",
      "orders.view",
      "support.respond",
      "disputes.decide",
      "returns.decide",
      "messages.view",
      "audit.view",
    ],
  },
  moderation: {
    name: "Modération",
    description: "Modération des produits et des avis.",
    permissions: ["users.view", "moderation.decide", "audit.view"],
  },
} as const satisfies Record<
  string,
  { name: string; description: string; permissions: readonly PermissionKey[] }
>;

export type SystemRoleKey = keyof typeof SYSTEM_ROLES;

/** Rôle proposé à l'invitation d'un administrateur. */
export type AdminRoleChoice = {
  id: string;
  name: string;
  description: string;
  systemKey: string | null;
  permissions: PermissionKey[];
};

/** Rôle tel que les écrans le reçoivent (liste et formulaire des rôles). */
export type AdminRoleView = {
  id: string;
  name: string;
  description: string;
  permissions: PermissionKey[];
  /** Rôle fourni à l'installation : modifiable, pas supprimable. */
  system: boolean;
  members: number;
};

/** Permission qui ouvre chaque module du journal d'audit (le super
 * administrateur voit tout ; il faut aussi « Voir le journal d'audit »). */
export const AUDIT_MODULE_PERMISSION: Record<string, PermissionKey> = {
  users: "users.view",
  validations: "validations.decide",
  moderation: "moderation.decide",
  orders: "orders.view",
  deliveries: "deliveries.view",
  incidents: "incidents.decide",
  disputes: "disputes.decide",
  support: "support.respond",
  returns: "returns.decide",
  refunds: "refunds.view",
  finance: "finance.view",
  messages: "messages.view",
  security: "security.manage_admins",
  system: "settings.edit",
};

/** Modules du journal visibles avec ces permissions. */
export function auditModulesAllowed(permissions: readonly PermissionKey[]): string[] {
  if (!permissions.includes("audit.view")) return [];
  return Object.entries(AUDIT_MODULE_PERMISSION)
    .filter(([, p]) => permissions.includes(p))
    .map(([m]) => m);
}

/** Ne garde que les permissions connues, sans doublon, dans l'ordre du catalogue. */
export function cleanPermissions(list: readonly string[]): PermissionKey[] {
  const wanted = new Set(list);
  return PERMISSION_KEYS.filter((k) => wanted.has(k));
}
