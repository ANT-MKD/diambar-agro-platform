import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { type Product } from "@/data/mocks";
import { formatFCFA } from "@/lib/format";
import { StockStatusBadge } from "./status-badge";

export const CATEGORIES: Product["category"][] = [
  "Légumes",
  "Fruits",
  "Viande",
  "Volaille",
  "Céréales",
  "Tubercules",
  "Épices",
];
export const SAMPLE_IMAGES = [
  "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600",
  "https://images.unsplash.com/photo-1620574387735-3624d75b2dbc?w=600",
  "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600",
  "https://images.unsplash.com/photo-1582515073490-39981397c445?w=600",
];

export type ProductDraft = Omit<Product, "id" | "ordersThisMonth"> & {
  description?: string;
  minOrder?: number;
  minPrice?: number;
  pickupAddress?: string;
  availableFrom?: string;
  barcode?: string;
  organic?: boolean;
  publicVisible?: boolean;
  recurring?: boolean;
  notes?: string;
  photos?: string[];
};

const empty: ProductDraft = {
  name: "",
  category: "Légumes",
  pricePerKg: 0,
  unit: "kg",
  stock: 0,
  minStock: 0,
  sku: "",
  image: SAMPLE_IMAGES[0],
  status: "draft",
  farmerId: "f1",
  description: "",
  minOrder: 1,
  minPrice: 0,
  pickupAddress: "Thiès, Route de Khombole",
  availableFrom: "",
  barcode: "",
  organic: false,
  publicVisible: true,
  recurring: false,
  notes: "",
  photos: [SAMPLE_IMAGES[0]],
};

