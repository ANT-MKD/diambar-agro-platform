import type { PaymentMethod } from "@/data/mocks";

// Paiements du pilote tels que les écrans les montrent (sans base : rien de
// tout cela n'apparaît, la démonstration garde son fonctionnement).

export type PaymentState =
  /** Wave / OM : rien de déclaré par le restaurant. */
  | "to_pay"
  /** Wave / OM : référence déclarée, l'admin vérifie. */
  | "declared"
  /** Wave / OM : l'admin n'a pas retrouvé la transaction. */
  | "refused"
  /** Espèces : à régler au livreur à la livraison. */
  | "cash_on_delivery"
  /** Espèces : encaissées par le livreur, pas encore remises à Diambar. */
  | "collected"
  /** Argent reçu par Diambar (compte marchand ou espèces remises). */
  | "paid"
  /** Plus rien à payer (commandes annulées). */
  | "cancelled";

export type PaymentRowLike = {
  orderId: string | null;
  status: "pending" | "confirmed" | "failed" | "refunded" | "cancelled";
  declaredAt: Date | string | null;
  collectedAt: Date | string | null;
};

export function paymentState(p: PaymentRowLike): PaymentState {
  if (p.status === "confirmed") return "paid";
  if (p.status === "cancelled" || p.status === "refunded") return "cancelled";
  if (p.orderId) return p.collectedAt ? "collected" : "cash_on_delivery";
  if (p.status === "failed") return "refused";
  return p.declaredAt ? "declared" : "to_pay";
}

export const PAYMENT_STATE_LABEL: Record<PaymentState, string> = {
  to_pay: "À payer",
  declared: "Paiement en vérification",
  refused: "Paiement non retrouvé",
  cash_on_delivery: "Espèces à la livraison",
  collected: "Espèces encaissées par le livreur",
  paid: "Payé",
  cancelled: "Rien à payer",
};

/** Paiement d'une commande, vu par le restaurant (et l'admin). */
export type OrderPayment = {
  id: string;
  checkoutId: string;
  checkoutReference: string;
  mode: "prepaid" | "cash";
  state: PaymentState;
  method: PaymentMethod;
  /** Montant de ce paiement : le panier entier (Wave / OM) ou la commande (espèces). */
  amount: number;
  /** Commandes réglées par ce paiement. */
  orderReferences: string[];
  providerRef?: string;
  /** Motif d'un refus par l'admin. */
  note?: string;
  declaredAt?: string;
  collectedAt?: string;
  paidAt?: string;
  /** Wave / OM pas encore déclaré : sans paiement à cette heure, le panier
   * est annulé. */
  dueBy?: string;
};

export type RefundSourceView =
  "reception" | "dispute" | "return" | "incident" | "manual" | "shortage" | "cancellation";

export type RefundView = {
  id: string;
  reference: string;
  orderId: string;
  orderReference: string;
  source: RefundSourceView;
  amount: number;
  status: "pending" | "approved" | "paid" | "rejected" | "failed";
  reason?: string;
  createdAt: string;
  paidAt?: string;
  providerRef?: string;
};

export const REFUND_SOURCE_LABEL: Record<RefundSourceView, string> = {
  reception: "Refus à la réception",
  dispute: "Litige",
  return: "Retour",
  incident: "Incident de livraison",
  manual: "Geste commercial",
  shortage: "Quantités manquantes",
  cancellation: "Commande annulée",
};

/** Paiement vu par l'admin : de quoi le retrouver sur le compte marchand. */
export type AdminPayment = OrderPayment & {
  restaurantId: string;
  restaurantName: string;
  restaurantPhone: string;
  /** Ce que le restaurant doit à cet instant (peut différer après un ajustement). */
  dueNow: number;
  orders: { id: string; reference: string; farmerName: string; status: string; due: number }[];
  collectedBy?: { id: string; name: string };
  confirmedByName?: string;
  createdAt: string;
};

/** Numéros marchands où le restaurant paie (réglés par l'admin). */
export type MerchantNumbers = { wave: string | null; orangeMoney: string | null };

/** Retrait demandé par un producteur ou un livreur, vu par l'admin. */
export type AdminPayout = {
  id: string;
  reference: string;
  userId: string;
  name: string;
  role: "farmer" | "driver";
  amount: number;
  method: PaymentMethod;
  accountNumber: string;
  status: "requested" | "processing" | "paid" | "failed" | "cancelled";
  createdAt: string;
  paidAt?: string;
  providerRef?: string;
  note?: string;
  /** Solde du compte (versements payés déduits). */
  balance: number;
  /** Double validation : montant au-dessus du seuil, et qui a validé. */
  needsTwoAdmins: boolean;
  approvedById?: string;
  approvedByName?: string;
};

/** Remboursement à faire au restaurant, vu par l'admin. */
export type AdminRefund = RefundView & {
  restaurantId: string;
  restaurantName: string;
  /** Numéro proposé par défaut pour renvoyer l'argent. */
  restaurantPhone: string;
  checkoutReference: string;
  method?: PaymentMethod;
  paidTo?: string;
  bornBy: "farmer" | "driver" | "platform";
  needsTwoAdmins: boolean;
  approvedById?: string;
  approvedByName?: string;
};
