import { createServerFn } from "@tanstack/react-start";
import { inArray } from "drizzle-orm";
import { z } from "zod";
import { createDb, type Db } from "@/db/client.server";
import { users } from "@/db/schema";
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
  reassignMission,
  removeProduct,
  reportReception,
  saveProduct,
  setOrderStatus,
  withdrawMission,
} from "./market-db.server";
import { declarePayment, rejectPayment } from "./payments-db.server";
import { payPayout, payRefund, rejectPayout, requestPayout } from "./payouts-db.server";
import { readSnapshot } from "./snapshot.server";
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
    return { ok: false, message: "Action impossible pour le moment. Réessayez." };
  } finally {
    await close();
  }
}

const id = z.string().uuid("Identifiant invalide");

function parse<S extends z.ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  const res = schema.safeParse(data);
  if (!res.success) throw new Error(res.error.issues[0].message);
  return res.data;
}

// --- Lecture --------------------------------------------------------------------

/** Données du compte connecté ; null sans base (mode démo dans le navigateur). */
export const getMarketSnapshotFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<MarketSnapshot | null> => {
    if (!process.env.DATABASE_URL?.trim()) return null;
    const res = await withMarket(["farmer", "restaurant", "driver", "admin"], (db, me) =>
      readSnapshot(db, { id: me.id, role: me.role }),
    );
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
  unit: z.string().trim().min(1).max(20),
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
});

export type PlaceOrderResult =
  | {
      ok: true;
      checkoutId: string;
      checkoutReference: string;
      total: number;
      orders: { id: string; reference: string }[];
    }
  | { ok: false; message: string };

export const placeOrderFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof orderSchema>) => parse(orderSchema, input))
  .handler(async ({ data }): Promise<PlaceOrderResult> =>
    withMarket(["restaurant"], async (db, me) => {
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
});

/** Admin : l'argent est bien arrivé (compte marchand ou espèces remises). */
export const confirmPaymentFn = createServerFn({ method: "POST" })
  .validator((input: z.input<typeof confirmPaymentSchema>) => parse(confirmPaymentSchema, input))
  .handler(async ({ data }): Promise<ActionResult> =>
    withMarket(
      ["admin"],
      async (db, me) => {
        await confirmPayment(db, me.id, data.paymentId, data.providerRef);
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
