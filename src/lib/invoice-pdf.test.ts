import { describe, expect, it } from "vitest";
import { buildDiambarInvoice, type InvoiceData } from "./invoice-pdf";

const base = (n: number): InvoiceData => ({
  number: "FAC-2026-00001",
  issuedAt: new Date("2026-10-12T10:00:00Z"),
  dueAt: new Date("2026-10-12T10:00:00Z"),
  orderRef: "PAN-1001",
  seller: {
    name: "Diambar Agro",
    addressLines: ["Dakar"],
    email: "contact@diambar.sn",
    legal: "NINEA 123",
  },
  buyer: { label: "Client", name: "Le Baobab", addressLines: ["Plateau"], email: "" },
  items: Array.from({ length: n }, (_, i) => ({
    name: `Ligne ${i + 1}`,
    qty: "1",
    unitPrice: 100,
    amount: i % 2 ? -100 : 100,
  })),
  totals: [{ label: "Total", amount: 0, bold: true }],
  amountDue: 0,
});

async function text(d: InvoiceData) {
  return new TextDecoder().decode(await buildDiambarInvoice(d).arrayBuffer());
}

describe("PDF Diambar", () => {
  it("une page pour une facture courte, avec une table de références juste", async () => {
    const pdf = await text(base(3));
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("/Count 1");
    expect(pdf).toContain("(Page 1 sur 1)");
    // Chaque entrée de la table xref pointe sur le bon objet.
    const offsets = [...pdf.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    offsets.forEach((o, i) => expect(pdf.slice(o, o + 12)).toMatch(new RegExp(`^${i + 1} 0 obj`)));
  });

  it("plusieurs pages quand le tableau déborde (relevé)", async () => {
    const pdf = await text({ ...base(80), title: "Releve", hideAmountDue: true });
    const count = Number(pdf.match(/\/Count (\d+)/)?.[1]);
    expect(count).toBeGreaterThan(1);
    expect(pdf).toContain(`(Page ${count} sur ${count})`);
    expect(pdf).toContain("(Releve - suite)");
    expect(pdf).toContain("(Ligne 80)");
    expect(pdf).not.toContain("(Montant du)");
    expect(pdf).toContain("(-100 FCFA)");
  });
});
