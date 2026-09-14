import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Plus, Minus, ClipboardEdit, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/farmer/page-header";
import { useProducts, movementActions, useFarmerProfile } from "@/data/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const searchSchema = z.object({
  productId: z.string().optional(),
  type: z.enum(["in", "out", "adjust"]).optional(),
});

export const Route = createFileRoute("/farmer/stock/movement/new")({
  head: () => ({ meta: [{ title: "Nouveau mouvement · Diambar Agro" }] }),
  validateSearch: (s) => searchSchema.parse(s),
  component: NewMovementPage,
});

const TYPES = [
  {
    v: "in",
    label: "Entrée (récolte / approvisionnement)",
    icon: Plus,
    tone: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  },
  {
    v: "out",
    label: "Sortie (perte / casse / périmé)",
    icon: Minus,
    tone: "bg-rose-500/10 text-rose-500 border-rose-500/30",
  },
  {
    v: "adjust",
    label: "Inventaire (saisie absolue)",
    icon: ClipboardEdit,
    tone: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  },
] as const;

function NewMovementPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const products = useProducts().filter((p) => p.farmerId === "f1");
  const profile = useFarmerProfile();

  const [productId, setProductId] = useState(search.productId || products[0]?.id || "");
  const [type, setType] = useState<"in" | "out" | "adjust">(search.type ?? "in");
  const [qty, setQty] = useState(0);
  const [reason, setReason] = useState("");

  const product = products.find((p) => p.id === productId);
  const next = !product
    ? 0
    : type === "in"
      ? product.stock + qty
      : type === "out"
        ? Math.max(0, product.stock - qty)
        : qty;

  const submit = () => {
    if (!product || qty <= 0) {
      toast.error("Choisissez un produit et une quantité > 0");
      return;
    }
    movementActions.create({
      productId: product.id,
      type,
      qty,
      reason: reason || "—",
      operator: profile.firstName,
    });
    toast.success(`Mouvement enregistré · ${product.name} maintenant à ${next} ${product.unit}`);
    navigate({ to: "/farmer/stock" });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Nouveau mouvement de stock"
        subtitle="Enregistrez une entrée, sortie ou inventaire"
        actions={
          <Button
            variant="outline"
            onClick={() => navigate({ to: "/farmer/stock" })}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
        }
      />

      <div className="glass rounded-2xl p-6 space-y-5">
        <div className="space-y-2">
          <Label>Type de mouvement</Label>
          <div className="grid sm:grid-cols-3 gap-2">
            {TYPES.map((t) => (
              <button
                key={t.v}
                type="button"
                onClick={() => setType(t.v)}
                className={`text-left rounded-xl border p-3 transition ${type === t.v ? t.tone + " ring-2 ring-current" : "border-border hover:border-primary/40"}`}
              >
                <t.icon className="h-5 w-5 mb-2" />
                <div className="text-xs font-medium">{t.label}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Produit</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner…" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.stock} {p.unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Quantité ({product?.unit ?? "kg"})</Label>
            <Input
              type="number"
              min={0}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Motif</Label>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Récolte du matin, perte au transport, inventaire mensuel…"
          />
        </div>

        {product && (
          <div className="rounded-xl bg-primary/10 border border-primary/20 p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Stock actuel → nouveau stock</div>
              <div className="font-bold text-lg">
                {product.stock} → <span className="text-primary">{next}</span> {product.unit}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate({ to: "/farmer/stock" })}>
            Annuler
          </Button>
          <Button onClick={submit}>Enregistrer le mouvement</Button>
        </div>
      </div>
    </div>
  );
}
