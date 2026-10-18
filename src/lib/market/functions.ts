import { createServerFn } from "@tanstack/react-start";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { createDb, type Db } from "@/db/client.server";
import { auditLogs, cities, farmers as farmerTable, settings, users, zones } from "@/db/schema";
import { isDemoMode } from "@/lib/auth/config.server";
import { sessionAccount } from "@/lib/auth/guard.server";
import { AttemptLimiter } from "@/lib/auth/helpers";
import type { AccountRecord, StaffRole } from "@/lib/auth/store.server";
import { DbAccountStore } from "@/lib/auth/store-db.server";
import { formatFCFA } from "@/lib/format";
import { appUrl, notify } from "@/lib/notify/notify.server";
import { newOrderFarmerEmail } from "@/lib/notify/templates";
import {
  acceptMission,
  addDeliveryProof,
  addProductPhoto,
  confirmOrder,
  confirmPayment,
  markArrived,
  markNotificationsRead,
  MarketError,
  missionStep,
  moveStock,
  placeOrder,
  quoteCheckoutDelivery,
  reassignMission,
  removeProduct,
  reportReception,
  saveProduct,
  setOrderStatus,
  sweepUnpaidCheckouts,
  withdrawMission,
} from "./market-db.server";
import { declarePayment, rejectPayment } from "./payments-db.server";
import {
  approvePayout,
  approveRefund,
  payPayout,
  payRefund,
  rejectPayout,
  requestPayout,
} from "./payouts-db.server";
import { issueDueInvoices, readStatement } from "./documents-db.server";
import { checkSenegal, readDeliverySettings } from "./delivery-db.server";
import { explainDbError } from "@/db/errors.server";
import { normalizeDriverPay } from "@/lib/platform-rules";
import { readAdminDirectory, type AdminDirectory } from "./admin-directory.server";
import { approveCategory, mergeCategory, renameCategory, renameUnit } from "./catalog-db.server";
import {
  cancelRecurringOrder,
  createRecurringOrder,
  overrideNextRecurringDelivery,
  pauseRecurringOrder,
  resolveRecurringPending,
  resumeRecurringOrder,
  runDueRecurringOrders,
  skipNextRecurringDelivery,
  updateRecurringOrder,
} from "./recurring-db.server";
import {
  assignDispute,
  DISPUTE_STAFF,
  escalateDispute,
  openDispute,
  replyDispute,
  requestEscalation,
  resolveDispute,
  setDisputeStatus,
  type StoredFile,
} from "./disputes-db.server";
import {
  requestAccountDeletion,
  setAvatar,
  updateAccount,
  updateDriver,
  updateFarm,
  updatePreferences,
  updateRestaurant,
  type AccountPatch,
  type FarmPatch,
  type PreferencesPatch,
  type RestaurantPatch,
} from "./profile-db.server";
import {
  addConversationNote,
  markConversationRead,
  MESSAGING_STAFF,
  sendMessage,
  startConversation,
  updateConversationMeta,
} from "./messaging-db.server";
import {
  assignTicket,
  createTicket,
  replyTicket,
  setTicketStatus,
  ticketFromConversation,
} from "./support-db.server";
import { normalizePricing } from "@/lib/delivery-pricing";
import type { StatementView } from "./documents-view";
import { readSnapshot } from "./snapshot.server";
import { createReview, replyReview, setReviewHidden, type ReviewInput } from "./reviews-db.server";
import {
  MODERATION_STAFF,
  moderateProduct,
  reportProduct,
  type ModerationAction,
} from "./moderation-db.server";
import { setAccountStatus, type AccountStatusChange } from "./accounts-admin-db.server";
import {
  advanceReturnPickup,
  closeReturn,
  createReturn,
  creditReturn,
  escalateReturn,
  farmerDecideReturn,
  inspectReturn,
  replyReturn,
  resolveReturn,
  RETURN_STAFF,
  scheduleReturnPickup,
} from "./returns-db.server";
import {
  clearFavoriteProducts,
  createSupplier,
  removeSupplier,
  saveBudget,
  toggleFavoriteProduct,
  updateSupplier,
} from "./restaurant-book-db.server";
import {
  decideDocRenewal,
  decideVehicleChange,
  FLEET_STAFF,
  logMaintenance,
  reportVehicleIssue,
  requestVehicleChange,
  resolveVehicleIssue,
  setDriverOnline,
  setVehiclePhoto,
  submitDocRenewal,
  updateVehicle,
  updateWorkSettings,
} from "./fleet-db.server";
import {
  commentIncident,
  createIncident,
  escalateIncident,
  resolveIncident,
} from "./incidents-db.server";
import {
  BUCKETS,
  decodeImage,
  NOT_STORED_PREFIX,
  removeObjects,
  storageConfigured,
  storageKey,
  uploadObject,
  type Bucket,
} from "./storage.server";
import type { ActionResult, MarketSnapshot } from "./types";

// Place de marché en base : fonctions appelées par les écrans. Chaque appel
// vérifie la session (compte actif, bon rôle) avant de toucher aux données.
// Sans base de données (aperçu de démonstration), les écrans gardent leurs
// données locales et n'appellent pas ces fonctions.

type Role = AccountRecord["role"];

async function withMarket<T>(
  roles: Role[],
  fn: (db: Db, me: AccountRecord) => Promise<T>,
  staff?: StaffRole[],
): Promise<T | { ok: false; message: string }> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return { ok: false, message: "Base de données non configurée." };
  const { db, close } = createDb(url);
  try {
    const me = await sessionAccount(new DbAccountStore(db));
    if (!me) return { ok: false, message: "Session expirée : reconnectez-vous." };
    if (!roles.includes(me.role)) {
      return { ok: false, message: "Votre compte ne permet pas cette action." };
    }
    if (staff && (!me.staffRole || !staff.includes(me.staffRole))) {
      return { ok: false, message: "Votre rôle ne permet pas cette action." };
    }
    return await fn(db, me);
  } catch (err) {
    if (err instanceof MarketError) return { ok: false, message: err.message };
    console.error("[marché]", err);
    return {
      ok: false,
      message: explainDbError(err) ?? "Action impossible pour le moment. Réessayez.",
    };
  } finally {
    await close().catch(() => undefined);
  }
}

const id = z.string().uuid("Identifiant invalide");

function parse<S extends z.ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  const res = schema.safeParse(data);
  if (!res.success) throw new Error(res.error.issues[0].message);
  return res.data;
}

// --- Commandes non payées ----------------------------------------------------------

// Au plus une fois par minute et par instance : rappel puis annulation des
// paniers Wave / Orange Money non payés dans le délai. (Une tâche planifiée
// Cloudflare pourra l'appeler aussi à la mise en ligne.)
let lastSweep = 0;
async function sweepUnpaid(db: Db) {
  if (Date.now() - lastSweep < 60_000) return;
  lastSweep = Date.now();
  try {
    await sweepUnpaidCheckouts(db);
  } catch (err) {
    console.error("[paiements] annulation des commandes non payées", err);
  }
  try {
    // Factures des paniers terminés (livrés, contrôle de réception fait ou expiré).
    await issueDueInvoices(db);
  } catch (err) {
    console.error("[factures] émission", err);
  }
  try {
    // Commandes récurrentes dont le moment est venu (la veille de la livraison).
    await runDueRecurringOrders(db);
  } catch (err) {
    console.error("[récurrentes] passage", err);
  }
}

// --- Lecture --------------------------------------------------------------------

/** Données du compte connecté ; null sans base (mode démo dans le navigateur). */
export const getMarketSnapshotFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<MarketSnapshot | null> => {
    if (!process.env.DATABASE_URL?.trim()) return null;
    const res = await withMarket(["farmer", "restaurant", "driver", "admin"], async (db, me) => {
      await sweepUnpaid(db);
      return readSnapshot(db, { id: me.id, role: me.role });
    });
    if ("ok" in res && res.ok === false) throw new Error(res.message);
    return res as MarketSnapshot;
  },
);

// --- Produits ---------------------------------------------------------------------

const qty = z.number().finite().min(0).max(1_000_000);

const productSchema = z.object({
  id: id.optional(),
  name: z.string().trim().min(2, "Nom du produit trop court").max(80),
  category: z.string().trim().min(1, "Choisissez une catégorie").max(40),
  price: z.number().int("Prix en francs entiers").positive("Prix requis").max(10_000_000),
  unit: z.string().trim().min(1, "Indiquez l'unité de vente").max(20, "Unité trop longue"),
  stock: qty,
  minStock: qty,
  description: z.string().trim().max(1000).optional(),
  minOrder: qty.optional(),
  availableFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide")
    .optional()
    .or(z.literal("")),
  organic: z.boolean(),
  paused: z.boolean(),
  draft: z.boolean(),
});

export const saveProductFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof productSchema>) => parse(productSchema, input))
  .handler(async ({ data }): Promise<{ ok: true; id: string } | { ok: false; message: string }> =>
    withMarket(["farmer"], async (db, me) => ({
      ok: true as const,
      id: await saveProduct(db, me.id, { ...data, availableFrom: data.availableFrom || undefined }),
    })),
  );

