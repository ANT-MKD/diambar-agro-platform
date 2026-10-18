// Schéma de la base de données (PostgreSQL / Supabase) — tables du pilote.
//
// Règles communes :
// - montants en F CFA entiers (integer), jamais de décimales ;
// - quantités en numeric(12,3) (kg, sacs, bottes) ;
// - dates en timestamptz ;
// - identifiants uuid générés par la base ;
// - les historiques (order_events, mission_events, stock_movements,
//   ledger_entries, audit_logs) ne sont jamais modifiés, seulement complétés ;
// - aucune suppression physique des comptes : users.deleted_at.
//
// Les migrations SQL sont générées depuis ce fichier (npm run db:generate) ;
// le verrouillage RLS est dans une migration écrite à la main.
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgSequence,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
const qty = (name: string) => numeric(name, { precision: 12, scale: 3, mode: "number" });

// --- Énumérations ------------------------------------------------------------

export const userRole = pgEnum("user_role", ["restaurant", "farmer", "driver", "admin"]);
export const userStatus = pgEnum("user_status", ["pending", "active", "suspended", "rejected"]);
export const adminRole = pgEnum("admin_role", ["super_admin", "operations", "finance", "support"]);
export const validationStatus = pgEnum("validation_status", [
  "pending",
  "needs_correction",
  "approved",
  "rejected",
]);
export const documentKind = pgEnum("document_kind", [
  "cni",
  "permis",
  "assurance",
  "carte_grise",
  "visite_technique",
  "attestation_exploitation",
  "ninea",
  "autre",
]);
export const documentStatus = pgEnum("document_status", ["pending", "ok", "refused"]);
export const certification = pgEnum("certification", ["none", "bio", "raisonnee", "globalgap"]);
export const preferredLang = pgEnum("preferred_lang", ["fr", "wo"]);
export const vehicleType = pgEnum("vehicle_type", [
  "velo",
  "moto",
  "tricycle",
  "camionnette",
  "camion",
]);
export const vehicleStatus = pgEnum("vehicle_status", ["active", "blocked"]);
export const productStatus = pgEnum("product_status", ["draft", "active", "paused", "out"]);
export const categoryStatus = pgEnum("category_status", ["approved", "proposed"]);
export const stockReason = pgEnum("stock_reason", [
  "manual",
  "order_reserved",
  "order_cancelled",
  "order_adjusted",
  "adjustment",
]);
/** « credit » : panier entièrement réglé par un avoir, rien à encaisser. */
export const paymentMode = pgEnum("payment_mode", ["prepaid", "pay_on_delivery", "cash", "credit"]);
export const orderStatus = pgEnum("order_status", [
  "pending",
  "confirmed",
  "preparing",
  "delivering",
  "delivered",
  "cancelled",
]);
export const shortagePreference = pgEnum("shortage_preference", ["partial", "cancel"]);
export const missionStatus = pgEnum("mission_status", [
  "available",
  "accepted",
  "pickup",
  "loaded",
  "delivered",
  "cancelled",
]);
export const missionUrgency = pgEnum("mission_urgency", ["standard", "priority", "express"]);
export const proofStage = pgEnum("proof_stage", ["pickup", "dropoff"]);
export const paymentMethod = pgEnum("payment_method", [
  "wave",
  "orange_money",
  "free_money",
  "cash",
  "transfer",
]);
export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "confirmed",
  "failed",
  "refunded",
  "cancelled",
]);
export const ledgerAccount = pgEnum("ledger_account", ["farmer", "driver", "platform"]);
export const ledgerKind = pgEnum("ledger_kind", [
  "sale",
  "commission",
  "delivery_fee",
  "driver_payout",
  "refund_adjustment",
  "payout",
  "adjustment",
]);
export const payoutStatus = pgEnum("payout_status", [
  "requested",
  "processing",
  "paid",
  "failed",
  "cancelled",
]);
export const refundSource = pgEnum("refund_source", [
  "reception",
  "dispute",
  "return",
  "incident",
  "manual",
  /** Payé, mais le producteur n'avait pas tout (confirmation partielle). */
  "shortage",
  /** Payé, puis commande annulée. */
  "cancellation",
]);
export const liableParty = pgEnum("liable_party", ["farmer", "driver", "platform"]);
export const refundStatus = pgEnum("refund_status", [
  "pending",
  "approved",
  "paid",
  "rejected",
  "failed",
]);
export const auditStatus = pgEnum("audit_status", ["success", "failed", "blocked", "cancelled"]);
export const recurringStatus = pgEnum("recurring_status", ["active", "paused", "ended", "problem"]);
export const disputeStatus = pgEnum("dispute_status", [
  "open",
  "investigating",
  "awaiting_response",
  "resolved",
  "rejected",
]);
/** Partie d'un litige ; « platform » : Diambar elle-même. */
export const disputeParty = pgEnum("dispute_party", ["restaurant", "farmer", "driver", "platform"]);
export const disputePriority = pgEnum("dispute_priority", ["low", "medium", "high"]);
export const disputeOutcome = pgEnum("dispute_outcome", [
  "refund",
  "partial",
  /** Avoir à utiliser sur une prochaine commande. */
  "credit",
  "goodwill",
  "rejected",
]);

// --- Référentiels --------------------------------------------------------------

export const cities = pgTable(
  "cities",
  {
    id: id(),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    /** Frais de livraison de base et par km (barème par distance). */
    baseFee: integer("base_fee"),
    perKmFee: integer("per_km_fee"),
    /** Position (calcul des distances) ; vide : position de référence. */
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("cities_name_key").on(t.name),
    check(
      "cities_fees_positive",
      sql`coalesce(${t.baseFee}, 0) >= 0 and coalesce(${t.perKmFee}, 0) >= 0`,
    ),
  ],
);

