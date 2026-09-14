import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { SettingsCard, FieldRow } from "@/components/common/settings-shell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFarmerProfile, farmerProfileActions } from "@/data/store";

export const Route = createFileRoute("/farmer/settings/profile")({
  head: () => ({
    meta: [
      { title: "Profil · Paramètres agriculteur · Diambar Agro" },
      {
        name: "description",
        content: "Modifiez vos informations personnelles de producteur sur Diambar Agro.",
      },
      { property: "og:title", content: "Profil · Paramètres agriculteur" },
      {
        property: "og:description",
        content: "Modifiez vos informations personnelles de producteur.",
      },
    ],
  }),
  component: ProfileSettings,
});

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

function ProfileSettings() {
  const profile = useFarmerProfile();
  const [form, setForm] = useState(profile);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof form, v: string) => setForm({ ...form, [k]: v });

  const pickPhoto = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Choisissez une image (JPG ou PNG)");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("Image trop lourde (max 2 Mo)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set("avatar", reader.result as string);
    reader.readAsDataURL(file);
  };

  const save = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("Le prénom et le nom sont obligatoires");
      return false;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      toast.error("Adresse email invalide");
      return false;
    }
    farmerProfileActions.update(form);
    return true;
  };

  return (
    <SettingsCard
      title="Informations personnelles"
      description="Visibles par les restaurants partenaires."
      onSave={save}
    >
      <div className="flex items-center gap-4">
        <img
          src={form.avatar}
          alt="Photo de profil du producteur"
          className="h-20 w-20 rounded-full object-cover ring-2 ring-primary/30"
        />
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) pickPhoto(file);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            Changer la photo
          </Button>
          <p className="text-xs text-muted-foreground mt-2">JPG ou PNG, max 2 Mo</p>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <FieldRow label="Prénom">
          <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
        </FieldRow>
        <FieldRow label="Nom">
          <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
        </FieldRow>
      </div>
      <FieldRow label="Email">
        <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
      </FieldRow>
      <FieldRow label="Téléphone">
        <div className="flex gap-2">
          <span className="inline-flex items-center rounded-md border border-input bg-muted px-3 text-sm">
            🇸🇳 +221
          </span>
          <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </div>
      </FieldRow>
      <FieldRow label="Langue préférée">
        <Select value={form.lang} onValueChange={(v) => set("lang", v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fr">Français</SelectItem>
            <SelectItem value="wo">Wolof</SelectItem>
            <SelectItem value="en">English</SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>
      <FieldRow label="Bio">
        <Textarea rows={3} value={form.bio} onChange={(e) => set("bio", e.target.value)} />
      </FieldRow>
    </SettingsCard>
  );
}
