import { useSyncExternalStore } from "react";
import { creditActions, disputeActions, type DisputeAttachment } from "@/data/disputes";
import { driverWalletActions } from "@/data/store";
import {
  refundActions,
  refundForReturn,
  REFUND_BORN_BY_LABEL,
  type RefundBornBy,
} from "@/data/finance";
import { orders, farmers } from "@/data/mocks";

/** Producteur réel concerné par un retour — dérivé de la commande d'origine
 * (Order.farmerId), jamais stocké sur ReturnRequest pour éviter une source
 * de vérité dupliquée avec la commande. */
export function farmerForReturn(r: { orderRef: string }) {
  const order = orders.find((o) => o.reference === r.orderRef);
  return order ? farmers.find((f) => f.id === order.farmerId) : undefined;
}

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

const now = () => new Date().toISOString();
const uid = (p: string) => `${p}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

/* ------------------------------------------------------------------ */
/* Retours & avoirs — espace agriculteur                               */
/* ------------------------------------------------------------------ */

export type ReturnReason = "quality" | "quantity" | "wrong_item" | "damaged" | "late" | "other";
export type ReturnStatus = "pending" | "accepted" | "refused" | "credited";

export const RETURN_REASON_LABEL: Record<ReturnReason, string> = {
  quality: "Qualité non conforme",
  quantity: "Quantité manquante",
  wrong_item: "Produit erroné",
  damaged: "Marchandise abîmée",
  late: "Livraison trop tardive",
  other: "Autre motif",
};

export const RETURN_STATUS_LABEL: Record<ReturnStatus, string> = {
  pending: "À traiter",
  accepted: "Accepté",
  refused: "Refusé",
  credited: "Avoir émis",
};

export type ReturnMessage = {
  id: string;
  at: string;
  authorRole: "restaurant" | "farmer";
  authorName: string;
  text: string;
};

// Récupération physique du produit par un livreur — champs additifs, ne
// remplacent pas `status` : l'agriculteur garde son parcours accepter/
// refuser/avoir tel quel, ceci n'est qu'une couche opérationnelle admin.
export type ReturnPickup = {
  driverId: string;
  driverName: string;
  scheduledFor: string;
  address: string;
  status: "scheduled" | "picked_up" | "received";
  scheduledAt: string;
  pickedUpAt?: string;
  receivedAt?: string;
  receivedCondition?: string;
};

export type ReturnInspection = {
  conform: boolean;
  note: string;
  inspectedBy: string;
  inspectedAt: string;
};

export type ReturnResolutionType = "refund" | "exchange" | "goodwill" | "reject";

export const RETURN_RESOLUTION_LABEL: Record<ReturnResolutionType, string> = {
  refund: "Remboursement",
  exchange: "Échange produit",
  goodwill: "Geste commercial",
  reject: "Refus",
};

// Décision motivée de l'admin, distincte du simple accept()/refuse() de
// l'agriculteur : détermine qui supporte réellement le coût au lieu du
// "farmer" fixe utilisé par le parcours agriculteur d'origine.
export type ReturnResolution = {
  type: ReturnResolutionType;
  bornBy: RefundBornBy;
  note: string;
  decidedBy: string;
  decidedAt: string;
};

export type ReturnRequest = {
  id: string;
  reference: string;
  orderRef: string;
  orderId?: string;
  restaurantId: string;
  restaurantName: string;
  productId?: string;
  productName: string;
  qty: number;
  unit: string;
  reason: ReturnReason;
  description: string;
  requestedAmount: number;
  awardedAmount?: number;
  status: ReturnStatus;
  createdAt: string;
  decidedAt?: string;
  decisionNote?: string;
  creditNoteRef?: string;
  photos?: DisputeAttachment[];
  messages: ReturnMessage[];
  history: { at: string; actor: string; text: string }[];
  pickup?: ReturnPickup;
  inspection?: ReturnInspection;
  resolution?: ReturnResolution;
  escalatedDisputeId?: string;
  closedAt?: string;
};

// Étape opérationnelle affichée (stepper) — dérivée des champs ci-dessus,
// jamais stockée : évite un second état qui pourrait diverger de `status`.
export type ReturnStage =
  | "pending"
  | "refused"
  | "awaiting_pickup"
  | "in_pickup"
  | "received"
  | "inspected"
  | "resolved"
  | "credited"
  | "closed";

export const RETURN_STAGE_LABEL: Record<ReturnStage, string> = {
  pending: "Demande",
  refused: "Refusé",
  awaiting_pickup: "À organiser",
  in_pickup: "En récupération",
  received: "À inspecter",
  inspected: "Inspecté — décision attendue",
  resolved: "Décidé",
  credited: "Avoir émis",
  closed: "Clôturé",
};

export function returnStage(r: ReturnRequest): ReturnStage {
  if (r.closedAt) return "closed";
  if (r.status === "refused") return "refused";
  if (r.status === "credited") return "credited";
  if (r.resolution) return "resolved";
  if (r.inspection) return "inspected";
  if (r.pickup?.receivedAt) return "received";
  if (r.pickup) return "in_pickup";
  if (r.status === "accepted") return "awaiting_pickup";
  return "pending";
}

const seedReturns: ReturnRequest[] = [
  {
    id: "rt1",
    reference: "RET-1042",
    orderRef: "CMD-2851",
    restaurantId: "r1",
    restaurantName: "Le Baobab",
    productId: "p1",
    productName: "Tomates fraîches",
    qty: 8,
    unit: "kg",
    reason: "quality",
    description: "8 kg de tomates trop mûres à la réception, non utilisables en cuisine.",
    requestedAmount: 6800,
    status: "pending",
    createdAt: "2025-05-15T12:10:00Z",
    photos: [
      {
        id: "rtp1",
        name: "photo-reception.jpg",
        size: 214000,
        mime: "image/jpeg",
        kind: "photo",
        dataUrl: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400",
        by: "Le Baobab",
        at: "2025-05-15T12:10:00Z",
      },
    ],
    messages: [],
    history: [
      { at: "2025-05-15T12:10:00Z", actor: "Le Baobab", text: "Demande de retour ouverte" },
    ],
  },
  {
    id: "rt2",
    reference: "RET-1041",
    orderRef: "CMD-2847",
    restaurantId: "r2",
    restaurantName: "Chez Aminata",
    productId: "p2",
    productName: "Oignons rouges",
    qty: 5,
    unit: "kg",
    reason: "quantity",
    description: "5 kg manquants sur les 30 kg commandés.",
    requestedAmount: 2250,
    awardedAmount: 2250,
    status: "credited",
    createdAt: "2025-05-14T15:00:00Z",
    decidedAt: "2025-05-14T17:20:00Z",
    decisionNote: "Écart confirmé sur le bon de pesée.",
    creditNoteRef: "AV-2214",
    messages: [],
    history: [
      { at: "2025-05-14T15:00:00Z", actor: "Chez Aminata", text: "Demande de retour ouverte" },
      {
        at: "2025-05-14T17:20:00Z",
        actor: "Mamadou Diallo",
        text: "Avoir AV-2214 émis (2 250 FCFA)",
      },
    ],
  },
  {
    id: "rt3",
    reference: "RET-1040",
    orderRef: "CMD-2848",
    restaurantId: "r3",
    restaurantName: "Restaurant Téranga",
    productId: "p3",
    productName: "Poulet fermier",
    qty: 2,
    unit: "kg",
    reason: "late",
    description: "Livraison avec 4h de retard, service du midi manqué.",
    requestedAmount: 6400,
    status: "refused",
    createdAt: "2025-05-13T09:30:00Z",
    photos: [
      {
        id: "rtp2",
        name: "photo-livraison.jpg",
        size: 198000,
        mime: "image/jpeg",
        kind: "photo",
        dataUrl: "https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=400",
        by: "Restaurant Téranga",
        at: "2025-05-13T09:30:00Z",
      },
    ],
    decidedAt: "2025-05-13T18:00:00Z",
    decisionNote: "Retard imputable au transporteur, dossier basculé en litige livreur.",
    messages: [],
    history: [
      {
        at: "2025-05-13T09:30:00Z",
        actor: "Restaurant Téranga",
        text: "Demande de retour ouverte",
      },
      {
        at: "2025-05-13T18:00:00Z",
        actor: "Mamadou Diallo",
        text: "Refusé — responsabilité transporteur",
      },
    ],
  },
];

const returnsStore = createStore<ReturnRequest[]>(seedReturns, "diambar:returns");

export function useReturns() {
  return useSyncExternalStore(returnsStore.subscribe, returnsStore.get, returnsStore.get);
}
export function useReturn(id: string) {
  return useReturns().find((r) => r.id === id) ?? null;
}
/** Retours du seul restaurant connecté — sans ce filtre, un restaurant
 * voyait les demandes de retour de tous les autres restaurants. */
export function useReturnsForRestaurant(restaurantId: string) {
  return useReturns().filter((r) => r.restaurantId === restaurantId);
}

export const returnActions = {
  create: (
    input: Omit<
      ReturnRequest,
      "id" | "reference" | "status" | "createdAt" | "history" | "messages"
    >,
  ) => {
    const item: ReturnRequest = {
      ...input,
      id: uid("rt"),
      reference: `RET-${1043 + returnsStore.get().length}`,
      status: "pending",
      createdAt: now(),
      messages: [],
      history: [{ at: now(), actor: input.restaurantName, text: "Demande de retour ouverte" }],
    };
    returnsStore.set((arr) => [item, ...arr]);
    return item;
  },
  reply: (id: string, msg: { role: "restaurant" | "farmer"; name: string; text: string }) => {
    returnsStore.set((arr) =>
      arr.map((x) =>
        x.id === id
          ? {
              ...x,
              messages: [
                ...x.messages,
                {
                  id: uid("rtm"),
                  at: now(),
                  authorRole: msg.role,
                  authorName: msg.name,
                  text: msg.text,
                },
              ],
            }
          : x,
      ),
    );
  },
  addPhotos: (id: string, files: DisputeAttachment[]) => {
    returnsStore.set((arr) =>
      arr.map((x) => (x.id === id ? { ...x, photos: [...(x.photos ?? []), ...files] } : x)),
    );
  },
  accept: (id: string, awardedAmount: number, note?: string, actor = "Mamadou Diallo") => {
    const r = returnsStore.get().find((x) => x.id === id);
    returnsStore.set((arr) =>
      arr.map((x) =>
        x.id === id
          ? {
              ...x,
              status: "accepted",
              awardedAmount,
              decidedAt: now(),
              decisionNote: note,
              history: [
                ...x.history,
                {
                  at: now(),
                  actor,
                  text: `Retour accepté — ${awardedAmount} FCFA`,
                },
              ],
            }
          : x,
      ),
    );
    if (r) {
      refundActions.create({
        source: "return",
        orderRef: r.orderRef,
        returnId: r.id,
        bornBy: "farmer",
        requester: r.restaurantName,
        amount: awardedAmount,
        method: "Wave",
        reason: `Retour ${r.reference} — ${RETURN_REASON_LABEL[r.reason]}`,
      });
    }
  },
  refuse: (id: string, note: string, actor = "Mamadou Diallo") => {
    returnsStore.set((arr) =>
      arr.map((x) =>
        x.id === id
          ? {
              ...x,
              status: "refused",
              decidedAt: now(),
              decisionNote: note,
              history: [...x.history, { at: now(), actor, text: `Retour refusé — ${note}` }],
            }
          : x,
      ),
    );
  },
  /* ---------------------------------------------------------------- */
  /* Couche opérationnelle admin — récupération, inspection, décision  */
  /* motivée. Additive : ne modifie jamais `status` en dehors des       */
  /* transitions déjà gérées ci-dessus (accept/refuse/issueCredit).     */
  /* ---------------------------------------------------------------- */
  adminSchedulePickup: (
    id: string,
    input: { driverId: string; driverName: string; scheduledFor: string; address: string },
  ) => {
    const at = now();
    returnsStore.set((arr) =>
      arr.map((x) =>
        x.id === id
          ? {
              ...x,
              pickup: {
                driverId: input.driverId,
                driverName: input.driverName,
                scheduledFor: input.scheduledFor,
                address: input.address,
                status: "scheduled",
                scheduledAt: at,
              },
              history: [
                ...x.history,
                {
                  at,
                  actor: "Admin Diambar",
                  text: `Récupération programmée — ${input.driverName}, ${new Date(input.scheduledFor).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}`,
                },
              ],
            }
          : x,
      ),
    );
  },
  adminMarkPickedUp: (id: string) => {
    const at = now();
    returnsStore.set((arr) =>
      arr.map((x) =>
        x.id === id && x.pickup
          ? {
              ...x,
              pickup: { ...x.pickup, status: "picked_up", pickedUpAt: at },
              history: [
                ...x.history,
                { at, actor: x.pickup.driverName, text: "Produit récupéré chez le client" },
              ],
            }
          : x,
      ),
    );
  },
  adminMarkReceived: (id: string, condition: string) => {
    const at = now();
    returnsStore.set((arr) =>
      arr.map((x) =>
        x.id === id && x.pickup
          ? {
              ...x,
              pickup: {
                ...x.pickup,
                status: "received",
                receivedAt: at,
                receivedCondition: condition,
              },
              history: [
                ...x.history,
                { at, actor: "Admin Diambar", text: `Produit réceptionné — état : ${condition}` },
              ],
            }
          : x,
      ),
    );
  },
  adminSetInspection: (
    id: string,
    input: { conform: boolean; note: string; inspectedBy?: string },
  ) => {
    const at = now();
    const inspectedBy = input.inspectedBy ?? "Admin Diambar";
    returnsStore.set((arr) =>
      arr.map((x) =>
        x.id === id
          ? {
              ...x,
              inspection: {
                conform: input.conform,
                note: input.note,
                inspectedBy,
                inspectedAt: at,
              },
              history: [
                ...x.history,
                {
                  at,
                  actor: inspectedBy,
                  text: `Inspection : ${input.conform ? "conforme au signalement" : "non conforme au signalement"} — ${input.note}`,
                },
              ],
            }
          : x,
      ),
    );
  },
  /** Décision motivée de l'admin : détermine qui paie (au lieu du
   * "farmer" fixe d'accept()) et couvre remboursement/échange/geste/refus. */
  adminResolve: (
    id: string,
    input: {
      type: ReturnResolutionType;
      bornBy: RefundBornBy;
      amount?: number;
      note: string;
      decidedBy?: string;
    },
  ) => {
    const r = returnsStore.get().find((x) => x.id === id);
    if (!r) return;
    const decidedBy = input.decidedBy ?? "Admin Diambar";
    const at = now();
    const amount = input.amount ?? r.awardedAmount ?? r.requestedAmount;
    const resolution: ReturnResolution = {
      type: input.type,
      bornBy: input.bornBy,
      note: input.note,
      decidedBy,
      decidedAt: at,
    };

    if (input.type === "reject") {
      returnsStore.set((arr) =>
        arr.map((x) =>
          x.id === id
            ? {
                ...x,
                status: "refused",
                decidedAt: at,
                decisionNote: input.note,
                resolution,
                history: [
                  ...x.history,
                  { at, actor: decidedBy, text: `Retour refusé (décision admin) — ${input.note}` },
                ],
              }
            : x,
        ),
      );
      return;
    }

    const existingRefund = refundForReturn(id);
    if (input.type === "exchange") {
      if (
        existingRefund &&
        (existingRefund.status === "pending" || existingRefund.status === "approved")
      ) {
        refundActions.reject(existingRefund.id, "Converti en échange produit");
      }
    } else if (existingRefund) {
      refundActions.setBornBy(existingRefund.id, input.bornBy, input.note);
    } else {
      refundActions.create(
        {
          source: "return",
          orderRef: r.orderRef,
          returnId: r.id,
          bornBy: input.bornBy,
          requester: r.restaurantName,
          amount,
          method: "Wave",
          reason: `Retour ${r.reference} — décision admin (${input.note})`,
        },
        "approved",
      );
    }

    returnsStore.set((arr) =>
      arr.map((x) =>
        x.id === id
          ? {
              ...x,
              status: "accepted",
              awardedAmount: x.awardedAmount ?? amount,
              decidedAt: at,
              decisionNote: input.note,
              resolution,
              history: [
                ...x.history,
                {
                  at,
                  actor: decidedBy,
                  text: `Décision admin — ${RETURN_RESOLUTION_LABEL[input.type]} (${amount.toLocaleString("fr-FR")} FCFA, à la charge de ${REFUND_BORN_BY_LABEL[input.bornBy]})`,
                },
              ],
            }
          : x,
      ),
    );
  },
  adminEscalateToDispute: (id: string, note: string) => {
    const r = returnsStore.get().find((x) => x.id === id);
    if (!r || r.escalatedDisputeId) return;
    const farmer = farmerForReturn(r);
    const disputeId = disputeActions.open({
      category: "quality",
      subcategory: "Retour litigieux",
      description: `Retour ${r.reference} escaladé en litige — ${note}`,
      orderRef: r.orderRef,
      orderId: r.orderId,
      returnId: r.id,
      openedByRole: "restaurant",
      openedByName: r.restaurantName,
      againstRole: "farmer",
      againstName: farmer?.name ?? "Producteur",
      claimedAmount: r.requestedAmount,
      priority: "medium",
    });
    returnsStore.set((arr) =>
      arr.map((x) =>
        x.id === id
          ? {
              ...x,
              escalatedDisputeId: disputeId,
              history: [
                ...x.history,
                { at: now(), actor: "Admin Diambar", text: `Escaladé en litige — ${note}` },
              ],
            }
          : x,
      ),
    );
  },
  adminClose: (id: string) => {
    const at = now();
    returnsStore.set((arr) =>
      arr.map((x) =>
        x.id === id
          ? {
              ...x,
              closedAt: at,
              history: [...x.history, { at, actor: "Admin Diambar", text: "Dossier clôturé" }],
            }
          : x,
      ),
    );
  },
  issueCredit: (id: string) => {
    const r = returnsStore.get().find((x) => x.id === id);
    if (!r) return;
    const amount = r.awardedAmount ?? r.requestedAmount;
    const { reference } = creditActions.issueForReturn(r.id, r.restaurantName, amount);
    returnsStore.set((arr) =>
      arr.map((x) =>
        x.id === id
          ? {
              ...x,
              status: "credited",
              creditNoteRef: reference,
              history: [
                ...x.history,
                {
                  at: now(),
                  actor: "Mamadou Diallo",
                  text: `Avoir ${reference} émis au restaurant (${amount} FCFA)`,
                },
              ],
            }
          : x,
      ),
    );
  },
};

/* ------------------------------------------------------------------ */
/* Notations post-livraison — espace restaurant                        */
/* ------------------------------------------------------------------ */

export type ReviewCriterion =
  "quality" | "quantity" | "freshness" | "timeliness" | "packaging" | "communication";

export const REVIEW_CRITERION_LABEL: Record<ReviewCriterion, string> = {
  quality: "Qualité des produits",
  quantity: "Respect des quantités",
  freshness: "Fraîcheur",
  timeliness: "Respect des délais",
  packaging: "Emballage",
  communication: "Communication",
};

export const REVIEW_TAGS = [
  "Produits frais",
  "Livraison rapide",
  "Bonne communication",
  "Quantité conforme",
  "Bon emballage",
  "Bon rapport qualité/prix",
] as const;

export type Review = {
  id: string;
  restaurantId: string;
  orderRef: string;
  supplierId: string;
  supplierName: string;
  driverName?: string;
  quality: number; // 1..5
  quantity: number; // 1..5
  freshness: number; // 1..5
  timeliness: number; // 1..5
  packaging: number; // 1..5
  communication: number; // 1..5
  comment: string;
  tags?: string[];
  photos?: DisputeAttachment[];
  createdAt: string;
  reply?: { at: string; text: string };
};

const seedReviews: Review[] = [
  {
    id: "rv1",
    restaurantId: "r1",
    orderRef: "CMD-3049",
    supplierId: "f3",
    supplierName: "Niayes Ndoye",
    driverName: "Oumar Ba",
    quality: 5,
    quantity: 5,
    freshness: 5,
    timeliness: 4,
    packaging: 5,
    communication: 4,
    comment: "Manioc impeccable, livraison quasi à l'heure.",
    tags: ["Produits frais", "Bonne communication"],
    createdAt: "2025-05-14T16:00:00Z",
    reply: { at: "2025-05-14T18:30:00Z", text: "Merci beaucoup, à très vite !" },
  },
  {
    id: "rv2",
    restaurantId: "r2",
    orderRef: "CMD-3045",
    supplierId: "f1",
    supplierName: "Ferme Diallo",
    driverName: "Oumar Ba",
    quality: 4,
    quantity: 4,
    freshness: 4,
    timeliness: 5,
    packaging: 3,
    communication: 4,
    comment: "Très bons légumes, emballage à améliorer.",
    tags: ["Quantité conforme"],
    createdAt: "2025-05-12T10:00:00Z",
  },
];

const reviewsStore = createStore<Review[]>(seedReviews, "diambar:reviews");

export function useReviews() {
  return useSyncExternalStore(reviewsStore.subscribe, reviewsStore.get, reviewsStore.get);
}
/** Avis d'un seul restaurant — sans ce filtre, chaque restaurant voyait et
 * comptait les avis de tous les autres (fuite de données entre comptes). */
export function useReviewsForRestaurant(restaurantId: string) {
  return useReviews().filter((r) => r.restaurantId === restaurantId);
}

const REVIEW_CRITERIA: ReviewCriterion[] = [
  "quality",
  "quantity",
  "freshness",
  "timeliness",
  "packaging",
  "communication",
];

export function reviewScore(r: Review) {
  return REVIEW_CRITERIA.reduce((s, c) => s + r[c], 0) / REVIEW_CRITERIA.length;
}

function scoreBySupplier(reviews: Review[]) {
  const map = new Map<string, { name: string; count: number; avg: number }>();
  reviews.forEach((r) => {
    const prev = map.get(r.supplierId) ?? { name: r.supplierName, count: 0, avg: 0 };
    const count = prev.count + 1;
    map.set(r.supplierId, {
      name: r.supplierName,
      count,
      avg: (prev.avg * prev.count + reviewScore(r)) / count,
    });
  });
  return [...map.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.avg - a.avg);
}
/** Score d'un producteur agrégé sur tous les restaurants clients (utilisé
 * côté agriculteur : sa réputation ne dépend pas d'un seul restaurant). */
export function useSupplierScores() {
  return scoreBySupplier(useReviews());
}
/** Score par fournisseur pour UN restaurant donné (utilisé côté
 * restaurant : ses propres avis seulement). */
export function useSupplierScoresForRestaurant(restaurantId: string) {
  return scoreBySupplier(useReviewsForRestaurant(restaurantId));
}

export const reviewActions = {
  create: (input: Omit<Review, "id" | "createdAt">) => {
    reviewsStore.set((arr) => [{ ...input, id: uid("rv"), createdAt: now() }, ...arr]);
  },
  reply: (id: string, text: string) => {
    reviewsStore.set((arr) =>
      arr.map((r) => (r.id === id ? { ...r, reply: { at: now(), text } } : r)),
    );
  },
  remove: (id: string) => reviewsStore.set((arr) => arr.filter((r) => r.id !== id)),
};

/* ------------------------------------------------------------------ */
/* Incidents de course — espace livreur                                */
/* ------------------------------------------------------------------ */

export type IncidentType =
  "client_absent" | "refused" | "breakdown" | "accident" | "traffic" | "address" | "other";
export type IncidentStatus = "open" | "escalated" | "resolved";
export type IncidentSeverity = "low" | "medium" | "high" | "critical";

export const INCIDENT_TYPE_LABEL: Record<IncidentType, string> = {
  client_absent: "Client absent",
  refused: "Colis refusé",
  breakdown: "Panne véhicule",
  accident: "Accident / dommage",
  traffic: "Blocage circulation",
  address: "Adresse introuvable",
  other: "Autre",
};

export const INCIDENT_STATUS_LABEL: Record<IncidentStatus, string> = {
  open: "Ouvert",
  escalated: "Escaladé au support",
  resolved: "Résolu",
};

export const INCIDENT_SEVERITY_LABEL: Record<IncidentSeverity, string> = {
  low: "Faible",
  medium: "Moyenne",
  high: "Haute",
  critical: "Critique",
};

// Gravité déterminée par le type d'incident au moment de la création (règle
// fixe, pas une valeur libre) : un accident ou une panne bloque réellement
// la livraison, un blocage circulation ou un problème d'adresse se résout
// souvent sans intervention lourde.
export const INCIDENT_TYPE_SEVERITY: Record<IncidentType, IncidentSeverity> = {
  accident: "critical",
  breakdown: "high",
  client_absent: "medium",
  refused: "medium",
  address: "low",
  traffic: "low",
  other: "medium",
};

export type Incident = {
  id: string;
  reference: string;
  missionRef: string;
  type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  waitedMinutes: number;
  compensationRequested: number;
  compensationAwarded?: number;
  resolutionNote?: string;
  status: IncidentStatus;
  createdAt: string;
  history: { at: string; actor: string; text: string }[];
  photos?: DisputeAttachment[];
};

const seedIncidents: Incident[] = [
  {
    id: "in1",
    reference: "INC-702",
    missionRef: "MIS-4180",
    type: "client_absent",
    severity: "medium",
    description: "Restaurant fermé à l'arrivée, 35 min d'attente sans réponse au téléphone.",
    waitedMinutes: 35,
    compensationRequested: 2000,
    status: "escalated",
    createdAt: "2025-05-14T13:20:00Z",
    history: [
      { at: "2025-05-14T13:20:00Z", actor: "Oumar Ba", text: "Incident signalé" },
      {
        at: "2025-05-14T14:00:00Z",
        actor: "Support Diambar",
        text: "Escaladé — vérification auprès du restaurant",
      },
    ],
  },
  {
    id: "in2",
    reference: "INC-701",
    missionRef: "MIS-4175",
    type: "breakdown",
    severity: "high",
    description: "Crevaison sur la VDN, mission reprise par un autre livreur.",
    waitedMinutes: 50,
    compensationRequested: 3000,
    compensationAwarded: 1500,
    status: "resolved",
    createdAt: "2025-05-12T08:40:00Z",
    history: [
      { at: "2025-05-12T08:40:00Z", actor: "Oumar Ba", text: "Incident signalé" },
      {
        at: "2025-05-12T11:00:00Z",
        actor: "Support Diambar",
        text: "Indemnité de 1 500 FCFA accordée",
      },
    ],
  },
];

const incidentsStore = createStore<Incident[]>(seedIncidents, "diambar:incidents");

export function useIncidents() {
  return useSyncExternalStore(incidentsStore.subscribe, incidentsStore.get, incidentsStore.get);
}

export const incidentActions = {
  create: (
    input: Omit<Incident, "id" | "reference" | "status" | "createdAt" | "history" | "severity">,
    reportedBy = "Oumar Ba",
  ) => {
    const item: Incident = {
      ...input,
      id: uid("in"),
      reference: `INC-${703 + incidentsStore.get().length}`,
      severity: INCIDENT_TYPE_SEVERITY[input.type],
      status: "open",
      createdAt: now(),
      history: [{ at: now(), actor: reportedBy, text: "Incident signalé" }],
    };
    incidentsStore.set((arr) => [item, ...arr]);
    return item;
  },
  escalate: (id: string) => {
    incidentsStore.set((arr) =>
      arr.map((i) =>
        i.id === id
          ? {
              ...i,
              status: "escalated",
              history: [
                ...i.history,
                { at: now(), actor: "Oumar Ba", text: "Escaladé au support" },
              ],
            }
          : i,
      ),
    );
  },
  resolve: (id: string, awarded: number, note?: string) => {
    const incident = incidentsStore.get().find((i) => i.id === id);
    incidentsStore.set((arr) =>
      arr.map((i) =>
        i.id === id
          ? {
              ...i,
              status: "resolved",
              compensationAwarded: awarded,
              resolutionNote: note,
              history: [
                ...i.history,
                {
                  at: now(),
                  actor: "Support Diambar",
                  text:
                    awarded > 0
                      ? `Clôturé — indemnité ${awarded} FCFA accordée${note ? ` (${note})` : ""}`
                      : `Clôturé — indemnité refusée${note ? ` (${note})` : ""}`,
                },
              ],
            }
          : i,
      ),
    );
    if (incident && awarded > 0) {
      driverWalletActions.credit(
        `Indemnité incident ${incident.reference}`,
        awarded,
        "adjustment",
        incident.reference,
      );
    }
  },
  addComment: (id: string, text: string) => {
    incidentsStore.set((arr) =>
      arr.map((i) =>
        i.id === id ? { ...i, history: [...i.history, { at: now(), actor: "Oumar Ba", text }] } : i,
      ),
    );
  },
};

// Le modèle Refund (remboursements) vit désormais dans @/data/finance —
// litiges et incidents doivent aussi pouvoir créer un vrai remboursement
// sans provoquer d'import circulaire avec business.ts/disputes.ts.