export const zones = pgTable(
  "zones",
  {
    id: id(),
    cityId: uuid("city_id")
      .notNull()
      .references(() => cities.id),
    name: text("name").notNull(),
    /** Supplément ou frais fixes propres à la zone (facultatif). */
    deliveryFee: integer("delivery_fee"),
    /** Position du quartier (calcul des distances) ; vide : position de référence. */
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("zones_city_name_key").on(t.cityId, t.name),
    check("zones_fee_positive", sql`coalesce(${t.deliveryFee}, 0) >= 0`),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: id(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    /** « proposed » : créée par un producteur, à garder, renommer ou fusionner
     * par l'équipe ; utilisable tout de suite. */
    status: categoryStatus("status").notNull().default("approved"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [uniqueIndex("categories_name_key").on(t.name)],
);

// --- Comptes ---------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: id(),
    role: userRole("role").notNull(),
    /** Toujours enregistré en minuscules (normalisé par le serveur). */
    email: text("email").notNull(),
    /** 9 chiffres, sans indicatif. */
    phone: text("phone"),
    /** bcrypt — jamais le mot de passe en clair. */
    passwordHash: text("password_hash").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    status: userStatus("status").notNull().default("pending"),
    twoFaEnabled: boolean("two_fa_enabled").notNull().default(false),
    phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
    /** Adresse confirmée par un code reçu par email (inscription). */
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    acceptedTermsAt: timestamp("accepted_terms_at", { withTimezone: true }),
    cityId: uuid("city_id").references(() => cities.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    /** Dernier changement de mot de passe (affiché dans Sécurité). */
    passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
    /** Photo de profil : chemin dans le stockage public. */
    avatarKey: text("avatar_key"),
    /** Préférences personnelles : notifications coupées, newsletter, numéros
     * de retrait… (voir UserPreferences). */
    preferences: jsonb("preferences").notNull().default({}),
    /** Suppression logique : le compte est masqué puis anonymisé. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("users_email_key").on(t.email),
    uniqueIndex("users_phone_key").on(t.phone),
    index("users_role_status_idx").on(t.role, t.status),
    index("users_city_idx").on(t.cityId),
    check("users_email_lowercase", sql`${t.email} = lower(${t.email})`),
    check("users_phone_format", sql`${t.phone} is null or ${t.phone} ~ '^[0-9]{9}$'`),
  ],
);

export const adminProfiles = pgTable("admin_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id),
  adminRole: adminRole("admin_role").notNull(),
  team: text("team"),
});

export const files = pgTable(
  "files",
  {
    id: id(),
    ownerId: uuid("owner_id").references(() => users.id),
    /** Chemin dans le stockage de fichiers (Supabase Storage). */
    storageKey: text("storage_key").notNull(),
    mime: text("mime").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("files_storage_key_key").on(t.storageKey),
    index("files_owner_idx").on(t.ownerId),
    check("files_size_positive", sql`${t.sizeBytes} >= 0`),
  ],
);

export const validations = pgTable(
  "validations",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    status: validationStatus("status").notNull().default("pending"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    decidedBy: uuid("decided_by").references(() => users.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    note: text("note"),
    /** Ce que la personne a rempli à l'inscription (ville, exploitation,
     * véhicule, zones…), tel quel : l'admin valide sur pièces. */
    submitted: jsonb("submitted"),
  },
  (t) => [
    index("validations_user_idx").on(t.userId),
    index("validations_status_idx").on(t.status),
    index("validations_decided_by_idx").on(t.decidedBy),
  ],
);

// --- Profils -----------------------------------------------------------------------

export const restaurants = pgTable(
  "restaurants",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id),
    name: text("name").notNull(),
    cuisine: text("cuisine"),
    address: text("address").notNull(),
    zoneId: uuid("zone_id").references(() => zones.id),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    ninea: text("ninea"),
    /** Créneaux de réception par jour : { mon: { open, from, to }, … } */
    receptionHours: jsonb("reception_hours"),
    billingEmail: text("billing_email"),
    paymentTermsDays: integer("payment_terms_days").notNull().default(0),
    deliveryInstructions: text("delivery_instructions"),
    /** Nombre de couverts, présentation et responsable des achats. */
    capacity: integer("capacity"),
    description: text("description"),
    contactName: text("contact_name"),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("restaurants_zone_idx").on(t.zoneId),
    check("restaurants_terms_positive", sql`${t.paymentTermsDays} >= 0`),
  ],
);

export const farmers = pgTable(
  "farmers",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id),
    farmName: text("farm_name").notNull(),
    pickupAddress: text("pickup_address").notNull(),
    zoneId: uuid("zone_id").references(() => zones.id),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    /** Correction de distance réglée par l'admin (piste absente de la carte…). */
    distanceAdjustKm: integer("distance_adjust_km").notNull().default(0),
    certification: certification("certification").notNull().default("none"),
    areaHa: numeric("area_ha", { precision: 8, scale: 2, mode: "number" }),
    lang: preferredLang("lang").notNull().default("fr"),
    /** Présentation affichée aux restaurants. */
    description: text("description"),
    /** Types de produits cultivés (noms de catégories). */
    productionTypes: jsonb("production_types").notNull().default([]),
    updatedAt: updatedAt(),
  },
  (t) => [index("farmers_zone_idx").on(t.zoneId)],
);

export const drivers = pgTable("drivers", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id),
  licenseNumber: text("license_number"),
  /** Horaires par jour : { mon: { enabled, start, end }, … } */
  workingHours: jsonb("working_hours"),
  isOnline: boolean("is_online").notNull().default(false),
  /** Adresse personnelle (facultative). */
  address: text("address"),
  updatedAt: updatedAt(),
});

export const driverZones = pgTable(
  "driver_zones",
  {
    driverId: uuid("driver_id")
      .notNull()
      .references(() => drivers.userId, { onDelete: "cascade" }),
    zoneId: uuid("zone_id")
      .notNull()
      .references(() => zones.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.driverId, t.zoneId] }),
    index("driver_zones_zone_idx").on(t.zoneId),
  ],
);

export const vehicles = pgTable(
  "vehicles",
  {
    id: id(),
    driverId: uuid("driver_id")
      .notNull()
      .references(() => drivers.userId),
    type: vehicleType("type").notNull(),
    plate: text("plate"),
    capacityKg: integer("capacity_kg").notNull(),
    insuranceExpiresAt: date("insurance_expires_at"),
    inspectionExpiresAt: date("inspection_expires_at"),
    status: vehicleStatus("status").notNull().default("active"),
    createdAt: createdAt(),
  },
  (t) => [
    index("vehicles_driver_idx").on(t.driverId),
    check("vehicles_capacity_positive", sql`${t.capacityKg} > 0`),
  ],
);

export const documents = pgTable(
  "documents",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    validationId: uuid("validation_id").references(() => validations.id),
    vehicleId: uuid("vehicle_id").references(() => vehicles.id),
    kind: documentKind("kind").notNull(),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id),
    expiresAt: date("expires_at"),
    status: documentStatus("status").notNull().default("pending"),
    createdAt: createdAt(),
  },
  (t) => [
    index("documents_user_idx").on(t.userId),
    index("documents_validation_idx").on(t.validationId),
    index("documents_vehicle_idx").on(t.vehicleId),
    index("documents_file_idx").on(t.fileId),
    index("documents_expires_idx").on(t.expiresAt),
  ],
);

// --- Réglages ------------------------------------------------------------------------

export const settings = pgTable(
  "settings",
  {
    /** ex. cutoff_hour, min_order_per_producer, commission_tiers, tva */
    key: text("key").primaryKey(),
    value: jsonb("value").notNull(),
    updatedBy: uuid("updated_by").references(() => users.id),
    updatedAt: updatedAt(),
  },
  (t) => [index("settings_updated_by_idx").on(t.updatedBy)],
);

// --- Catalogue -------------------------------------------------------------------------

