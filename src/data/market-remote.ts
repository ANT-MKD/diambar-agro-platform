import { useEffect } from "react";
import { downscaleDataUrl } from "@/lib/image-resize";
import { getRules } from "./rules";
import { firstDeliveryDay } from "@/lib/delivery-time";
import type { MissionProofPhoto, MissionStatus, OrderStatus, PaymentMethod } from "./mocks";
import { getMarketMode, isMarketRemote, setMarketMode, useMarketMode } from "./market-mode";
import {
  clearDemoCollections,
  missionActions,
  movementActions,
  orderActions,
  getProducts,
  productActions,
  recurringOrderActions,
  replaceMarketData,
  restaurantOrderActions,
  type AcceptResult,
} from "./store";
import {
  acceptMissionFn,
  confirmOrderFn,
  confirmPaymentFn,
  declarePaymentFn,
  getMarketSnapshotFn,
  markArrivedFn,
  markNotificationsReadFn,
  approvePayoutFn,
  approveRefundFn,
  getStatementFn,
  saveDriverPayFn,
  approveCategoryFn,
  mergeCategoryFn,
  renameCategoryFn,
  renameUnitFn,
  getAdminDirectoryFn,
  getDeliverySettingsFn,
  saveDeliveryPricingFn,
  saveFarmerDeliveryFn,
  savePlaceCoordsFn,
  payPayoutFn,
  payRefundFn,
  rejectPayoutFn,
  requestPayoutFn,
  missionStepFn,
  moveStockFn,
  placeOrderFn,
  reassignMissionFn,
  rejectPaymentFn,
  removeProductFn,
  reportReceptionFn,
  saveProductFn,
  setOrderStatusFn,
  uploadProductPhotoFn,
  uploadProofFn,
  withdrawMissionFn,
  createRecurringFn,
  openDisputeFn,
  replyDisputeFn,
  disputeStaffActionFn,
  requestDisputeEscalationFn,
  resolveDisputeFn,
  updateRecurringFn,
  recurringActionFn,
  overrideNextRecurringFn,
} from "@/lib/market/functions";
import type {
  PaymentMethod as Method,
  Product,
  RecurringOrder,
  RecurringOrderItem,
  StockMovement,
} from "./mocks";

/** Nouvelle commande récurrente (mêmes champs que côté serveur). */
export type RecurringCreate = {
  name: string;
  farmerId: string;
  items: { productId: string; qty: number }[];
  frequency: RecurringOrder["frequency"];
  intervalDays?: number;
  daysOfWeek: number[];
  deliveryTime: string;
  orderTime: string;
  firstDeliveryOn: string;
  end: RecurringOrder["end"];
  rules: RecurringOrder["rules"];
  deliveryAddress: string;
  paymentMethod: Method;
  shortagePreference: "partial" | "cancel";
  instructions?: string;
};
import type { OrderActor } from "@/lib/order-lifecycle";
import type { StatementView } from "@/lib/market/documents-view";
import type { DeliveryPricing, FarmerPlaceRow, PlaceRow } from "@/lib/delivery-pricing";
import type { DriverPay } from "@/lib/platform-rules";
import { requireRole } from "@/lib/auth/functions";
import { clearBusinessDemoData } from "./business";
import {
  clearDisputesDemoData,
  disputeActions,
  replaceDisputes,
  replaceDisputeStaff,
  type DisputeAttachment,
  type DisputeOutcome,
  type DisputeParty,
  type NewDisputeInput,
} from "./disputes";
import { clearFinanceDemoData } from "./finance";
import { clearSupportDemoData } from "./support";
import {
  applyAdminDirectory,
  clearAdminDemoData,
  replaceAdminServerNotifications,
} from "./admin-store";
import { ensureLocalCategory } from "./catalog";
import { canonicalUnit, unitChoices, unitProblem } from "@/lib/units";

// Place de marché côté navigateur. Avec une base de données, les données du
// compte viennent du serveur et chaque action passe par lui ; sans base
// (démonstration), les actions locales d'avant sont utilisées telles quelles.
// Les écrans appellent `market.*` sans se soucier du mode.

