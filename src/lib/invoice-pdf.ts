// Pro PDF generator (no deps) — matches the DIAMBAR AGRO reference layout.
// Standard-14 Helvetica + Helvetica-Bold. Accents are stripped for PDF text
// so byte-level encoding stays ASCII-safe; on-screen preview keeps full accents.

type RGB = [number, number, number];
type Align = "left" | "right";
type TextOpts = { bold?: boolean; color?: RGB; align?: Align };

export type InvoiceItem = {
  name: string;
  sub?: string;
  qty: string;
  qtyUnit?: string;
  unitPrice: number;
  amount: number;
};

export type InvoiceData = {
  number: string;
  issuedAt: Date;
  dueAt: Date;
  orderRef: string;
  seller: { name: string; addressLines: string[]; email: string; legal: string };
  buyer: { label: string; name: string; addressLines: string[]; email: string };
  brand?: { name: string; tagline?: string; color?: RGB };
  paidBanner?: string; // e.g. "22 538 FCFA payés" or "Facture en attente"
  items: InvoiceItem[];
  // Lignes de total dans l'ordre d'affichage (marchandise, livraison,
  // remises…, total payé) : la facture reprend exactement le montant payé.
  totals: { label: string; amount: number; bold?: boolean }[];
  amountDue: number;
  note?: string;
};

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
// Force the string into pure printable ASCII so the raw PDF bytes stay one-byte-per-char.
function toAscii(s: string): string {
  return stripAccents(s)
    .replace(/[\u00A0\u202F\u2007\u2009\u200A]/g, " ") // NBSP + narrow NBSPs → space
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2022/g, "*")
    .replace(/\u00B7/g, "-") // middle dot
    .replace(/[\u2026]/g, "...")
    .replace(/[^\x20-\x7E]/g, ""); // drop anything else non-ASCII
}
function pdfEscape(s: string): string {
  return toAscii(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

// Rough Helvetica widths (units of 1/1000 em) — good enough for right-alignment of short numeric strings.
const NARROW = new Set("ijl|!.,;:'`I ");
const MED = new Set("trf()[]-");
const WIDE = new Set("MW");
const XWIDE = new Set("mw");
function textWidth(s: string, size: number, bold = false): number {
  let w = 0;
  for (const c of toAscii(s)) {
    if (NARROW.has(c)) w += 278;
    else if (MED.has(c)) w += 333;
    else if (XWIDE.has(c)) w += 889;
    else if (WIDE.has(c)) w += 833;
    else w += 556;
  }
  return (w / 1000) * size * (bold ? 1.03 : 1);
}

function drawText(
  ops: string[],
  text: string,
  x: number,
  y: number,
  size: number,
  opts: TextOpts = {},
) {
  const bold = opts.bold ?? false;
  const font = bold ? "/F2" : "/F1";
  const [r, g, b] = opts.color ?? [0.06, 0.06, 0.08];
  const tx = opts.align === "right" ? x - textWidth(text, size, bold) : x;
  ops.push(`${r} ${g} ${b} rg`);
  ops.push("BT");
  ops.push(`${font} ${size} Tf`);
  ops.push(`${tx.toFixed(2)} ${y.toFixed(2)} Td`);
  ops.push(`(${pdfEscape(text)}) Tj`);
  ops.push("ET");
}
function drawLine(
  ops: string[],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: RGB = [0.85, 0.85, 0.87],
  width = 0.5,
) {
  ops.push(`${color[0]} ${color[1]} ${color[2]} RG`);
  ops.push(`${width} w`);
  ops.push(`${x1} ${y1} m ${x2} ${y2} l S`);
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n);
}
function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function buildDiambarInvoice(d: InvoiceData): Blob {
  const W = 595;
  const H = 842;
  const ML = 56;
  const MR = W - 56;
  const BLACK: RGB = [0.06, 0.06, 0.08];
  const GRAY: RGB = [0.45, 0.45, 0.5];
  const BRAND: RGB = d.brand?.color ?? [0.13, 0.68, 0.37];
  const brandName = d.brand?.name ?? "DIAMBAR AGRO";
  const tagline = d.brand?.tagline ?? "Logistique alimentaire";

  const ops: string[] = [];

  // ─── Header ────────────────────────────────────────────────────────────
  drawText(ops, "Facture", ML, H - 100, 40, { bold: true, color: BLACK });
  drawText(ops, brandName, MR, H - 85, 15, { bold: true, color: BRAND, align: "right" });
  drawText(ops, tagline, MR, H - 102, 9, { color: GRAY, align: "right" });

  // ─── Info block ─────────────────────────────────────────────────────────
  let y = H - 160;
  const infoRows: [string, string][] = [
    ["Numero de facture", d.number],
    ["Date d'emission", fmtDate(d.issuedAt)],
    ["Date d'echeance", fmtDate(d.dueAt)],
    ["Commande", d.orderRef],
  ];
  for (const [k, v] of infoRows) {
    drawText(ops, k, ML, y, 9, { color: GRAY });
    drawText(ops, v, ML + 130, y, 9.5, { bold: true, color: BLACK });
    y -= 17;
  }

  // ─── Seller ─── Destinataire ───────────────────────────────────────────
  const partiesY = H - 275;
  drawText(ops, d.seller.name, ML, partiesY, 10, { bold: true, color: BLACK });
  drawText(ops, d.buyer.label, ML + 280, partiesY, 9, { color: GRAY });

  let ys = partiesY - 20;
  for (const line of d.seller.addressLines) {
    drawText(ops, line, ML, ys, 9, { color: GRAY });
    ys -= 13;
  }
  drawText(ops, d.seller.email, ML, ys, 9, { color: GRAY });
  ys -= 13;
  drawText(ops, d.seller.legal, ML, ys, 8, { color: GRAY });

  let yb = partiesY - 20;
  drawText(ops, d.buyer.name, ML + 280, yb, 10, { bold: true, color: BLACK });
  yb -= 18;
  for (const line of d.buyer.addressLines) {
    drawText(ops, line, ML + 280, yb, 9, { color: GRAY });
    yb -= 13;
  }
  drawText(ops, d.buyer.email, ML + 280, yb, 9, { color: GRAY });

  // ─── Paid banner ───────────────────────────────────────────────────────
  y = H - 420;
  const banner = d.paidBanner ?? `${fmtMoney(d.amountDue)} FCFA a payer`;
  drawText(ops, banner, ML, y, 22, { bold: true, color: BLACK });

  // ─── Table header ──────────────────────────────────────────────────────
  y -= 30;
  drawLine(ops, ML, y, MR, y);
  y -= 18;
  drawText(ops, "Designation", ML, y, 9, { color: GRAY });
  drawText(ops, "Qte", ML + 320, y, 9, { color: GRAY, align: "right" });
  drawText(ops, "Prix unitaire HT", ML + 420, y, 9, { color: GRAY, align: "right" });
  drawText(ops, "Montant HT", MR, y, 9, { color: GRAY, align: "right" });
  y -= 8;
  drawLine(ops, ML, y, MR, y);

  // ─── Rows ──────────────────────────────────────────────────────────────
  for (const it of d.items) {
    y -= 22;
    drawText(ops, it.name, ML, y, 10, { bold: true, color: BLACK });
    drawText(ops, it.qty, ML + 320, y, 10, { color: BLACK, align: "right" });
    drawText(ops, `${fmtMoney(it.unitPrice)} FCFA`, ML + 420, y, 10, {
      color: BLACK,
      align: "right",
    });
    drawText(ops, `${fmtMoney(it.amount)} FCFA`, MR, y, 10, { color: BLACK, align: "right" });
    if (it.qtyUnit) drawText(ops, it.qtyUnit, ML + 320, y - 12, 8, { color: GRAY, align: "right" });
    if (it.sub) drawText(ops, it.sub, ML, y - 12, 8, { color: GRAY });
    y -= it.sub || it.qtyUnit ? 18 : 10;
    drawLine(ops, ML, y, MR, y);
  }

  // ─── Totals (right column) ─────────────────────────────────────────────
  y -= 25;
  const totals: [string, string, boolean][] = [
    ...d.totals.map(
      (t) =>
        [t.label, `${t.amount < 0 ? "-" : ""}${fmtMoney(Math.abs(t.amount))} FCFA`, !!t.bold] as [
          string,
          string,
          boolean,
        ],
    ),
    ["Montant du", `${fmtMoney(d.amountDue)} FCFA`, true],
  ];
  for (const [k, v, bold] of totals) {
    drawText(ops, k, ML + 340, y, 10, { color: bold ? BLACK : GRAY, bold });
    drawText(ops, v, MR, y, 10, { color: BLACK, align: "right", bold });
    y -= 20;
  }

  if (d.note) drawText(ops, d.note, ML, y - 10, 8, { color: GRAY });

  // ─── Footer ────────────────────────────────────────────────────────────
  drawLine(ops, ML, 70, MR, 70);
  drawText(ops, d.seller.legal, ML, 55, 8, { color: GRAY });
  drawText(ops, "Page 1 sur 1", MR, 55, 8, { color: GRAY, align: "right" });

  // ─── Assemble PDF ──────────────────────────────────────────────────────
  const stream = ops.join("\n");
  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Count 1 /Kids [3 0 R] >>");
  objects.push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`,
  );
  objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objects.push(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  );

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => {
    pdf += `${String(o).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

export function downloadDiambarInvoice(filename: string, data: InvoiceData) {
  const blob = buildDiambarInvoice(data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
