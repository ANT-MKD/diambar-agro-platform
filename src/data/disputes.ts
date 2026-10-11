import { useSyncExternalStore } from "react";
import {
  driverNotifActions,
  driverWalletActions,
  farmerNotifActions,
  onRestaurantOrderCancelled,
  restaurantNotifActions,
} from "./store";
import { refundActions } from "./finance";
import { createStore } from "./persist";

export type DisputeParty = "restaurant" | "farmer" | "driver" | "platform";
export type DisputeStatus =
  "open" | "investigating" | "awaiting_response" | "resolved" | "rejected";
export type DisputeChannel = "app" | "whatsapp" | "email" | "phone";
export type DisputeOutcome = "refund" | "credit" | "partial" | "rejected" | "goodwill";

export type DisputeAttachment = {
  id: string;
  name: string;
  size: number;
  mime: string;
  kind: "photo" | "delivery_note" | "payment_proof" | "other";
  dataUrl?: string;
  at: string;
  by: string;
};

export type DisputeMessage = {
  id: string;
  at: string;
  authorRole: DisputeParty;
  authorName: string;
  text: string;
  internal: boolean;
  attachments?: DisputeAttachment[];
};

export type DisputeEvent = {
  id: string;
  at: string;
  actor: string;
  label: string;
  detail?: string;
};

export type DisputeDecision = {
  at: string;
  by: string;
  outcome: DisputeOutcome;
  reason: string;
  grantedAmount: number;
  debitedParty: DisputeParty;
};

export type Dispute = {
  id: string;
  reference: string;
  category: string;
  subcategory: string;
  description: string;
  orderRef: string;
  orderId?: string;
  invoiceId?: string;
  missionId?: string;
  returnId?: string;
  hasGpsTrack: boolean;
  openedByRole: DisputeParty;
  openedByName: string;
  againstRole: DisputeParty;
  againstName: string;
  claimedAmount: number;
  grantedAmount: number | null;
  liableParty: DisputeParty | null;
  status: DisputeStatus;
  priority: "low" | "medium" | "high";
  channel: DisputeChannel;
  openedAt: string;
  slaDueAt: string;
  escalations: number;
  assignee: string | null;
  attachments: DisputeAttachment[];
  messages: DisputeMessage[];
  events: DisputeEvent[];
  decision?: DisputeDecision;
};

export type CreditNote = {
  id: string;
  reference: string;
  source: "dispute" | "return";
  disputeId?: string;
  returnId?: string;
  beneficiaryRole: DisputeParty;
  beneficiaryName: string;
  amount: number;
  at: string;
  // Un avoir litige est un geste immédiat sans expiration ; un avoir retour
  // suit une vraie règle métier (90 jours), pour rester crédible.
  expiresAt?: string;
  status: "issued" | "applied";
  usedOnOrderRef?: string;
  // Montant d'origine quand l'avoir a déjà été utilisé en partie (`amount`
  // est alors le solde restant), et le détail de chaque utilisation.
  initialAmount?: number;
  usages?: { orderRef: string; amount: number; at: string }[];
};

export const DISPUTE_CATEGORIES: Record<string, { label: string; subs: string[] }> = {
  quality: {
    label: "Qualité produit",
    subs: [
      "Produit avarié",
      "Calibre non conforme",
      "Chaîne du froid rompue",
      "Étiquetage incorrect",
    ],
  },
  quantity: {
    label: "Quantité / colis",
    subs: ["Colis manquant", "Poids inférieur", "Article non livré", "Erreur de référence"],
  },
  delivery: {
    label: "Livraison",
    subs: [
      "Retard important",
      "Livraison non effectuée",
      "Client absent",
      "Colis refusé",
      "Adresse incorrecte",
    ],
  },
  payment: {
    label: "Paiement",
    subs: ["Double débit", "Paiement non reçu", "Montant incorrect", "Frais contestés"],
  },
  behaviour: {
    label: "Comportement",
    subs: ["Comportement inapproprié", "Non-respect des consignes", "Litige contractuel"],
  },
  other: { label: "Autre", subs: ["Autre motif"] },
};

