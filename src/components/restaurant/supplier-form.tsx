import { useState } from "react";
import { Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Supplier } from "@/data/mocks";

export type SupplierFormValues = Omit<Supplier, "id" | "totalOrders" | "totalSpent" | "lastOrder">;

export function SupplierForm({
  initial,
  submitLabel = "Enregistrer",
  onSubmit,
  onCancel,
}: {
  initial?: Partial<SupplierFormValues>;
  submitLabel?: string;
  onSubmit: (v: SupplierFormValues) => void;
  onCancel?: () => void;
}) {
  const [v, setV] = useState<SupplierFormValues>({
    name: initial?.name ?? "",
    contact: initial?.contact ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    city: initial?.city ?? "",
    notes: initial?.notes ?? "",
    favorite: initial?.favorite ?? false,
    suspended: initial?.suspended ?? false,
    farmerId: initial?.farmerId,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof SupplierFormValues>(k: K, val: SupplierFormValues[K]) => setV((p) => ({ ...p, [k]: val }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (v.name.trim().length < 2) e.name = "Nom requis (2 caractères min.)";
    if (v.contact.trim().length < 2) e.contact = "Nom du contact requis";
    if (!/^\+?[0-9\s]{7,20}$/.test(v.phone.trim())) e.phone = "Téléphone invalide";
    if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) e.email = "Email invalide";
    if (v.city.trim().length < 2) e.city = "Ville requise";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) onSubmit(v);
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="glass rounded-2xl p-5 space-y-4">
        <h3 className="font-display font-bold text-lg">Informations générales</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Nom du fournisseur *</Label>
            <Input value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="Ferme Diallo" />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Ville *</Label>
            <Input value={v.city} onChange={(e) => set("city", e.target.value)} placeholder="Thiès" />
            {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-5 space-y-4">
        <h3 className="font-display font-bold text-lg">Contact</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Personne de contact *</Label>
            <Input value={v.contact} onChange={(e) => set("contact", e.target.value)} placeholder="Mamadou Diallo" />
            {errors.contact && <p className="text-xs text-destructive">{errors.contact}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Téléphone *</Label>
            <Input value={v.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+221 77 000 00 00" />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Email *</Label>
            <Input type="email" value={v.email} onChange={(e) => set("email", e.target.value)} placeholder="contact@ferme.sn" />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-5 space-y-4">
        <h3 className="font-display font-bold text-lg">Notes internes</h3>
        <Textarea value={v.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder="Spécialité, qualité, remarques…" rows={4} />
        <div className="flex flex-wrap gap-4 pt-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.favorite} onChange={(e) => set("favorite", e.target.checked)} />
            Marquer comme favori
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.suspended} onChange={(e) => set("suspended", e.target.checked)} />
            Suspendre ce fournisseur
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel} className="gap-2"><X className="h-4 w-4" />Annuler</Button>}
        <Button type="submit" className="gap-2"><Save className="h-4 w-4" />{submitLabel}</Button>
      </div>
    </form>
  );
}