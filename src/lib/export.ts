import { toast } from "sonner";

function download(blob: Blob, filename: string) {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeCell(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers, ...rows].map((r) => r.map(escapeCell).join(";")).join("\n");
  download(
    new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }),
    filename.endsWith(".csv") ? filename : `${filename}.csv`,
  );
  toast.success("Export CSV téléchargé", { description: filename });
}

export function downloadJson(filename: string, data: unknown) {
  download(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    filename.endsWith(".json") ? filename : `${filename}.json`,
  );
  toast.success("Export JSON téléchargé", { description: filename });
}

export function downloadHtml(filename: string, html: string) {
  download(
    new Blob([html], { type: "text/html;charset=utf-8;" }),
    filename.endsWith(".html") ? filename : `${filename}.html`,
  );
  toast.success("Reçu téléchargé", { description: filename });
}
