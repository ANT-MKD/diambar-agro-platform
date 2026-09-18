import { useSyncExternalStore } from "react";
import { creditActions, type DisputeAttachment } from "@/data/disputes";
import { driverWalletActions } from "@/data/store";

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
};

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
  accept: (id: string, awardedAmount: number, note?: string) => {
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
                  actor: "Mamadou Diallo",
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
        requester: r.restaurantName,
        amount: awardedAmount,
        method: "Wave",
        reason: `Retour ${r.reference} — ${RETURN_REASON_LABEL[r.reason]}`,
      });
    }
  },
  refuse: (id: string, note: string) => {
    returnsStore.set((arr) =>
      arr.map((x) =>
        x.id === id
          ? {
              ...x,
              status: "refused",
              decidedAt: now(),
              decisionNote: note,
              history: [
                ...x.history,
                { at: now(), actor: "Mamadou Diallo", text: `Retour refusé — ${note}` },
              ],
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

export type Incident = {
  id: string;
  reference: string;
  missionRef: string;
  type: IncidentType;
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
    missionRef: "MIS-4203",
    type: "client_absent",
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
    missionRef: "MIS-4198",
    type: "breakdown",
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
  create: (input: Omit<Incident, "id" | "reference" | "status" | "createdAt" | "history">) => {
    const item: Incident = {
      ...input,
      id: uid("in"),
      reference: `INC-${703 + incidentsStore.get().length}`,
      status: "open",
      createdAt: now(),
      history: [{ at: now(), actor: "Oumar Ba", text: "Incident signalé" }],
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
      driverWalletActions.credit(`Indemnité incident ${incident.reference}`, awarded, "adjustment");
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

/* ------------------------------------------------------------------ */
/* Remboursements — espace admin                                       */
/* ------------------------------------------------------------------ */

export type RefundSource = "return" | "dispute" | "incident" | "manual";
export type RefundStatus = "pending" | "approved" | "rejected" | "paid";

export const REFUND_SOURCE_LABEL: Record<RefundSource, string> = {
  return: "Retour produit",
  dispute: "Litige",
  incident: "Incident de course",
  manual: "Geste commercial",
};

export const REFUND_STATUS_LABEL: Record<RefundStatus, string> = {
  pending: "À valider",
  approved: "Approuvé",
  rejected: "Rejeté",
  paid: "Remboursé",
};

export type Refund = {
  id: string;
  reference: string;
  source: RefundSource;
  orderRef: string;
  requester: string;
  amount: number;
  method: "Wave" | "Orange Money" | "Free Money" | "Virement";
  reason: string;
  status: RefundStatus;
  createdAt: string;
  decidedAt?: string;
  note?: string;
};

const seedRefunds: Refund[] = [
  {
    id: "rf1",
    reference: "RMB-5031",
    source: "dispute",
    orderRef: "CMD-2851",
    requester: "Le Baobab",
    amount: 6800,
    method: "Wave",
    reason: "Litige qualité — tomates non conformes",
    status: "pending",
    createdAt: "2025-05-15T12:40:00Z",
  },
  {
    id: "rf2",
    reference: "RMB-5030",
    source: "return",
    orderRef: "CMD-2847",
    requester: "Chez Aminata",
    amount: 2250,
    method: "Orange Money",
    reason: "Retour RET-1041 — quantité manquante",
    status: "paid",
    createdAt: "2025-05-14T17:30:00Z",
    decidedAt: "2025-05-14T18:10:00Z",
    note: "Avoir converti en remboursement.",
  },
  {
    id: "rf3",
    reference: "RMB-5029",
    source: "incident",
    orderRef: "CMD-2840",
    requester: "Oumar Ba",
    amount: 1500,
    method: "Wave",
    reason: "Indemnité incident INC-701",
    status: "approved",
    createdAt: "2025-05-12T11:05:00Z",
    decidedAt: "2025-05-12T11:30:00Z",
  },
  {
    id: "rf4",
    reference: "RMB-5028",
    source: "manual",
    orderRef: "CMD-2832",
    requester: "Teranga Food",
    amount: 5000,
    method: "Virement",
    reason: "Geste commercial retard répété",
    status: "rejected",
    createdAt: "2025-05-10T09:00:00Z",
    decidedAt: "2025-05-10T15:00:00Z",
    note: "Retard non confirmé par le GPS.",
  },
];

const refundsStore = createStore<Refund[]>(seedRefunds, "diambar:refunds");

export function useRefunds() {
  return useSyncExternalStore(refundsStore.subscribe, refundsStore.get, refundsStore.get);
}

export const refundActions = {
  create: (input: Omit<Refund, "id" | "reference" | "status" | "createdAt">) => {
    const item: Refund = {
      ...input,
      id: uid("rf"),
      reference: `RMB-${5032 + refundsStore.get().length}`,
      status: "pending",
      createdAt: now(),
    };
    refundsStore.set((arr) => [item, ...arr]);
    return item;
  },
  approve: (id: string, note?: string) => {
    refundsStore.set((arr) =>
      arr.map((r) => (r.id === id ? { ...r, status: "approved", decidedAt: now(), note } : r)),
    );
  },
  reject: (id: string, note: string) => {
    refundsStore.set((arr) =>
      arr.map((r) => (r.id === id ? { ...r, status: "rejected", decidedAt: now(), note } : r)),
    );
  },
  markPaid: (id: string) => {
    refundsStore.set((arr) =>
      arr.map((r) => (r.id === id ? { ...r, status: "paid", decidedAt: now() } : r)),
    );
  },
};