export type Result<T = object> = ({ ok: true } & T) | { ok: false; message: string };

let loadedFor: string | null = null;
let inflight: Promise<void> | null = null;

async function load(): Promise<void> {
  const snap = await getMarketSnapshotFn();
  if (!snap) {
    setMarketMode({ remote: false, me: null });
    return;
  }
  if (getMarketMode().me?.id !== snap.me.id) {
    clearDemoCollections();
    clearDisputesDemoData();
    clearBusinessDemoData();
    clearFinanceDemoData();
    clearSupportDemoData();
    clearAdminDemoData();
  }
  replaceMarketData(snap);
  replaceDisputes(snap.disputes ?? []);
  replaceDisputeStaff(snap.disputeStaff ?? []);
  if (snap.me.role === "admin") {
    replaceAdminServerNotifications(snap.notifications);
    // Vrais comptes, rôles et journal ; en cas d'échec, les listes restent vides.
    const dir = await getAdminDirectoryFn().catch(() => null);
    if (dir?.ok) applyAdminDirectory(dir);
  }
  setMarketMode({ remote: true, me: snap.me });
}

/** À l'entrée d'un portail : charge les données du compte (une fois par
 * compte, puis rafraîchit en arrière-plan). */
export async function ensureMarketLoaded(accountKey: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (loadedFor === accountKey) {
    void refreshMarket();
    return;
  }
  await load();
  loadedFor = accountKey;
}

