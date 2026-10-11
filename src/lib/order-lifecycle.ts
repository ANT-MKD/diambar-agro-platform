import type { MissionStatus, OrderStatus } from "@/data/mocks";

// Cycle de vie unique d'une commande, partagé par les 4 portails.
//
//   En attente ──(producteur accepte)──▶ Confirmée ──(producteur)──▶ En préparation
//        │                                  │                              │
//        │                                  └────(livreur enlève)──────────┤
//        ▼                                                                 ▼
//     Annulée ◀── avant l'enlèvement seulement ─────────────────── En livraison
//                                                                          │
//                                                        (livreur livre) ▼
//                                                                        Livrée
//
// Chaque étape n'a lieu qu'une fois : « Livrée » et « Annulée » sont finales,
// et on ne revient jamais en arrière. C'est ce qui garantit qu'une commande
// ne paie le producteur et le livreur qu'une seule fois.

export type OrderActor = "farmer" | "restaurant" | "driver" | "admin";

const ORDER_RULES: Record<OrderStatus, Partial<Record<OrderStatus, OrderActor[]>>> = {
  pending: {
    confirmed: ["farmer", "admin"],
    cancelled: ["farmer", "restaurant", "admin"],
  },
  confirmed: {
    preparing: ["farmer", "admin"],
    delivering: ["driver"],
    cancelled: ["farmer", "restaurant", "admin"],
  },
  preparing: {
    delivering: ["driver"],
    cancelled: ["farmer", "admin"],
  },
  delivering: {
    delivered: ["driver", "admin"],
  },
  delivered: {},
  cancelled: {},
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  preparing: "En préparation",
  delivering: "En livraison",
  delivered: "Livrée",
  cancelled: "Annulée",
};

export type TransitionCheck = { ok: true } | { ok: false; message: string };

export function checkOrderTransition(
  from: OrderStatus,
  to: OrderStatus,
  actor: OrderActor,
): TransitionCheck {
  if (from === to)
    return { ok: false, message: `La commande est déjà « ${ORDER_STATUS_LABEL[to]} ».` };
  if (from === "delivered" || from === "cancelled") {
    return {
      ok: false,
      message: `La commande est déjà « ${ORDER_STATUS_LABEL[from]} » : elle ne peut plus changer.`,
    };
  }
  const allowed = ORDER_RULES[from][to];
  if (!allowed) {
    if (to === "cancelled") {
      return {
        ok: false,
        message: "Annulation impossible : la marchandise a déjà été enlevée par le livreur.",
      };
    }
    return {
      ok: false,
      message: `Passage de « ${ORDER_STATUS_LABEL[from]} » à « ${ORDER_STATUS_LABEL[to]} » impossible.`,
    };
  }
  if (!allowed.includes(actor)) {
    if (to === "delivering") {
      return {
        ok: false,
        message: "C'est l'enlèvement par le livreur qui met la commande en livraison.",
      };
    }
    if (to === "delivered") {
      return {
        ok: false,
        message: "Seul le livreur confirme la livraison, avec sa preuve de remise.",
      };
    }
    if (to === "cancelled" && actor === "restaurant") {
      return {
        ok: false,
        message:
          "Le producteur prépare déjà la commande : contactez-le ou le support pour l'annuler.",
      };
    }
    return { ok: false, message: "Vous n'avez pas la main sur cette étape de la commande." };
  }
  return { ok: true };
}

/** Étapes suivantes qu'un acteur peut déclencher depuis un statut. */
export function nextOrderStatuses(from: OrderStatus, actor: OrderActor): OrderStatus[] {
  return (Object.entries(ORDER_RULES[from]) as [OrderStatus, OrderActor[]][])
    .filter(([, actors]) => actors.includes(actor))
    .map(([to]) => to);
}

/** Une commande peut encore être annulée tant qu'elle n'est pas enlevée. */
export function isCancellable(status: OrderStatus, actor: OrderActor): boolean {
  return checkOrderTransition(status, "cancelled", actor).ok;
}

// Étapes du livreur sur sa mission (l'acceptation, le désistement et
// l'annulation passent par leurs propres actions).
const MISSION_DRIVER_STEPS: Partial<Record<MissionStatus, MissionStatus[]>> = {
  accepted: ["pickup", "loaded"],
  pickup: ["loaded"],
  loaded: ["delivered"],
};

export const MISSION_STATUS_LABEL: Record<MissionStatus, string> = {
  available: "Disponible",
  accepted: "Acceptée",
  pickup: "En route vers le producteur",
  loaded: "Marchandise chargée",
  delivered: "Livrée",
  cancelled: "Annulée",
};

export function checkMissionStep(from: MissionStatus, to: MissionStatus): TransitionCheck {
  if (MISSION_DRIVER_STEPS[from]?.includes(to)) return { ok: true };
  if (from === "delivered") return { ok: false, message: "Cette mission est déjà livrée." };
  if (from === "cancelled") return { ok: false, message: "Cette mission a été annulée." };
  return {
    ok: false,
    message: `Étape impossible : « ${MISSION_STATUS_LABEL[from]} » → « ${MISSION_STATUS_LABEL[to]} ».`,
  };
}