export const products = pgTable(
  "products",
  {
    id: id(),
    farmerId: uuid("farmer_id")
      .notNull()
      .references(() => farmers.userId),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    name: text("name").notNull(),
    description: text("description"),
    /** kg, sac, botte… */
    unit: text("unit").notNull().default("kg"),
    /** Prix en F CFA par unité. */
    price: integer("price").notNull(),
    stockQty: qty("stock_qty").notNull().default(0),
    minStock: qty("min_stock").notNull().default(0),
    minOrderQty: qty("min_order_qty"),
    availableFrom: date("available_from"),
    organic: boolean("organic").notNull().default(false),
    status: productStatus("status").notNull().default("draft"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("products_farmer_idx").on(t.farmerId),
    index("products_category_idx").on(t.categoryId),
    index("products_status_idx").on(t.status),
    check("products_price_positive", sql`${t.price} > 0`),
    check("products_stock_positive", sql`${t.stockQty} >= 0 and ${t.minStock} >= 0`),
    check("products_min_order_positive", sql`${t.minOrderQty} is null or ${t.minOrderQty} > 0`),
  ],
);

export const productPhotos = pgTable(
  "product_photos",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.fileId] }),
    index("product_photos_file_idx").on(t.fileId),
  ],
);

// --- Commandes ----------------------------------------------------------------------------

/** Numéros lisibles et sans doublon, même quand deux commandes arrivent en
 * même temps : CMD-3101, MIS-4301, PAN-1001… */
export const orderReferenceSeq = pgSequence("order_reference_seq", { startWith: 3101 });
export const missionReferenceSeq = pgSequence("mission_reference_seq", { startWith: 4301 });
export const checkoutReferenceSeq = pgSequence("checkout_reference_seq", { startWith: 1001 });
export const refundReferenceSeq = pgSequence("refund_reference_seq", { startWith: 501 });
export const payoutReferenceSeq = pgSequence("payout_reference_seq", { startWith: 201 });
export const disputeReferenceSeq = pgSequence("dispute_reference_seq", { startWith: 1 });
export const creditNoteReferenceSeq = pgSequence("credit_note_reference_seq", { startWith: 1 });

/** Le panier validé par le restaurant : paiement et facture Diambar. */
export const checkouts = pgTable(
  "checkouts",
  {
    id: id(),
    reference: text("reference").notNull(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.userId),
    slotStart: timestamp("slot_start", { withTimezone: true }).notNull(),
    /** Créneau tel qu'affiché au restaurant (« Mardi 30 sept. · 07:00 – 11:00 »). */
    slotLabel: text("slot_label"),
    deliveryAddress: text("delivery_address").notNull(),
    /** Consignes pour le livreur (quai, contact, code d'accès…). */
    instructions: text("instructions"),
    zoneId: uuid("zone_id").references(() => zones.id),
    paymentMode: paymentMode("payment_mode").notNull(),
    subtotal: integer("subtotal").notNull(),
    deliveryFee: integer("delivery_fee").notNull().default(0),
    discount: integer("discount").notNull().default(0),
    total: integer("total").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("checkouts_reference_key").on(t.reference),
    index("checkouts_restaurant_idx").on(t.restaurantId),
    index("checkouts_zone_idx").on(t.zoneId),
    check(
      "checkouts_amounts_positive",
      sql`${t.subtotal} >= 0 and ${t.deliveryFee} >= 0 and ${t.discount} >= 0 and ${t.total} >= 0`,
    ),
    check(
      "checkouts_total_consistent",
      sql`${t.total} = ${t.subtotal} + ${t.deliveryFee} - ${t.discount}`,
    ),
  ],
);

/** La commande d'un producteur (une par producteur dans le panier). */
export const orders = pgTable(
  "orders",
  {
    id: id(),
    reference: text("reference").notNull(),
    checkoutId: uuid("checkout_id")
      .notNull()
      .references(() => checkouts.id),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.userId),
    farmerId: uuid("farmer_id")
      .notNull()
      .references(() => farmers.userId),
    status: orderStatus("status").notNull().default("pending"),
    shortagePreference: shortagePreference("shortage_preference").notNull().default("partial"),
    /** Codes à 4 chiffres : le producteur donne le code d'enlèvement au
     * livreur, le restaurant donne le code de remise. Seul le serveur les lit
     * et ne les montre qu'au producteur ou au restaurant concerné. */
    pickupCode: text("pickup_code").notNull(),
    /** Anciennes colonnes (codes brouillés), inutilisées : conservées car
     * Supabase bloque la suppression de colonnes ; à retirer plus tard. */
    pickupCodeHash: text("pickup_code_hash"),
    deliveryCodeHash: text("delivery_code_hash"),
    deliveryCode: text("delivery_code").notNull(),
    deliveredWithCode: boolean("delivered_with_code").notNull().default(false),
    trackingToken: text("tracking_token").notNull(),
    subtotal: integer("subtotal").notNull(),
    /** Part de la commande dans le panier : frais de sa course, remise. */
    deliveryFee: integer("delivery_fee").notNull().default(0),
    /** Distance estimée producteur → restaurant à la commande : sert aux frais
     * du restaurant et à la paie du livreur. */
    distanceKm: numeric("distance_km", { precision: 7, scale: 1, mode: "number" }),
    discount: integer("discount").notNull().default(0),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    /** Fin du délai de vérification (livraison + 48 h). */
    receptionDeadline: timestamp("reception_deadline", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    /** Contrôle à la réception par le restaurant (lignes : order_items). */
    receptionAt: timestamp("reception_at", { withTimezone: true }),
    receptionNote: text("reception_note"),
    /** Montant de cette commande couvert par le paiement déclaré du panier
     * (Wave, Orange Money) : base des remboursements si elle diminue ensuite. */
    paymentShare: integer("payment_share"),
    /** Commande passée automatiquement par une commande récurrente. */
    recurringOrderId: uuid("recurring_order_id").references((): AnyPgColumn => recurringOrders.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("orders_reference_key").on(t.reference),
    uniqueIndex("orders_tracking_token_key").on(t.trackingToken),
    index("orders_checkout_idx").on(t.checkoutId),
    index("orders_restaurant_idx").on(t.restaurantId, t.createdAt),
    index("orders_farmer_idx").on(t.farmerId, t.createdAt),
    index("orders_status_idx").on(t.status),
    index("orders_recurring_idx").on(t.recurringOrderId),
    check("orders_subtotal_positive", sql`${t.subtotal} >= 0`),
    check("orders_fees_positive", sql`${t.deliveryFee} >= 0 and ${t.discount} >= 0`),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    /** Recopiés au moment de la commande : un changement de prix ne touche pas le passé. */
    productName: text("product_name").notNull(),
    unit: text("unit").notNull(),
    unitPrice: integer("unit_price").notNull(),
    qtyOrdered: qty("qty_ordered").notNull(),
    qtyConfirmed: qty("qty_confirmed"),
    qtyRefused: qty("qty_refused").notNull().default(0),
    refusalReason: text("refusal_reason"),
  },
  (t) => [
    index("order_items_order_idx").on(t.orderId),
    index("order_items_product_idx").on(t.productId),
    check("order_items_price_positive", sql`${t.unitPrice} > 0`),
    check("order_items_qty_positive", sql`${t.qtyOrdered} > 0`),
    check(
      "order_items_confirmed_range",
      sql`${t.qtyConfirmed} is null or (${t.qtyConfirmed} >= 0 and ${t.qtyConfirmed} <= ${t.qtyOrdered})`,
    ),
    check(
      "order_items_refused_range",
      sql`${t.qtyRefused} >= 0 and ${t.qtyRefused} <= coalesce(${t.qtyConfirmed}, ${t.qtyOrdered})`,
    ),
  ],
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    status: orderStatus("status").notNull(),
    actorId: uuid("actor_id").references(() => users.id),
    note: text("note"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("order_events_order_idx").on(t.orderId, t.at),
    index("order_events_actor_idx").on(t.actorId),
  ],
);

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    delta: qty("delta").notNull(),
    reason: stockReason("reason").notNull(),
    orderId: uuid("order_id").references(() => orders.id),
    actorId: uuid("actor_id").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("stock_movements_product_idx").on(t.productId, t.createdAt),
    index("stock_movements_order_idx").on(t.orderId),
    index("stock_movements_actor_idx").on(t.actorId),
    check("stock_movements_delta_nonzero", sql`${t.delta} <> 0`),
  ],
);

