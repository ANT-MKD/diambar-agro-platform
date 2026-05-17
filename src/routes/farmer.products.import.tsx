import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Upload, FileSpreadsheet, ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/farmer/products/import")({
  head: () => ({ meta: [{ title: "Importer Excel · Diambar Agro" }] }),
  component: ImportPage,
});

const sample = [
  { name: "Tomates fraîches", category: "Légumes", price: 850, unit: "kg", stock: 50, sku: "SKU-TOM-001" },
  { name: "Oignons rouges", category: "Légumes", price: 450, unit: "kg", stock: 30, sku: "SKU-OIG-002" },
  { name: "Mangues Kent", category: "Fruits", price: 600, unit: "kg", stock: 80, sku: "SKU-MAN-004" },
];

function ImportPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  return (
    <div className="space-y-6">
      <PageHeader title="Importer un fichier Excel" subtitle="Ajoutez plusieurs produits d'un coup" actions={
        <Button asChild variant="outline" className="gap-2"><Link to="/farmer/products"><ArrowLeft className="h-4 w-4" />Retour</Link></Button>
      } />

      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className={`flex-1 h-1.5 rounded-full ${s <= step ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>

      {step === 1 && (
        <div className="glass rounded-2xl p-10 text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 text-primary grid place-items-center"><Upload className="h-8 w-8" /></div>
          <h3 className="font-semibold">Déposez votre fichier Excel ou CSV</h3>
          <p className="text-sm text-muted-foreground">Formats acceptés : .xlsx, .csv (max 5 Mo)</p>
          <div className="border-2 border-dashed border-border rounded-xl p-8 mx-auto max-w-md hover:border-primary/50 transition">
            <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground" />
            <input type="file" accept=".xlsx,.csv" className="mt-3 mx-auto" onChange={() => setStep(2)} />
          </div>
          <Button onClick={() => setStep(2)}>Simuler un import</Button>
        </div>
      )}

      {step === 2 && (
        <div className="glass rounded-2xl p-6 space-y-4">
          <h3 className="font-semibold">Aperçu — 3 produits détectés</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border">
                <tr><th className="text-left py-2">Nom</th><th className="text-left">Catégorie</th><th className="text-right">Prix</th><th className="text-right">Stock</th><th className="text-left">SKU</th></tr>
              </thead>
              <tbody>
                {sample.map((r, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="py-2 font-medium">{r.name}</td>
                    <td className="text-muted-foreground">{r.category}</td>
                    <td className="text-right">{r.price.toLocaleString("fr-FR")} FCFA</td>
                    <td className="text-right">{r.stock} {r.unit}</td>
                    <td className="font-mono text-xs">{r.sku}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>Retour</Button>
            <Button onClick={() => { setStep(3); toast.success("3 produits importés"); }}>Valider l'import</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="glass rounded-2xl p-10 text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-full bg-emerald-500/15 text-emerald-500 grid place-items-center"><Check className="h-8 w-8" /></div>
          <h3 className="font-semibold">Import réussi</h3>
          <p className="text-sm text-muted-foreground">3 produits ont été ajoutés à votre catalogue.</p>
          <Button asChild><Link to="/farmer/products">Voir mes produits</Link></Button>
        </div>
      )}
    </div>
  );
}