export const SUPPORT_AGENTS = [
  "Fatou Ndiaye (support)",
  "Ibrahima Fall (support)",
  "Coumba Diop (litiges)",
];

const now = Date.now();
const iso = (hoursAgo: number) => new Date(now - hoursAgo * 3600_000).toISOString();

const seedDisputes: Dispute[] = [
  {
    id: "dp1",
    reference: "LIT-0142",
    category: "quality",
    subcategory: "Produit avarié",
    description:
      "8 kg de poulet fermier livrés avec un écart de fraîcheur constaté à la réception.",
    orderRef: "CMD-2848",
    hasGpsTrack: true,
    openedByRole: "restaurant",
    openedByName: "Le Baobab",
    againstRole: "farmer",
    againstName: "Coopérative Sow",
    claimedAmount: 25600,
    grantedAmount: null,
    liableParty: null,
    status: "awaiting_response",
    priority: "high",
    channel: "app",
    openedAt: iso(20),
    slaDueAt: iso(-28),
    escalations: 0,
    assignee: SUPPORT_AGENTS[0],
    attachments: [
      {
        id: "at1",
        name: "photo-reception.jpg",
        size: 482113,
        mime: "image/jpeg",
        kind: "photo",
        at: iso(20),
        by: "Le Baobab",
      },
    ],
    messages: [
      {
        id: "m1",
        at: iso(20),
        authorRole: "restaurant",
        authorName: "Le Baobab",
        text: "Produit reçu avec une odeur suspecte, photos jointes. Nous demandons un remboursement total.",
        internal: false,
      },
      {
        id: "m2",
        at: iso(18),
        authorRole: "platform",
        authorName: "Fatou Ndiaye (support)",
        text: "Dossier pris en charge, réponse du producteur attendue sous 48h.",
        internal: false,
      },
      {
        id: "m3",
        at: iso(17),
        authorRole: "platform",
        authorName: "Fatou Ndiaye (support)",
        text: "3e signalement qualité pour ce producteur ce mois-ci.",
        internal: true,
      },
    ],
    events: [
      {
        id: "e1",
        at: iso(20),
        actor: "Le Baobab",
        label: "Litige ouvert",
        detail: "Canal : application",
      },
      {
        id: "e2",
        at: iso(18),
        actor: "Support Diambar",
        label: "Assigné",
        detail: SUPPORT_AGENTS[0],
      },
      { id: "e3", at: iso(18), actor: "Support Diambar", label: "Statut : réponse attendue" },
    ],
  },
  {
    id: "dp2",
    reference: "LIT-0141",
    category: "delivery",
    subcategory: "Retard important",
    description: "Livraison arrivée 2h après le créneau confirmé, service du midi impacté.",
    orderRef: "CMD-2842",
    hasGpsTrack: true,
    openedByRole: "restaurant",
    openedByName: "Hôtel Téranga",
    againstRole: "driver",
    againstName: "Oumar Ba",
    claimedAmount: 32500,
    grantedAmount: null,
    liableParty: null,
    status: "investigating",
    priority: "medium",
    channel: "whatsapp",
    openedAt: iso(44),
    slaDueAt: iso(-4),
    escalations: 1,
    assignee: SUPPORT_AGENTS[1],
    attachments: [],
    messages: [
      {
        id: "m4",
        at: iso(44),
        authorRole: "restaurant",
        authorName: "Hôtel Téranga",
        text: "Retard de 2h non annoncé.",
        internal: false,
      },
      {
        id: "m5",
        at: iso(40),
        authorRole: "driver",
        authorName: "Oumar Ba",
        text: "Panne moto à Rufisque, j'ai prévenu par message le restaurant.",
        internal: false,
      },
    ],
    events: [
      {
        id: "e4",
        at: iso(44),
        actor: "Hôtel Téranga",
        label: "Litige ouvert",
        detail: "Canal : WhatsApp",
      },
      {
        id: "e5",
        at: iso(30),
        actor: "Système",
        label: "Escalade niveau 1",
        detail: "SLA de réponse dépassé",
      },
    ],
  },
  {
    id: "dp3",
    reference: "LIT-0140",
    category: "quantity",
    subcategory: "Colis manquant",
    description: "Un sac de 10 kg d'oignons manquant sur la commande.",
    orderRef: "CMD-2829",
    hasGpsTrack: false,
    openedByRole: "restaurant",
    openedByName: "Chez Aminata",
    againstRole: "farmer",
    againstName: "Ferme Diallo",
    claimedAmount: 4500,
    grantedAmount: 4500,
    liableParty: "farmer",
    status: "resolved",
    priority: "low",
    channel: "app",
    openedAt: iso(120),
    slaDueAt: iso(72),
    escalations: 0,
    assignee: SUPPORT_AGENTS[2],
    attachments: [],
    messages: [
      {
        id: "m6",
        at: iso(120),
        authorRole: "restaurant",
        authorName: "Chez Aminata",
        text: "Sac manquant au déchargement.",
        internal: false,
      },
    ],
    events: [
      { id: "e6", at: iso(120), actor: "Chez Aminata", label: "Litige ouvert" },
      {
        id: "e7",
        at: iso(110),
        actor: "Support Diambar",
        label: "Résolu",
        detail: "Avoir de 4 500 FCFA",
      },
    ],
    decision: {
      at: iso(110),
      by: SUPPORT_AGENTS[2],
      outcome: "credit",
      reason: "Manquant confirmé par le bon de livraison signé.",
      grantedAmount: 4500,
      debitedParty: "farmer",
    },
  },
  {
    id: "dp4",
    reference: "LIT-0139",
    category: "payment",
    subcategory: "Double débit",
    description: "Double débit Orange Money signalé par le restaurant.",
    orderRef: "CMD-2820",
    hasGpsTrack: false,
    openedByRole: "restaurant",
    openedByName: "Dibiterie Keur Massar",
    againstRole: "platform",
    againstName: "Plateforme Diambar",
    claimedAmount: 73000,
    grantedAmount: 0,
    liableParty: "platform",
    status: "rejected",
    priority: "medium",
    channel: "email",
    openedAt: iso(170),
    slaDueAt: iso(122),
    escalations: 0,
    assignee: SUPPORT_AGENTS[0],
    attachments: [],
    messages: [
      {
        id: "m7",
        at: iso(170),
        authorRole: "restaurant",
        authorName: "Dibiterie Keur Massar",
        text: "Deux débits de 73 000 FCFA constatés.",
        internal: false,
      },
    ],
    events: [
      { id: "e8", at: iso(170), actor: "Dibiterie Keur Massar", label: "Litige ouvert" },
      {
        id: "e9",
        at: iso(150),
        actor: "Support Diambar",
        label: "Rejeté",
        detail: "Un seul débit confirmé par l'opérateur",
      },
    ],
    decision: {
      at: iso(150),
      by: SUPPORT_AGENTS[0],
      outcome: "rejected",
      reason:
        "Relevé opérateur : un seul débit effectif, la seconde écriture est une pré-autorisation annulée.",
      grantedAmount: 0,
      debitedParty: "platform",
    },
  },
  {
    id: "dp5",
    reference: "LIT-0138",
    category: "delivery",
    subcategory: "Client absent",
    description: "Restaurant fermé à l'arrivée, 40 min d'attente puis retour à la ferme.",
    orderRef: "CMD-2844",
    missionId: "mi7",
    hasGpsTrack: true,
    openedByRole: "driver",
    openedByName: "Oumar Ba",
    againstRole: "restaurant",
    againstName: "Le Baobab",
    claimedAmount: 6000,
    grantedAmount: null,
    liableParty: null,
    status: "open",
    priority: "medium",
    channel: "app",
    openedAt: iso(6),
    slaDueAt: iso(-42),
    escalations: 0,
    assignee: null,
    attachments: [],
    messages: [
      {
        id: "m8",
        at: iso(6),
        authorRole: "driver",
        authorName: "Oumar Ba",
        text: "Personne sur place, appels sans réponse. Je demande l'indemnité de course à vide.",
        internal: false,
      },
    ],
    events: [{ id: "e10", at: iso(6), actor: "Oumar Ba", label: "Litige ouvert" }],
  },
  {
    id: "dp6",
    reference: "LIT-0137",
    category: "payment",
    subcategory: "Paiement non reçu",
    description: "Commande livrée et confirmée, versement non reçu après 7 jours.",
    orderRef: "CMD-2801",
    orderId: "o1",
    hasGpsTrack: false,
    openedByRole: "farmer",
    openedByName: "Coopérative Sow",
    againstRole: "platform",
    againstName: "Plateforme Diambar",
    claimedAmount: 128000,
    grantedAmount: null,
    liableParty: null,
    status: "investigating",
    priority: "high",
    channel: "phone",
    openedAt: iso(52),
    slaDueAt: iso(-20),
    escalations: 1,
    assignee: SUPPORT_AGENTS[1],
    attachments: [],
    messages: [
      {
        id: "m9",
        at: iso(52),
        authorRole: "farmer",
        authorName: "Coopérative Sow",
        text: "Aucun virement reçu sur Wave.",
        internal: false,
      },
    ],
    events: [{ id: "e11", at: iso(52), actor: "Coopérative Sow", label: "Litige ouvert" }],
  },
];