export function ProductForm({
  initial,
  onSubmit,
  submitLabel,
}: {
  initial?: ProductDraft;
  onSubmit: (d: ProductDraft, publish: boolean) => void;
  submitLabel: string;
}) {
  const navigate = useNavigate();
  const [form, setForm] = useState<ProductDraft>(initial ?? empty);
  const set = <K extends keyof ProductDraft>(k: K, v: ProductDraft[K]) =>
    setForm({ ...form, [k]: v });
  const addPhoto = (url: string) => {
    if (!url) return;
    const photos = [...(form.photos ?? []), url].slice(0, 5);
    setForm({ ...form, photos, image: photos[0] });
  };
  const removePhoto = (i: number) => {
    const photos = (form.photos ?? []).filter((_, j) => j !== i);
    setForm({ ...form, photos, image: photos[0] ?? SAMPLE_IMAGES[0] });
  };
  const setMain = (i: number) => {
    const photos = form.photos ?? [];
    if (!photos[i]) return;
    setForm({ ...form, image: photos[i] });
  };

  const submit = (publish: boolean) => {
    if (!form.name || form.pricePerKg <= 0 || !form.sku) {
      toast.error("Renseignez nom, prix et SKU");
      return;
    }
    onSubmit(
      {
        ...form,
        status: publish
          ? form.stock === 0
            ? "out"
            : form.stock < form.minStock
              ? "low"
              : "active"
          : "draft",
      },
      publish,
    );
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Section title="Informations produit">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Nom *">
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Tomates fraîches"
              />
            </Field>
            <Field label="SKU *">
              <Input
                value={form.sku}
                onChange={(e) => set("sku", e.target.value)}
                placeholder="SKU-TOM-001"
              />
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Catégorie *">
              <Select
                value={form.category}
                onValueChange={(v) => set("category", v as Product["category"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Code-barres">
              <Input
                value={form.barcode}
                onChange={(e) => set("barcode", e.target.value)}
                placeholder="0123456789012"
              />
            </Field>
          </div>
          <Field label="Description (max 500)">
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => set("description", e.target.value.slice(0, 500))}
              placeholder="Tomates cueillies le matin, calibre moyen…"
            />
          </Field>
        </Section>

        <Section title="Prix & quantités">
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Unité">
              <Select value={form.unit} onValueChange={(v) => set("unit", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["kg", "litre", "unité", "botte", "sac"].map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Prix de vente (FCFA) *">
              <Input
                type="number"
                value={form.pricePerKg}
                onChange={(e) => set("pricePerKg", Number(e.target.value))}
              />
            </Field>
            <Field label="Prix minimum">
              <Input
                type="number"
                value={form.minPrice}
                onChange={(e) => set("minPrice", Number(e.target.value))}
              />
            </Field>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Quantité disponible">
              <Input
                type="number"
                value={form.stock}
                onChange={(e) => set("stock", Number(e.target.value))}
              />
            </Field>
            <Field label="Stock minimum">
              <Input
                type="number"
                value={form.minStock}
                onChange={(e) => set("minStock", Number(e.target.value))}
              />
            </Field>
            <Field label="Commande min.">
              <Input
                type="number"
                value={form.minOrder}
                onChange={(e) => set("minOrder", Number(e.target.value))}
              />
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Disponible à partir du">
              <Input
                type="date"
                value={form.availableFrom}
                onChange={(e) => set("availableFrom", e.target.value)}
              />
            </Field>
            <Field label="Lieu de collecte">
              <Input
                value={form.pickupAddress}
                onChange={(e) => set("pickupAddress", e.target.value)}
              />
            </Field>
          </div>
        </Section>

        <Section title="Options">
          <ToggleRow
            label="Visible dans le catalogue public"
            checked={form.publicVisible ?? true}
            onChange={(v) => set("publicVisible", v)}
          />
          <ToggleRow
            label="Accepte les commandes récurrentes"
            checked={form.recurring ?? false}
            onChange={(v) => set("recurring", v)}
          />
          <ToggleRow
            label="Certification bio"
            checked={form.organic ?? false}
            onChange={(v) => set("organic", v)}
          />
          <Field label="Notes internes (non visibles par les clients)">
            <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </Section>
      </div>

      <div className="space-y-6">
        <Section title="Photos">
          <div className="grid grid-cols-3 gap-2">
            {(form.photos ?? []).map((url, i) => (
              <div
                key={i}
                className="relative aspect-square rounded-lg overflow-hidden border border-border group"
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
                {form.image === url && (
                  <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded">
                    Principale
                  </span>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => setMain(i)}
                    className="text-[10px] bg-white text-black px-2 py-1 rounded"
                  >
                    ★
                  </button>
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="text-[10px] bg-destructive text-white px-1.5 py-1 rounded"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
            {(form.photos ?? []).length < 5 && (
              <button
                type="button"
                onClick={() =>
                  addPhoto(SAMPLE_IMAGES[(form.photos ?? []).length % SAMPLE_IMAGES.length])
                }
                className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 text-muted-foreground text-[10px]"
              >
                <Upload className="h-4 w-4" />
                Ajouter
              </button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Jusqu'à 5 photos. Cliquez ★ pour définir la photo principale.
          </p>
        </Section>

        <Section title="Aperçu">
          <div className="rounded-xl overflow-hidden border border-border">
            <div className="aspect-[4/3] bg-muted overflow-hidden">
              <img
                src={form.image || SAMPLE_IMAGES[0]}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-sm">{form.name || "Nom du produit"}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {form.category} · {form.sku || "SKU"}
                  </div>
                </div>
                <StockStatusBadge status={form.status} />
              </div>
              <div className="text-primary font-bold">
                {formatFCFA(form.pricePerKg)}
                <span className="text-xs text-muted-foreground font-normal">/{form.unit}</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {form.stock} {form.unit} disponibles
              </div>
            </div>
          </div>
        </Section>
      </div>

      <div className="lg:col-span-3 flex justify-end gap-2 sticky bottom-0 bg-background/80 backdrop-blur py-3 -mx-4 px-4 rounded-xl">
        <Button variant="outline" onClick={() => navigate({ to: "/farmer/products" })}>
          Annuler
        </Button>
        <Button variant="outline" onClick={() => submit(false)}>
          Enregistrer en brouillon
        </Button>
        <Button onClick={() => submit(true)}>{submitLabel}</Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <h3 className="font-semibold text-sm">{title}</h3>
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}
function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
