import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Save, Download } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { useProducts, productActions } from "@/data/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/farmer/stock/inventory")({
  head: () => ({ meta: [{ title: "Inventaire · Diambar Agro" }] }),
  component: InventoryPage,
});

function InventoryPage() {
  const navigate = useNavigate();
  const items = useProducts().filter((p) => p.farmerId === "f1");
  const [counts, setCounts] = useState<Record<string, number>>(() => Object.fromEntries(items.map((p) => [p.id, p.stock])));

  const validate = () => {
    items.forEach((p) => {
      if (counts[p.id] !== p.stock) productActions.setStock(p.id, counts[p.id]);
    });
    toast.success("Inventaire validé");
    navigate({ to: "/farmer/stock" });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Inventaire" subtitle="Comparez le stock théorique au stock réel" actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate({ to: "/farmer/stock" })} className="gap-2"><ArrowLeft className="h-4 w-4" />Retour</Button>
          <Button variant="outline" className="gap-2"><Download className="h-4 w-4" />Export</Button>
          <Button onClick={validate} className="gap-2"><Save className="h-4 w-4" />Valider</Button>
        </div>
      } />

      <div className="glass rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead className="text-right">Théorique</TableHead>
              <TableHead className="text-right">Réel</TableHead>
              <TableHead className="text-right">Écart</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((p) => {
              const diff = counts[p.id] - p.stock;
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{p.stock} {p.unit}</TableCell>
                  <TableCell className="text-right w-32">
                    <Input type="number" value={counts[p.id]} onChange={(e) => setCounts({ ...counts, [p.id]: Number(e.target.value) })} className="text-right" />
                  </TableCell>
                  <TableCell className={`text-right font-semibold ${diff === 0 ? "text-muted-foreground" : diff > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                    {diff > 0 ? "+" : ""}{diff}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}