export const removeProductFn = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => parse(z.object({ id }), input))
  .handler(
    async ({ data }): Promise<{ ok: true; removed: boolean } | { ok: false; message: string }> =>
      withMarket(["farmer"], async (db, me) => {
        const res = await removeProduct(db, me.id, data.id);
        if (res.photoKeys.length) await removeObjects(res.photoKeys);
        return { ok: true as const, removed: res.removed };
      }),
  );

const stockSchema = z.object({
  productId: id,
  type: z.enum(["in", "out", "adjust"]),
  qty: qty,
});

export const moveStockFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof stockSchema>) => parse(stockSchema, input))
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(["farmer"], async (db, me) => {
      await moveStock(db, me.id, data);
      return { ok: true as const };
    }),
  );

// --- Fichiers -------------------------------------------------------------------------

/** Enregistre une image (stockage configuré) ou, en démonstration sans
 * stockage, la note comme « non conservée ». */
async function storeImage(
  bucket: Bucket,
  folder: string,
  dataUrl: string,
): Promise<{ storageKey: string; mime: string; size: number }> {
  const img = decodeImage(dataUrl);
  if (!img.ok) throw new MarketError(img.message);
  const name = `${crypto.randomUUID()}.${img.ext}`;
  if (!storageConfigured()) {
    if (!isDemoMode()) {
      throw new MarketError(
        "Le stockage des photos n'est pas configuré sur le serveur (SUPABASE_URL et SUPABASE_SECRET_KEY).",
      );
    }
    return { storageKey: `${NOT_STORED_PREFIX}${name}`, mime: img.mime, size: img.bytes.length };
  }
  const path = `${folder}/${name}`;
  const up = await uploadObject(bucket, path, img.bytes, img.mime);
  if (!up.ok) throw new MarketError("La photo n'a pas pu être enregistrée. Réessayez.");
  return { storageKey: storageKey(bucket, path), mime: img.mime, size: img.bytes.length };
}

const photoSchema = z.object({
  productId: id,
  dataUrl: z.string().max(3_000_000, "Photo trop lourde (2 Mo maximum)"),
});

export const uploadProductPhotoFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof photoSchema>) => parse(photoSchema, input))
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(["farmer"], async (db, me) => {
      const file = await storeImage(BUCKETS.public, `${me.id}/${data.productId}`, data.dataUrl);
      try {
        await addProductPhoto(db, me.id, { productId: data.productId, ...file });
      } catch (err) {
        await removeObjects([file.storageKey]);
        throw err;
      }
      return { ok: true as const };
    }),
  );

const proofSchema = z.object({
  missionId: id,
  stage: z.enum(["pickup", "dropoff"]),
  dataUrl: z.string().max(3_000_000, "Photo trop lourde (2 Mo maximum)"),
});

export const uploadProofFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof proofSchema>) => parse(proofSchema, input))
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(["driver"], async (db, me) => {
      const file = await storeImage(BUCKETS.private, data.missionId, data.dataUrl);
      try {
        await addDeliveryProof(db, me.id, {
          missionId: data.missionId,
          stage: data.stage,
          ...file,
        });
      } catch (err) {
        await removeObjects([file.storageKey]);
        throw err;
      }
      return { ok: true as const };
    }),
  );

// --- Commande ---------------------------------------------------------------------------

const orderSchema = z.object({
  lines: z
    .array(z.object({ productId: id, qty: z.number().finite().positive().max(100_000) }))
    .min(1, "Votre panier est vide.")
    .max(60),
  deliveryAddress: z.string().trim().min(10, "Adresse trop courte (min 10 caractères)").max(300),
  slotStart: z.string().min(10),
  slotLabel: z.string().trim().min(3).max(120),
  paymentMethod: z.enum(["Wave", "Orange Money", "Free Money", "Espèces"]),
  shortagePreference: z.enum(["partial", "cancel"]),
  instructions: z.string().trim().max(500).optional(),
  creditNoteId: id.optional(),
});

export type PlaceOrderResult =
  | {
      ok: true;
      checkoutId: string;
      checkoutReference: string;
      total: number;
      creditApplied: number;
      orders: { id: string; reference: string }[];
    }
  | { ok: false; message: string };

export const placeOrderFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof orderSchema>) => parse(orderSchema, input))
  .handler(async ({ data }): Promise<PlaceOrderResult> =>
    withMarket(["restaurant"], async (db, me) => {
      // Le stock des paniers non payés à temps est d'abord remis en vente.
      await sweepUnpaid(db);
      const placed = await placeOrder(db, me.id, data);
      // Chaque producteur est prévenu par email (en plus de l'application).
      const farmerRows = await db
        .select({ id: users.id, email: users.email, firstName: users.firstName })
        .from(users)
        .where(
          inArray(
            users.id,
            placed.orders.map((o) => o.farmerId),
          ),
        );
      await Promise.all(
        placed.orders.map((o) => {
          const f = farmerRows.find((x) => x.id === o.farmerId);
          if (!f) return null;
          return notify(
            f.email,
            newOrderFarmerEmail({
              firstName: f.firstName,
              reference: o.reference,
              amount: formatFCFA(o.subtotal),
              slot: data.slotLabel,
              url: appUrl(`/farmer/orders/${o.id}`),
            }),
          );
        }),
      );
      return {
        ok: true as const,
        checkoutId: placed.checkoutId,
        checkoutReference: placed.checkoutReference,
        total: placed.total,
        creditApplied: placed.creditApplied,
        orders: placed.orders.map(({ id: orderId, reference }) => ({ id: orderId, reference })),
      };
    }),
  );

const statusSchema = z.object({
  orderId: id,
  status: z.enum(["pending", "confirmed", "preparing", "delivering", "delivered", "cancelled"]),
  note: z.string().trim().max(500).optional(),
});

export const setOrderStatusFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof statusSchema>) => parse(statusSchema, input))
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(["farmer", "restaurant", "admin"], async (db, me) => {
      if (me.role === "admin" && !["super_admin", "operations"].includes(me.staffRole ?? "")) {
        return { ok: false as const, message: "Votre rôle ne permet pas cette action." };
      }
      await setOrderStatus(
        db,
        { id: me.id, actor: me.role as "farmer" | "restaurant" | "admin" },
        data.orderId,
        data.status,
        data.note,
      );
      return { ok: true as const };
    }),
  );

const confirmSchema = z.object({
  orderId: id,
  available: z.record(z.string(), z.number().finite().min(0)).default({}),
});

export const confirmOrderFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof confirmSchema>) => parse(confirmSchema, input))
  .handler(
    async ({
      data,
    }): Promise<
      { ok: true; outcome: "confirmed" | "adjusted" | "cancelled" } | { ok: false; message: string }
    > =>
      withMarket(["farmer"], async (db, me) => ({
        ok: true as const,
        ...(await confirmOrder(db, me.id, data.orderId, data.available)),
      })),
  );

const receptionSchema = z.object({
  orderId: id,
  lines: z
    .array(
      z.object({
        productId: id,
        refusedQty: z.number().finite().min(0),
        reason: z.string().trim().max(300),
      }),
    )
    .max(60),
  note: z.string().trim().max(1000).optional(),
});

export const reportReceptionFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof receptionSchema>) => parse(receptionSchema, input))
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(["restaurant"], async (db, me) => {
      await reportReception(db, me.id, data.orderId, { lines: data.lines, note: data.note });
      return { ok: true as const };
    }),
  );

// --- Missions -------------------------------------------------------------------------

// Codes d'enlèvement et de remise (4 chiffres) : 5 essais par quart d'heure
// et par mission, pour qu'on ne puisse pas les deviner en essayant tout.
const codeLimiter = new AttemptLimiter(5, 15 * 60_000);

export const acceptMissionFn = createServerFn({ method: "POST" })
  .validator((input: { missionId: string }) => parse(z.object({ missionId: id }), input))
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(["driver"], async (db, me) => {
      await acceptMission(db, me.id, data.missionId);
      return { ok: true as const };
    }),
  );

const stepSchema = z.object({
  missionId: id,
  status: z.enum(["pickup", "loaded", "delivered"]),
  code: z.string().trim().max(10).optional(),
  /** Espèces : le livreur confirme avoir encaissé le montant affiché. */
  cashCollected: z.boolean().optional(),
});

export const missionStepFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof stepSchema>) => parse(stepSchema, input))
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(["driver"], async (db, me) => {
      const key = `${data.missionId}:${data.status}`;
      const needsCode = data.status !== "pickup";
      if (needsCode && codeLimiter.lockedMinutes(key) > 0) {
        return {
          ok: false as const,
          message: `Trop d'essais de code. Réessayez dans ${codeLimiter.lockedMinutes(key)} min ou appelez le support.`,
        };
      }
      try {
        await missionStep(db, me.id, data.missionId, data.status, data.code, data.cashCollected);
      } catch (err) {
        if (err instanceof MarketError && needsCode && /^Code .*incorrect/.test(err.message)) {
          codeLimiter.fail(key);
        }
        throw err;
      }
      codeLimiter.reset(key);
      return { ok: true as const };
    }),
  );

