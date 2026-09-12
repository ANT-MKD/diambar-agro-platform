import { useSyncExternalStore } from "react";
import type { Role } from "./mocks";

export type TicketStatus = "open" | "answered" | "closed";
export type TicketRole = Extract<Role, "farmer" | "restaurant" | "driver">;

export type SupportTicket = {
  id: string;
  subject: string;
  message: string;
  fromName: string;
  fromRole: TicketRole;
  orderRef?: string;
  status: TicketStatus;
  createdAt: string;
};

const SEED: SupportTicket[] = [
  {
    id: "t1",
    subject: "Retard de versement Wave",
    message: "Le versement de ma dernière commande n'est toujours pas arrivé après 48h.",
    fromName: "Mamadou Diallo",
    fromRole: "farmer",
    orderRef: "CMD-2851",
    status: "answered",
    createdAt: "2025-05-10T09:00:00Z",
  },
  {
    id: "t2",
    subject: "Produit reçu endommagé",
    message: "Les tomates de la dernière livraison étaient abîmées à réception.",
    fromName: "Le Baobab",
    fromRole: "restaurant",
    orderRef: "CMD-3049",
    status: "open",
    createdAt: "2025-05-14T15:30:00Z",
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
    orderRef?: string;
  }) => {
    const id = `t_${Date.now()}`;
    const ticket: SupportTicket = {
      id,
      subject: input.subject,
      message: input.message,
      fromName: input.fromName,
      fromRole: input.fromRole,
      orderRef: input.orderRef,
      status: "open",
      createdAt: new Date().toISOString(),
    };
    ticketsStore.set((arr) => [ticket, ...arr]);
    return ticket;
  },
  setStatus: (id: string, status: TicketStatus) => {
    ticketsStore.set((arr) => arr.map((t) => (t.id === id ? { ...t, status } : t)));
  },
};

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Ouvert",
  answered: "Répondu",
  closed: "Fermé",
};
