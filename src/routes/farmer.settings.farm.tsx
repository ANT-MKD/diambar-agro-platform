import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { SettingsCard, FieldRow } from "@/components/common/settings-shell";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCities } from "@/data/admin-store";
import { useFarmerFarm, farmerFarmActions } from "@/data/store";

export const Route = createFileRoute("/farmer/settings/farm")({
  head: () => ({
    meta: [
      { title: "Exploitation · Paramètres agriculteur · Diambar Agro" },
      {
        name: "description",
        content:
          "Renseignez les détails de votre exploitation agricole : ville, superficie, types de produits.",
      },
      { property: "og:title", content: "Exploitation · Paramètres agriculteur" },
      {
        property: "og:description",
        content: "Détails de votre exploitation agricole sur Diambar Agro.",
      },
    ],
  }),
  component: FarmSettings,
});

const PRODUCT_TYPES = [
  "Légumes",
  "Fruits",
  "Volaille",
  "Viande",
  "Céréales",
  "Tubercules",
  "Épices",
];

function FarmSettings() {
  const farm = useFarmerFarm();
  const cities = useCities();
  const [form, setForm] = useState(farm);
  const toggle = (t: string) =>
    setForm({
      ...form,
      types: form.types.includes(t) ? form.types.filter((x) => x !== t) : [...form.types, t],
    });

  const save = () => {
    if (!form.name.trim()) {
      toast.error("Le nom de l'exploitation est obligatoire");
      return false;
    }
    if (form.types.length === 0) {
      toast.error("Sélectionnez au moins un type de produit");
      return false;
    }
    const size = Number(form.size);
    if (!Number.isFinite(size) || size <= 0) {
      toast.error("Superficie invalide");
      return false;
    }
    farmerFarmActions.update(form);
    return true;
  };

  return (
    <SettingsCard
      title="Exploitation"
      description="Détails de votre exploitation agricole."
      onSave={save}
    >
      <FieldRow label="Nom de l'exploitation">
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </FieldRow>
      <div className="grid sm:grid-cols-2 gap-4">
        <FieldRow label="Ville">
          <Select value={form.city} onValueChange={(v) => setForm({ ...form, city: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {cities.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Superficie (ha)">
          <Input
            type="number"
            step="0.1"
            value={form.size}
            onChange={(e) => setForm({ ...form, size: e.target.value })}
          />
        </FieldRow>
      </div>
      <FieldRow label="Adresse précise">
        <Input
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
      </FieldRow>
      <FieldRow label="Certification" hint="Affichée sur votre vitrine marketplace.">
        <Select
          value={form.certification}
          onValueChange={(v) => setForm({ ...form, certification: v as typeof form.certification })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Aucune</SelectItem>
            <SelectItem value="bio">Agriculture biologique</SelectItem>
            <SelectItem value="raisonnee">Agriculture raisonnée</SelectItem>
            <SelectItem value="globalgap">GLOBALG.A.P.</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>
      <FieldRow label="Types de produits">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PRODUCT_TYPES.map((t) => (
            <label
              key={t}
              className={`rounded-xl border px-3 py-2.5 flex items-center gap-2 text-sm cursor-pointer ${form.types.includes(t) ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <input
                type="checkbox"
                checked={form.types.includes(t)}
                onChange={() => toggle(t)}
                className="rounded"
              />
              {t}
            </label>
          ))}
        </div>
      </FieldRow>
    </SettingsCard>
  );
}