export const withdrawMissionFn = createServerFn({ method: "POST" })
  .validator((input: { missionId: string; reason: string }) =>
    parse(z.object({ missionId: id, reason: z.string().trim().min(3).max(300) }), input),
  )
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(["driver"], async (db, me) => {
      await withdrawMission(db, me.id, data.missionId, data.reason);
      return { ok: true as const };
    }),
  );

export const markArrivedFn = createServerFn({ method: "POST" })
  .validator((input: { missionId: string; stage: "pickup" | "dropoff" }) =>
    parse(z.object({ missionId: id, stage: z.enum(["pickup", "dropoff"]) }), input),
  )
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(["driver"], async (db, me) => {
      await markArrived(db, me.id, data.missionId, data.stage);
      return { ok: true as const };
    }),
  );

export const reassignMissionFn = createServerFn({ method: "POST" })
  .validator((input: { missionId: string; driverId: string }) =>
    parse(z.object({ missionId: id, driverId: id }), input),
  )
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(
      ["admin"],
      async (db, me) => {
        await reassignMission(db, me.id, data.missionId, data.driverId);
        return { ok: true as const };
      },
      ["super_admin", "operations"],
    ),
  );

// --- Notifications ----------------------------------------------------------------------

export const markNotificationsReadFn = createServerFn({ method: "POST" })
  .validator((input: { ids: string[] | "all" }) =>
    parse(z.object({ ids: z.union([z.literal("all"), z.array(id).max(200)]) }), input),
  )
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(["farmer", "restaurant", "driver", "admin"], async (db, me) => {
      await markNotificationsRead(db, me.id, data.ids);
      return { ok: true as const };
    }),
  );

// --- Paiements du pilote ----------------------------------------------------------

/** Rôles admin qui ont la main sur l'argent. */
const MONEY_STAFF: StaffRole[] = ["super_admin", "finance"];

const declareSchema = z.object({
  checkoutId: id,
  method: z.enum(["wave", "orange_money"]),
  providerRef: z.string().trim().min(4, "Référence de la transaction trop courte").max(64),
});

/** Restaurant : « j'ai payé », avec la référence de la transaction. */
export const declarePaymentFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof declareSchema>) => parse(declareSchema, input))
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(["restaurant"], async (db, me) => {
      await declarePayment(db, me.id, data);
      return { ok: true as const };
    }),
  );

const confirmPaymentSchema = z.object({
  paymentId: id,
  providerRef: z.string().trim().max(64).optional(),
  /** Montant vu sur le compte marchand (ou remis par le livreur). */
  amountReceived: z.number().int("Montant en francs entiers").positive("Montant reçu requis"),
});

/** Admin : l'argent est bien arrivé (compte marchand ou espèces remises). */
export const confirmPaymentFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof confirmPaymentSchema>) => parse(confirmPaymentSchema, input))
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(
      ["admin"],
      async (db, me) => {
        await confirmPayment(db, me.id, data.paymentId, data.providerRef, data.amountReceived);
        return { ok: true as const };
      },
      MONEY_STAFF,
    ),
  );

const rejectPaymentSchema = z.object({
  paymentId: id,
  reason: z.string().trim().min(5, "Indiquez le motif au restaurant").max(300),
});

/** Admin : transaction introuvable ou montant différent. */
export const rejectPaymentFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof rejectPaymentSchema>) => parse(rejectPaymentSchema, input))
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(
      ["admin"],
      async (db, me) => {
        await rejectPayment(db, me.id, data.paymentId, data.reason);
        return { ok: true as const };
      },
      MONEY_STAFF,
    ),
  );

// --- Versements et remboursements (argent qui sort) --------------------------------

const payoutRequestSchema = z.object({
  amount: z.number().int("Montant en francs entiers").positive().max(50_000_000),
  method: z.enum(["wave", "orange_money"]),
  accountNumber: z.string().trim().max(20).optional(),
});

/** Producteur ou livreur : retirer tout ou partie de son solde. */
export const requestPayoutFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof payoutRequestSchema>) => parse(payoutRequestSchema, input))
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(["farmer", "driver"], async (db, me) => {
      await requestPayout(db, me.id, data);
      return { ok: true as const };
    }),
  );

const payPayoutSchema = z.object({
  payoutId: id,
  providerRef: z.string().trim().min(4, "Référence de la transaction trop courte").max(64),
});

/** Admin : l'argent est parti depuis le compte marchand. */
export const payPayoutFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof payPayoutSchema>) => parse(payPayoutSchema, input))
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(
      ["admin"],
      async (db, me) => {
        await payPayout(db, me.id, data.payoutId, data.providerRef);
        return { ok: true as const };
      },
      MONEY_STAFF,
    ),
  );

const rejectPayoutSchema = z.object({
  payoutId: id,
  reason: z.string().trim().min(5, "Indiquez le motif").max(300),
});

export const rejectPayoutFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof rejectPayoutSchema>) => parse(rejectPayoutSchema, input))
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(
      ["admin"],
      async (db, me) => {
        await rejectPayout(db, me.id, data.payoutId, data.reason);
        return { ok: true as const };
      },
      MONEY_STAFF,
    ),
  );

const payRefundSchema = z.object({
  refundId: id,
  method: z.enum(["wave", "orange_money"]),
  paidTo: z.string().trim().min(9, "Numéro du restaurant requis").max(20),
  providerRef: z.string().trim().min(4, "Référence de la transaction trop courte").max(64),
});

/** Admin : l'argent est renvoyé au restaurant. */
export const payRefundFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof payRefundSchema>) => parse(payRefundSchema, input))
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(
      ["admin"],
      async (db, me) => {
        await payRefund(db, me.id, data.refundId, data);
        return { ok: true as const };
      },
      MONEY_STAFF,
    ),
  );

// --- Double validation ----------------------------------------------------------------

const approvePayoutSchema = z.object({ payoutId: id });

/** Admin : premier temps de la double validation d'un retrait important. */
export const approvePayoutFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof approvePayoutSchema>) => parse(approvePayoutSchema, input))
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(
      ["admin"],
      async (db, me) => {
        await approvePayout(db, me.id, data.payoutId);
        return { ok: true as const };
      },
      MONEY_STAFF,
    ),
  );

const approveRefundSchema = z.object({ refundId: id });

export const approveRefundFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof approveRefundSchema>) => parse(approveRefundSchema, input))
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(
      ["admin"],
      async (db, me) => {
        await approveRefund(db, me.id, data.refundId);
        return { ok: true as const };
      },
      MONEY_STAFF,
    ),
  );

// --- Relevé mensuel ---------------------------------------------------------------------

const statementSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mois invalide"),
});

/** Producteur ou livreur : relevé de son compte pour un mois. */
export const getStatementFn = createServerFn({ method: "GET" })
  .validator((input: z.input<typeof statementSchema>) => parse(statementSchema, input))
  .handler(
    async ({
      data,
    }): Promise<{ ok: true; statement: StatementView } | { ok: false; message: string }> =>
      withMarket(["farmer", "driver"], async (db, me) => ({
        ok: true as const,
        statement: await readStatement(db, me.id, data.month),
      })),
  );

// --- Devis de livraison ----------------------------------------------------------------

const quoteSchema = z.object({
  deliveryAddress: z.string().trim().min(3).max(300),
  lines: z
    .array(z.object({ productId: id, qty: z.number().positive().max(100_000) }))
    .min(1)
    .max(100),
});

export type DeliveryQuoteResult =
  | {
      ok: true;
      zone: string;
      deliveries: {
        farmerId: string;
        farmName: string;
        origin: string;
        distanceKm: number;
        fee: number;
        bracket: string;
      }[];
      total: number;
    }
  | { ok: false; message: string };

/** Restaurant : frais de livraison du panier, par producteur, avant de payer. */
export const quoteDeliveryFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof quoteSchema>) => parse(quoteSchema, input))
  .handler(async ({ data }): Promise<DeliveryQuoteResult> =>
    withMarket(["restaurant"], async (db, me) => ({
      ok: true as const,
      ...(await quoteCheckoutDelivery(db, me.id, data)),
    })),
  );

// --- Catégories de produits (admin) ---------------------------------------------------

/** Rôles qui tiennent la liste des catégories. */
const CATALOG_STAFF: StaffRole[] = ["super_admin", "operations"];

export const approveCategoryFn = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => parse(z.object({ id }), input))
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(
      ["admin"],
      async (db, me) => {
        await approveCategory(db, me.id, data.id);
        return { ok: true as const };
      },
      CATALOG_STAFF,
    ),
  );