// --- Livraison ----------------------------------------------------------------------------

export const missions = pgTable(
  "missions",
  {
    id: id(),
    reference: text("reference").notNull(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    driverId: uuid("driver_id").references(() => drivers.userId),
    vehicleId: uuid("vehicle_id").references(() => vehicles.id),
    status: missionStatus("status").notNull().default("available"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    distanceKm: numeric("distance_km", { precision: 8, scale: 2, mode: "number" }),
    weightKg: qty("weight_kg"),
    /** F CFA versés au livreur pour la course. */
    payout: integer("payout").notNull(),
    urgency: missionUrgency("urgency").notNull().default("standard"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("missions_reference_key").on(t.reference),
    uniqueIndex("missions_order_key").on(t.orderId),
    index("missions_driver_idx").on(t.driverId, t.scheduledFor),
    index("missions_vehicle_idx").on(t.vehicleId),
    index("missions_status_idx").on(t.status, t.scheduledFor),
    check("missions_payout_positive", sql`${t.payout} >= 0`),
    check(
      "missions_driver_required",
      sql`${t.status} in ('available', 'cancelled') or ${t.driverId} is not null`,
    ),
  ],
);

export const missionEvents = pgTable(
  "mission_events",
  {
    id: id(),
    missionId: uuid("mission_id")
      .notNull()
      .references(() => missions.id, { onDelete: "cascade" }),
    /** Vide pour une simple note (ex. attente au restaurant). */
    status: missionStatus("status"),
    actorId: uuid("actor_id").references(() => users.id),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    note: text("note"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("mission_events_mission_idx").on(t.missionId, t.at),
    index("mission_events_actor_idx").on(t.actorId),
  ],
);

export const deliveryProofs = pgTable(
  "delivery_proofs",
  {
    id: id(),
    missionId: uuid("mission_id")
      .notNull()
      .references(() => missions.id),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id),
    stage: proofStage("stage").notNull(),
    codeChecked: boolean("code_checked").notNull().default(false),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    takenAt: timestamp("taken_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("delivery_proofs_mission_idx").on(t.missionId),
    index("delivery_proofs_file_idx").on(t.fileId),
  ],
);

// --- Argent ----------------------------------------------------------------------------------

/** Pendant le pilote, sans paiement intégré :
 * - Wave / Orange Money : un paiement par panier. Le restaurant paie sur le
 *   numéro marchand, déclare la référence de la transaction, et l'admin la
 *   confirme après l'avoir vue sur le compte marchand ;
 * - espèces : un paiement par commande (chaque course a son livreur). Le
 *   livreur encaisse à la livraison, l'admin confirme quand il a remis
 *   l'argent. */
export const payments = pgTable(
  "payments",
  {
    id: id(),
    checkoutId: uuid("checkout_id")
      .notNull()
      .references(() => checkouts.id),
    /** Espèces : la commande payée à son livreur. Vide pour Wave / OM. */
    orderId: uuid("order_id").references(() => orders.id),
    method: paymentMethod("method").notNull(),
    /** Référence de la transaction chez Wave, Orange Money… */
    providerRef: text("provider_ref"),
    amount: integer("amount").notNull(),
    status: paymentStatus("status").notNull().default("pending"),
    /** Le restaurant indique avoir payé (référence de la transaction). */
    declaredAt: timestamp("declared_at", { withTimezone: true }),
    declaredBy: uuid("declared_by").references(() => users.id),
    /** Espèces : le livreur qui a encaissé, et quand. */
    collectedBy: uuid("collected_by").references(() => users.id),
    collectedAt: timestamp("collected_at", { withTimezone: true }),
    /** Pendant le pilote : l'admin qui a constaté le paiement. */
    confirmedBy: uuid("confirmed_by").references(() => users.id),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    /** Motif d'un refus par l'admin (référence introuvable, montant…). */
    note: text("note"),
    /** Rappel envoyé au restaurant avant l'annulation faute de paiement. */
    remindedAt: timestamp("reminded_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("payments_checkout_idx").on(t.checkoutId),
    index("payments_order_idx").on(t.orderId),
    index("payments_status_idx").on(t.status),
    index("payments_declared_by_idx").on(t.declaredBy),
    index("payments_collected_by_idx").on(t.collectedBy),
    index("payments_confirmed_by_idx").on(t.confirmedBy),
    uniqueIndex("payments_provider_ref_key").on(t.method, t.providerRef),
    check("payments_amount_positive", sql`${t.amount} > 0`),
    check(
      "payments_confirmed_has_date",
      sql`${t.status} <> 'confirmed' or ${t.paidAt} is not null`,
    ),
  ],
);

export const invoices = pgTable(
  "invoices",
  {
    id: id(),
    /** Numérotation continue, sans trou (exigence de facturation). */
    number: text("number").notNull(),
    checkoutId: uuid("checkout_id")
      .notNull()
      .references(() => checkouts.id),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    totalHt: integer("total_ht").notNull(),
    tvaRate: numeric("tva_rate", { precision: 5, scale: 2, mode: "number" }).notNull().default(0),
    tvaAmount: integer("tva_amount").notNull().default(0),
    totalTtc: integer("total_ttc").notNull(),
    fileId: uuid("file_id").references(() => files.id),
    /** Contenu figé à l'émission (vendeur, client, lignes, totaux) : une
     * facture émise ne change plus, même si un réglage change ensuite. */
    content: jsonb("content"),
  },
  (t) => [
    uniqueIndex("invoices_number_key").on(t.number),
    uniqueIndex("invoices_checkout_key").on(t.checkoutId),
    index("invoices_file_idx").on(t.fileId),
    check("invoices_tva_rate_range", sql`${t.tvaRate} >= 0 and ${t.tvaRate} <= 100`),
    check("invoices_totals_consistent", sql`${t.totalTtc} = ${t.totalHt} + ${t.tvaAmount}`),
  ],
);

/** Retrait demandé par un producteur ou un livreur. Pendant le pilote,
 * l'admin envoie l'argent depuis le compte marchand puis saisit la référence. */
export const payouts = pgTable(
  "payouts",
  {
    id: id(),
    /** VER-201, VER-202… (vide sur les lignes antérieures au pilote). */
    reference: text("reference"),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    amount: integer("amount").notNull(),
    fee: integer("fee").notNull().default(0),
    method: paymentMethod("method").notNull(),
    /** Numéro Wave / Orange Money qui reçoit l'argent. */
    accountNumber: text("account_number"),
    providerRef: text("provider_ref"),
    status: payoutStatus("status").notNull().default("requested"),
    processedBy: uuid("processed_by").references(() => users.id),
    /** Au-dessus du seuil de double validation : l'admin qui a validé ;
     * un autre admin verse. */
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    /** Motif d'un refus ou d'un échec. */
    note: text("note"),
    createdAt: createdAt(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("payouts_reference_key").on(t.reference),
    index("payouts_user_idx").on(t.userId, t.createdAt),
    index("payouts_status_idx").on(t.status),
    index("payouts_processed_by_idx").on(t.processedBy),
    index("payouts_approved_by_idx").on(t.approvedBy),
    check("payouts_amount_positive", sql`${t.amount} > 0 and ${t.fee} >= 0`),
  ],
);

export const refunds = pgTable(
  "refunds",
  {
    id: id(),
    reference: text("reference").notNull(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    source: refundSource("source").notNull(),
    amount: integer("amount").notNull(),
    bornBy: liableParty("born_by").notNull().default("platform"),
    method: paymentMethod("method"),
    status: refundStatus("status").notNull().default("pending"),
    reason: text("reason"),
    createdBy: uuid("created_by").references(() => users.id),
    approvedBy: uuid("approved_by").references(() => users.id),
    /** Numéro qui a reçu le remboursement et référence de la transaction. */
    /** Admin qui a envoyé l'argent (au-dessus du seuil, différent de celui
     * qui a validé). */
    paidBy: uuid("paid_by").references(() => users.id),
    paidTo: text("paid_to"),
    providerRef: text("provider_ref"),
    createdAt: createdAt(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("refunds_reference_key").on(t.reference),
    index("refunds_order_idx").on(t.orderId),
    index("refunds_status_idx").on(t.status),
    index("refunds_created_by_idx").on(t.createdBy),
    index("refunds_approved_by_idx").on(t.approvedBy),
    index("refunds_paid_by_idx").on(t.paidBy),
    check("refunds_amount_positive", sql`${t.amount} > 0`),
    // Un même admin ne crée et n'approuve pas le même remboursement.
    check(
      "refunds_separation_of_duties",
      sql`${t.createdBy} is null or ${t.approvedBy} is null or ${t.createdBy} <> ${t.approvedBy}`,
    ),
  ],
);

/** Le grand livre : le solde d'un compte est la somme de ses écritures. */
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: id(),
    account: ledgerAccount("account").notNull(),
    /** Vide pour le compte de la plateforme. */
    userId: uuid("user_id").references(() => users.id),
    kind: ledgerKind("kind").notNull(),
    /** Positif = dû au compte, négatif = repris ou versé. */
    amount: integer("amount").notNull(),
    orderId: uuid("order_id").references(() => orders.id),
    missionId: uuid("mission_id").references(() => missions.id),
    refundId: uuid("refund_id").references(() => refunds.id),
    payoutId: uuid("payout_id").references(() => payouts.id),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [
    index("ledger_entries_user_idx").on(t.userId, t.createdAt),
    index("ledger_entries_order_idx").on(t.orderId),
    index("ledger_entries_mission_idx").on(t.missionId),
    index("ledger_entries_refund_idx").on(t.refundId),
    index("ledger_entries_payout_idx").on(t.payoutId),
    check("ledger_entries_amount_nonzero", sql`${t.amount} <> 0`),
    check(
      "ledger_entries_owner",
      sql`(${t.account} = 'platform' and ${t.userId} is null) or (${t.account} <> 'platform' and ${t.userId} is not null)`,
    ),
  ],
);

// --- Suivi ------------------------------------------------------------------------------------

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    /** Page de l'app à ouvrir. */
    link: text("link"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    actorId: uuid("actor_id").references(() => users.id),
    module: text("module").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    status: auditStatus("status").notNull().default("success"),
    ip: text("ip"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_actor_idx").on(t.actorId, t.at),
    index("audit_logs_module_idx").on(t.module, t.at),
    index("audit_logs_target_idx").on(t.targetType, t.targetId),
  ],
);

// --- Commandes récurrentes -----------------------------------------------------

/** Commande qui se répète : le serveur passe chaque commande automatiquement
 * la veille de la livraison, à l'heure choisie, avec les règles du restaurant
 * (prix, stock, budget, jour non ouvré). */
export const recurringOrders = pgTable(
  "recurring_orders",
  {
    id: id(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.userId),
    farmerId: uuid("farmer_id")
      .notNull()
      .references(() => farmers.userId),
    name: text("name").notNull(),
    /** [{ productId, qty, referencePrice }] */
    items: jsonb("items").notNull(),
    /** weekly | biweekly | monthly | every_n_days | custom */
    frequency: text("frequency").notNull(),
    intervalDays: integer("interval_days"),
    /** Jours de livraison (0 = dimanche). */
    daysOfWeek: jsonb("days_of_week").notNull().default([]),
    /** Heure de livraison souhaitée (« 09:30 »). */
    deliveryTime: text("delivery_time").notNull(),
    /** Heure à laquelle la commande est passée, la veille de la livraison. */
    orderTime: text("order_time").notNull(),
    firstDeliveryOn: date("first_delivery_on").notNull(),
    /** { type: never } | { type: on_date, date } | { type: after_count, count } */
    endRule: jsonb("end_rule").notNull(),
    rules: jsonb("rules").notNull(),
    deliveryAddress: text("delivery_address").notNull(),
    paymentMethod: paymentMethod("payment_method").notNull(),
    shortagePreference: shortagePreference("shortage_preference").notNull().default("partial"),
    instructions: text("instructions"),
    status: recurringStatus("status").notNull().default("active"),
    pauseReason: text("pause_reason"),
    pausedUntil: timestamp("paused_until", { withTimezone: true }),
    /** Prochaine livraison prévue et moment où la commande sera passée. */
    nextDeliveryOn: date("next_delivery_on"),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    generatedCount: integer("generated_count").notNull().default(0),
    /** [{ id, type: skip | override, occurrenceDate, items?, reason?, createdAt }] */
    exceptions: jsonb("exceptions").notNull().default([]),
    /** Règle déclenchée qui attend la décision du restaurant. */
    pendingAction: jsonb("pending_action"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("recurring_orders_restaurant_idx").on(t.restaurantId),
    index("recurring_orders_farmer_idx").on(t.farmerId),
    index("recurring_orders_due_idx").on(t.status, t.nextRunAt),
    check("recurring_orders_generated_positive", sql`${t.generatedCount} >= 0`),
  ],
);

export const recurringOrderEvents = pgTable(
  "recurring_order_events",
  {
    id: id(),
    recurringOrderId: uuid("recurring_order_id")
      .notNull()
      .references(() => recurringOrders.id, { onDelete: "cascade" }),
    /** generated | skipped | rule_triggered | shifted | paused | resumed | cancelled | edited */
    kind: text("kind").notNull(),
    message: text("message").notNull(),
    orderId: uuid("order_id").references(() => orders.id),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("recurring_order_events_recurring_idx").on(t.recurringOrderId, t.at),
    index("recurring_order_events_order_idx").on(t.orderId),
  ],
);

// --- Litiges ---------------------------------------------------------------------

export const disputes = pgTable(
  "disputes",
  {
    id: id(),
    reference: text("reference").notNull(),
    orderId: uuid("order_id").references(() => orders.id),
    missionId: uuid("mission_id").references(() => missions.id),
    category: text("category").notNull(),
    subcategory: text("subcategory").notNull(),
    description: text("description").notNull(),
    openedBy: uuid("opened_by")
      .notNull()
      .references(() => users.id),
    openedByRole: disputeParty("opened_by_role").notNull(),
    againstRole: disputeParty("against_role").notNull(),
    againstUserId: uuid("against_user_id").references(() => users.id),
    claimedAmount: integer("claimed_amount").notNull().default(0),
    status: disputeStatus("status").notNull().default("open"),
    priority: disputePriority("priority").notNull().default("medium"),
    slaDueAt: timestamp("sla_due_at", { withTimezone: true }).notNull(),
    escalations: integer("escalations").notNull().default(0),
    assigneeId: uuid("assignee_id").references(() => users.id),
    outcome: disputeOutcome("outcome"),
    grantedAmount: integer("granted_amount"),
    liableParty: disputeParty("liable_party"),
    decisionReason: text("decision_reason"),
    decidedBy: uuid("decided_by").references(() => users.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    /** Remboursement créé par la décision (restaurant indemnisé). */
    refundId: uuid("refund_id").references(() => refunds.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("disputes_reference_key").on(t.reference),
    index("disputes_order_idx").on(t.orderId),
    index("disputes_mission_idx").on(t.missionId),
    index("disputes_opened_by_idx").on(t.openedBy),
    index("disputes_against_user_idx").on(t.againstUserId),
    index("disputes_assignee_idx").on(t.assigneeId),
    index("disputes_decided_by_idx").on(t.decidedBy),
    index("disputes_refund_idx").on(t.refundId),
    index("disputes_status_idx").on(t.status, t.createdAt),
    check("disputes_claimed_positive", sql`${t.claimedAmount} >= 0`),
    check("disputes_granted_positive", sql`${t.grantedAmount} is null or ${t.grantedAmount} >= 0`),
  ],
);

export const disputeMessages = pgTable(
  "dispute_messages",
  {
    id: id(),
    disputeId: uuid("dispute_id")
      .notNull()
      .references(() => disputes.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id),
    authorRole: disputeParty("author_role").notNull(),
    text: text("text").notNull(),
    /** Note interne de l'équipe, jamais montrée aux parties. */
    internal: boolean("internal").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index("dispute_messages_dispute_idx").on(t.disputeId, t.createdAt),
    index("dispute_messages_author_idx").on(t.authorId),
  ],
);

export const disputeEvents = pgTable(
  "dispute_events",
  {
    id: id(),
    disputeId: uuid("dispute_id")
      .notNull()
      .references(() => disputes.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id),
    label: text("label").notNull(),
    detail: text("detail"),
    createdAt: createdAt(),
  },
  (t) => [
    index("dispute_events_dispute_idx").on(t.disputeId, t.createdAt),
    index("dispute_events_actor_idx").on(t.actorId),
  ],
);

export const disputeAttachments = pgTable(
  "dispute_attachments",
  {
    id: id(),
    disputeId: uuid("dispute_id")
      .notNull()
      .references(() => disputes.id, { onDelete: "cascade" }),
    messageId: uuid("message_id").references(() => disputeMessages.id, { onDelete: "set null" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("dispute_attachments_dispute_idx").on(t.disputeId),
    index("dispute_attachments_message_idx").on(t.messageId),
    index("dispute_attachments_file_idx").on(t.fileId),
  ],
);

// --- Avoirs -----------------------------------------------------------------------------
// Montant dû à un restaurant, à déduire de ses prochaines commandes (décision
// de litige). La partie responsable est débitée dans le grand livre à
// l'émission ; à l'utilisation, le restaurant paie d'autant moins.

export const creditNoteStatus = pgEnum("credit_note_status", ["active", "used", "cancelled"]);

export const creditNotes = pgTable(
  "credit_notes",
  {
    id: id(),
    reference: text("reference").notNull(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.userId),
    amount: integer("amount").notNull(),
    /** Ce qui reste à utiliser. */
    balance: integer("balance").notNull(),
    disputeId: uuid("dispute_id").references(() => disputes.id),
    bornBy: liableParty("born_by").notNull().default("platform"),
    reason: text("reason"),
    status: creditNoteStatus("status").notNull().default("active"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("credit_notes_reference_key").on(t.reference),
    index("credit_notes_restaurant_idx").on(t.restaurantId, t.status),
    index("credit_notes_dispute_idx").on(t.disputeId),
    index("credit_notes_created_by_idx").on(t.createdBy),
    check("credit_notes_amount_positive", sql`${t.amount} > 0`),
    check("credit_notes_balance_range", sql`${t.balance} >= 0 and ${t.balance} <= ${t.amount}`),
  ],
);

/** Utilisation d'un avoir sur une commande ; rendue si la commande est
 * annulée ou réduite. */
export const creditNoteUses = pgTable(
  "credit_note_uses",
  {
    id: id(),
    creditNoteId: uuid("credit_note_id")
      .notNull()
      .references(() => creditNotes.id),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    amount: integer("amount").notNull(),
    /** Part rendue à l'avoir (annulation, quantités réduites). */
    restored: integer("restored").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index("credit_note_uses_note_idx").on(t.creditNoteId),
    index("credit_note_uses_order_idx").on(t.orderId),
    check("credit_note_uses_amount_positive", sql`${t.amount} > 0`),
    check(
      "credit_note_uses_restored_range",
      sql`${t.restored} >= 0 and ${t.restored} <= ${t.amount}`,
    ),
  ],
);

// --- Messagerie -------------------------------------------------------------------------
// Fils entre un restaurant et un producteur, ou entre un livreur et un
// restaurant (autour d'une course). L'équipe lit tout, peut écrire, classer et
// ajouter des notes internes que les parties ne voient jamais.

export const conversationKind = pgEnum("conversation_kind", [
  "restaurant_farmer",
  "driver_restaurant",
]);
export const conversationPriority = pgEnum("conversation_priority", [
  "normal",
  "important",
  "urgent",
]);
export const messageAuthorRole = pgEnum("message_author_role", [
  "restaurant",
  "farmer",
  "driver",
  "admin",
]);

export const conversations = pgTable(
  "conversations",
  {
    id: id(),
    kind: conversationKind("kind").notNull(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => users.id),
    farmerId: uuid("farmer_id").references(() => users.id),
    driverId: uuid("driver_id").references(() => users.id),
    /** Course à l'origine d'un fil livreur ↔ restaurant. */
    missionId: uuid("mission_id").references(() => missions.id),
    priority: conversationPriority("priority").notNull().default("normal"),
    tags: jsonb("tags").notNull().default([]),
    /** Ticket support ouvert depuis ce fil. */
    ticketId: uuid("ticket_id").references((): AnyPgColumn => supportTickets.id),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    lastMessagePreview: text("last_message_preview"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("conversations_restaurant_farmer_key")
      .on(t.restaurantId, t.farmerId)
      .where(sql`${t.kind} = 'restaurant_farmer'`),
    uniqueIndex("conversations_driver_restaurant_key")
      .on(t.driverId, t.restaurantId)
      .where(sql`${t.kind} = 'driver_restaurant'`),
    index("conversations_restaurant_idx").on(t.restaurantId),
    index("conversations_farmer_idx").on(t.farmerId),
    index("conversations_driver_idx").on(t.driverId),
    index("conversations_mission_idx").on(t.missionId),
    index("conversations_ticket_idx").on(t.ticketId),
    index("conversations_last_idx").on(t.lastMessageAt),
    check(
      "conversations_participants",
      sql`(${t.kind} = 'restaurant_farmer' and ${t.farmerId} is not null) or (${t.kind} = 'driver_restaurant' and ${t.driverId} is not null)`,
    ),
  ],
);

export const conversationMessages = pgTable(
  "conversation_messages",
  {
    id: id(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id),
    authorRole: messageAuthorRole("author_role").notNull(),
    text: text("text").notNull().default(""),
    fileId: uuid("file_id").references(() => files.id),
    attachmentName: text("attachment_name"),
    /** Note de l'équipe : jamais montrée aux parties. */
    internal: boolean("internal").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index("conversation_messages_conversation_idx").on(t.conversationId, t.createdAt),
    index("conversation_messages_author_idx").on(t.authorId),
    index("conversation_messages_file_idx").on(t.fileId),
  ],
);

/** Dernière lecture d'un fil par une personne (messages non lus). */
export const conversationReads = pgTable(
  "conversation_reads",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.conversationId, t.userId] }),
    index("conversation_reads_user_idx").on(t.userId),
  ],
);

// --- Support ----------------------------------------------------------------------------

export const ticketStatus = pgEnum("ticket_status", ["open", "answered", "closed"]);
export const ticketCategory = pgEnum("ticket_category", [
  "delivery",
  "products",
  "payments",
  "account",
  "technical",
  "other",
]);
export const ticketPriority = pgEnum("ticket_priority", ["low", "medium", "high", "urgent"]);
export const ticketReferenceSeq = pgSequence("ticket_reference_seq", { startWith: 1 });

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: id(),
    reference: text("reference").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    subject: text("subject").notNull(),
    category: ticketCategory("category").notNull(),
    priority: ticketPriority("priority").notNull(),
    status: ticketStatus("status").notNull().default("open"),
    assigneeId: uuid("assignee_id").references(() => users.id),
    orderId: uuid("order_id").references(() => orders.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("support_tickets_reference_key").on(t.reference),
    index("support_tickets_user_idx").on(t.userId),
    index("support_tickets_assignee_idx").on(t.assigneeId),
    index("support_tickets_order_idx").on(t.orderId),
    index("support_tickets_status_idx").on(t.status, t.createdAt),
  ],
);

export const supportMessages = pgTable(
  "support_messages",
  {
    id: id(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id),
    authorRole: disputeParty("author_role").notNull(),
    text: text("text").notNull(),
    internal: boolean("internal").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index("support_messages_ticket_idx").on(t.ticketId, t.createdAt),
    index("support_messages_author_idx").on(t.authorId),
  ],
);

// --- Avis après livraison -----------------------------------------------------------------
// Un avis par commande livrée, noté par le restaurant sur six critères (1 à 5).
// Le producteur peut répondre ; l'équipe peut masquer un avis abusif.

export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => users.id),
    farmerId: uuid("farmer_id")
      .notNull()
      .references(() => users.id),
    driverId: uuid("driver_id").references(() => users.id),
    quality: integer("quality").notNull(),
    quantity: integer("quantity").notNull(),
    freshness: integer("freshness").notNull(),
    timeliness: integer("timeliness").notNull(),
    packaging: integer("packaging").notNull(),
    communication: integer("communication").notNull(),
    comment: text("comment").notNull().default(""),
    tags: jsonb("tags").notNull().default([]),
    reply: text("reply"),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    /** Masqué par l'équipe (abusif) : plus compté ni affiché. */
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("reviews_order_key").on(t.orderId),
    index("reviews_restaurant_idx").on(t.restaurantId),
    index("reviews_farmer_idx").on(t.farmerId),
    index("reviews_driver_idx").on(t.driverId),
    check(
      "reviews_scores_range",
      sql`${t.quality} between 1 and 5 and ${t.quantity} between 1 and 5 and ${t.freshness} between 1 and 5 and ${t.timeliness} between 1 and 5 and ${t.packaging} between 1 and 5 and ${t.communication} between 1 and 5`,
    ),
  ],
);

// --- Modération du catalogue --------------------------------------------------------------

export const productReportStatus = pgEnum("product_report_status", ["open", "resolved"]);

/** Signalement d'un produit par un restaurant (photo trompeuse, prix…). */
export const productReports = pgTable(
  "product_reports",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id),
    reason: text("reason").notNull(),
    status: productReportStatus("status").notNull().default("open"),
    resolvedBy: uuid("resolved_by").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("product_reports_product_idx").on(t.productId, t.status),
    index("product_reports_reporter_idx").on(t.reporterId),
    index("product_reports_resolved_by_idx").on(t.resolvedBy),
  ],
);

/** Décisions de modération sur un produit (historique affiché à l'équipe). */
export const moderationEvents = pgTable(
  "moderation_events",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    actorId: uuid("actor_id").references(() => users.id),
    text: text("text").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("moderation_events_product_idx").on(t.productId, t.createdAt),
    index("moderation_events_actor_idx").on(t.actorId),
  ],
);

// --- Retours ----------------------------------------------------------------------------
// Le restaurant signale un produit livré non conforme, dans le délai de
// réception. Le producteur accepte (remboursement à sa charge, ou avoir) ou
// refuse ; l'équipe peut organiser la récupération, inspecter, trancher (qui
// paie), escalader en litige et clôturer.

export const returnReason = pgEnum("return_reason", [
  "quality",
  "quantity",
  "wrong_item",
  "damaged",
  "late",
  "other",
]);
export const returnStatus = pgEnum("return_status", ["pending", "accepted", "refused", "credited"]);
export const returnReferenceSeq = pgSequence("return_reference_seq", { startWith: 1 });

export const returnRequests = pgTable(
  "return_requests",
  {
    id: id(),
    reference: text("reference").notNull(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => users.id),
    farmerId: uuid("farmer_id")
      .notNull()
      .references(() => users.id),
    qty: qty("qty").notNull(),
    reason: returnReason("reason").notNull(),
    description: text("description").notNull(),
    requestedAmount: integer("requested_amount").notNull(),
    awardedAmount: integer("awarded_amount"),
    status: returnStatus("status").notNull().default("pending"),
    decisionNote: text("decision_note"),
    decidedBy: uuid("decided_by").references(() => users.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    refundId: uuid("refund_id").references(() => refunds.id),
    creditNoteId: uuid("credit_note_id").references(() => creditNotes.id),
    /** Récupération : livreur, créneau, adresse, étapes. */
    pickup: jsonb("pickup"),
    /** Inspection à réception : conforme ou non, note, par qui. */
    inspection: jsonb("inspection"),
    /** Décision de l'équipe : type, qui paie, note. */
    resolution: jsonb("resolution"),
    disputeId: uuid("dispute_id").references(() => disputes.id),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("return_requests_reference_key").on(t.reference),
    index("return_requests_order_idx").on(t.orderId),
    index("return_requests_item_idx").on(t.orderItemId),
    index("return_requests_restaurant_idx").on(t.restaurantId, t.createdAt),
    index("return_requests_farmer_idx").on(t.farmerId, t.createdAt),
    index("return_requests_decided_by_idx").on(t.decidedBy),
    index("return_requests_refund_idx").on(t.refundId),
    index("return_requests_credit_note_idx").on(t.creditNoteId),
    index("return_requests_dispute_idx").on(t.disputeId),
    check("return_requests_amount_positive", sql`${t.requestedAmount} > 0`),
    check("return_requests_qty_positive", sql`${t.qty} > 0`),
  ],
);

export const returnMessages = pgTable(
  "return_messages",
  {
    id: id(),
    returnId: uuid("return_id")
      .notNull()
      .references(() => returnRequests.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    authorRole: disputeParty("author_role").notNull(),
    text: text("text").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("return_messages_return_idx").on(t.returnId, t.createdAt),
    index("return_messages_author_idx").on(t.authorId),
  ],
);

export const returnEvents = pgTable(
  "return_events",
  {
    id: id(),
    returnId: uuid("return_id")
      .notNull()
      .references(() => returnRequests.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id),
    text: text("text").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("return_events_return_idx").on(t.returnId, t.createdAt),
    index("return_events_actor_idx").on(t.actorId),
  ],
);

export const returnPhotos = pgTable(
  "return_photos",
  {
    id: id(),
    returnId: uuid("return_id")
      .notNull()
      .references(() => returnRequests.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id),
    name: text("name").notNull(),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("return_photos_return_idx").on(t.returnId),
    index("return_photos_file_idx").on(t.fileId),
    index("return_photos_uploaded_by_idx").on(t.uploadedBy),
  ],
);

// --- Incidents de course --------------------------------------------------------------------
// Le livreur signale un incident sur une de ses courses (client absent, panne,
// accident…) et peut demander une indemnité ; l'équipe la verse sur son solde
// (grand livre) ou la refuse.

export const incidentType = pgEnum("incident_type", [
  "client_absent",
  "refused",
  "breakdown",
  "accident",
  "traffic",
  "address",
  "other",
]);
export const incidentStatus = pgEnum("incident_status", ["open", "escalated", "resolved"]);
export const incidentSeverity = pgEnum("incident_severity", ["low", "medium", "high", "critical"]);
export const incidentReferenceSeq = pgSequence("incident_reference_seq", { startWith: 1 });

export const incidents = pgTable(
  "incidents",
  {
    id: id(),
    reference: text("reference").notNull(),
    missionId: uuid("mission_id")
      .notNull()
      .references(() => missions.id),
    driverId: uuid("driver_id")
      .notNull()
      .references(() => users.id),
    type: incidentType("type").notNull(),
    severity: incidentSeverity("severity").notNull(),
    description: text("description").notNull(),
    waitedMinutes: integer("waited_minutes").notNull().default(0),
    compensationRequested: integer("compensation_requested").notNull().default(0),
    compensationAwarded: integer("compensation_awarded"),
    resolutionNote: text("resolution_note"),
    status: incidentStatus("status").notNull().default("open"),
    resolvedBy: uuid("resolved_by").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("incidents_reference_key").on(t.reference),
    index("incidents_mission_idx").on(t.missionId),
    index("incidents_driver_idx").on(t.driverId, t.createdAt),
    index("incidents_status_idx").on(t.status),
    index("incidents_resolved_by_idx").on(t.resolvedBy),
    check(
      "incidents_amounts_range",
      sql`${t.waitedMinutes} >= 0 and ${t.compensationRequested} >= 0 and (${t.compensationAwarded} is null or ${t.compensationAwarded} >= 0)`,
    ),
  ],
);

export const incidentEvents = pgTable(
  "incident_events",
  {
    id: id(),
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => incidents.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id),
    text: text("text").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("incident_events_incident_idx").on(t.incidentId, t.createdAt),
    index("incident_events_actor_idx").on(t.actorId),
  ],
);

export const incidentPhotos = pgTable(
  "incident_photos",
  {
    id: id(),
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => incidents.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("incident_photos_incident_idx").on(t.incidentId),
    index("incident_photos_file_idx").on(t.fileId),
  ],
);
