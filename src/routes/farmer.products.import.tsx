import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Upload, FileSpreadsheet, ArrowLeft, Check, X, Download } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { Button } from "@/components/ui/button";
import { productActions } from "@/data/store";
import { downloadCsv } from "@/lib/export";
import { CATEGORIES, SAMPLE_IMAGES } from "@/components/farmer/product-form";
import type { Product } from "@/data/mocks";

export const Route = createFileRoute("/farmer/products/import")({
  head: () => ({ meta: [{ title: "Importer CSV · Diambar Agro" }] }),
  component: ImportPage,
});

type ParsedRow = {
  name: string;
  category: string;
  price: string;
  unit: string;
  stock: string;
  sku: string;
  errors: string[];
};

const COLUMN_ALIASES: Record<string, keyof Omit<ParsedRow, "errors">> = {
  name: "name",
  nom: "name",
  category: "category",
  categorie: "category",
  catégorie: "category",
  price: "price",
  prix: "price",
  unit: "unit",
  unite: "unit",
  unité: "unit",
  stock: "stock",
  sku: "sku",
};

function normalizeHeader(h: string) {
  return h
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => normalizeHeader(h));
  const cols = headers.map((h) => COLUMN_ALIASES[h]);

  return lines.slice(1).map((line) => {
    const cells = line.split(sep).map((c) => c.trim());
    const row: Omit<ParsedRow, "errors"> = {
      name: "",
      category: "",
      price: "",
      unit: "kg",
      stock: "",
      sku: "",
    };
    cols.forEach((key, i) => {
      if (key && cells[i] !== undefined) row[key] = cells[i];
    });

    const errors: string[] = [];
    if (!row.name) errors.push("nom manquant");
    if (!CATEGORIES.includes(row.category as Product["category"]))
      errors.push(`catégorie invalide (attendu : ${CATEGORIES.join(", ")})`);
    if (!Number.isFinite(Number(row.price)) || Number(row.price) <= 0) errors.push("prix invalide");
    if (!Number.isFinite(Number(row.stock)) || Number(row.stock) < 0) errors.push("stock invalide");

    return { ...row, errors };
  });
}

function ImportPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [imported, setImported] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Format non pris en charge dans cette démo — utilisez un fichier .csv");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result));
      if (parsed.length === 0) {
        toast.error("Aucune ligne détectée dans le fichier");
        return;
      }
      setRows(parsed);
      setStep(2);
    };
    reader.readAsText(file);
  };

  const validCount = rows.filter((r) => r.errors.length === 0).length;

  const confirmImport = () => {
    const valid = rows.filter((r) => r.errors.length === 0);
    valid.forEach((r, i) => {
      const stock = Number(r.stock);
      productActions.create({
        name: r.name,
        category: r.category as Product["category"],
        pricePerKg: Number(r.price),
        unit: r.unit || "kg",
        stock,
        minStock: Math.max(5, Math.round(stock * 0.2)),
        sku: r.sku || `SKU-IMP-${Date.now()}-${i}`,
        image: SAMPLE_IMAGES[i % SAMPLE_IMAGES.length],
        status: "active",
        ordersThisMonth: 0,
        farmerId: "f1",
      });
    });
    setImported(valid.length);
    setStep(3);
    toast.success(`${valid.length} produit(s) importé(s)`);
  };

  const downloadTemplate = () => {
    downloadCsv(
      "modele-import-produits",
      ["name", "category", "price", "unit", "stock", "sku"],
      [
        ["Tomates fraîches", "Légumes", 850, "kg", 50, "SKU-TOM-001"],
        ["Mangues Kent", "Fruits", 600, "kg", 80, "SKU-MAN-004"],
      ],
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Importer un fichier CSV"
        subtitle="Ajoutez plusieurs produits d'un coup"
        actions={
          <Button asChild variant="outline" className="gap-2">
            <Link to="/farmer/products">
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Link>
          </Button>
        }
      />

      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`flex-1 h-1.5 rounded-full ${s <= step ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="glass rounded-2xl p-10 text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 text-primary grid place-items-center">
            <Upload className="h-8 w-8" />
          </div>
          <h3 className="font-semibold">Déposez votre fichier CSV</h3>
          <p className="text-sm text-muted-foreground">
            Colonnes attendues : name, category, price, unit, stock, sku
          </p>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-xl p-8 mx-auto max-w-md hover:border-primary/50 transition cursor-pointer"
          >
            <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground" />
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
            <p className="mt-3 text-xs text-muted-foreground">Cliquez pour choisir un fichier</p>
          </div>
          <Button variant="outline" onClick={downloadTemplate} className="gap-2">
            <Download className="h-4 w-4" />
            Télécharger un modèle
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="glass rounded-2xl p-6 space-y-4">
          <h3 className="font-semibold">
            Aperçu — {rows.length} ligne(s) détectée(s), {validCount} valide(s)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left py-2 w-8"></th>
                  <th className="text-left py-2">Nom</th>
                  <th className="text-left">Catégorie</th>
                  <th className="text-right">Prix</th>
                  <th className="text-right">Stock</th>
                  <th className="text-left">SKU</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={i}
                    className={`border-b border-border last:border-0 ${r.errors.length > 0 ? "bg-destructive/5" : ""}`}
                    title={r.errors.join(" · ") || undefined}
                  >
                    <td className="py-2">
                      {r.errors.length === 0 ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <X className="h-4 w-4 text-destructive" />
                      )}
                    </td>
                    <td className="py-2 font-medium">{r.name || "—"}</td>
                    <td className="text-muted-foreground">{r.category || "—"}</td>
                    <td className="text-right">
                      {r.price ? `${Number(r.price).toLocaleString("fr-FR")} FCFA` : "—"}
                    </td>
                    <td className="text-right">
                      {r.stock} {r.unit}
                    </td>
                    <td className="font-mono text-xs">{r.sku || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.some((r) => r.errors.length > 0) && (
            <p className="text-xs text-destructive">
              Les lignes en rouge seront ignorées (survolez pour voir le motif).
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              Retour
            </Button>
            <Button onClick={confirmImport} disabled={validCount === 0}>
              Valider l'import ({validCount})
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="glass rounded-2xl p-10 text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-full bg-emerald-500/15 text-emerald-500 grid place-items-center">
            <Check className="h-8 w-8" />
          </div>
          <h3 className="font-semibold">Import réussi</h3>
          <p className="text-sm text-muted-foreground">
            {imported} produit(s) {imported > 1 ? "ont été ajoutés" : "a été ajouté"} à votre
            catalogue.
          </p>
          <Button onClick={() => navigate({ to: "/farmer/products" })}>Voir mes produits</Button>
        </div>
      )}
    </div>
  );
}
