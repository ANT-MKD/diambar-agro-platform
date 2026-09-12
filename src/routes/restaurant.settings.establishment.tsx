import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SettingsCard, FieldRow } from "@/components/common/settings-shell";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cities } from "@/data/mocks";

export const Route = createFileRoute("/restaurant/settings/establishment")({
  head: () => ({
    meta: [
      { title: "Établissement · Paramètres restaurant · Diambar Agro" },
      {
        name: "description",
        content:
          "Adresse, capacité et horaires de réception des livraisons de votre établissement.",
      },
      { property: "og:title", content: "Établissement · Paramètres restaurant" },
      {
        property: "og:description",
        content: "Adresse et horaires de livraison de votre restaurant.",
      },
    ],
  }),
  component: EstablishmentSettings,
});

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

function EstablishmentSettings() {
  const [form, setForm] = useState({
    address: "Place de l'Indépendance, Dakar Plateau",
    city: "Dakar",
    capacity: "80",
    ninea: "00512345 2A2",
  });
  const [slots, setSlots] = useState<Record<string, { from: string; to: string; open: boolean }>>(
    Object.fromEntries(
      DAYS.map((d) => [d, { from: "07:00", to: "11:00", open: d !== "Dimanche" }]),
    ),
  );
  return (
    <>
      <SettingsCard
        title="Établissement"
        description="Coordonnées utilisées pour vos livraisons et factures."
      >
        <FieldRow label="Adresse">
          <Input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
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
          <FieldRow label="Capacité (couverts)">
            <Input
              type="number"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            />
          </FieldRow>
        </div>
        <FieldRow label="NINEA" hint="Numéro d'identification fiscale figurant sur vos factures.">
          <Input value={form.ninea} onChange={(e) => setForm({ ...form, ninea: e.target.value })} />
        </FieldRow>
      </SettingsCard>

      <SettingsCard
        title="Créneaux de réception"
        description="Heures pendant lesquelles vous pouvez recevoir les livraisons."
      >
        <div className="space-y-2">
          {DAYS.map((d) => (
            <div
              key={d}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3"
            >
              <label className="flex items-center gap-2 text-sm font-medium w-32">
                <input
                  type="checkbox"
                  className="rounded"
                  checked={slots[d].open}
                  onChange={(e) =>
                    setSlots({ ...slots, [d]: { ...slots[d], open: e.target.checked } })
                  }
                />
                {d}
              </label>
              <Input
                type="time"
                className="w-32"
                disabled={!slots[d].open}
                value={slots[d].from}
                onChange={(e) => setSlots({ ...slots, [d]: { ...slots[d], from: e.target.value } })}
              />
              <span className="text-muted-foreground text-sm">→</span>
              <Input
                type="time"
                className="w-32"
                disabled={!slots[d].open}
                value={slots[d].to}
                onChange={(e) => setSlots({ ...slots, [d]: { ...slots[d], to: e.target.value } })}
              />
            </div>
          ))}
        </div>
      </SettingsCard>
    </>
  );
}
