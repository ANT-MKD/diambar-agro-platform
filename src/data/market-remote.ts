import { useEffect } from "react";
import type { MissionProofPhoto, MissionStatus, OrderStatus, PaymentMethod } from "./mocks";
import { getMarketMode, isMarketRemote, setMarketMode, useMarketMode } from "./market-mode";
import {
  clearDemoCollections,
  missionActions,
  movementActions,
  orderActions,
  productActions,
  replaceMarketData,
  restaurantOrderActions,
  type AcceptResult,
} from "./store";
import {
  acceptMissionFn,
  confirmOrderFn,
  getMarketSnapshotFn,
  markArrivedFn,
  markNotificationsReadFn,
  missionStepFn,
  moveStockFn,
  placeOrderFn,
  reassignMissionFn,
  removeProductFn,
  reportReceptionFn,
  saveProductFn,
  setOrderStatusFn,
  uploadProductPhotoFn,
  uploadProofFn,
  withdrawMissionFn,
} from "@/lib/market/functions";
import type { Product, StockMovement } from "./mocks";
import type { OrderActor } from "@/lib/order-lifecycle";
import { requireRole } from "@/lib/auth/functions";
import { clearBusinessDemoData } from "./business";
import { clearDisputesDemoData } from "./disputes";
import { clearFinanceDemoData } from "./finance";
import { clearSupportDemoData } from "./support";

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
  }
  replaceMarketData(snap);
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
  async placeOrder(
    req: PlaceOrderRequest,
  ): Promise<Result<{ orders: { id: string; reference: string }[] }>> {
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

  async missionStep(missionId: string, status: MissionStatus, code?: string): Promise<Result> {
    if (isMarketRemote()) {
      if (status !== "pickup" && status !== "loaded" && status !== "delivered") {
        return { ok: false, message: "Étape inconnue." };
      }
      return remote(() => missionStepFn({ data: { missionId, status, code } }));
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