export const renameCategoryFn = createServerFn({ method: "POST" })
  .validator((input: { id: string; name: string }) =>
    parse(z.object({ id, name: z.string().max(60) }), input),
  )
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(
      ["admin"],
      async (db, me) => {
        await renameCategory(db, me.id, data.id, data.name);
        return { ok: true as const };
      },
      CATALOG_STAFF,
    ),
  );

export const mergeCategoryFn = createServerFn({ method: "POST" })
  .validator((input: { fromId: string; intoId: string }) =>
    parse(z.object({ fromId: id, intoId: id }), input),
  )
  .handler(async ({ data }): Promise<ActionResult & { moved?: number }> =>
    withMarket(
      ["admin"],
      async (db, me) => ({
        ok: true as const,
        moved: await mergeCategory(db, me.id, data.fromId, data.intoId),
      }),
      CATALOG_STAFF,
    ),
  );

export const renameUnitFn = createServerFn({ method: "POST" })
  .validator((input: { from: string; to: string }) =>
    parse(z.object({ from: z.string().min(1).max(40), to: z.string().max(40) }), input),
  )
  .handler(async ({ data }): Promise<ActionResult & { moved?: number }> =>
    withMarket(
      ["admin"],
      async (db, me) => ({
        ok: true as const,
        moved: await renameUnit(db, me.id, data.from, data.to),
      }),
      CATALOG_STAFF,
    ),
  );

// --- Commandes récurrentes (restaurant) -------------------------------------------------

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure invalide");
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide");
const recurringItems = z
  .array(z.object({ productId: id, qty: z.number().finite().positive().max(100_000) }))
  .min(1, "Ajoutez au moins un produit.")
  .max(40);
const recurringRules = z.object({
  priceIncreaseThresholdPct: z.number().finite().min(0).max(500),
  onPriceIncrease: z.enum(["auto_continue", "ask_confirmation", "suspend"]),
  onOutOfStock: z.enum(["cancel_item", "replace_equivalent", "cancel_all", "ask_confirmation"]),
  maxBudget: z.number().finite().min(0).max(100_000_000),
  onBudgetExceeded: z.enum(["ask_confirmation", "cancel", "reduce_quantities"]),
  onNonBusinessDay: z.enum(["day_before", "day_after", "ask_confirmation"]),
});
const paymentChoice = z.enum(["Wave", "Orange Money", "Free Money", "Espèces"]);
const recurringSchema = z.object({
  name: z.string().trim().max(80),
  farmerId: id,
  items: recurringItems,
  frequency: z.enum(["weekly", "biweekly", "monthly", "every_n_days", "custom"]),
  intervalDays: z.number().int().min(1).max(60).optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7),
  deliveryTime: hhmm,
  orderTime: hhmm,
  firstDeliveryOn: isoDay,
  end: z.union([
    z.object({ type: z.literal("never") }),
    z.object({ type: z.literal("on_date"), date: z.string().min(10) }),
    z.object({ type: z.literal("after_count"), count: z.number().int().min(1).max(1000) }),
  ]),
  rules: recurringRules,
  deliveryAddress: z.string().trim().min(10, "Adresse trop courte (min 10 caractères)").max(300),
  paymentMethod: paymentChoice,
  shortagePreference: z.enum(["partial", "cancel"]),
  instructions: z.string().trim().max(500).optional(),
});

export const createRecurringFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof recurringSchema>) => parse(recurringSchema, input))
  .handler(async ({ data }): Promise<ActionResult & { id?: string }> =>
    withMarket(["restaurant"], async (db, me) => ({
      ok: true as const,
      id: await createRecurringOrder(db, me.id, data),
    })),
  );

const recurringPatchSchema = z.object({
  id,
  name: z.string().trim().max(80).optional(),
  items: recurringItems.optional(),
  rules: recurringRules.optional(),
  deliveryAddress: z.string().trim().min(10).max(300).optional(),
  paymentMethod: paymentChoice.optional(),
  instructions: z.string().trim().max(500).optional(),
});

export const updateRecurringFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof recurringPatchSchema>) => parse(recurringPatchSchema, input))
  .handler(async ({ data: { id: recurringId, ...patch } }): Promise<ActionResult> =>
    withMarket(["restaurant"], async (db, me) => {
      await updateRecurringOrder(db, me.id, recurringId, patch);
      return { ok: true as const };
    }),
  );

const recurringActionSchema = z.object({
  id,
  action: z.enum(["pause", "resume", "cancel", "skip_next", "confirm", "cancel_occurrence"]),
  reason: z.string().trim().max(200).optional(),
  pausedUntil: isoDay.optional(),
});

export const recurringActionFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof recurringActionSchema>) => parse(recurringActionSchema, input))
  .handler(async ({ data }): Promise<ActionResult & { outcome?: string }> =>
    withMarket(["restaurant"], async (db, me) => {
      switch (data.action) {
        case "pause":
          await pauseRecurringOrder(db, me.id, data.id, data.reason ?? "", data.pausedUntil);
          return { ok: true as const };
        case "resume":
          await resumeRecurringOrder(db, me.id, data.id);
          return { ok: true as const };
        case "cancel":
          await cancelRecurringOrder(db, me.id, data.id);
          return { ok: true as const };
        case "skip_next":
          await skipNextRecurringDelivery(db, me.id, data.id, data.reason ?? "");
          return { ok: true as const };
        default:
          return {
            ok: true as const,
            outcome: await resolveRecurringPending(db, me.id, data.id, data.action),
          };
      }
    }),
  );

const overrideSchema = z.object({ id, items: recurringItems });

export const overrideNextRecurringFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof overrideSchema>) => parse(overrideSchema, input))
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(["restaurant"], async (db, me) => {
      await overrideNextRecurringDelivery(db, me.id, data.id, data.items);
      return { ok: true as const };
    }),
  );

// --- Litiges ------------------------------------------------------------------------------

const disputeFiles = z
  .array(
    z.object({
      name: z.string().trim().max(120),
      dataUrl: z.string().max(3_000_000, "Photo trop lourde (2 Mo maximum)"),
    }),
  )
  .max(4, "Quatre photos au plus.")
  .default([]);

/** Photos de preuve (litige, retour, incident), dans le stockage privé. */
async function storeDisputeFiles(
  list: { name: string; dataUrl: string }[],
  folder = "litiges",
): Promise<StoredFile[]> {
  const out: StoredFile[] = [];
  try {
    for (const f of list) {
      const file = await storeImage(BUCKETS.private, folder, f.dataUrl);
      out.push({ ...file, name: f.name });
    }
  } catch (err) {
    await removeObjects(out.map((f) => f.storageKey));
    throw err;
  }
  return out;
}

const openDisputeSchema = z.object({
  orderId: id.optional(),
  missionId: id.optional(),
  category: z.string().trim().min(2).max(40),
  subcategory: z.string().trim().min(2).max(80),
  description: z.string().trim().min(20, "Décrivez le problème (20 caractères minimum).").max(4000),
  againstRole: z.enum(["restaurant", "farmer", "driver", "platform"]),
  claimedAmount: z.number().finite().min(0).max(100_000_000),
  priority: z.enum(["low", "medium", "high"]),
  files: disputeFiles,
});

export const openDisputeFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof openDisputeSchema>) => parse(openDisputeSchema, input))
  .handler(async ({ data: { files, ...input } }): Promise<ActionResult & { id?: string }> =>
    withMarket(["restaurant", "farmer", "driver"], async (db, me) => {
      const stored = await storeDisputeFiles(files);
      try {
        const d = await openDispute(db, { id: me.id, role: me.role }, input, stored);
        return { ok: true as const, id: d.id };
      } catch (err) {
        await removeObjects(stored.map((f) => f.storageKey));
        throw err;
      }
    }),
  );

const replyDisputeSchema = z.object({
  id,
  text: z.string().trim().min(1, "Message vide").max(4000),
  internal: z.boolean().optional(),
  files: disputeFiles,
});

export const replyDisputeFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof replyDisputeSchema>) => parse(replyDisputeSchema, input))
  .handler(async ({ data: { files, id: disputeId, ...input } }): Promise<ActionResult> =>
    withMarket(["restaurant", "farmer", "driver", "admin"], async (db, me) => {
      const stored = await storeDisputeFiles(files);
      try {
        await replyDispute(db, { id: me.id, role: me.role }, disputeId, input, stored);
      } catch (err) {
        await removeObjects(stored.map((f) => f.storageKey));
        throw err;
      }
      return { ok: true as const };
    }),
  );

const disputeStaffSchema = z.object({
  id,
  action: z.enum(["investigate", "await_response", "assign", "escalate"]),
  assigneeId: id.optional(),
  reason: z.string().trim().max(300).optional(),
});