const seedCredits: CreditNote[] = [
  {
    id: "cn1",
    reference: "AV-0031",
    source: "dispute",
    disputeId: "dp3",
    beneficiaryRole: "restaurant",
    beneficiaryName: "Chez Aminata",
    amount: 4500,
    at: iso(110),
    status: "applied",
  },
];

const disputesStore = createStore<Dispute[]>(seedDisputes, "diambar:disputes");
const creditsStore = createStore<CreditNote[]>(seedCredits, "diambar:credit-notes");

export function useAllDisputes() {
  return useSyncExternalStore(disputesStore.subscribe, disputesStore.get, disputesStore.get);
}
export function useDisputeById(id: string) {
  return useAllDisputes().find((d) => d.id === id) ?? null;
}
/** Litiges visibles par un rôle : ceux qu'il a ouverts + ceux qui le mettent en cause. */
export function useDisputesForRole(role: DisputeParty) {
  return useAllDisputes().filter((d) => d.openedByRole === role || d.againstRole === role);
}
export function useCreditNotes() {
  return useSyncExternalStore(creditsStore.subscribe, creditsStore.get, creditsStore.get);
}
/** Avoirs d'un restaurant donné, litiges + retours confondus (un seul
 * registre réel plutôt que deux systèmes déconnectés). */
