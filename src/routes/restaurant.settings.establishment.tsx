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
import { RECEPTION_DAYS, type ReceptionDay, type ReceptionSlot } from "@/data/mocks";
import { useRestaurantProfile, restaurantProfileActions } from "@/data/store";
import { useCities } from "@/data/admin-store";

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

function EstablishmentSettings() {
  const profile = useRestaurantProfile();
  const cities = useCities();
  const [form, setForm] = useState({
    address: profile.deliveryAddress,
    city: profile.city,
    capacity: String(profile.capacity),
    ninea: profile.ninea,
  });
  const [slots, setSlots] = useState<Record<ReceptionDay, ReceptionSlot>>(profile.receptionHours);

  const saveInfo = () => {
    const capacity = Number(form.capacity);
    if (!form.address.trim() || form.address.trim().length < 10) {
      toast.error("Adresse trop courte (min 10 caractères)");
      return false;
    }
    if (!Number.isFinite(capacity) || capacity <= 0) {
      toast.error("Capacité invalide");
      return false;
    }
    restaurantProfileActions.update({
      deliveryAddress: form.address,
      city: form.city,
      capacity,
      ninea: form.ninea,
    });
    return true;
  };

  const saveSlots = () => {
    restaurantProfileActions.update({ receptionHours: slots });
    return true;
  };

  return (
    <>
      <SettingsCard
        title="Établissement"
        description="Coordonnées utilisées pour vos livraisons et factures."
        onSave={saveInfo}
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
        description="Heures pendant lesquelles vous pouvez recevoir les livraisons. Ces créneaux alimentent directement le choix proposé à vos producteurs au moment de la commande."
        onSave={saveSlots}
      >
        <div className="space-y-2">
          {RECEPTION_DAYS.map((d) => (
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