export const disputeStaffActionFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof disputeStaffSchema>) => parse(disputeStaffSchema, input))
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(
      ["admin"],
      async (db, me) => {
        if (data.action === "investigate")
          await setDisputeStatus(db, me.id, data.id, "investigating");
        else if (data.action === "await_response")
          await setDisputeStatus(db, me.id, data.id, "awaiting_response");
        else if (data.action === "assign") {
          if (!data.assigneeId) throw new MarketError("Choisissez un membre de l'équipe.");
          await assignDispute(db, me.id, data.id, data.assigneeId);
        } else await escalateDispute(db, me.id, data.id, data.reason ?? "");
        return { ok: true as const };
      },
      [...DISPUTE_STAFF],
    ),
  );

export const requestDisputeEscalationFn = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => parse(z.object({ id }), input))
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(["restaurant", "farmer", "driver"], async (db, me) => {
      await requestEscalation(db, { id: me.id, role: me.role }, data.id);
      return { ok: true as const };
    }),
  );

const resolveDisputeSchema = z.object({
  id,
  outcome: z.enum(["refund", "partial", "credit", "goodwill", "rejected"]),
  grantedAmount: z.number().finite().min(0).max(100_000_000),
  liableParty: z.enum(["restaurant", "farmer", "driver", "platform"]),
  reason: z.string().trim().min(10, "Motivez la décision (10 caractères minimum).").max(2000),
});

export const resolveDisputeFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof resolveDisputeSchema>) => parse(resolveDisputeSchema, input))
  .handler(async ({ data: { id: disputeId, ...input } }): Promise<ActionResult> =>
    withMarket(
      ["admin"],
      async (db, me) => {
        await resolveDispute(db, me.id, disputeId, input);
        return { ok: true as const };
      },
      [...DISPUTE_STAFF],
    ),
  );

// --- Annuaire de l'administration ----------------------------------------------------

export type AdminDirectoryResult = ({ ok: true } & AdminDirectory) | { ok: false; message: string };

/** Admin : vrais comptes, rôles de l'équipe et journal d'audit. */
export const getAdminDirectoryFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminDirectoryResult> =>
    withMarket(["admin"], async (db) => ({ ok: true as const, ...(await readAdminDirectory(db)) })),
);

// --- Tarifs de livraison (admin) -----------------------------------------------------

/** Rôles qui règlent les tarifs et les positions. */
const PRICING_STAFF: StaffRole[] = ["super_admin", "operations"];

export const getDeliverySettingsFn = createServerFn({ method: "GET" }).handler(async () =>
  withMarket(["admin"], async (db) => ({
    ok: true as const,
    ...(await readDeliverySettings(db)),
  })),
);

const pricingSchema = z.object({
  brackets: z
    .array(
      z.object({
        upToKm: z.number().positive("Distance de tranche invalide").max(1000),
        fee: z.number().int().min(0).max(1_000_000),
      }),
    )
    .min(1, "Au moins une tranche")
    .max(12),
  beyondPerKm: z.number().int().min(0).max(10_000),
  perKgOver: z.number().int().min(0).max(10_000),
  freeKg: z.number().min(0).max(10_000),
  roadFactor: z.number().min(1, "Coefficient d'au moins 1").max(2.5),
  floorToCost: z.boolean(),
});

export const saveDeliveryPricingFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof pricingSchema>) => parse(pricingSchema, input))
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(
      ["admin"],
      async (db, me) => {
        const ups = data.brackets.map((b) => b.upToKm);
        if (ups.some((u, i) => i > 0 && u <= ups[i - 1])) {
          return { ok: false as const, message: "Les tranches doivent aller en croissant." };
        }
        const value = normalizePricing(data);
        await db
          .insert(settings)
          .values({ key: "delivery_pricing", value, updatedBy: me.id })
          .onConflictDoUpdate({
            target: settings.key,
            set: { value, updatedBy: me.id, updatedAt: new Date() },
          });
        await db.insert(auditLogs).values({
          actorId: me.id,
          module: "settings",
          action: "Tarifs de livraison modifiés",
          targetType: "settings",
          targetId: "delivery_pricing",
          after: value,
        });
        return { ok: true as const };
      },
      PRICING_STAFF,
    ),
  );

const driverPaySchema = z.object({
  base: z.number().int().min(0).max(100_000),
  perKm: z.number().int().min(0).max(10_000),
  perKgOver: z.number().int().min(0).max(10_000),
  freeKg: z.number().min(0).max(10_000),
  minimum: z.number().int().min(0).max(100_000),
  commissionRate: z.number().min(0).max(90),
  motoMaxKg: z.number().min(1).max(5_000),
  vanMaxKg: z.number().min(1).max(50_000),
});

/** Paie des livreurs, commission de Diambar et choix du véhicule : pour les
 * prochaines courses (les courses déjà ouvertes gardent leur prix). */
export const saveDriverPayFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof driverPaySchema>) => parse(driverPaySchema, input))
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(
      ["admin"],
      async (db, me) => {
        if (data.vanMaxKg <= data.motoMaxKg) {
          return {
            ok: false as const,
            message: "Le poids maximum d'une camionnette doit dépasser celui d'une moto.",
          };
        }
        const value = normalizeDriverPay(data);
        await db
          .insert(settings)
          .values({ key: "driver_pay", value, updatedBy: me.id })
          .onConflictDoUpdate({
            target: settings.key,
            set: { value, updatedBy: me.id, updatedAt: new Date() },
          });
        await db.insert(auditLogs).values({
          actorId: me.id,
          module: "finance",
          action: "Paie des livreurs modifiée",
          targetType: "settings",
          targetId: "driver_pay",
          after: value,
        });
        return { ok: true as const };
      },
      PRICING_STAFF,
    ),
  );

const placeSchema = z.object({
  kind: z.enum(["city", "zone"]),
  id,
  /** Vide : revenir à la position de référence. */
  lat: z.number().nullable(),
  lng: z.number().nullable(),
});

export const savePlaceCoordsFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof placeSchema>) => parse(placeSchema, input))
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(
      ["admin"],
      async (db, me) => {
        if ((data.lat == null) !== (data.lng == null)) {
          return { ok: false as const, message: "Indiquez la latitude et la longitude." };
        }
        if (data.lat != null && data.lng != null && !checkSenegal(data.lat, data.lng)) {
          return {
            ok: false as const,
            message:
              "Position hors du Sénégal : vérifiez la latitude (≈ 14,7) et la longitude (≈ −17,4).",
          };
        }
        const table = data.kind === "city" ? cities : zones;
        await db.update(table).set({ lat: data.lat, lng: data.lng }).where(eq(table.id, data.id));
        await db.insert(auditLogs).values({
          actorId: me.id,
          module: "settings",
          action: "Position d'un lieu modifiée",
          targetType: data.kind,
          targetId: data.id,
          after: { lat: data.lat, lng: data.lng },
        });
        return { ok: true as const };
      },
      PRICING_STAFF,
    ),
  );

const farmerPlaceSchema = z.object({
  farmerId: id,
  adjustKm: z.number().int().min(-30).max(100),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
});

export const saveFarmerDeliveryFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof farmerPlaceSchema>) => parse(farmerPlaceSchema, input))
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(
      ["admin"],
      async (db, me) => {
        if ((data.lat == null) !== (data.lng == null)) {
          return { ok: false as const, message: "Indiquez la latitude et la longitude." };
        }
        if (data.lat != null && data.lng != null && !checkSenegal(data.lat, data.lng)) {
          return { ok: false as const, message: "Position hors du Sénégal." };
        }
        await db
          .update(farmerTable)
          .set({ distanceAdjustKm: data.adjustKm, lat: data.lat, lng: data.lng })
          .where(eq(farmerTable.userId, data.farmerId));
        await db.insert(auditLogs).values({
          actorId: me.id,
          module: "settings",
          action: "Lieu de collecte d'un producteur modifié",
          targetType: "farmer",
          targetId: data.farmerId,
          after: data,
        });
        return { ok: true as const };
      },
      PRICING_STAFF,
    ),
  );

// --- Profils et réglages personnels ------------------------------------------------------

const PROFILE_ROLES: Role[] = ["restaurant", "farmer", "driver", "admin"];
const shortText = (max: number) => z.string().max(max);

export const updateAccountFn = createServerFn({ method: "POST" })
  .validator((input: AccountPatch) =>
    parse(
      z.object({
        firstName: shortText(80).optional(),
        lastName: shortText(80).optional(),
        phone: shortText(30).optional(),
        city: shortText(80).optional(),
      }),
      input,
    ),
  )
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(PROFILE_ROLES, async (db, me) => {
      await updateAccount(db, { id: me.id, role: me.role }, data);
      return { ok: true as const };
    }),
  );

/** Photo de profil : image envoyée (réduite par le navigateur), ou null pour
 * la retirer. L'ancienne photo est supprimée du stockage. */
