import { useEffect } from "react";
import { downscaleDataUrl } from "@/lib/image-resize";
import type {
  AccountPatch,
  FarmPatch,
  PreferencesPatch,
  RestaurantPatch,
} from "@/lib/market/types";
import { getRules } from "./rules";
import { firstDeliveryDay } from "@/lib/delivery-time";
import type { BudgetState } from "./budget";
import type {
  ChatAttachment,
  Supplier,
  DriverWorkCriteria,
  VehicleChangeReason,
  VehicleChangeRequest,
  VehicleIssueSeverity,
  VehicleIssueType,
  WorkingHours,
  MissionProofPhoto,
  MissionStatus,
  OrderStatus,
  PaymentMethod,
} from "./mocks";
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
  markConversationReadLocally,
  replaceConversations,
  replaceDriverFleet,
  replaceRestaurantBook,
  replaceTeam,
  supplierActions,
  wishlistActions,
  replaceFleetQueue,
  driverOnlineActions,
  vehicleActions,
  docRenewalActions,
  driverSettingsActions,
  replaceDriverConversations,
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
  startConversationFn,
  sendMessageFn,
  markConversationReadFn,
  conversationStaffFn,
  createTicketFn,
  replyTicketFn,
  ticketStaffFn,
  ticketFromConversationFn,
  createReviewFn,
  replyReviewFn,
  hideReviewFn,
  reportProductFn,
  moderateProductFn,
  setAccountStatusFn,
  createReturnFn,
  replyReturnFn,
  decideReturnFn,
  creditReturnFn,
  returnStaffFn,
  createIncidentFn,
  incidentActionFn,
  adminRoleActionFn,
  vehicleActionFn,
  vehiclePhotoFn,
  reportVehicleIssueFn,
  requestVehicleChangeFn,
  submitDocRenewalFn,
  fleetDecisionFn,
  setDriverOnlineFn,
  updateWorkSettingsFn,
  supplierActionFn,
  favoriteProductFn,
  saveBudgetFn,
  teamActionFn,
  updateAccountFn,
  updateAvatarFn,
  updatePreferencesFn,
  updateRestaurantFn,
  updateFarmFn,
  updateDriverFn,
  requestAccountDeletionFn,
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
import type { AdminRoleActionInput } from "@/lib/market/functions";
import type { OrderActor } from "@/lib/order-lifecycle";
import type { StatementView } from "@/lib/market/documents-view";
import type { DeliveryPricing, FarmerPlaceRow, PlaceRow } from "@/lib/delivery-pricing";
import type { DriverPay } from "@/lib/platform-rules";
import { requireRole } from "@/lib/auth/functions";
import {
  clearBusinessDemoData,
  incidentActions,
  replaceAfterSales,
  returnActions,
  reviewActions,
  type IncidentType,
  type ReturnReason,
  type ReturnRequest,
  type ReturnResolutionType,
  type Review,
} from "./business";
import type { RefundBornBy } from "./finance";
import {
  clearDisputesDemoData,
  disputeActions,
  replaceDisputes,
  replaceDisputeStaff,
  replaceCreditNotes,
  type DisputeAttachment,
  type DisputeOutcome,
  type DisputeParty,
  type NewDisputeInput,
} from "./disputes";
import { clearFinanceDemoData } from "./finance";
import { clearSupportDemoData, replaceSupportTickets } from "./support";
import {
  adminUserActions,
  applyAdminDirectory,
  clearAdminDemoData,
  moderationActions,
  replaceAdminServerNotifications,
  replaceMaintenance,
  replaceModeration,
} from "./admin-store";
import type { PlatformUserStatus } from "./admin-mocks";
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
  replaceCreditNotes(snap.creditNotes ?? []);
  replaceConversations(snap.conversations ?? []);
  replaceDriverConversations(snap.driverConversations ?? []);
  replaceSupportTickets(snap.supportTickets ?? []);
  replaceAfterSales({
    returns: snap.returns ?? [],
    reviews: snap.reviews ?? [],
    incidents: snap.incidents ?? [],
  });
  if (snap.fleet) replaceDriverFleet(snap.fleet);
  if (snap.book) replaceRestaurantBook(snap.book);
  replaceTeam(snap);
  if (snap.maintenance) replaceMaintenance(snap.maintenance);
  if (snap.me.role === "admin") {
    replaceModeration(snap.moderation ?? []);
    replaceFleetQueue(snap.fleetQueue ?? { renewals: [], changeRequests: [] });
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
  /** Avoir à déduire du panier. */
  creditNoteId?: string;
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
      creditApplied: number;
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

  // --- Profil et réglages (mode base) -----------------------------------------------

  saveAccount(patch: AccountPatch): Promise<Result> {
    return remote(() => updateAccountFn({ data: patch }));
  },

  /** Photo de profil réduite (512 px) avant l'envoi ; null la retire. */
  async saveAvatar(dataUrl: string | null): Promise<Result> {
    const small = dataUrl ? await downscaleDataUrl(dataUrl, 512, 0.85) : null;
    return remote(() => updateAvatarFn({ data: { dataUrl: small } }));
  },

  savePreferences(patch: PreferencesPatch): Promise<Result> {
    return remote(() => updatePreferencesFn({ data: patch }));
  },

  saveRestaurant(patch: RestaurantPatch): Promise<Result> {
    return remote(() => updateRestaurantFn({ data: patch }));
  },

  saveFarm(patch: FarmPatch): Promise<Result> {
    return remote(() => updateFarmFn({ data: patch }));
  },

  saveDriver(patch: { address?: string }): Promise<Result> {
    return remote(() => updateDriverFn({ data: patch }));
  },

  requestAccountDeletion(reason: string): Promise<Result> {
    return remote(() => requestAccountDeletionFn({ data: { reason } }));
  },

  // --- Messagerie et support (mode base) ---------------------------------------------

  /** Ouvre (ou retrouve) le fil avec un producteur (restaurant) ou un restaurant. */
  startConversation(target: {
    farmerId?: string;
    restaurantId?: string;
  }): Promise<Result<{ id: string }>> {
    return remote(async () => {
      const res = await startConversationFn({ data: target });
      return res.ok ? { ok: true as const, id: res.id ?? "" } : res;
    });
  },

  /** Message (et photo jointe, réduite avant l'envoi). */
  async sendMessage(id: string, text: string, attachment?: ChatAttachment): Promise<Result> {
    if (attachment && !attachment.mime.startsWith("image/")) {
      return { ok: false, message: "Seules les photos (JPEG, PNG, WebP) peuvent être jointes." };
    }
    const file = attachment
      ? { name: attachment.name, dataUrl: await downscaleDataUrl(attachment.dataUrl) }
      : undefined;
    return remote(() => sendMessageFn({ data: { id, text, file } }));
  },

  /** Fil lu : le compteur disparaît tout de suite, le serveur suit. */
  markConversationRead(id: string) {
    markConversationReadLocally(id);
    void markConversationReadFn({ data: { id } }).catch(() => undefined);
  },

  conversationStaff(
    id: string,
    input: { priority?: "normal" | "important" | "urgent"; tags?: string[]; note?: string },
  ): Promise<Result> {
    return remote(() => conversationStaffFn({ data: { id, ...input } }));
  },

  createTicket(input: {
    subject: string;
    message: string;
    category: string;
    orderRef?: string;
    urgent?: boolean;
  }): Promise<Result<{ id: string; reference: string }>> {
    return remote(async () => {
      const res = await createTicketFn({ data: input });
      return res.ok ? { ok: true as const, id: res.id ?? "", reference: res.reference ?? "" } : res;
    });
  },

  replyTicket(id: string, text: string, internal = false): Promise<Result> {
    return remote(() => replyTicketFn({ data: { id, text, internal } }));
  },

  ticketStaff(
    id: string,
    input: { status?: "open" | "answered" | "closed"; assigneeId?: string | null },
  ): Promise<Result> {
    return remote(() => ticketStaffFn({ data: { id, ...input } }));
  },

  ticketFromConversation(
    conversationId: string,
    subject: string,
    category: string,
  ): Promise<Result<{ id: string; reference: string }>> {
    return remote(async () => {
      const res = await ticketFromConversationFn({ data: { conversationId, subject, category } });
      return res.ok ? { ok: true as const, id: res.id ?? "", reference: res.reference ?? "" } : res;
    });
  },

  // --- Avis ---------------------------------------------------------------------------

  /** Note une commande livrée (restaurant). */
  async createReview(input: Omit<Review, "id" | "createdAt">): Promise<Result> {
    if (isMarketRemote()) {
      if (!input.orderId) return { ok: false, message: "Choisissez la commande notée." };
      return remote(() =>
        createReviewFn({
          data: {
            orderId: input.orderId!,
            quality: input.quality,
            quantity: input.quantity,
            freshness: input.freshness,
            timeliness: input.timeliness,
            packaging: input.packaging,
            communication: input.communication,
            comment: input.comment,
            tags: input.tags ?? [],
          },
        }),
      );
    }
    reviewActions.create(input);
    return { ok: true };
  },

  async replyReview(id: string, text: string): Promise<Result> {
    if (isMarketRemote()) return remote(() => replyReviewFn({ data: { id, text } }));
    reviewActions.reply(id, text);
    return { ok: true };
  },

  async hideReview(id: string, hidden: boolean): Promise<Result> {
    if (isMarketRemote()) return remote(() => hideReviewFn({ data: { id, hidden } }));
    if (hidden) reviewActions.remove(id);
    return { ok: true };
  },

  // --- Modération ------------------------------------------------------------------------

  /** Signale un produit à l'équipe (restaurant). */
  async reportProduct(productId: string, reason: string): Promise<Result> {
    if (isMarketRemote()) return remote(() => reportProductFn({ data: { productId, reason } }));
    return { ok: true };
  },

  async moderateProduct(
    item: { id: string; productId: string },
    action: "keep" | "unpublish" | "request_change" | "suspend_farmer",
    note = "",
    actor?: string,
  ): Promise<Result> {
    if (isMarketRemote()) {
      return remote(() => moderateProductFn({ data: { productId: item.productId, action, note } }));
    }
    if (action === "keep") moderationActions.approve(item.id, actor);
    else if (action === "unpublish") moderationActions.unpublish(item.id, actor);
    else if (action === "request_change") moderationActions.requestChange(item.id, note, actor);
    else moderationActions.suspendFarmer(item.id, actor);
    return { ok: true };
  },

  // --- Comptes (admin) ---------------------------------------------------------------

  async setAccountStatus(
    userId: string,
    status: Extract<PlatformUserStatus, "active" | "suspended" | "rejected">,
    reason?: string,
  ): Promise<Result> {
    if (isMarketRemote()) {
      const res = await remote(() => setAccountStatusFn({ data: { userId, status, reason } }));
      // La liste des comptes vient de l'annuaire : il est relu aussi.
      if (res.ok) {
        const dir = await getAdminDirectoryFn().catch(() => null);
        if (dir?.ok) applyAdminDirectory(dir);
      }
      return res;
    }
    adminUserActions.setStatus(userId, status);
    return { ok: true };
  },

  // --- Retours produit -------------------------------------------------------------------

  /** Déclare un retour (restaurant), avec photos réduites avant l'envoi. */
  async createReturn(
    input: Omit<
      ReturnRequest,
      "id" | "reference" | "status" | "createdAt" | "history" | "messages"
    >,
  ): Promise<Result<{ id: string; reference: string }>> {
    if (isMarketRemote()) {
      if (!input.orderId || !input.productId) {
        return { ok: false, message: "Choisissez la commande et le produit." };
      }
      const files = await disputeFiles(input.photos ?? []);
      if (!files.ok) return files;
      return remote(async () => {
        const res = await createReturnFn({
          data: {
            orderId: input.orderId!,
            productId: input.productId!,
            qty: input.qty,
            reason: input.reason as ReturnReason,
            description: input.description,
            requestedAmount: input.requestedAmount,
            files: files.list,
          },
        });
        return res.ok
          ? { ok: true as const, id: res.id ?? "", reference: res.reference ?? "" }
          : res;
      });
    }
    const item = returnActions.create(input);
    return { ok: true, id: item.id, reference: item.reference };
  },

  async replyReturn(
    id: string,
    msg: { role: "restaurant" | "farmer"; name: string; text: string },
    photos: DisputeAttachment[] = [],
  ): Promise<Result> {
    if (isMarketRemote()) {
      const files = await disputeFiles(photos);
      if (!files.ok) return files;
      return remote(() => replyReturnFn({ data: { id, text: msg.text, files: files.list } }));
    }
    if (msg.text.trim()) returnActions.reply(id, msg);
    if (photos.length) returnActions.addPhotos(id, photos);
    return { ok: true };
  },

  /** Décision du producteur : accepter (montant) ou refuser (motif). */
  async decideReturn(
    id: string,
    input: { accept: boolean; amount?: number; note?: string },
  ): Promise<Result> {
    if (isMarketRemote()) return remote(() => decideReturnFn({ data: { id, ...input } }));
    if (input.accept) returnActions.accept(id, input.amount ?? 0, input.note);
    else returnActions.refuse(id, input.note ?? "");
    return { ok: true };
  },

  async creditReturn(id: string): Promise<Result> {
    if (isMarketRemote()) return remote(() => creditReturnFn({ data: { id } }));
    return returnActions.issueCredit(id);
  },

  /** Équipe : récupération, inspection, décision, escalade, clôture. */
  async returnStaff(
    id: string,
    input:
      | {
          action: "pickup";
          driverId: string;
          driverName: string;
          scheduledFor: string;
          address: string;
        }
      | { action: "picked_up" }
      | { action: "received"; condition: string }
      | { action: "inspect"; conform: boolean; note: string }
      | {
          action: "resolve";
          type: ReturnResolutionType;
          bornBy: RefundBornBy;
          amount?: number;
          note: string;
        }
      | { action: "escalate"; note: string }
      | { action: "close" },
    actor = "Admin Diambar",
  ): Promise<Result> {
    if (isMarketRemote()) {
      if (input.action === "pickup") {
        const { driverName: _name, ...rest } = input;
        return remote(() => returnStaffFn({ data: { id, ...rest } }));
      }
      return remote(() =>
        returnStaffFn({
          data: { id, ...input } as Parameters<typeof returnStaffFn>[0]["data"],
        }),
      );
    }
    switch (input.action) {
      case "pickup":
        returnActions.adminSchedulePickup(id, { ...input, actor });
        break;
      case "picked_up":
        returnActions.adminMarkPickedUp(id);
        break;
      case "received":
        returnActions.adminMarkReceived(id, input.condition, actor);
        break;
      case "inspect":
        returnActions.adminSetInspection(id, { ...input, inspectedBy: actor });
        break;
      case "resolve":
        returnActions.adminResolve(id, { ...input, decidedBy: actor });
        break;
      case "escalate":
        returnActions.adminEscalateToDispute(id, input.note, actor);
        break;
      case "close":
        returnActions.adminClose(id, actor);
        break;
    }
    return { ok: true };
  },

  // --- Incidents de course ---------------------------------------------------------------

  async createIncident(
    input: {
      missionId?: string;
      missionRef: string;
      type: IncidentType;
      description: string;
      waitedMinutes: number;
      compensationRequested: number;
      photos?: DisputeAttachment[];
    },
    reportedBy?: string,
  ): Promise<Result<{ id: string; reference: string }>> {
    if (isMarketRemote()) {
      if (!input.missionId) return { ok: false, message: "Choisissez la course concernée." };
      const files = await disputeFiles(input.photos ?? []);
      if (!files.ok) return files;
      return remote(async () => {
        const res = await createIncidentFn({
          data: {
            missionId: input.missionId!,
            type: input.type,
            description: input.description,
            waitedMinutes: input.waitedMinutes,
            compensationRequested: input.compensationRequested,
            files: files.list,
          },
        });
        return res.ok
          ? { ok: true as const, id: res.id ?? "", reference: res.reference ?? "" }
          : res;
      });
    }
    const { missionId: _m, ...rest } = input;
    const item = incidentActions.create(rest, reportedBy);
    return { ok: true, id: item.id, reference: item.reference };
  },

  async escalateIncident(id: string): Promise<Result> {
    if (isMarketRemote())
      return remote(() => incidentActionFn({ data: { id, action: "escalate" } }));
    incidentActions.escalate(id);
    return { ok: true };
  },

  async commentIncident(id: string, text: string): Promise<Result> {
    if (isMarketRemote()) {
      return remote(() => incidentActionFn({ data: { id, action: "comment", text } }));
    }
    incidentActions.addComment(id, text);
    return { ok: true };
  },

  /** Rôles de l'administration (base) : créer, modifier, supprimer, attribuer. */
  async adminRoleAction(input: AdminRoleActionInput): Promise<Result> {
    return remote(() => adminRoleActionFn({ data: input }));
  },

  /** Rembourse le restaurant de la course (base) : retourne la référence. */
  async refundRestaurantForIncident(
    id: string,
    amount: number,
    reason: string,
  ): Promise<Result<{ reference?: string }>> {
    return remote(() =>
      incidentActionFn({
        data: { id, action: "refund_restaurant", awarded: amount, text: reason },
      }),
    );
  },

  async resolveIncident(
    id: string,
    awarded: number,
    note?: string,
    actor?: string,
  ): Promise<Result> {
    if (isMarketRemote()) {
      return remote(() =>
        incidentActionFn({ data: { id, action: "resolve", awarded, text: note } }),
      );
    }
    incidentActions.resolve(id, awarded, note, actor);
    return { ok: true };
  },

  // --- Flotte du livreur ---------------------------------------------------------------

  /** En ligne / hors ligne : seules les personnes en ligne prennent des courses. */
  async setOnline(online: boolean): Promise<Result> {
    if (isMarketRemote()) return remote(() => setDriverOnlineFn({ data: { online } }));
    driverOnlineActions.set(online);
    return { ok: true };
  },

  async updateVehicle(patch: {
    brand?: string;
    model?: string;
    year?: number;
    color?: string;
    mileageKm?: number;
    nextMaintenanceAt?: string | null;
  }): Promise<Result> {
    if (isMarketRemote()) {
      return remote(() => vehicleActionFn({ data: { action: "update", ...patch } }));
    }
    const { nextMaintenanceAt, ...rest } = patch;
    vehicleActions.update({
      ...rest,
      ...(nextMaintenanceAt !== undefined
        ? { nextMaintenanceAt: nextMaintenanceAt ?? undefined }
        : {}),
    });
    return { ok: true };
  },

  async vehiclePhoto(dataUrl: string): Promise<Result> {
    if (isMarketRemote()) {
      const small = await downscaleDataUrl(dataUrl);
      return remote(() => vehiclePhotoFn({ data: { dataUrl: small } }));
    }
    vehicleActions.setPhoto(dataUrl);
    return { ok: true };
  },

  async reportVehicleIssue(input: {
    type: VehicleIssueType;
    severity: VehicleIssueSeverity;
    description: string;
    photos?: DisputeAttachment[];
  }): Promise<Result<{ reference: string }>> {
    if (isMarketRemote()) {
      const files = await disputeFiles(input.photos ?? []);
      if (!files.ok) return files;
      return remote(async () => {
        const res = await reportVehicleIssueFn({
          data: {
            type: input.type,
            severity: input.severity,
            description: input.description,
            files: files.list,
          },
        });
        return res.ok ? { ok: true as const, reference: res.reference ?? "" } : res;
      });
    }
    const issue = vehicleActions.reportIssue(input);
    return { ok: true, reference: issue.reference };
  },

  async resolveVehicleIssue(id: string): Promise<Result> {
    if (isMarketRemote()) {
      return remote(() => vehicleActionFn({ data: { action: "resolve_issue", id } }));
    }
    vehicleActions.resolveIssue(id);
    return { ok: true };
  },

  async logMaintenance(label: string): Promise<Result> {
    if (isMarketRemote()) {
      return remote(() => vehicleActionFn({ data: { action: "maintenance", label } }));
    }
    vehicleActions.logMaintenance(label);
    return { ok: true };
  },

  async requestVehicleChange(input: {
    reason: VehicleChangeReason;
    newVehicle: VehicleChangeRequest["newVehicle"];
    docs: DisputeAttachment[];
  }): Promise<Result<{ reference: string }>> {
    if (isMarketRemote()) {
      const files = await disputeFiles(input.docs);
      if (!files.ok) return files;
      return remote(async () => {
        const res = await requestVehicleChangeFn({
          data: { reason: input.reason, newVehicle: input.newVehicle, files: files.list },
        });
        return res.ok ? { ok: true as const, reference: res.reference ?? "" } : res;
      });
    }
    const req = vehicleActions.requestChange(input);
    return { ok: true, reference: req.reference };
  },

  /** Document renouvelé (assurance, contrôle technique), validé par l'équipe. */
  async submitDocRenewal(
    doc: "insurance" | "inspection",
    newExpiry: string,
    photos: DisputeAttachment[],
  ): Promise<Result> {
    if (isMarketRemote()) {
      if (!photos.length) return { ok: false, message: "Ajoutez la photo du document." };
      const files = await disputeFiles(photos);
      if (!files.ok) return files;
      return remote(() => submitDocRenewalFn({ data: { doc, newExpiry, files: files.list } }));
    }
    return docRenewalActions.submit({ doc, newExpiry, photos });
  },

  /** Équipe : valider ou refuser un document ou un changement de véhicule. */
  async fleetDecision(
    kind: "renewal" | "vehicle",
    id: string,
    approve: boolean,
    note?: string,
    actor = "Admin Diambar",
  ): Promise<Result> {
    if (isMarketRemote()) {
      return remote(() => fleetDecisionFn({ data: { kind, id, approve, note } }));
    }
    if (kind === "renewal") {
      if (approve) docRenewalActions.approve(id, actor);
      else docRenewalActions.reject(id, actor, note ?? "");
    }
    return { ok: true };
  },

  /** Préférences de travail, horaires, partage de position. */
  async updateWorkSettings(patch: {
    workPrefs?: { radius?: number; autoAccept?: boolean; criteria?: DriverWorkCriteria };
    workingHours?: WorkingHours;
    locationSharing?: boolean;
  }): Promise<Result> {
    if (isMarketRemote()) return remote(() => updateWorkSettingsFn({ data: patch }));
    if (patch.workPrefs) {
      const { criteria, ...prefs } = patch.workPrefs;
      if (Object.keys(prefs).length) driverSettingsActions.setWorkPrefs(prefs);
      if (criteria) driverSettingsActions.setCriteria(criteria);
    }
    if (patch.workingHours) {
      for (const [day, h] of Object.entries(patch.workingHours)) {
        driverSettingsActions.setWorkingDay(day as keyof WorkingHours, h);
      }
    }
    if (patch.locationSharing !== undefined) {
      driverSettingsActions.setLocationSharing(patch.locationSharing);
    }
    return { ok: true };
  },

  // --- Carnet du restaurant -------------------------------------------------------------

  async createSupplier(
    input: Omit<Supplier, "id" | "totalOrders" | "totalSpent" | "lastOrder" | "suspended"> & {
      suspended?: boolean;
    },
  ): Promise<Result<{ id: string }>> {
    if (isMarketRemote()) {
      return remote(async () => {
        const res = await supplierActionFn({
          data: {
            action: "create",
            name: input.name,
            contact: input.contact,
            phone: input.phone,
            email: input.email,
            city: input.city,
            notes: input.notes,
            favorite: input.favorite,
            suspended: input.suspended,
            farmerId: input.farmerId ?? null,
          },
        });
        return res.ok ? { ok: true as const, id: res.id ?? "" } : res;
      });
    }
    return { ok: true, id: supplierActions.create(input) };
  },

  async updateSupplier(
    id: string,
    patch: Partial<
      Pick<
        Supplier,
        "name" | "contact" | "phone" | "email" | "city" | "notes" | "favorite" | "suspended"
      >
    >,
  ): Promise<Result> {
    if (isMarketRemote()) {
      return remote(() => supplierActionFn({ data: { action: "update", id, ...patch } }));
    }
    supplierActions.update(id, patch);
    return { ok: true };
  },

  async removeSupplier(id: string): Promise<Result> {
    if (isMarketRemote()) return remote(() => supplierActionFn({ data: { action: "remove", id } }));
    supplierActions.remove(id);
    return { ok: true };
  },

  /** Produit favori : le cœur change tout de suite, le serveur suit. */
  async toggleFavorite(productId: string): Promise<Result> {
    wishlistActions.toggle(productId);
    if (!isMarketRemote()) return { ok: true };
    const res = await remote(() => favoriteProductFn({ data: { productId } }));
    if (!res.ok) wishlistActions.toggle(productId);
    return res;
  },

  async clearFavorites(): Promise<Result> {
    wishlistActions.clear();
    if (!isMarketRemote()) return { ok: true };
    return remote(() => favoriteProductFn({ data: { clear: true } }));
  },

  /** Budget d'achat (mensuel, seuil d'alerte, enveloppes). */
  async saveBudget(budget: BudgetState): Promise<Result> {
    if (isMarketRemote()) return remote(() => saveBudgetFn({ data: budget }));
    return { ok: true };
  },

  // --- Équipe de l'établissement --------------------------------------------------------

  /** Inviter, renvoyer, changer le rôle ou retirer un membre (titulaire). Le
   * lien d'invitation est renvoyé pour être copié si l'e-mail n'est pas parti. */
  teamAction(
    input:
      | { action: "invite"; email: string; role: string }
      | { action: "renew"; id: string }
      | { action: "role"; id: string; role: string }
      | { action: "remove"; id: string },
  ): Promise<Result<{ path?: string; emailed?: boolean }>> {
    return remote(async () => {
      const res = await teamActionFn({ data: input });
      return res.ok ? { ok: true as const, path: res.path, emailed: res.emailed } : res;
    });
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
      return remote(() =>
        resolveDisputeFn({
          data: {
            id,
            outcome: decision.outcome,
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
