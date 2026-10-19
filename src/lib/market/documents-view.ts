import type { InvoiceData } from "@/lib/invoice-pdf";

// Factures et relevés tirés de la base, et leur mise en page PDF (même
// générateur que les factures de démonstration).

export type InvoiceContent = {
  seller: {
    name: string;
    tradeName?: string;
    address: string;
    email: string;
    phone: string;
    ninea: string;
    rccm: string;
  };
  buyer: { name: string; address: string; phone: string };
  checkoutReference: string;
  orders: { reference: string; farmerName: string; deliveredAt?: string }[];
  /** Quantités réellement acceptées (livrées − refusées à la réception). */
  lines: {
    name: string;
    unit: string;
    qty: number;
    unitPrice: number;
    amount: number;
    orderRef: string;
    farmerName: string;
  }[];
  deliveryFees: { orderRef: string; amount: number }[];
  discount: number;
  totals: { ht: number; tvaRate: number; tva: number; ttc: number };
  /** À l'émission : payé (ou encaissé par le livreur) et remboursé. */
  payment: { method: string; paid: number; refunded: number };
};

export type InvoiceView = {
  id: string;
  number: string;
  issuedAt: string;
  checkoutId: string;
  checkoutReference: string;
  totalTtc: number;
  content: InvoiceContent;
};

export type StatementView = {
  /** AAAA-MM */
  month: string;
  account: { name: string; role: "farmer" | "driver"; phone: string };
  seller: InvoiceContent["seller"];
  opening: number;
  lines: { at: string; label: string; reference: string; amount: number }[];
  credits: number;
  debits: number;
  closing: number;
  generatedAt: string;
};

const fcfa = (n: number) => `${new Intl.NumberFormat("fr-FR").format(n)} FCFA`;

function legalLine(s: InvoiceContent["seller"]) {
  const parts = [s.ninea && `NINEA ${s.ninea}`, s.rccm && `RCCM ${s.rccm}`].filter(Boolean);
  return parts.length ? parts.join(" · ") : "NINEA et RCCM : immatriculation en cours";
}

function sellerBlock(s: InvoiceContent["seller"]) {
  return {
    name: s.tradeName ? `${s.name} (${s.tradeName})` : s.name,
    addressLines: [s.address, s.phone].filter(Boolean),
    email: s.email,
    legal: legalLine(s),
  };
}

export function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function invoicePdfData(v: InvoiceView): InvoiceData {
  const c = v.content;
  const withTva = c.totals.tvaRate > 0;
  const settled = c.payment.paid - c.payment.refunded;
  const due = Math.max(0, c.totals.ttc - settled);
  return {
    number: v.number,
    issuedAt: new Date(v.issuedAt),
    dueAt: new Date(v.issuedAt),
    orderRef: c.checkoutReference,
    infoRows: [
      ["Numero de facture", v.number],
      ["Date d'emission", new Date(v.issuedAt).toLocaleDateString("fr-FR")],
      ["Panier", c.checkoutReference],
      ["Commandes", c.orders.map((o) => o.reference).join(", ")],
    ],
    seller: sellerBlock(c.seller),
    buyer: {
      label: "Client",
      name: c.buyer.name,
      addressLines: [c.buyer.address, c.buyer.phone].filter(Boolean),
      email: "",
    },
    paidBanner: due > 0 ? `${fcfa(due)} a payer` : `${fcfa(c.totals.ttc)} - payee`,
    columns: {
      name: "Designation",
      qty: "Qte",
      unitPrice: withTva ? "Prix unitaire TTC" : "Prix unitaire",
      amount: withTva ? "Montant TTC" : "Montant",
    },
    items: [
      ...c.lines.map((l) => ({
        name: l.name,
        sub: `${l.orderRef} · ${l.farmerName}`,
        qty: String(l.qty),
        qtyUnit: l.unit,
        unitPrice: l.unitPrice,
        amount: l.amount,
      })),
      ...c.deliveryFees.map((f) => ({
        name: "Livraison",
        sub: f.orderRef,
        qty: "1",
        unitPrice: f.amount,
        amount: f.amount,
      })),
      ...(c.discount > 0
        ? [{ name: "Avoir déduit", qty: "1", unitPrice: 0, amount: -c.discount }]
        : []),
    ],
    totals: [
      ...(withTva
        ? [
            { label: "Total HT", amount: c.totals.ht },
            { label: `TVA ${c.totals.tvaRate} %`, amount: c.totals.tva },
          ]
        : []),
      { label: withTva ? "Total TTC" : "Total", amount: c.totals.ttc, bold: true },
      { label: `Paye (${c.payment.method})`, amount: c.payment.paid },
      ...(c.payment.refunded > 0 ? [{ label: "Rembourse", amount: -c.payment.refunded }] : []),
    ],
    amountDue: due,
    note: withTva
      ? "Prix toutes taxes comprises."
      : "TVA non appliquee. Quantites acceptees a la reception.",
  };
}

export function statementPdfData(s: StatementView): InvoiceData {
  const role = s.account.role === "driver" ? "Livreur" : "Producteur";
  return {
    number: `RELEVE-${s.month}`,
    issuedAt: new Date(s.generatedAt),
    dueAt: new Date(s.generatedAt),
    orderRef: s.month,
    title: "Releve",
    infoRows: [
      ["Periode", monthLabel(s.month)],
      ["Compte", `${s.account.name} (${role})`],
      ["Edite le", new Date(s.generatedAt).toLocaleDateString("fr-FR")],
    ],
    seller: sellerBlock(s.seller),
    buyer: {
      label: "Titulaire du compte",
      name: s.account.name,
      addressLines: [s.account.phone].filter(Boolean),
      email: "",
    },
    paidBanner: `Solde fin de mois : ${fcfa(s.closing)}`,
    columns: { name: "Operation", qty: "Date", unitPrice: "", amount: "Montant" },
    items: s.lines.map((l) => ({
      name: l.label,
      sub: l.reference || undefined,
      qty: new Date(l.at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
      unitPrice: 0,
      amount: l.amount,
    })),
    totals: [
      { label: "Solde d'ouverture", amount: s.opening },
      { label: "Credits", amount: s.credits },
      { label: "Debits", amount: s.debits },
      { label: "Solde de cloture", amount: s.closing, bold: true },
    ],
    amountDue: 0,
    hideAmountDue: true,
    note: "Soldes tires du grand livre Diambar : ventes ou courses livrees, commissions, retraits verses.",
  };
}