export const updateAvatarFn = createServerFn({ method: "POST" })
  .validator((input: { dataUrl: string | null }) =>
    parse(z.object({ dataUrl: z.string().max(3_000_000).nullable() }), input),
  )
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(PROFILE_ROLES, async (db, me) => {
      const stored = data.dataUrl
        ? await storeImage(BUCKETS.public, "profils", data.dataUrl)
        : null;
      try {
        const previous = await setAvatar(
          db,
          { id: me.id, role: me.role },
          stored?.storageKey ?? null,
        );
        if (previous) await removeObjects([previous]).catch(() => undefined);
      } catch (err) {
        if (stored) await removeObjects([stored.storageKey]).catch(() => undefined);
        throw err;
      }
      return { ok: true as const };
    }),
  );

export const updatePreferencesFn = createServerFn({ method: "POST" })
  .validator((input: PreferencesPatch) =>
    parse(
      z.object({
        mutedNotifications: z.array(shortText(20)).max(10).optional(),
        newsletter: z.boolean().optional(),
        payout: z
          .object({
            wave: shortText(20).optional(),
            orangeMoney: shortText(20).optional(),
            primary: z.enum(["wave", "orange_money"]).optional(),
          })
          .optional(),
      }),
      input,
    ),
  )
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(PROFILE_ROLES, async (db, me) => {
      await updatePreferences(db, { id: me.id, role: me.role }, data);
      return { ok: true as const };
    }),
  );

const slotSchema = z.object({ open: z.boolean(), from: shortText(5), to: shortText(5) });

export const updateRestaurantFn = createServerFn({ method: "POST" })
  .validator((input: RestaurantPatch) =>
    parse(
      z.object({
        name: shortText(200).optional(),
        cuisine: shortText(100).optional(),
        description: shortText(1000).optional(),
        contactName: shortText(200).optional(),
        capacity: z.number().int().nullable().optional(),
        address: shortText(300).optional(),
        ninea: shortText(60).optional(),
        billingEmail: shortText(250).optional(),
        receptionHours: z.record(slotSchema).optional(),
      }),
      input,
    ),
  )
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(["restaurant"], async (db, me) => {
      await updateRestaurant(db, { id: me.id, role: "restaurant" }, data);
      return { ok: true as const };
    }),
  );

export const updateFarmFn = createServerFn({ method: "POST" })
  .validator((input: FarmPatch) =>
    parse(
      z.object({
        name: shortText(200).optional(),
        address: shortText(300).optional(),
        areaHa: z.number().nullable().optional(),
        certification: z.enum(["none", "bio", "raisonnee", "globalgap"]).optional(),
        productionTypes: z.array(shortText(80)).max(30).optional(),
        description: shortText(1000).optional(),
        lang: z.enum(["fr", "wo"]).optional(),
      }),
      input,
    ),
  )
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(["farmer"], async (db, me) => {
      await updateFarm(db, { id: me.id, role: "farmer" }, data);
      return { ok: true as const };
    }),
  );

export const updateDriverFn = createServerFn({ method: "POST" })
  .validator((input: { address?: string }) =>
    parse(z.object({ address: shortText(300).optional() }), input),
  )
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(["driver"], async (db, me) => {
      await updateDriver(db, { id: me.id, role: "driver" }, data);
      return { ok: true as const };
    }),
  );

export const requestAccountDeletionFn = createServerFn({ method: "POST" })
  .validator((input: { reason: string }) => parse(z.object({ reason: shortText(500) }), input))
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(["restaurant", "farmer", "driver"], async (db, me) => {
      await requestAccountDeletion(db, { id: me.id, role: me.role }, data.reason);
      return { ok: true as const };
    }),
  );

// --- Messagerie ------------------------------------------------------------------------

const ALL_ROLES: Role[] = ["restaurant", "farmer", "driver", "admin"];
const messageFile = z
  .object({ name: z.string().max(200), dataUrl: z.string().max(3_000_000) })
  .optional();

export const startConversationFn = createServerFn({ method: "POST" })
  .validator((input: { farmerId?: string; restaurantId?: string }) =>
    parse(z.object({ farmerId: id.optional(), restaurantId: id.optional() }), input),
  )
  .handler(async ({ data }): Promise<ActionResult & { id?: string }> =>
    withMarket(["restaurant", "farmer", "driver"], async (db, me) => ({
      ok: true as const,
      id: await startConversation(db, { id: me.id, role: me.role }, data),
    })),
  );

export const sendMessageFn = createServerFn({ method: "POST" })
  .validator((input: { id: string; text: string; file?: { name: string; dataUrl: string } }) =>
    parse(z.object({ id, text: z.string().max(4000), file: messageFile }), input),
  )
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(ALL_ROLES, async (db, me) => {
      const stored = data.file
        ? {
            ...(await storeImage(BUCKETS.private, "messages", data.file.dataUrl)),
            name: data.file.name,
          }
        : undefined;
      try {
        await sendMessage(db, { id: me.id, role: me.role }, data.id, {
          text: data.text,
          file: stored,
        });
      } catch (err) {
        if (stored) await removeObjects([stored.storageKey]).catch(() => undefined);
        throw err;
      }
      return { ok: true as const };
    }),
  );

export const markConversationReadFn = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => parse(z.object({ id }), input))
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(ALL_ROLES, async (db, me) => {
      await markConversationRead(db, { id: me.id, role: me.role }, data.id);
      return { ok: true as const };
    }),
  );

export const conversationStaffFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      id: string;
      priority?: "normal" | "important" | "urgent";
      tags?: string[];
      note?: string;
    }) =>
      parse(
        z.object({
          id,
          priority: z.enum(["normal", "important", "urgent"]).optional(),
          tags: z.array(z.string().max(40)).max(12).optional(),
          note: z.string().max(4000).optional(),
        }),
        input,
      ),
  )
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(
      ["admin"],
      async (db, me) => {
        const who = { id: me.id, role: "admin" as const };
        if (data.note !== undefined) await addConversationNote(db, who, data.id, data.note);
        if (data.priority || data.tags) {
          await updateConversationMeta(db, who, data.id, {
            priority: data.priority,
            tags: data.tags,
          });
        }
        return { ok: true as const };
      },
      [...MESSAGING_STAFF],
    ),
  );

// --- Support ----------------------------------------------------------------------------

const ticketCategory = z.enum([
  "delivery",
  "products",
  "payments",
  "account",
  "technical",
  "other",
]);

export const createTicketFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      subject: string;
      message: string;
      category: string;
      orderRef?: string;
      urgent?: boolean;
    }) =>
      parse(
        z.object({
          subject: z.string().max(300),
          message: z.string().max(5000),
          category: ticketCategory,
          orderRef: z.string().max(40).optional(),
          urgent: z.boolean().optional(),
        }),
        input,
      ),
  )
  .handler(async ({ data }): Promise<ActionResult & { id?: string; reference?: string }> =>
    withMarket(["restaurant", "farmer", "driver"], async (db, me) => ({
      ok: true as const,
      ...(await createTicket(db, { id: me.id, role: me.role }, data)),
    })),
  );

export const replyTicketFn = createServerFn({ method: "POST" })
  .validator((input: { id: string; text: string; internal?: boolean }) =>
    parse(z.object({ id, text: z.string().max(5000), internal: z.boolean().optional() }), input),
  )
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(ALL_ROLES, async (db, me) => {
      await replyTicket(db, { id: me.id, role: me.role }, data.id, data);
      return { ok: true as const };
    }),
  );

export const ticketStaffFn = createServerFn({ method: "POST" })
  .validator(
    (input: { id: string; status?: "open" | "answered" | "closed"; assigneeId?: string | null }) =>
      parse(
        z.object({
          id,
          status: z.enum(["open", "answered", "closed"]).optional(),
          assigneeId: id.nullable().optional(),
        }),
        input,
      ),
  )
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(
      ["admin"],
      async (db, me) => {
        const who = { id: me.id, role: "admin" as const };
        if (data.status) await setTicketStatus(db, who, data.id, data.status);
        if (data.assigneeId !== undefined) await assignTicket(db, who, data.id, data.assigneeId);
        return { ok: true as const };
      },
      [...MESSAGING_STAFF],
    ),
  );

export const ticketFromConversationFn = createServerFn({ method: "POST" })
  .validator((input: { conversationId: string; subject: string; category: string }) =>
    parse(
      z.object({ conversationId: id, subject: z.string().max(300), category: ticketCategory }),
      input,
    ),
  )
  .handler(async ({ data }): Promise<ActionResult & { id?: string; reference?: string }> =>
    withMarket(
      ["admin"],
      async (db, me) => ({
        ok: true as const,
        ...(await ticketFromConversation(
          db,
          { id: me.id, role: "admin" },
          data.conversationId,
          data,
        )),
      }),
      [...MESSAGING_STAFF],
    ),
  );

// --- Avis après livraison ----------------------------------------------------------

const score = z.number().int().min(1).max(5);

export const createReviewFn = createServerFn({ method: "POST" })
  .validator((input: ReviewInput) =>
    parse(
      z.object({
        orderId: id,
        quality: score,
        quantity: score,
        freshness: score,
        timeliness: score,
        packaging: score,
        communication: score,
        comment: z.string().max(1500),
        tags: z.array(z.string().max(40)).max(8),
      }),
      input,
    ),
  )
  .handler(async ({ data }): Promise<ActionResult & { id?: string }> =>
    withMarket(["restaurant"], async (db, me) => ({
      ok: true as const,
      id: await createReview(db, { id: me.id, role: me.role }, data),
    })),
  );

