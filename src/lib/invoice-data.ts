import { products, farmers, restaurants, type RestaurantOrder } from "@/data/mocks";
import type { InvoiceData } from "@/lib/invoice-pdf";
import { orderAmounts } from "@/lib/pricing";

type Farmer = (typeof farmers)[number];
type Restaurant = (typeof restaurants)[number];

/** Numéro de facture stable et unique : année de la commande + sa référence
 * (elle-même unique), au lieu d'une année figée et de 3 caractères d'id. */
export function invoiceNumberFor(id: string, createdAt?: string, reference?: string) {
  const year = createdAt ? new Date(createdAt).getFullYear() : new Date().getFullYear();
  const ref = reference ? reference.replace(/^CMD-/, "") : id.slice(-6).toUpperCase();
  return `FAC-${year}-${ref}`;
}

/** En retard : uniquement une commande réellement non payée depuis plus que
 * le délai de règlement configuré dans les paramètres Paiements (les
 * paiements Wave/Orange Money/Free Money sont déjà réglés à la commande,
 * donc jamais "en retard"). */
export function isInvoiceOverdue(o: RestaurantOrder, paymentTermsDays: number) {
  if (o.paid || o.status === "cancelled") return false;
  // Paiement à la livraison : rien n'est dû avant que la commande soit livrée.
  if (o.paymentMethod === "Espèces" && o.status !== "delivered") return false;
  const days = (Date.now() - new Date(o.createdAt).getTime()) / 86400_000;
  return days > paymentTermsDays;
}

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/** Construit la facture PDF/écran à partir d'une seule source de vérité
 * (la commande réelle), pour ne plus dupliquer ce calcul entre la liste
 * et le détail. */
export function buildInvoiceData(
  order: RestaurantOrder,
  farmer: Farmer | undefined,
  restaurant: Restaurant | undefined,
  paymentTermsDays: number,
): InvoiceData {
  // La facture reprend exactement ce que le restaurant a payé : marchandise,
  // frais de livraison, remises et avoir — jamais une TVA ajoutée en plus.
  const a = orderAmounts(order);
  const total = a.total;
  const totals: InvoiceData["totals"] = [
    { label: "Marchandise", amount: a.subtotal },
    ...(a.deliveryFee > 0 ? [{ label: "Frais de livraison", amount: a.deliveryFee }] : []),
    ...(a.promoDiscount > 0
      ? [
          {
            label: order.promoCode ? `Remise (${order.promoCode})` : "Remise",
            amount: -a.promoDiscount,
          },
        ]
      : []),
    ...(a.creditApplied > 0 ? [{ label: "Avoir utilisé", amount: -a.creditApplied }] : []),
    { label: "Total TTC", amount: total, bold: true },
  ];
  const issued = new Date(order.createdAt);
  const due = new Date(issued.getTime() + paymentTermsDays * 86400_000);
  const buyerName = restaurant?.name ?? "Restaurant";

  return {
    number: invoiceNumberFor(order.id, order.createdAt, order.reference),
    issuedAt: issued,
    dueAt: due,
    orderRef: order.reference,
    seller: {
      name: "DIAMBAR AGRO SARL",
      addressLines: ["Immeuble Plateau, Avenue Léopold Sédar Senghor,", "Dakar, Sénégal"],
      email: "contact@diambar.sn",
      // À remplacer par le NINEA et le RCCM réels de la société.
      legal: "NINEA et RCCM : immatriculation en cours",
    },
    buyer: {
      label: "Destinataire",
      name: buyerName,
      addressLines: [order.deliveryAddress],
      email: `${slugify(buyerName)}@diambar.sn`,
    },
    paidBanner: order.paid
      ? `${new Intl.NumberFormat("fr-FR").format(total)} FCFA payés`
      : `${new Intl.NumberFormat("fr-FR").format(total)} FCFA à payer`,
    items: order.items.map((it) => {
      const p = products.find((x) => x.id === it.productId);
      return {
        name: p?.name ?? it.productId,
        sub: `Commande ${order.reference} · ${farmer?.name ?? ""}`,
        qty: String(it.qty),
        qtyUnit: p?.unit,
        unitPrice: it.price,
        amount: it.qty * it.price,
      };
    }),
    totals,
    amountDue: order.paid || order.status === "cancelled" ? 0 : total,
    note: "Montants toutes taxes comprises.",
  };
}