export function useCreditNotesForRestaurant(restaurantName: string) {
  return useCreditNotes().filter(
    (c) => c.beneficiaryRole === "restaurant" && c.beneficiaryName === restaurantName,
  );
}
export function isCreditExpired(c: CreditNote) {
  return !!c.expiresAt && new Date(c.expiresAt).getTime() < Date.now();
}
function nextCreditRef(arr: CreditNote[]) {
  const max = arr.reduce(
    (n, c) => Math.max(n, parseInt(c.reference.split("-")[1] ?? "0", 10) || 0),
    31,
  );
  return `AV-${String(max + 1).padStart(4, "0")}`;
}
export const creditActions = {
  /** Émet un vrai avoir suite à un retour accepté par le producteur — plus
   * une simple chaîne de texte posée sur le retour, mais une entrée réelle
   * du registre d'avoirs, avec solde et expiration réels. */
  issueForReturn: (returnId: string, beneficiaryName: string, amount: number) => {
    const id = `cn_${Date.now()}`;
    const reference = nextCreditRef(creditsStore.get());
    const at = new Date().toISOString();
    creditsStore.set((arr) => [
      {
        id,
        reference,
        source: "return",
        returnId,
        beneficiaryRole: "restaurant",
        beneficiaryName,
        amount,
        at,
        expiresAt: new Date(Date.now() + 90 * 86_400_000).toISOString(),
        status: "issued",
      },
      ...arr,
    ]);
    return { id, reference };
  },
  /** Utilise tout ou partie d'un avoir sur une commande : le solde baisse du
   * montant réellement utilisé, et le reste reste disponible. */
  redeem: (id: string, orderRef: string, amountUsed?: number) => {
    const at = new Date().toISOString();
    creditsStore.set((arr) =>
      arr.map((c) => {
        if (c.id !== id || c.status !== "issued" || isCreditExpired(c)) return c;
        const used = Math.min(c.amount, amountUsed ?? c.amount);
        const remaining = c.amount - used;
        return {
          ...c,
          initialAmount: c.initialAmount ?? c.amount,
          amount: remaining,
          status: remaining > 0 ? "issued" : "applied",
          usedOnOrderRef: orderRef,
          usages: [...(c.usages ?? []), { orderRef, amount: used, at }],
        };
      }),
    );
  },
  /** Recrédite la part d'un avoir utilisée sur une commande annulée. */
  restore: (id: string, orderRef: string, amount: number) => {
    creditsStore.set((arr) =>
      arr.map((c) =>
        c.id === id
          ? {
              ...c,
              amount: c.amount + amount,
              status: "issued",
              usages: (c.usages ?? []).filter((u) => u.orderRef !== orderRef),
            }
          : c,
      ),
    );
  },
};