export const replyReviewFn = createServerFn({ method: "POST" })
  .validator((input: { id: string; text: string }) =>
    parse(z.object({ id, text: z.string().max(1000) }), input),
  )
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(["farmer"], async (db, me) => {
      await replyReview(db, { id: me.id, role: me.role }, data.id, data.text);
      return { ok: true as const };
    }),
  );

export const hideReviewFn = createServerFn({ method: "POST" })
  .validator((input: { id: string; hidden: boolean }) =>
    parse(z.object({ id, hidden: z.boolean() }), input),
  )
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(
      ["admin"],
      async (db, me) => {
        await setReviewHidden(db, me.id, data.id, data.hidden);
        return { ok: true as const };
      },
      [...MODERATION_STAFF],
    ),
  );

// --- Modération du catalogue ----------------------------------------------------

export const reportProductFn = createServerFn({ method: "POST" })
  .validator((input: { productId: string; reason: string }) =>
    parse(z.object({ productId: id, reason: z.string().max(300) }), input),
  )
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(["restaurant"], async (db, me) => {
      await reportProduct(db, me.id, data.productId, data.reason);
      return { ok: true as const };
    }),
  );

export const moderateProductFn = createServerFn({ method: "POST" })
  .validator((input: { productId: string; action: ModerationAction; note?: string }) =>
    parse(
      z.object({
        productId: id,
        action: z.enum(["keep", "unpublish", "request_change", "suspend_farmer"]),
        note: z.string().max(500).optional(),
      }),
      input,
    ),
  )
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(
      ["admin"],
      async (db, me) => {
        if (data.action === "suspend_farmer" && me.staffRole !== "super_admin") {
          return { ok: false as const, message: "Seul le super admin suspend un compte." };
        }
        await moderateProduct(db, me.id, data.productId, data.action, data.note ?? "");
        return { ok: true as const };
      },
      [...MODERATION_STAFF],
    ),
  );

// --- Statut des comptes (admin) -------------------------------------------------

export const setAccountStatusFn = createServerFn({ method: "POST" })
  .validator((input: { userId: string; status: AccountStatusChange; reason?: string }) =>
    parse(
      z.object({
        userId: id,
        status: z.enum(["active", "suspended", "rejected"]),
        reason: z.string().max(300).optional(),
      }),
      input,
    ),
  )
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(
      ["admin"],
      async (db, me) => {
        await setAccountStatus(db, me, data.userId, data.status, data.reason ?? "");
        return { ok: true as const };
      },
      ["super_admin"],
    ),
  );

// --- Retours produit --------------------------------------------------------------

const returnReasonEnum = z.enum(["quality", "quantity", "wrong_item", "damaged", "late", "other"]);

const createReturnSchema = z.object({
  orderId: id,
  productId: id,
  qty: z.number().finite().positive().max(1_000_000),
  reason: returnReasonEnum,
  description: z.string().trim().max(2000),
  requestedAmount: z.number().finite().positive().max(100_000_000),
  files: disputeFiles,
});

export const createReturnFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof createReturnSchema>) => parse(createReturnSchema, input))
  .handler(
    async ({
      data: { files, ...input },
    }): Promise<ActionResult & { id?: string; reference?: string }> =>
      withMarket(["restaurant"], async (db, me) => {
        const stored = await storeDisputeFiles(files, "retours");
        try {
          return {
            ok: true as const,
            ...(await createReturn(db, { id: me.id, role: me.role }, input, stored)),
          };
        } catch (err) {
          await removeObjects(stored.map((f) => f.storageKey));
          throw err;
        }
      }),
  );

const replyReturnSchema = z.object({
  id,
  text: z.string().max(2000),
  files: disputeFiles,
});

export const replyReturnFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof replyReturnSchema>) => parse(replyReturnSchema, input))
  .handler(async ({ data: { files, ...input } }): Promise<ActionResult> =>
    withMarket(["restaurant", "farmer", "admin"], async (db, me) => {
      const stored = await storeDisputeFiles(files, "retours");
      try {
        await replyReturn(db, { id: me.id, role: me.role }, input.id, input.text, stored);
      } catch (err) {
        await removeObjects(stored.map((f) => f.storageKey));
        throw err;
      }
      return { ok: true as const };
    }),
  );

export const decideReturnFn = createServerFn({ method: "POST" })
  .validator((input: { id: string; accept: boolean; amount?: number; note?: string }) =>
    parse(
      z.object({
        id,
        accept: z.boolean(),
        amount: z.number().finite().min(0).max(100_000_000).optional(),
        note: z.string().max(500).optional(),
      }),
      input,
    ),
  )
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(["farmer"], async (db, me) => {
      await farmerDecideReturn(db, { id: me.id, role: me.role }, data.id, data);
      return { ok: true as const };
    }),
  );

export const creditReturnFn = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => parse(z.object({ id }), input))
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(["farmer", "admin"], async (db, me) => {
      await creditReturn(db, { id: me.id, role: me.role }, data.id);
      return { ok: true as const };
    }),
  );

const returnStaffSchema = z.discriminatedUnion("action", [
  z.object({
    id,
    action: z.literal("pickup"),
    driverId: id,
    scheduledFor: z.string().max(40),
    address: z.string().max(300),
  }),
  z.object({ id, action: z.literal("picked_up") }),
  z.object({ id, action: z.literal("received"), condition: z.string().max(300) }),
  z.object({
    id,
    action: z.literal("inspect"),
    conform: z.boolean(),
    note: z.string().max(500),
  }),
  z.object({
    id,
    action: z.literal("resolve"),
    type: z.enum(["refund", "exchange", "goodwill", "reject"]),
    bornBy: z.enum(["farmer", "driver", "platform"]),
    amount: z.number().finite().min(0).max(100_000_000).optional(),
    note: z.string().max(500),
  }),
  z.object({ id, action: z.literal("escalate"), note: z.string().max(500) }),
  z.object({ id, action: z.literal("close") }),
]);

export const returnStaffFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof returnStaffSchema>) => parse(returnStaffSchema, input))
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(
      ["admin"],
      async (db, me) => {
        const who = { id: me.id, role: "admin" as const };
        switch (data.action) {
          case "pickup":
            await scheduleReturnPickup(db, who, data.id, data);
            break;
          case "picked_up":
            await advanceReturnPickup(db, who, data.id, "picked_up");
            break;
          case "received":
            await advanceReturnPickup(db, who, data.id, "received", data.condition);
            break;
          case "inspect":
            await inspectReturn(db, who, data.id, data);
            break;
          case "resolve":
            await resolveReturn(db, who, data.id, data);
            break;
          case "escalate":
            await escalateReturn(db, who, data.id, data.note);
            break;
          case "close":
            await closeReturn(db, who, data.id);
            break;
        }
        return { ok: true as const };
      },
      [...RETURN_STAFF],
    ),
  );

// --- Incidents de course ---------------------------------------------------------

const createIncidentSchema = z.object({
  missionId: id,
  type: z.enum([
    "client_absent",
    "refused",
    "breakdown",
    "accident",
    "traffic",
    "address",
    "other",
  ]),
  description: z.string().trim().max(2000),
  waitedMinutes: z
    .number()
    .finite()
    .min(0)
    .max(24 * 60),
  compensationRequested: z.number().finite().min(0).max(10_000_000),
  files: disputeFiles,
});

export const createIncidentFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof createIncidentSchema>) => parse(createIncidentSchema, input))
  .handler(
    async ({
      data: { files, ...input },
    }): Promise<ActionResult & { id?: string; reference?: string }> =>
      withMarket(["driver", "admin"], async (db, me) => {
        const stored = await storeDisputeFiles(files, "incidents");
        try {
          return {
            ok: true as const,
            ...(await createIncident(db, { id: me.id, role: me.role }, input, stored)),
          };
        } catch (err) {
          await removeObjects(stored.map((f) => f.storageKey));
          throw err;
        }
      }),
  );

export const incidentActionFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      id: string;
      action: "escalate" | "comment" | "resolve";
      text?: string;
      awarded?: number;
    }) =>
      parse(
        z.object({
          id,
          action: z.enum(["escalate", "comment", "resolve"]),
          text: z.string().max(1000).optional(),
          awarded: z.number().finite().min(0).max(10_000_000).optional(),
        }),
        input,
      ),
  )
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(["driver", "admin"], async (db, me) => {
      const who = { id: me.id, role: me.role };
      if (data.action === "escalate") await escalateIncident(db, who, data.id);
      else if (data.action === "comment") await commentIncident(db, who, data.id, data.text ?? "");
      else {
        await resolveIncident(db, who, data.id, {
          awarded: data.awarded ?? 0,
          note: data.text,
        });
      }
      return { ok: true as const };
    }),
  );

