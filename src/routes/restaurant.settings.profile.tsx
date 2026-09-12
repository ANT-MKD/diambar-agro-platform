import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SettingsCard, FieldRow } from "@/components/common/settings-shell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/restaurant/settings/profile")({
  head: () => ({
    meta: [
      { title: "Profil · Paramètres restaurant · Diambar Agro" },
      {
        name: "description",
        content: "Modifiez le profil public de votre restaurant sur Diambar Agro.",
      },
      { property: "og:title", content: "Profil · Paramètres restaurant" },
      { property: "og:description", content: "Profil public de votre restaurant." },
    ],
  }),
  component: RestaurantProfileSettings,
});

function RestaurantProfileSettings() {
  const [form, setForm] = useState({
    name: "Le Baobab",
    cuisine: "Sénégalaise",
    phone: "+221 77 123 45 67",
    email: "contact@lebaobab.sn",
    manager: "Fatou Sarr",
    bio: "Cuisine sénégalaise contemporaine, 80 couverts, approvisionnement local.",
  });
  const set = (k: keyof typeof form, v: string) => setForm({ ...form, [k]: v });
  return (
    <SettingsCard
      title="Profil restaurant"
      description="Ces informations sont visibles par vos producteurs."
    >
      <div className="flex items-center gap-4">
        <img
          src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200"
          alt="Photo du restaurant Le Baobab"
          className="h-20 w-20 rounded-2xl object-cover ring-2 ring-amber-500/30"
        />
        <div>
          <Button type="button" variant="outline" size="sm">
            Changer la photo
          </Button>
          <p className="text-xs text-muted-foreground mt-2">JPG ou PNG, max 2 Mo</p>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <FieldRow label="Nom">
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
        </FieldRow>
        <FieldRow label="Type de cuisine">
          <Input value={form.cuisine} onChange={(e) => set("cuisine", e.target.value)} />
        </FieldRow>
        <FieldRow label="Téléphone">
          <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </FieldRow>
        <FieldRow label="Email">
          <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </FieldRow>
      </div>
      <FieldRow label="Responsable des achats">
        <Input value={form.manager} onChange={(e) => set("manager", e.target.value)} />
      </FieldRow>
      <FieldRow label="Présentation">
        <Textarea rows={3} value={form.bio} onChange={(e) => set("bio", e.target.value)} />
      </FieldRow>
    </SettingsCard>
  );
}