// Une commande annulée rend l'avoir qu'elle avait utilisé.
onRestaurantOrderCancelled((o) => {
  if (o.creditId && o.creditApplied)
    creditActions.restore(o.creditId, o.reference, o.creditApplied);
});

export const PARTY_LABEL: Record<DisputeParty, string> = {
  restaurant: "Restaurant",
  farmer: "Producteur",
  driver: "Livreur",
  platform: "Plateforme",
};

export const STATUS_LABEL: Record<DisputeStatus, string> = {
  open: "Ouvert",
  investigating: "En instruction",
  awaiting_response: "Réponse attendue",
  resolved: "Résolu",
  rejected: "Rejeté",
};

export function slaRemaining(d: Dispute) {
  const ms = new Date(d.slaDueAt).getTime() - Date.now();
  const overdue = ms < 0;
  const h = Math.floor(Math.abs(ms) / 3600_000);
  const m = Math.floor((Math.abs(ms) % 3600_000) / 60_000);
  return {
    overdue,
    label: `${overdue ? "Dépassé de " : ""}${h}h ${String(m).padStart(2, "0")}min`,
    hours: ms / 3600_000,
  };
}

function nextRef(arr: Dispute[]) {
  const max = arr.reduce(
    (n, d) => Math.max(n, parseInt(d.reference.split("-")[1] ?? "0", 10) || 0),
    140,
  );
  return `LIT-${String(max + 1).padStart(4, "0")}`;
}

export type NewDisputeInput = {
  category: string;
  subcategory: string;
  description: string;
  orderRef: string;
  orderId?: string;
  invoiceId?: string;
  missionId?: string;
  returnId?: string;
  hasGpsTrack?: boolean;
  openedByRole: DisputeParty;
  openedByName: string;
  againstRole: DisputeParty;
  againstName: string;
  claimedAmount: number;
  priority: Dispute["priority"];
  channel?: DisputeChannel;
  attachments?: DisputeAttachment[];
  slaHours?: number;
};

