import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import { useServerForm } from "@/hooks/use-server-form";
import { toast } from "sonner";
import { SettingsCard, FieldRow, ToggleRow } from "@/components/common/settings-shell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useRestaurantProfile, restaurantProfileActions } from "@/data/store";
import { market } from "@/data/market-remote";
import { useBaseMode } from "@/data/demo-only";

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

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

function RestaurantProfileSettings() {
  const profile = useRestaurantProfile();
  const base = useBaseMode();
  const [form, setForm] = useServerForm(profile);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const set = (
    k: "displayName" | "cuisine" | "phone" | "email" | "manager" | "bio" | "avatarUrl",
    v: string,
  ) => setForm({ ...form, [k]: v });

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
    reader.onload = () => set("avatarUrl", reader.result as string);
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!form.displayName.trim()) {
      toast.error("Le nom affiché est obligatoire");
      return false;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      toast.error("Adresse email invalide");
      return false;
    }
    if (market.isRemote()) {
      // Enregistré sur le serveur : fiche, téléphone, newsletter, photo.
      const steps = [
        () =>
          market.saveRestaurant({
            name: form.displayName,
            cuisine: form.cuisine,
            description: form.bio,
            contactName: form.manager,
          }),
        () => market.saveAccount({ phone: form.phone }),
        () => market.savePreferences({ newsletter: form.newsletter }),
        ...(form.avatarUrl !== profile.avatarUrl
          ? [() => market.saveAvatar(form.avatarUrl || null)]
          : []),
      ];
      for (const step of steps) {
        const res = await step();
        if (!res.ok) {
          toast.error(res.message);
          return false;
        }
      }
      return true;
    }
    restaurantProfileActions.update({
      displayName: form.displayName,
      cuisine: form.cuisine,
      phone: form.phone,
      email: form.email,
      manager: form.manager,
      bio: form.bio,
      avatarUrl: form.avatarUrl,
      newsletter: form.newsletter,
    });
    return true;
  };

  return (
    <SettingsCard
      title="Profil restaurant"
      description="Ces informations sont visibles par vos producteurs."
      onSave={save}
    >
      <div className="flex items-center gap-4">
        <img
          src={form.avatarUrl || undefined}
          alt={`Photo du restaurant ${form.displayName}`}
          className="h-20 w-20 rounded-2xl object-cover ring-2 ring-amber-500/30"
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
        <FieldRow
          label="Nom affiché"
          hint="Le nom d'identification de votre compte reste inchangé."
        >
          <Input value={form.displayName} onChange={(e) => set("displayName", e.target.value)} />
        </FieldRow>
        <FieldRow label="Type de cuisine">
          <Input value={form.cuisine} onChange={(e) => set("cuisine", e.target.value)} />
        </FieldRow>
        <FieldRow label="Téléphone">
          <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </FieldRow>
        <FieldRow
          label="Email"
          hint={base ? "Adresse de connexion : pour la changer, contactez l'équipe." : undefined}
        >
          <Input
            type="email"
            value={form.email}
            readOnly={base}
            onChange={(e) => set("email", e.target.value)}
          />
        </FieldRow>
      </div>
      <FieldRow label="Responsable des achats">
        <Input value={form.manager} onChange={(e) => set("manager", e.target.value)} />
      </FieldRow>
      <FieldRow label="Présentation">
        <Textarea rows={3} value={form.bio} onChange={(e) => set("bio", e.target.value)} />
      </FieldRow>
      <ToggleRow
        label="Newsletter Diambar Agro"
        description="Bons plans, nouveaux producteurs et actualités de la plateforme."
        checked={form.newsletter}
        onChange={(v) => setForm({ ...form, newsletter: v })}
      />
    </SettingsCard>
  );
}
