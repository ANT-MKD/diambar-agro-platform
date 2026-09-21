import { useSyncExternalStore } from "react";
import type { Role } from "./mocks";
import { SUPPORT_AGENTS } from "./disputes";

export type TicketStatus = "open" | "answered" | "closed";
export type TicketRole = Extract<Role, "farmer" | "restaurant" | "driver">;
export type TicketCategory =
  "delivery" | "products" | "payments" | "account" | "technical" | "other";
export type TicketPriority = "low" | "medium" | "high";

export type TicketMessage = {
  id: string;
  at: string;
  authorRole: TicketRole | "platform";
  authorName: string;
  text: string;
  internal: boolean;
};

export type SupportTicket = {
  id: string;
  subject: string;
  message: string;
  fromName: string;
  fromRole: TicketRole;
  category: TicketCategory;
  priority: TicketPriority;
  assignee: string | null;
  orderRef?: string;
  status: TicketStatus;
  createdAt: string;
  messages: TicketMessage[];
};

// Priorité déterminée par la catégorie au moment de la création (même
// logique que la gravité des incidents livreur) : un problème de paiement
// ou de livraison impacte immédiatement l'activité, un problème de compte
// ou technique est rarement bloquant.
export const TICKET_CATEGORY_PRIORITY: Record<TicketCategory, TicketPriority> = {
  payments: "high",
  delivery: "high",
  products: "medium",
  account: "medium",
  technical: "low",
  other: "low",
};

const SEED: SupportTicket[] = [
  {
    id: "t1",
    subject: "Retard de versement Wave",
    message: "Le versement de ma dernière commande n'est toujours pas arrivé après 48h.",
    fromName: "Mamadou Diallo",
    fromRole: "farmer",
    category: "payments",
    priority: "high",
    assignee: SUPPORT_AGENTS[0],
    orderRef: "CMD-2851",
    status: "answered",
    createdAt: "2025-05-10T09:00:00Z",
    messages: [
      {
        id: "t1-m1",
        at: "2025-05-10T09:00:00Z",
        authorRole: "farmer",
        authorName: "Mamadou Diallo",
        text: "Le versement de ma dernière commande n'est toujours pas arrivé après 48h.",
        internal: false,
      },
      {
        id: "t1-m2",
        at: "2025-05-10T14:00:00Z",
        authorRole: "platform",
        authorName: SUPPORT_AGENTS[0],
        text: "Versement relancé auprès de Wave, régularisation prévue sous 24h.",
        internal: false,
      },
    ],
  },
  {
    id: "t2",
    subject: "Produit reçu endommagé",
    message: "Les tomates de la dernière livraison étaient abîmées à réception.",
    fromName: "Le Baobab",
    fromRole: "restaurant",
    category: "products",
    priority: "medium",
    assignee: null,
    orderRef: "CMD-3049",
    status: "open",
    createdAt: "2025-05-14T15:30:00Z",
    messages: [
      {
        id: "t2-m1",
        at: "2025-05-14T15:30:00Z",
        authorRole: "restaurant",
        authorName: "Le Baobab",
        text: "Les tomates de la dernière livraison étaient abîmées à réception.",
        internal: false,
      },
    ],
  },
];

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

const ticketsStore = createStore<SupportTicket[]>(SEED, "diambar:support-tickets");

export function useSupportTickets() {
  return useSyncExternalStore(ticketsStore.subscribe, ticketsStore.get, ticketsStore.get);
}

export function useSupportTicketsFor(fromName: string) {
  return useSupportTickets().filter((t) => t.fromName === fromName);
}

export const supportTicketActions = {
  create: (input: {
    subject: string;
    message: string;
    fromName: string;
    fromRole: TicketRole;
    category: TicketCategory;
    orderRef?: string;
  }) => {
    const id = `t_${Date.now()}`;
    const createdAt = new Date().toISOString();
    const ticket: SupportTicket = {
      id,
      subject: input.subject,
      message: input.message,
      fromName: input.fromName,
      fromRole: input.fromRole,
      category: input.category,
      priority: TICKET_CATEGORY_PRIORITY[input.category],
      assignee: null,
      orderRef: input.orderRef,
      status: "open",
      createdAt,
      messages: [
        {
          id: `${id}-m1`,
          at: createdAt,
          authorRole: input.fromRole,
          authorName: input.fromName,
          text: input.message,
          internal: false,
        },
      ],
    };
    ticketsStore.set((arr) => [ticket, ...arr]);
    return ticket;
  },
  setStatus: (id: string, status: TicketStatus) => {
    ticketsStore.set((arr) => arr.map((t) => (t.id === id ? { ...t, status } : t)));
  },
  assign: (id: string, agent: string | null) => {
    ticketsStore.set((arr) => arr.map((t) => (t.id === id ? { ...t, assignee: agent } : t)));
  },
  /** Note interne visible uniquement par l'équipe admin — jusqu'ici
   * `internal` existait sur TicketMessage mais rien ne le mettait jamais
   * à `true`, donc aucune note interne n'était réellement possible. */
  addInternalNote: (id: string, authorName: string, text: string) => {
    ticketsStore.set((arr) =>
      arr.map((t) =>
        t.id === id
          ? {
              ...t,
              messages: [
                ...t.messages,
                {
                  id: `${id}-m${t.messages.length + 1}`,
                  at: new Date().toISOString(),
                  authorRole: "platform",
                  authorName,
                  text,
                  internal: true,
                },
              ],
            }
          : t,
      ),
    );
  },
  addMessage: (id: string, authorName: string, text: string) => {
    ticketsStore.set((arr) =>
      arr.map((t) =>
        t.id === id
          ? {
              ...t,
              status: t.status === "open" ? "answered" : t.status,
              messages: [
                ...t.messages,
                {
                  id: `${id}-m${t.messages.length + 1}`,
                  at: new Date().toISOString(),
                  authorRole: "platform",
                  authorName,
                  text,
                  internal: false,
                },
              ],
            }
          : t,
      ),
    );
  },
};

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Ouvert",
  answered: "Répondu",
  closed: "Fermé",
};

export const TICKET_PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: "Basse",
  medium: "Moyenne",
  high: "Haute",
};

export const TICKET_CATEGORY_LABEL: Record<TicketCategory, string> = {
  delivery: "Commandes et livraisons",
  products: "Produits et stock",
  payments: "Paiements et factures",
  account: "Compte et profil",
  technical: "Technique et bugs",
  other: "Autres",
};