/** Relit les données du serveur (après une action, ou régulièrement). */
export function refreshMarket(): Promise<void> {
  if (!isMarketRemote()) return Promise.resolve();
  if (!inflight) {
    inflight = load()
      .catch(() => undefined)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Rafraîchit régulièrement tant que la page est visible : une commande
 * passée par un restaurant apparaît chez le producteur sans recharger. */
export function useMarketPolling(intervalMs = 15_000) {
  const { remote } = useMarketMode();
  useEffect(() => {
    if (!remote) return;
    const tick = () => {
      if (document.visibilityState === "visible") void refreshMarket();
    };
    const timer = window.setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [remote, intervalMs]);
}

const UNREACHABLE = "Le serveur ne répond pas. Vérifiez votre connexion puis réessayez.";

/** Appelle une action serveur puis relit les données. */
async function remote<T extends { ok: boolean }>(
  call: () => Promise<T>,
): Promise<T | { ok: false; message: string }> {
  try {
    const res = await call();
    if (res.ok) await refreshMarket();
    return res;
  } catch (err) {
    const message = err instanceof Error && err.message ? err.message : UNREACHABLE;
    return { ok: false, message: /fetch|network|réseau/i.test(message) ? UNREACHABLE : message };
  }
}

export type ProductDraft = Omit<Product, "id" | "sku" | "ordersThisMonth" | "status"> & {
  status?: Product["status"];
};

export type PlaceOrderRequest = {
  lines: { productId: string; qty: number }[];
  deliveryAddress: string;
  slotStart: string;
  slotLabel: string;
  paymentMethod: PaymentMethod;
  shortagePreference: "partial" | "cancel";
  instructions?: string;
};

/** Photos de preuve pour le serveur : images seulement, réduites (2 Mo au plus). */
async function disputeFiles(
  list: DisputeAttachment[],
): Promise<
  { ok: true; list: { name: string; dataUrl: string }[] } | { ok: false; message: string }
> {
  const out: { name: string; dataUrl: string }[] = [];
  for (const f of list) {
    if (!f.dataUrl || !f.mime.startsWith("image/")) {
      return {
        ok: false,
        message: `${f.name} : seules les photos (JPEG, PNG, WebP) sont acceptées.`,
      };
    }
    out.push({ name: f.name, dataUrl: await downscaleDataUrl(f.dataUrl) });
  }
  return { ok: true, list: out };
}

export const market = {
  isRemote: isMarketRemote,

  // --- Produits (producteur) ---
  async saveProduct(
    id: string | null,
    p: ProductDraft & { sku?: string },
  ): Promise<Result<{ id: string }>> {
    if (isMarketRemote()) {
      return remote(() =>
        saveProductFn({
          data: {
            ...(id ? { id } : {}),
            name: p.name,
            category: p.category,
            price: p.pricePerKg,
            unit: p.unit,
            stock: p.stock,
            minStock: p.minStock,
            description: p.description || undefined,
            minOrder: p.minOrder || undefined,
            availableFrom: p.availableFrom || "",
            organic: !!p.organic,
            paused: !!p.paused,
            draft: p.status === "draft",
          },
        }),
      );
    }
    // Démonstration : une nouvelle catégorie rejoint la liste locale ; une
    // unité écrite autrement qu'une unité existante reprend celle-ci.
    const unitError = unitProblem(p.unit);
    if (unitError) return { ok: false, message: unitError };
    p = {
      ...p,
      category: ensureLocalCategory(p.category),
      unit: canonicalUnit(p.unit, unitChoices(getProducts().map((x) => x.unit))),
    };
    if (id) {
      productActions.update(id, p);
      return { ok: true, id };
    }
    const newId = productActions.create({
      ...p,
      sku: p.sku ?? `SKU-${Date.now().toString().slice(-6)}`,
      ordersThisMonth: 0,
      status: p.status ?? "active",
    } as Omit<Product, "id">);
    return { ok: true, id: newId };
  },

  /** Enregistre le produit puis envoie ses nouvelles photos (mode base). */
  async saveProductWithPhotos(
    id: string | null,
    p: ProductDraft & { sku?: string },
  ): Promise<Result<{ id: string }>> {
    const res = await market.saveProduct(id, p);
    if (!res.ok || !isMarketRemote()) return res;
    for (const photo of (p.photos ?? []).filter((x) => x.startsWith("data:"))) {
      const up = await market.addProductPhoto(res.id, photo);
      if (!up.ok) {
        return {
          ok: false,
          message: `Produit enregistré, mais une photo n'a pas pu être envoyée : ${up.message}`,
        };
      }
    }
    return res;
  },

  async updateProduct(p: Product, patch: Partial<Product>): Promise<Result> {
    if (isMarketRemote()) return market.saveProduct(p.id, { ...p, ...patch });
    productActions.update(p.id, patch);
    return { ok: true };
  },

  async removeProduct(id: string): Promise<Result<{ removed: boolean }>> {
    if (isMarketRemote()) return remote(() => removeProductFn({ data: { id } }));
    productActions.remove(id);
    return { ok: true, removed: true };
  },

  async addProductPhoto(productId: string, dataUrl: string): Promise<Result> {
    if (isMarketRemote())
      return remote(() => uploadProductPhotoFn({ data: { productId, dataUrl } }));
    return { ok: true };
  },

  async moveStock(m: Omit<StockMovement, "id" | "at"> & { at?: string }): Promise<Result> {
    if (isMarketRemote()) {
      return remote(() =>
        moveStockFn({ data: { productId: m.productId, type: m.type, qty: m.qty } }),
      );
    }
    movementActions.create(m);
    return { ok: true };
  },

  // --- Commandes ---
  async placeOrder(req: PlaceOrderRequest): Promise<
    Result<{
      checkoutId: string;
      checkoutReference: string;
      total: number;
      orders: { id: string; reference: string }[];
    }>
  > {
    return remote(() => placeOrderFn({ data: req }));
  },

  async confirmOrder(orderId: string, available: Record<string, number>): Promise<Result> {
    if (isMarketRemote()) return remote(() => confirmOrderFn({ data: { orderId, available } }));
    return orderActions.confirmPartial(orderId, available);
  },

  /** Producteur : préparation, refus. Restaurant : annulation. Admin. */
  async setOrderStatus(
    orderId: string,
    status: OrderStatus,
    actor: OrderActor,
    note?: string,
  ): Promise<Result> {
    if (isMarketRemote()) {
      return remote(() => setOrderStatusFn({ data: { orderId, status, note } }));
    }
    return actor === "restaurant"
      ? restaurantOrderActions.setStatus(orderId, status, "restaurant", note)
      : orderActions.setStatus(orderId, status, note, actor);
  },

  async reportReception(
    orderId: string,
    lines: { productId: string; refusedQty: number; reason: string }[],
    note?: string,
  ): Promise<Result> {
    if (isMarketRemote()) {
      return remote(() => reportReceptionFn({ data: { orderId, lines, note } }));
    }
    return restaurantOrderActions.reportReception(orderId, lines, note);
  },

  // --- Missions (livreur) ---
  async acceptMission(missionId: string): Promise<AcceptResult> {
    if (isMarketRemote()) {
      const res = await remote(() => acceptMissionFn({ data: { missionId } }));
      return res.ok ? { ok: true } : { ok: false, reason: "taken", message: res.message };
    }
    return missionActions.accept(missionId);
  },

  async missionStep(
    missionId: string,
    status: MissionStatus,
    code?: string,
    cashCollected?: boolean,
  ): Promise<Result> {
    if (isMarketRemote()) {
      if (status !== "pickup" && status !== "loaded" && status !== "delivered") {
        return { ok: false, message: "Étape inconnue." };
      }
      return remote(() => missionStepFn({ data: { missionId, status, code, cashCollected } }));
    }
    return missionActions.setStatus(missionId, status, undefined, { code });
  },

  async withdrawMission(missionId: string, reason: string): Promise<Result> {
    if (isMarketRemote()) return remote(() => withdrawMissionFn({ data: { missionId, reason } }));
    return missionActions.withdraw(missionId, reason);
  },

  async markArrived(missionId: string, stage: "pickup" | "dropoff"): Promise<Result> {
    if (isMarketRemote()) return remote(() => markArrivedFn({ data: { missionId, stage } }));
    missionActions.markArrived(missionId, stage);
    return { ok: true };
  },

  /** Photos de preuve : chacune est envoyée au serveur (mode base). */
  async attachProof(
    missionId: string,
    photos: MissionProofPhoto[],
    stage: "pickup" | "dropoff" = "dropoff",
  ): Promise<Result> {
    if (isMarketRemote()) {
      for (const p of photos) {
        if (!p.dataUrl?.startsWith("data:")) continue;
        const res = await remote(() =>
          uploadProofFn({ data: { missionId, stage, dataUrl: p.dataUrl! } }),
        );
        if (!res.ok) return res;
      }
      return { ok: true };
    }
    missionActions.attachProof(missionId, photos);
    return { ok: true };
  },

  async reassignMission(missionId: string, driverId: string): Promise<AcceptResult> {
    if (isMarketRemote()) {
      const res = await remote(() => reassignMissionFn({ data: { missionId, driverId } }));
      return res.ok ? { ok: true } : { ok: false, reason: "taken", message: res.message };
    }
    return missionActions.reassign(missionId, driverId);
  },

  // --- Paiements du pilote (mode base uniquement) ---
  /** Restaurant : « j'ai payé » avec la référence de la transaction. */
  async declarePayment(
    checkoutId: string,
    method: "wave" | "orange_money",
    providerRef: string,
  ): Promise<Result> {
    return remote(() => declarePaymentFn({ data: { checkoutId, method, providerRef } }));
  },

  /** Admin : argent reçu (compte marchand ou espèces remises). */
  async confirmPayment(
    paymentId: string,
    amountReceived: number,
    providerRef?: string,
  ): Promise<Result> {
    return remote(() => confirmPaymentFn({ data: { paymentId, providerRef, amountReceived } }));
  },

  /** Admin : transaction introuvable, le restaurant déclare à nouveau. */
  async rejectPayment(paymentId: string, reason: string): Promise<Result> {
    return remote(() => rejectPaymentFn({ data: { paymentId, reason } }));
  },

  /** Producteur ou livreur : demander un retrait (mode base). */
  async requestPayout(
    amount: number,
    method: PaymentMethod,
    accountNumber?: string,
  ): Promise<Result> {
    if (method !== "Wave" && method !== "Orange Money") {
      return { ok: false, message: "Les retraits se font par Wave ou Orange Money." };
    }
    return remote(() =>
      requestPayoutFn({
        data: {
          amount: Math.round(amount),
          method: method === "Wave" ? "wave" : "orange_money",
          accountNumber: accountNumber || undefined,
        },
      }),
    );
  },

  /** Admin : premier temps de la double validation. */
  async approvePayout(payoutId: string): Promise<Result> {
    return remote(() => approvePayoutFn({ data: { payoutId } }));
  },

  async approveRefund(refundId: string): Promise<Result> {
    return remote(() => approveRefundFn({ data: { refundId } }));
  },

  /** Producteur ou livreur : relevé mensuel (mode base). */
  async statement(month: string): Promise<Result<{ statement: StatementView }>> {
    try {
      return await getStatementFn({ data: { month } });
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error && err.message ? err.message : UNREACHABLE,
      };
    }
  },

  /** Admin : garder une catégorie proposée par un producteur. */
  async approveCategory(id: string): Promise<Result> {
    return remote(() => approveCategoryFn({ data: { id } }));
  },

  async renameCategory(id: string, name: string): Promise<Result> {
    return remote(() => renameCategoryFn({ data: { id, name } }));
  },

  /** Admin : déplacer les produits d'une catégorie dans une autre. */
  async mergeCategory(fromId: string, intoId: string): Promise<Result<{ moved?: number }>> {
    return remote(() => mergeCategoryFn({ data: { fromId, intoId } }));
  },

  // --- Litiges ------------------------------------------------------------------------

  /** Ouvre un litige (avec photos de preuve, réduites avant l'envoi). */
  async openDispute(input: NewDisputeInput): Promise<Result<{ id: string }>> {
    if (isMarketRemote()) {
      const files = await disputeFiles(input.attachments ?? []);
      if (!files.ok) return files;
      const res = await remote(() =>
        openDisputeFn({
          data: {
            orderId: input.orderId,
            missionId: input.missionId,
            category: input.category,
            subcategory: input.subcategory,
            description: input.description,
            againstRole: input.againstRole,
            claimedAmount: input.claimedAmount,
            priority: input.priority,
            files: files.list,
          },
        }),
      );
      return res.ok ? { ok: true, id: res.id ?? "" } : res;
    }
    return { ok: true, id: disputeActions.open(input) };
  },

  async replyDispute(
    id: string,
    msg: {
      role: DisputeParty;
      name: string;
      text: string;
      internal?: boolean;
      attachments?: DisputeAttachment[];
    },
  ): Promise<Result> {
    if (isMarketRemote()) {
      const files = await disputeFiles(msg.attachments ?? []);
      if (!files.ok) return files;
      return remote(() =>
        replyDisputeFn({ data: { id, text: msg.text, internal: msg.internal, files: files.list } }),
      );
    }
    disputeActions.reply(id, msg);
    return { ok: true };
  },

  /** Équipe : instruire, demander une réponse, assigner, escalader. */
  async disputeStaffAction(
    id: string,
    action: "investigate" | "await_response" | "assign" | "escalate",
    opts: {
      assignee?: { id?: string; name: string };
      reason?: string;
      actor: string;
      againstName?: string;
    },
  ): Promise<Result> {
    if (isMarketRemote()) {
      return remote(() =>
        disputeStaffActionFn({
          data: { id, action, assigneeId: opts.assignee?.id, reason: opts.reason },
        }),
      );
    }
    if (action === "investigate") disputeActions.setStatus(id, "investigating", opts.actor);
    else if (action === "await_response")
      disputeActions.setStatus(
        id,
        "awaiting_response",
        opts.actor,
        `Réponse demandée à ${opts.againstName ?? "la partie"}`,
      );
    else if (action === "assign") disputeActions.assign(id, opts.assignee?.name ?? "", opts.actor);
    else disputeActions.escalate(id, opts.reason ?? "Escalade", opts.actor);
    return { ok: true };
  },

  /** Une partie demande l'escalade de son dossier. */
  async requestDisputeEscalation(id: string, actor: string): Promise<Result> {
    if (isMarketRemote()) return remote(() => requestDisputeEscalationFn({ data: { id } }));
    disputeActions.escalate(id, `Escalade demandée par ${actor}`);
    return { ok: true };
  },

  async resolveDispute(
    id: string,
    decision: {
      outcome: DisputeOutcome;
      grantedAmount: number;
      liableParty: DisputeParty;
      reason: string;
      by: string;
    },
  ): Promise<Result> {
    if (isMarketRemote()) {
      if (decision.outcome === "credit") {
        return {
          ok: false,
          message: "Les avoirs ne sont pas encore disponibles : choisissez un remboursement.",
        };
      }
      return remote(() =>
        resolveDisputeFn({
          data: {
            id,
            outcome: decision.outcome as "refund" | "partial" | "goodwill" | "rejected",
            grantedAmount: decision.grantedAmount,
            liableParty: decision.liableParty,
            reason: decision.reason,
          },
        }),
      );
    }
    disputeActions.resolve(id, decision);
    return { ok: true };
  },

  // --- Commandes récurrentes (restaurant) ------------------------------------------

  /** Nouvelle récurrence : jours de livraison, commande passée la veille. */
  async createRecurring(input: RecurringCreate): Promise<Result<{ id?: string }>> {
    if (isMarketRemote()) return remote(() => createRecurringFn({ data: input }));
    // Démonstration : la récurrence vit dans le navigateur.
    const prices = new Map(getProducts().map((p) => [p.id, p.pricePerKg]));
    const firstRun = new Date(`${input.firstDeliveryOn}T${input.orderTime}:00Z`);
    firstRun.setUTCDate(firstRun.getUTCDate() - 1);
    recurringOrderActions.create({
      name: input.name,
      farmerId: input.farmerId,
      items: input.items.map((i) => ({ ...i, referencePrice: prices.get(i.productId) ?? 0 })),
      frequency: input.frequency,
      intervalDays: input.intervalDays,
      daysOfWeek: input.daysOfWeek,
      createTime: input.orderTime,
      deliverySlot: input.deliveryTime,
      firstRunAt: firstRun.toISOString(),
      end: input.end,
      rules: input.rules,
      deliveryAddress: input.deliveryAddress,
      deliveryMode: "standard",
      instructions: input.instructions,
      paymentMethod: input.paymentMethod,
    });
    return { ok: true };
  },

  /** Copie d'une récurrence, à partir de la première livraison possible. */
  async duplicateRecurring(r: RecurringOrder): Promise<Result<{ id?: string }>> {
    const first = new Date(firstDeliveryDay(new Date(), getRules().cutoffHour))
      .toISOString()
      .slice(0, 10);
    return market.createRecurring({
      name: `${r.name} (copie)`,
      farmerId: r.farmerId,
      items: r.items.map(({ productId, qty }) => ({ productId, qty })),
      frequency: r.frequency,
      intervalDays: r.intervalDays,
      daysOfWeek: r.daysOfWeek,
      deliveryTime: /^\d{2}:\d{2}$/.test(r.deliverySlot) ? r.deliverySlot : "09:00",
      orderTime: r.createTime,
      firstDeliveryOn: first,
      end: r.end,
      rules: r.rules,
      deliveryAddress: r.deliveryAddress,
      paymentMethod: r.paymentMethod,
      shortagePreference: "partial",
      instructions: r.instructions,
    });
  },

  async updateRecurring(
    id: string,
    patch: {
      name?: string;
      items?: { productId: string; qty: number; referencePrice?: number }[];
      rules?: RecurringOrder["rules"];
    },
  ): Promise<Result> {
    if (isMarketRemote()) {
      return remote(() =>
        updateRecurringFn({
          data: {
            id,
            ...patch,
            items: patch.items?.map(({ productId, qty }) => ({ productId, qty })),
          },
        }),
      );
    }
    recurringOrderActions.update(id, {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.rules ? { rules: patch.rules } : {}),
      ...(patch.items
        ? { items: patch.items.map((i) => ({ ...i, referencePrice: i.referencePrice ?? 0 })) }
        : {}),
    });
    return { ok: true };
  },

  /** Pause, reprise, arrêt, livraison sautée ou décision sur une règle. */
  async recurringAction(
    id: string,
    action: "pause" | "resume" | "cancel" | "skip_next" | "confirm" | "cancel_occurrence",
    opts: { reason?: string; pausedUntil?: string } = {},
  ): Promise<Result<{ outcome?: string }>> {
    if (isMarketRemote()) return remote(() => recurringActionFn({ data: { id, action, ...opts } }));
    if (action === "pause") recurringOrderActions.pause(id, opts.reason ?? "", opts.pausedUntil);
    else if (action === "resume") recurringOrderActions.resume(id);
    else if (action === "cancel") recurringOrderActions.cancel(id, "full");
    else if (action === "skip_next") recurringOrderActions.skipNextOccurrence(id, opts.reason);
    else recurringOrderActions.resolvePendingAction(id, action);
    return { ok: true };
  },

  async overrideNextRecurring(id: string, items: RecurringOrderItem[]): Promise<Result> {
    if (isMarketRemote()) {
      return remote(() =>
        overrideNextRecurringFn({
          data: { id, items: items.map(({ productId, qty }) => ({ productId, qty })) },
        }),
      );
    }
    recurringOrderActions.overrideNextOccurrence(id, items);
    return { ok: true };
  },

  /** Admin : renommer une unité sur tous les produits (fusion si elle existe). */
  async renameUnit(from: string, to: string): Promise<Result<{ moved?: number }>> {
    return remote(() => renameUnitFn({ data: { from, to } }));
  },

  /** Admin : barème, positions des lieux et des producteurs (mode base). */
  async deliverySettings(): Promise<
    Result<{
      pricing: DeliveryPricing;
      driverPay: DriverPay;
      places: PlaceRow[];
      farmers: FarmerPlaceRow[];
    }>
  > {
    try {
      return await getDeliverySettingsFn();
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error && err.message ? err.message : UNREACHABLE,
      };
    }
  },

  async saveDriverPay(pay: DriverPay): Promise<Result> {
    return remote(() => saveDriverPayFn({ data: pay }));
  },

  async saveDeliveryPricing(pricing: DeliveryPricing): Promise<Result> {
    return remote(() => saveDeliveryPricingFn({ data: pricing }));
  },

  /** Position d'une ville ou d'un quartier ; null : position de référence. */
  async savePlaceCoords(
    kind: "city" | "zone",
    id: string,
    coords: { lat: number; lng: number } | null,
  ): Promise<Result> {
    return remote(() =>
      savePlaceCoordsFn({ data: { kind, id, lat: coords?.lat ?? null, lng: coords?.lng ?? null } }),
    );
  },

  async saveFarmerDelivery(
    farmerId: string,
    adjustKm: number,
    coords: { lat: number; lng: number } | null,
  ): Promise<Result> {
    return remote(() =>
      saveFarmerDeliveryFn({
        data: { farmerId, adjustKm, lat: coords?.lat ?? null, lng: coords?.lng ?? null },
      }),
    );
  },

  /** Admin : retrait versé, avec la référence de la transaction. */
  async payPayout(payoutId: string, providerRef: string): Promise<Result> {
    return remote(() => payPayoutFn({ data: { payoutId, providerRef } }));
  },

  async rejectPayout(payoutId: string, reason: string): Promise<Result> {
    return remote(() => rejectPayoutFn({ data: { payoutId, reason } }));
  },

  /** Admin : remboursement renvoyé au restaurant. */
  async payRefund(
    refundId: string,
    method: "wave" | "orange_money",
    paidTo: string,
    providerRef: string,
  ): Promise<Result> {
    return remote(() => payRefundFn({ data: { refundId, method, paidTo, providerRef } }));
  },

  // --- Notifications ---
  async markNotificationsRead(ids: string[] | "all"): Promise<void> {
    if (!isMarketRemote()) return;
    await remote(() => markNotificationsReadFn({ data: { ids } }));
  },
};

/** Entrée d'un portail : contrôle du rôle (serveur), puis données du compte. */
export async function enterPortal(role: "farmer" | "restaurant" | "driver" | "admin") {
  const ctx = await requireRole(role);
  await ensureMarketLoaded(ctx.user.email);
  return ctx;
}
