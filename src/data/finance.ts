import { useSyncExternalStore } from "react";

/* ------------------------------------------------------------------ */
/* Remboursements — centre de résolution financière (espace admin)     */
/*                                                                      */
/* Module isolé (aucune dépendance vers business.ts/disputes.ts) pour   */
/* que litiges, incidents et retours puissent tous créer un vrai        */
/* Refund sans provoquer d'import circulaire.                           */
/* ------------------------------------------------------------------ */

export type RefundSource = "return" | "dispute" | "incident" | "manual";
export type RefundStatus = "pending" | "approved" | "rejected" | "paid" | "failed";
export type RefundMethod = "Wave" | "Orange Money" | "Free Money" | "Virement";
// Qui supporte réellement le coût une fois le remboursement exécuté :
// "farmer" → déduit de ses revenus (produit en cause) ; "driver" → déjà
// débité de son wallet ailleurs (litige responsabilité livreur), gardé ici
// pour affichage seulement ; "platform" → aucune autre partie ne rembourse
// Diambar Agro, donc c'est une vraie charge plateforme.
export type RefundBornBy = "farmer" | "driver" | "platform";

export const REFUND_BORN_BY_LABEL: Record<RefundBornBy, string> = {
  farmer: "Producteur",
  driver: "Livreur",
  platform: "Plateforme (Diambar Agro)",
};

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
  failed: "Échec",
};

export type RefundEvent = { at: string; actor: string; text: string };

export type Refund = {
  id: string;
  reference: string;
  source: RefundSource;
  orderRef: string;
  // Clés réelles vers le dossier d'origine — sans elles, "Éléments liés"
  // ne serait qu'une correspondance approximative par référence texte.
  disputeId?: string;
  incidentId?: string;
  returnId?: string;
  // Absent sur les anciens dossiers de démo (seed) : traité comme "platform"
  // par défaut partout où c'est lu, plutôt que de silencieusement l'ignorer.
  bornBy?: RefundBornBy;
  requester: string;
  amount: number;
  method: RefundMethod;
  reason: string;
  status: RefundStatus;
  createdAt: string;
  decidedAt?: string;
  note?: string;
  attemptCount: number;
  failureReason?: string;
  history: RefundEvent[];
  // Identité réelle de l'admin à chaque étape sensible — absent quand
  // l'étape n'a pas été faite par un admin identifié (ex. dossier créé
  // automatiquement depuis un litige/retour/incident : createdBy reste
  // vide, ce n'est pas un geste commercial saisi à la main). Sert à
  // empêcher qu'un même admin crée, approuve ET exécute le même dossier.
  createdBy?: string;
  approvedBy?: string;
};

