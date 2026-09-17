import { products, farmers, restaurants, type RestaurantOrder } from "@/data/mocks";
import type { InvoiceData } from "@/lib/invoice-pdf";

type Farmer = (typeof farmers)[number];
type Restaurant = (typeof restaurants)[number];

export function invoiceNumberFor(id: string) {
  return `FAC-2025-${id.slice(-3).toUpperCase().padStart(3, "0")}`;
}

/** En retard : uniquement une commande réellement non payée depuis plus que
 * le délai de règlement configuré dans les paramètres Paiements (les
 * paiements Wave/Orange Money/Free Money sont déjà réglés à la commande,
 * donc jamais "en retard"). */
export function isInvoiceOverdue(o: RestaurantOrder, paymentTermsDays: number) {
  if (o.paid) return false;
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
  const subtotal = order.items.reduce((s, i) => s + i.qty * i.price, 0);
  const vat = Math.round(subtotal * 0.18);
  const total = subtotal + vat;
  const issued = new Date(order.createdAt);
  const due = new Date(issued.getTime() + paymentTermsDays * 86400_000);
  const buyerName = restaurant?.name ?? "Restaurant";

  return {
    number: invoiceNumberFor(order.id),
    issuedAt: issued,
    dueAt: due,
    orderRef: order.reference,
    seller: {
      name: "DIAMBAR AGRO SARL",
      addressLines: ["Immeuble Plateau, Avenue Léopold Sédar Senghor,", "Dakar, Sénégal"],
      email: "contact@diambar.sn",
      legal: "NINEA 008772341 · RC DKR-2024-B-12847",
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
    subtotalHT: subtotal,
    vat,
    vatRate: 18,
    totalTTC: total,
    amountDue: order.paid ? 0 : total,
  };
}