// --- Flotte des livreurs ---------------------------------------------------------

const vehicleActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update"),
    brand: z.string().max(60).optional(),
    model: z.string().max(60).optional(),
    year: z.number().int().optional(),
    color: z.string().max(40).optional(),
    mileageKm: z.number().finite().min(0).max(10_000_000).optional(),
    nextMaintenanceAt: z.string().max(10).nullable().optional(),
  }),
  z.object({ action: z.literal("resolve_issue"), id }),
  z.object({ action: z.literal("maintenance"), label: z.string().max(200) }),
]);

export const vehicleActionFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof vehicleActionSchema>) => parse(vehicleActionSchema, input))
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(["driver"], async (db, me) => {
      const who = { id: me.id, role: me.role };
      if (data.action === "update") {
        const { action: _a, ...patch } = data;
        await updateVehicle(db, who, patch);
      } else if (data.action === "resolve_issue") {
        await resolveVehicleIssue(db, who, data.id);
      } else {
        await logMaintenance(db, who, data.label);
      }
      return { ok: true as const };
    }),
  );

export const vehiclePhotoFn = createServerFn({ method: "POST" })
  .validator((input: { dataUrl: string }) =>
    parse(
      z.object({ dataUrl: z.string().max(3_000_000, "Photo trop lourde (2 Mo maximum)") }),
      input,
    ),
  )
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(["driver"], async (db, me) => {
      const file = await storeImage(BUCKETS.private, `vehicules/${me.id}`, data.dataUrl);
      try {
        const old = await setVehiclePhoto(
          db,
          { id: me.id, role: me.role },
          { ...file, name: "vehicule" },
        );
        if (old) await removeObjects([old]);
      } catch (err) {
        await removeObjects([file.storageKey]);
        throw err;
      }
      return { ok: true as const };
    }),
  );

const vehicleIssueSchema = z.object({
  type: z.enum(["tires", "brakes", "battery", "engine", "lights", "other"]),
  severity: z.enum(["low", "medium", "high"]),
  description: z.string().max(2000),
  files: disputeFiles,
});

export const reportVehicleIssueFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof vehicleIssueSchema>) => parse(vehicleIssueSchema, input))
  .handler(async ({ data: { files, ...input } }): Promise<ActionResult & { reference?: string }> =>
    withMarket(["driver"], async (db, me) => {
      const stored = await storeDisputeFiles(files, "vehicules");
      try {
        const r = await reportVehicleIssue(db, { id: me.id, role: me.role }, input, stored);
        return { ok: true as const, reference: r.reference };
      } catch (err) {
        await removeObjects(stored.map((f) => f.storageKey));
        throw err;
      }
    }),
  );

const vehicleChangeSchema = z.object({
  reason: z.enum(["sold", "breakdown", "new_vehicle", "rental", "other"]),
  newVehicle: z.object({
    type: z.enum(["Moto", "Camionnette", "Camion", "Tricycle"]),
    brand: z.string().max(60),
    model: z.string().max(60),
    year: z.number().int().min(0).max(3000),
    plate: z.string().max(20),
    capacityKg: z.number().finite().min(0).max(100_000),
    mileageKm: z.number().finite().min(0).max(10_000_000),
  }),
  files: disputeFiles,
});

export const requestVehicleChangeFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof vehicleChangeSchema>) => parse(vehicleChangeSchema, input))
  .handler(async ({ data: { files, ...input } }): Promise<ActionResult & { reference?: string }> =>
    withMarket(["driver"], async (db, me) => {
      const stored = await storeDisputeFiles(files, "vehicules");
      try {
        const r = await requestVehicleChange(db, { id: me.id, role: me.role }, input, stored);
        return { ok: true as const, reference: r.reference };
      } catch (err) {
        await removeObjects(stored.map((f) => f.storageKey));
        throw err;
      }
    }),
  );

const docRenewalSchema = z.object({
  doc: z.enum(["insurance", "inspection"]),
  newExpiry: z.string().max(10),
  files: disputeFiles,
});

export const submitDocRenewalFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof docRenewalSchema>) => parse(docRenewalSchema, input))
  .handler(async ({ data: { files, ...input } }): Promise<ActionResult> =>
    withMarket(["driver"], async (db, me) => {
      const stored = await storeDisputeFiles(files, "documents");
      try {
        await submitDocRenewal(db, { id: me.id, role: me.role }, input, stored);
      } catch (err) {
        await removeObjects(stored.map((f) => f.storageKey));
        throw err;
      }
      return { ok: true as const };
    }),
  );

export const fleetDecisionFn = createServerFn({ method: "POST" })
  .validator(
    (input: { kind: "renewal" | "vehicle"; id: string; approve: boolean; note?: string }) =>
      parse(
        z.object({
          kind: z.enum(["renewal", "vehicle"]),
          id,
          approve: z.boolean(),
          note: z.string().max(300).optional(),
        }),
        input,
      ),
  )
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(
      ["admin"],
      async (db, me) => {
        const who = { id: me.id, role: "admin" as const };
        if (data.kind === "renewal") await decideDocRenewal(db, who, data.id, data);
        else await decideVehicleChange(db, who, data.id, data);
        return { ok: true as const };
      },
      [...FLEET_STAFF],
    ),
  );

export const setDriverOnlineFn = createServerFn({ method: "POST" })
  .validator((input: { online: boolean }) => parse(z.object({ online: z.boolean() }), input))
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(["driver"], async (db, me) => {
      await setDriverOnline(db, { id: me.id, role: me.role }, data.online);
      return { ok: true as const };
    }),
  );

const dayHours = z.object({
  enabled: z.boolean(),
  start: z.string().max(5),
  end: z.string().max(5),
});
const workSettingsSchema = z.object({
  workPrefs: z
    .object({
      radius: z.number().finite().optional(),
      autoAccept: z.boolean().optional(),
      criteria: z
        .object({
          minPayout: z.number().finite(),
          maxWeightKg: z.number().finite(),
          acceptedUrgencies: z.array(z.enum(["standard", "priority", "express"])).max(3),
          acceptedCities: z.array(z.string().max(60)).max(30),
        })
        .optional(),
    })
    .optional(),
  workingHours: z
    .object({
      mon: dayHours,
      tue: dayHours,
      wed: dayHours,
      thu: dayHours,
      fri: dayHours,
      sat: dayHours,
      sun: dayHours,
    })
    .optional(),
  locationSharing: z.boolean().optional(),
});

export const updateWorkSettingsFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof workSettingsSchema>) => parse(workSettingsSchema, input))
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(["driver"], async (db, me) => {
      await updateWorkSettings(db, { id: me.id, role: me.role }, data);
      return { ok: true as const };
    }),
  );

// --- Carnet du restaurant ---------------------------------------------------------

const supplierFields = {
  name: z.string().max(120).optional(),
  contact: z.string().max(120).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().max(160).optional(),
  city: z.string().max(80).optional(),
  notes: z.string().max(1000).optional(),
  favorite: z.boolean().optional(),
  suspended: z.boolean().optional(),
};

const supplierActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    ...supplierFields,
    name: z.string().max(120),
    farmerId: id.nullable().optional(),
  }),
  z.object({ action: z.literal("update"), id, ...supplierFields }),
  z.object({ action: z.literal("remove"), id }),
]);

export const supplierActionFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof supplierActionSchema>) => parse(supplierActionSchema, input))
  .handler(async ({ data }): Promise<ActionResult & { id?: string }> =>
    withMarket(["restaurant"], async (db, me) => {
      if (data.action === "create") {
        const { action: _a, ...input } = data;
        return { ok: true as const, id: await createSupplier(db, me.id, input) };
      }
      if (data.action === "update") {
        const { action: _a, id: supplierId, ...patch } = data;
        await updateSupplier(db, me.id, supplierId, patch);
      } else {
        await removeSupplier(db, me.id, data.id);
      }
      return { ok: true as const };
    }),
  );

export const favoriteProductFn = createServerFn({ method: "POST" })
  .validator((input: { productId?: string; clear?: boolean }) =>
    parse(z.object({ productId: id.optional(), clear: z.boolean().optional() }), input),
  )
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(["restaurant"], async (db, me) => {
      if (data.clear) await clearFavoriteProducts(db, me.id);
      else if (data.productId) await toggleFavoriteProduct(db, me.id, data.productId);
      return { ok: true as const };
    }),
  );

const budgetSchema = z.object({
  monthly: z.number().finite().min(0),
  alertThreshold: z.number().finite(),
  categories: z
    .array(
      z.object({
        key: z.string().max(40),
        label: z.string().max(60),
        allocated: z.number().finite().min(0),
      }),
    )
    .max(20),
});

export const saveBudgetFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof budgetSchema>) => parse(budgetSchema, input))
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(["restaurant"], async (db, me) => {
      await saveBudget(db, me.id, data);
      return { ok: true as const };
    }),
  );