const seedRefunds: Refund[] = [
  {
    id: "rf1",
    reference: "RMB-5031",
    source: "dispute",
    orderRef: "CMD-2851",
    bornBy: "farmer",
    requester: "Le Baobab",
    amount: 6800,
    method: "Wave",
    reason: "Litige qualité — tomates non conformes",
    status: "pending",
    createdAt: "2025-05-15T12:40:00Z",
    attemptCount: 0,
    history: [{ at: "2025-05-15T12:40:00Z", actor: "Le Baobab", text: "Dossier créé" }],
  },
  {
    id: "rf2",
    reference: "RMB-5030",
    source: "return",
    orderRef: "CMD-2847",
    bornBy: "farmer",
    requester: "Chez Aminata",
    amount: 2250,
    method: "Orange Money",
    reason: "Retour RET-1041 — quantité manquante",
    status: "paid",
    createdAt: "2025-05-14T17:30:00Z",
    decidedAt: "2025-05-14T18:10:00Z",
    note: "Avoir converti en remboursement.",
    attemptCount: 1,
    history: [
      { at: "2025-05-14T17:30:00Z", actor: "Chez Aminata", text: "Dossier créé" },
      { at: "2025-05-14T17:50:00Z", actor: "Admin Diambar", text: "Remboursement approuvé" },
      { at: "2025-05-14T18:10:00Z", actor: "Admin Diambar", text: "Paiement confirmé" },
    ],
  },
  {
    id: "rf3",
    reference: "RMB-5029",
    source: "incident",
    orderRef: "CMD-2840",
    bornBy: "platform",
    requester: "Oumar Ba",
    amount: 1500,
    method: "Wave",
    reason: "Indemnité incident INC-701",
    status: "approved",
    createdAt: "2025-05-12T11:05:00Z",
    decidedAt: "2025-05-12T11:30:00Z",
    attemptCount: 0,
    history: [
      { at: "2025-05-12T11:05:00Z", actor: "Admin Diambar", text: "Dossier créé" },
      { at: "2025-05-12T11:30:00Z", actor: "Admin Diambar", text: "Remboursement approuvé" },
    ],
  },
  {
    id: "rf4",
    reference: "RMB-5028",
    source: "manual",
    orderRef: "CMD-2832",
    bornBy: "platform",
    requester: "Teranga Food",
    amount: 5000,
    method: "Virement",
    reason: "Geste commercial retard répété",
    status: "rejected",
    createdAt: "2025-05-10T09:00:00Z",
    decidedAt: "2025-05-10T15:00:00Z",
    note: "Retard non confirmé par le GPS.",
    attemptCount: 0,
    history: [
      { at: "2025-05-10T09:00:00Z", actor: "Admin Diambar", text: "Dossier créé" },
      {
        at: "2025-05-10T15:00:00Z",
        actor: "Admin Diambar",
        text: "Rejeté — Retard non confirmé par le GPS.",
      },
    ],
  },
  {
    id: "rf5",
    reference: "RMB-5027",
    source: "return",
    orderRef: "CMD-2820",
    bornBy: "farmer",
    requester: "Restaurant Téranga",
    amount: 4200,
    method: "Wave",
    reason: "Retour RET-1038 — produit endommagé",
    status: "failed",
    createdAt: "2025-05-09T10:15:00Z",
    decidedAt: "2025-05-09T11:00:00Z",
    attemptCount: 1,
    failureReason: "Transaction Wave rejetée (numéro invalide)",
    history: [
      { at: "2025-05-09T10:15:00Z", actor: "Restaurant Téranga", text: "Dossier créé" },
      { at: "2025-05-09T11:00:00Z", actor: "Admin Diambar", text: "Remboursement approuvé" },
      {
        at: "2025-05-09T11:20:00Z",
        actor: "Système",
        text: "Échec — Transaction Wave rejetée (numéro invalide)",
      },
    ],
  },
];

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
  const listeners = new Set<() => void>();
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
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

const refundsStore = createStore<Refund[]>(seedRefunds, "diambar:refunds");

export function useRefunds() {
  return useSyncExternalStore(refundsStore.subscribe, refundsStore.get, refundsStore.get);
}
export function useRefund(id: string) {
  return useRefunds().find((r) => r.id === id) ?? null;
}
/** Accès non réactif (hors composant React) au remboursement lié à un
 * retour — utilisé par business.ts pour faire pointer la décision admin
 * d'un retour sur le bon dossier de remboursement, sans dupliquer l'état. */
export function refundForReturn(returnId: string) {
  return refundsStore.get().find((r) => r.returnId === returnId);
}

function nextRefundRef(arr: Refund[]) {
  const max = arr.reduce(
    (n, r) => Math.max(n, parseInt(r.reference.split("-")[1] ?? "0", 10) || 0),
    5030,
  );
  return `RMB-${max + 1}`;
}

/** Somme déjà remboursée (approuvée ou payée) sur une commande, avorté
 * ou échoué exclus — c'est le calcul qui alimente la protection anti
 * double-remboursement. */
export function refundedTotalForOrder(refunds: Refund[], orderRef: string, excludeId?: string) {
  return refunds
    .filter(
      (r) =>
        r.orderRef === orderRef &&
        r.id !== excludeId &&
        (r.status === "approved" || r.status === "paid"),
    )
    .reduce((s, r) => s + r.amount, 0);
}