export const disputeActions = {
  open: (input: NewDisputeInput) => {
    const id = `dp_${Date.now()}`;
    const at = new Date().toISOString();
    const slaHours =
      input.slaHours ?? (input.priority === "high" ? 24 : input.priority === "medium" ? 48 : 72);
    disputesStore.set((arr) => [
      {
        id,
        reference: nextRef(arr),
        category: input.category,
        subcategory: input.subcategory,
        description: input.description,
        orderRef: input.orderRef,
        orderId: input.orderId,
        invoiceId: input.invoiceId,
        missionId: input.missionId,
        returnId: input.returnId,
        hasGpsTrack: input.hasGpsTrack ?? false,
        openedByRole: input.openedByRole,
        openedByName: input.openedByName,
        againstRole: input.againstRole,
        againstName: input.againstName,
        claimedAmount: input.claimedAmount,
        grantedAmount: null,
        liableParty: null,
        status: "open",
        priority: input.priority,
        channel: input.channel ?? "app",
        openedAt: at,
        slaDueAt: new Date(Date.now() + slaHours * 3600_000).toISOString(),
        escalations: 0,
        assignee: null,
        attachments: input.attachments ?? [],
        messages: [
          {
            id: `m_${Date.now()}`,
            at,
            authorRole: input.openedByRole,
            authorName: input.openedByName,
            text: input.description,
            internal: false,
            attachments: input.attachments,
          },
        ],
        events: [
          {
            id: `e_${Date.now()}`,
            at,
            actor: input.openedByName,
            label: "Litige ouvert",
            detail: `Canal : ${input.channel ?? "app"} · SLA ${slaHours}h`,
          },
        ],
      },
      ...arr,
    ]);
    return id;
  },
  reply: (
    id: string,
    msg: {
      role: DisputeParty;
      name: string;
      text: string;
      internal?: boolean;
      attachments?: DisputeAttachment[];
    },
  ) => {
    const at = new Date().toISOString();
    disputesStore.set((arr) =>
      arr.map((d) =>
        d.id === id
          ? {
              ...d,
              status:
                d.status === "awaiting_response" && msg.role === d.againstRole
                  ? "investigating"
                  : d.status,
              messages: [
                ...d.messages,
                {
                  id: `m_${Date.now()}`,
                  at,
                  authorRole: msg.role,
                  authorName: msg.name,
                  text: msg.text,
                  internal: msg.internal ?? false,
                  attachments: msg.attachments,
                },
              ],
              attachments: [...d.attachments, ...(msg.attachments ?? [])],
            }
          : d,
      ),
    );
  },
  addAttachments: (id: string, files: DisputeAttachment[]) => {
    disputesStore.set((arr) =>
      arr.map((d) =>
        d.id === id
          ? {
              ...d,
              attachments: [...d.attachments, ...files],
              events: [
                ...d.events,
                {
                  id: `e_${Date.now()}`,
                  at: new Date().toISOString(),
                  actor: files[0]?.by ?? "Utilisateur",
                  label: `${files.length} pièce(s) jointe(s) ajoutée(s)`,
                },
              ],
            }
          : d,
      ),
    );
  },
  setStatus: (id: string, status: DisputeStatus, actor = "Support Diambar", detail?: string) => {
    disputesStore.set((arr) =>
      arr.map((d) =>
        d.id === id
          ? {
              ...d,
              status,
              events: [
                ...d.events,
                {
                  id: `e_${Date.now()}`,
                  at: new Date().toISOString(),
                  actor,
                  label: `Statut : ${STATUS_LABEL[status]}`,
                  detail,
                },
              ],
            }
          : d,
      ),
    );
  },
  assign: (id: string, agent: string, actor = "Support Diambar") => {
    disputesStore.set((arr) =>
      arr.map((d) =>
        d.id === id
          ? {
              ...d,
              assignee: agent,
              events: [
                ...d.events,
                {
                  id: `e_${Date.now()}`,
                  at: new Date().toISOString(),
                  actor,
                  label: "Dossier assigné",
                  detail: agent,
                },
              ],
            }
          : d,
      ),
    );
  },
  escalate: (id: string, reason: string, actor = "Support Diambar") => {
    disputesStore.set((arr) =>
      arr.map((d) =>
        d.id === id
          ? {
              ...d,
              escalations: d.escalations + 1,
              priority: "high",
              slaDueAt: new Date(Date.now() + 12 * 3600_000).toISOString(),
              events: [
                ...d.events,
                {
                  id: `e_${Date.now()}`,
                  at: new Date().toISOString(),
                  actor,
                  label: `Escalade niveau ${d.escalations + 1}`,
                  detail: reason,
                },
              ],
            }
          : d,
      ),
    );
  },
  /** Décision motivée + impact financier réel (avoir, débit wallet livreur, etc.) */
  resolve: (
    id: string,
    decision: {
      outcome: DisputeOutcome;
      grantedAmount: number;
      liableParty: DisputeParty;
      reason: string;
      by?: string;
    },
  ) => {
    const d0 = disputesStore.get().find((x) => x.id === id);
    if (!d0 || d0.decision) return;
    const d = d0;
    // Jamais plus que ce qui est réclamé, et jamais une deuxième fois ce qui a
    // déjà été indemnisé par le retour d'origine (avoir déjà émis).
    const alreadyCompensated = d.returnId
      ? creditsStore
          .get()
          .filter((c) => c.returnId === d.returnId)
          .reduce((sum, c) => sum + (c.initialAmount ?? c.amount), 0)
      : 0;
    decision = {
      ...decision,
      grantedAmount: Math.max(
        0,
        Math.min(decision.grantedAmount, d.claimedAmount) - alreadyCompensated,
      ),
    };
    const at = new Date().toISOString();
    const by = decision.by ?? "Support Diambar";
    const resolved = decision.outcome === "rejected" ? "rejected" : "resolved";
    disputesStore.set((arr) =>
      arr.map((x) =>
        x.id === id
          ? {
              ...x,
              status: resolved as DisputeStatus,
              grantedAmount: decision.grantedAmount,
              liableParty: decision.liableParty,
              decision: {
                at,
                by,
                outcome: decision.outcome,
                reason: decision.reason,
                grantedAmount: decision.grantedAmount,
                debitedParty: decision.liableParty,
              },
              events: [
                ...x.events,
                {
                  id: `e_${Date.now()}`,
                  at,
                  actor: by,
                  label: `Décision : ${outcomeLabel(decision.outcome)}`,
                  detail: `${decision.grantedAmount.toLocaleString("fr-FR")} FCFA · à la charge de ${PARTY_LABEL[decision.liableParty]}`,
                },
              ],
              messages: [
                ...x.messages,
                {
                  id: `m_${Date.now()}`,
                  at,
                  authorRole: "platform" as DisputeParty,
                  authorName: by,
                  text: `Décision : ${outcomeLabel(decision.outcome)}. ${decision.reason}`,
                  internal: false,
                },
              ],
            }
          : x,
      ),
    );

    // Les deux parties apprennent la décision, avec le montant.
    const decisionText = `${d.reference} : ${outcomeLabel(decision.outcome)}${decision.grantedAmount > 0 ? ` — ${decision.grantedAmount.toLocaleString("fr-FR")} FCFA` : ""}`;
    const notifyParty = (role: DisputeParty) => {
      const n = { type: "system" as const, title: "Décision sur votre litige", body: decisionText };
      if (role === "restaurant")
        restaurantNotifActions.add({ ...n, link: `/restaurant/disputes/${d.id}` });
      if (role === "farmer") farmerNotifActions.add({ ...n, link: `/farmer/disputes/${d.id}` });
      if (role === "driver") driverNotifActions.add({ ...n, link: `/driver/disputes/${d.id}` });
    };
    notifyParty(d.openedByRole);
    if (d.againstRole !== d.openedByRole) notifyParty(d.againstRole);

    if (decision.grantedAmount > 0 && decision.outcome !== "rejected") {
      // "refund"/"partial" impliquent un vrai virement au plaignant (sauf un
      // livreur, déjà compensé via son wallet ci-dessous) : un vrai dossier
      // Remboursement, suivi et payé depuis le centre de résolution, pas
      // seulement un avoir consommable au prochain checkout restaurant.
      // "credit"/"goodwill" restent des avoirs, comme avant.
      const isRealRefund =
        (decision.outcome === "refund" || decision.outcome === "partial") &&
        d.openedByRole !== "driver";
      if (isRealRefund) {
        // Le livreur responsable est déjà débité de son wallet ci-dessous —
        // "farmer" est le seul cas où ce dossier doit encore déduire un vrai
        // compte (ses revenus, au moment du paiement) ; les autres finissent
        // à la charge de la plateforme, faute d'un tiers réellement débité.
        const bornBy =
          decision.liableParty === "farmer"
            ? "farmer"
            : decision.liableParty === "driver"
              ? "driver"
              : "platform";
        refundActions.create(
          {
            source: "dispute",
            disputeId: id,
            orderRef: d.orderRef,
            bornBy,
            requester: d.openedByName,
            amount: decision.grantedAmount,
            method: "Wave",
            reason: `Litige ${d.reference} — ${decision.reason}`,
          },
          // Passe par les paliers d'approbation comme tout remboursement.
          "pending",
        );
      } else if (d.openedByRole !== "driver") {
        // Un livreur est indemnisé sur son portefeuille (ci-dessous), jamais
        // en plus par un avoir qu'il ne pourrait de toute façon pas utiliser.
        creditsStore.set((arr) => [
          {
            id: `cn_${Date.now()}`,
            reference: nextCreditRef(arr),
            source: "dispute",
            disputeId: id,
            beneficiaryRole: d.openedByRole,
            beneficiaryName: d.openedByName,
            amount: decision.grantedAmount,
            at,
            status: "issued",
          },
          ...arr,
        ]);
      }
      if (decision.liableParty === "driver") {
        driverWalletActions.credit(
          `Retenue litige ${d.reference}`,
          -Math.abs(decision.grantedAmount),
          "adjustment",
        );
      } else if (d.openedByRole === "driver") {
        driverWalletActions.credit(
          `Indemnité litige ${d.reference}`,
          Math.abs(decision.grantedAmount),
          "adjustment",
        );
      }
    }
  },
};

