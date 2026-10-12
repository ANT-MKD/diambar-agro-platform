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
export const stockReason = pgEnum("stock_reason", [
  "manual",
  "order_reserved",
  "order_cancelled",
  "order_adjusted",
  "adjustment",
]);
export const paymentMode = pgEnum("payment_mode", ["prepaid", "pay_on_delivery", "cash"]);
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
    certification: certification("certification").notNull().default("none"),
    areaHa: numeric("area_ha", { precision: 8, scale: 2, mode: "number" }),
    lang: preferredLang("lang").notNull().default("fr"),
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