export const refundActions = {
  create: (
    input: Omit<
      Refund,
      "id" | "reference" | "status" | "createdAt" | "attemptCount" | "history" | "createdBy"
    >,
    initialStatus: RefundStatus = "pending",
    actor?: string,
  ) => {
    const createdAt = new Date().toISOString();
    const item: Refund = {
      ...input,
      id: `rf_${Date.now()}`,
      reference: nextRefundRef(refundsStore.get()),
      status: initialStatus,
      createdAt,
      attemptCount: 0,
      // Un geste commercial saisi à la main par un admin a un créateur
      // identifié ; un dossier ouvert automatiquement depuis un
      // litige/retour/incident n'en a pas (personne à exclure ensuite).
      createdBy: actor,
      history: [
        { at: createdAt, actor: actor ?? input.requester, text: "Dossier créé" },
        ...(initialStatus === "approved"
          ? [{ at: createdAt, actor: actor ?? "Admin Diambar", text: "Remboursement approuvé" }]
          : []),
      ],
    };
    refundsStore.set((arr) => [item, ...arr]);
    return item;
  },
  approve: (id: string, actor: string, note?: string) => {
    const at = new Date().toISOString();
    refundsStore.set((arr) =>
      arr.map((r) =>
        r.id === id
          ? {
              ...r,
              status: "approved",
              decidedAt: at,
              note,
              approvedBy: actor,
              history: [
                ...r.history,
                {
                  at,
                  actor,
                  text: `Remboursement approuvé${note ? ` — ${note}` : ""}`,
                },
              ],
            }
          : r,
      ),
    );
  },
  reject: (id: string, actor: string, note: string) => {
    const at = new Date().toISOString();
    refundsStore.set((arr) =>
      arr.map((r) =>
        r.id === id
          ? {
              ...r,
              status: "rejected",
              decidedAt: at,
              note,
              history: [...r.history, { at, actor, text: `Rejeté — ${note}` }],
            }
          : r,
      ),
    );
  },
  markPaid: (id: string, actor: string) => {
    const at = new Date().toISOString();
    refundsStore.set((arr) =>
      arr.map((r) =>
        r.id === id
          ? {
              ...r,
              status: "paid",
              decidedAt: at,
              history: [...r.history, { at, actor, text: "Paiement confirmé" }],
            }
          : r,
      ),
    );
  },
  markFailed: (id: string, reason: string) => {
    const at = new Date().toISOString();
    refundsStore.set((arr) =>
      arr.map((r) =>
        r.id === id
          ? {
              ...r,
              status: "failed",
              failureReason: reason,
              attemptCount: r.attemptCount + 1,
              history: [...r.history, { at, actor: "Système", text: `Échec — ${reason}` }],
            }
          : r,
      ),
    );
  },
  /** Réattribue qui supporte le coût — utilisé quand une inspection admin
   * (retour) établit une responsabilité différente de celle retenue au
   * moment de la création du dossier. Bloqué une fois payé : l'argent a
   * déjà bougé, la charge réelle ne peut plus être réécrite. */
  setBornBy: (id: string, bornBy: RefundBornBy, note?: string) => {
    const at = new Date().toISOString();
    refundsStore.set((arr) =>
      arr.map((r) =>
        r.id === id && r.status !== "paid"
          ? {
              ...r,
              bornBy,
              history: [
                ...r.history,
                {
                  at,
                  actor: "Admin Diambar",
                  text: `Prise en charge révisée — ${REFUND_BORN_BY_LABEL[bornBy]}${note ? ` (${note})` : ""}`,
                },
              ],
            }
          : r,
      ),
    );
  },
  /** Nouvelle tentative après échec : repasse en "approved" pour permettre
   * un nouveau "Marquer comme remboursé", sans perdre l'historique. */
  retry: (id: string, method?: RefundMethod) => {
    const at = new Date().toISOString();
    refundsStore.set((arr) =>
      arr.map((r) =>
        r.id === id
          ? {
              ...r,
              status: "approved",
              method: method ?? r.method,
              history: [
                ...r.history,
                {
                  at,
                  actor: "Admin Diambar",
                  text: method
                    ? `Nouvelle tentative via ${method}`
                    : "Nouvelle tentative de remboursement",
                },
              ],
            }
          : r,
      ),
    );
  },
};