export function outcomeLabel(o: DisputeOutcome) {
  return o === "refund"
    ? "Remboursement intégral"
    : o === "partial"
      ? "Remboursement partiel"
      : o === "credit"
        ? "Avoir émis"
        : o === "goodwill"
          ? "Geste commercial"
          : "Réclamation rejetée";
}

/** Statistiques litiges : taux par partie, délai moyen de résolution, montants remboursés. */
export function disputeStats(list: Dispute[]) {
  const resolved = list.filter((d) => d.decision);
  const durations = resolved.map(
    (d) => (new Date(d.decision!.at).getTime() - new Date(d.openedAt).getTime()) / 3600_000,
  );
  const avgHours = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const refundedThisMonth = resolved
    .filter((d) => new Date(d.decision!.at) >= monthStart)
    .reduce((s, d) => s + (d.decision!.grantedAmount || 0), 0);
  const byParty = new Map<
    string,
    { name: string; role: DisputeParty; count: number; amount: number; liable: number }
  >();
  for (const d of list) {
    const key = `${d.againstRole}:${d.againstName}`;
    const e = byParty.get(key) ?? {
      name: d.againstName,
      role: d.againstRole,
      count: 0,
      amount: 0,
      liable: 0,
    };
    e.count += 1;
    e.amount += d.claimedAmount;
    if (d.liableParty === d.againstRole) e.liable += 1;
    byParty.set(key, e);
  }
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600_000);
  const lastMonthStart = new Date(monthStart);
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
  return {
    total: list.length,
    open: list.filter(
      (d) =>
        d.status === "open" || d.status === "investigating" || d.status === "awaiting_response",
    ).length,
    // "Litiges ouverts" au sens strict du mockup (hors instruction/réponse
    // attendue, qui forment le compteur "En traitement" séparé).
    openStrict: list.filter((d) => d.status === "open").length,
    inTreatment: list.filter(
      (d) => d.status === "investigating" || d.status === "awaiting_response",
    ).length,
    resolvedCount: list.filter((d) => d.status === "resolved").length,
    openedThisWeek: list.filter((d) => new Date(d.openedAt) >= weekAgo).length,
    resolvedThisMonthCount: resolved.filter((d) => new Date(d.decision!.at) >= monthStart).length,
    claimedThisMonth: list
      .filter((d) => new Date(d.openedAt) >= monthStart)
      .reduce((s, d) => s + d.claimedAmount, 0),
    claimedLastMonth: list
      .filter((d) => new Date(d.openedAt) >= lastMonthStart && new Date(d.openedAt) < monthStart)
      .reduce((s, d) => s + d.claimedAmount, 0),
    overdue: list.filter(
      (d) => d.status !== "resolved" && d.status !== "rejected" && slaRemaining(d).overdue,
    ).length,
    avgHours,
    refundedThisMonth,
    claimedTotal: list.reduce((s, d) => s + d.claimedAmount, 0),
    grantedTotal: resolved.reduce((s, d) => s + (d.decision!.grantedAmount || 0), 0),
    byParty: [...byParty.values()].sort((a, b) => b.count - a.count),
  };
}
