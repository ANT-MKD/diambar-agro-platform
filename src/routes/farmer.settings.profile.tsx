import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SettingsCard, FieldRow } from "@/components/common/settings-shell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/farmer/settings/profile")({
  head: () => ({
    meta: [
      { title: "Profil · Paramètres agriculteur · Diambar Agro" },
      { name: "description", content: "Modifiez vos informations personnelles de producteur sur Diambar Agro." },
      { property: "og:title", content: "Profil · Paramètres agriculteur" },
      { property: "og:description", content: "Modifiez vos informations personnelles de producteur." },
    ],
  }),
  component: ProfileSettings,
});

function ProfileSettings() {
  const [form, setForm] = useState({
    firstName: "Mamadou",
    lastName: "Diallo",
    email: "mamadou@diallo-farm.sn",
    phone: "77 123 45 67",
    lang: "fr",
    bio: "Producteur de tomates et oignons depuis 2015 à Thiès.",
  });
  const set = (k: keyof typeof form, v: string) => setForm({ ...form, [k]: v });
  return (
    <SettingsCard title="Informations personnelles" description="Visibles par les restaurants partenaires.">
      <div className="flex items-center gap-4">
        <img src="https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200" alt="Photo de profil du producteur" className="h-20 w-20 rounded-full object-cover ring-2 ring-primary/30" />
        <div>
          <Button type="button" variant="outline" size="sm">Changer la photo</Button>
          <p className="text-xs text-muted-foreground mt-2">JPG ou PNG, max 2 Mo</p>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <FieldRow label="Prénom"><Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} /></FieldRow>
        <FieldRow label="Nom"><Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} /></FieldRow>
      </div>
      <FieldRow label="Email"><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></FieldRow>
      <FieldRow label="Téléphone">
        <div className="flex gap-2">
          <span className="inline-flex items-center rounded-md border border-input bg-muted px-3 text-sm">🇸🇳 +221</span>
          <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </div>
      </FieldRow>
      <FieldRow label="Langue préférée">
        <Select value={form.lang} onValueChange={(v) => set("lang", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="fr">Français</SelectItem>
            <SelectItem value="wo">Wolof</SelectItem>
            <SelectItem value="en">English</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>
      <FieldRow label="Bio"><Textarea rows={3} value={form.bio} onChange={(e) => set("bio", e.target.value)} /></FieldRow>
    </SettingsCard>
  );
}