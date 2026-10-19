import { createFileRoute, Link } from "@tanstack/react-router";
import { useBaseMode, useHiddenInBase } from "@/data/demo-only";
import { useRef, useState } from "react";
import { useServerForm } from "@/hooks/use-server-form";
import { market } from "@/data/market-remote";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import { SettingsCard, FieldRow } from "@/components/common/settings-shell";
import { driverProfile } from "@/data/mocks";
import { useDriverSettings, driverSettingsActions, useMyAccount } from "@/data/store";
import { useCities } from "@/data/admin-store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/driver/settings/profile")({
  head: () => ({ meta: [{ title: "Profil · Paramètres livreur" }] }),
  component: ProfileSettings,
});

function ProfileSettings() {
  return useBaseMode() ? <BaseProfileSettings /> : <DemoProfileSettings />;
}

/** Mode base : enregistré avec le compte (nom, téléphone, ville, adresse, photo). */
function BaseProfileSettings() {
  const account = useMyAccount();
  const settings = useDriverSettings();
  const cities = useCities();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useServerForm({
    firstName: account?.firstName ?? "",
    lastName: account?.lastName ?? "",
    phone: account?.phone ?? "",
    city: account?.city ?? "",
    address: account?.driver?.address ?? "",
    avatar: account?.avatarUrl ?? "",
  });
  const set = (k: keyof typeof form, v: string) => setForm({ ...form, [k]: v });

  const pickPhoto = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Choisissez une image (JPG ou PNG)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image trop lourde (max 5 Mo)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set("avatar", reader.result as string);
    reader.readAsDataURL(file);
  };

  const save = async () => {
    const steps = [
      () =>
        market.saveAccount({
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone,
          ...(form.city ? { city: form.city } : {}),
        }),
      () => market.saveDriver({ address: form.address }),
      ...(form.avatar !== (account?.avatarUrl ?? "")
        ? [() => market.saveAvatar(form.avatar || null)]
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
  };

  return (
    <div className="space-y-6">
      <SettingsCard title="Informations personnelles" onSave={save}>
        <div className="flex items-center gap-4">
          <img
            src={form.avatar || undefined}
            alt=""
            className="h-16 w-16 rounded-full object-cover ring-2 ring-primary/30 bg-muted"
          />
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
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
            <p className="text-xs text-muted-foreground mt-2">
              Livreur depuis{" "}
              {account
                ? new Date(account.createdAt).toLocaleDateString("fr-FR", {
                    month: "long",
                    year: "numeric",
                  })
                : "—"}{" "}
              · {settings.profile.name}
            </p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <FieldRow label="Prénom">
            <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
          </FieldRow>
          <FieldRow label="Nom">
            <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
          </FieldRow>
          <FieldRow label="Téléphone">
            <Input
              inputMode="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </FieldRow>
          <FieldRow
            label="Email"
            hint="Adresse de connexion : pour la changer, contactez l'équipe."
          >
            <Input value={account?.email ?? ""} readOnly />
          </FieldRow>
          <FieldRow label="Ville de base">
            <Select value={form.city} onValueChange={(v) => set("city", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une ville" />
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
          <FieldRow label="Adresse" hint="Facultatif">
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
          </FieldRow>
        </div>
      </SettingsCard>
      <div className="glass rounded-2xl p-5 flex items-center gap-3 text-sm">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        Compte validé par l'équipe Diambar (identité, permis et véhicule vérifiés à l'inscription).
      </div>
    </div>
  );
}

function DemoProfileSettings() {
  const hiddenInBase = useHiddenInBase();
  const settings = useDriverSettings();
  const [name, setName] = useState(settings.profile.name);
  const [phone, setPhone] = useState(settings.profile.phone);
  const [email, setEmail] = useState(settings.profile.email);
  const [city, setCity] = useState(settings.profile.city);
  const [address, setAddress] = useState(settings.profile.address);

  const save = () => {
    driverSettingsActions.updateProfile({ name, phone, email, city, address });
    return true;
  };

  const docs = driverProfile.documents;
  const checks = [
    { label: "Identité", verified: docs.idVerified },
    { label: "Téléphone", verified: true },
    { label: "Email", verified: true },
    { label: "Permis", verified: docs.permitVerified },
  ];

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-5 flex items-center gap-4">
        <img
          src={settings.profile.avatar || undefined}
          alt=""
          className="h-16 w-16 rounded-full object-cover ring-2 ring-primary/30"
        />
        <div className="flex-1">
          <div className="font-semibold">{settings.profile.name}</div>
          <div className="text-xs text-muted-foreground">
            Livreur depuis{" "}
            {new Date(driverProfile.memberSince).toLocaleDateString("fr-FR", {
              month: "long",
              year: "numeric",
            })}{" "}
            · ★ {driverProfile.rating}
          </div>
        </div>
      </div>

      <SettingsCard title="Informations personnelles" onSave={save}>
        <div className="grid sm:grid-cols-2 gap-4">
          <FieldRow label="Nom complet">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </FieldRow>
          <FieldRow label="Téléphone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </FieldRow>
          <FieldRow label="Email">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </FieldRow>
          <FieldRow label="Ville de base">
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </FieldRow>
          <FieldRow label="Adresse" hint="Facultatif">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </FieldRow>
        </div>
      </SettingsCard>

      <div className="glass rounded-2xl p-5 space-y-3">
        <h3 className="font-semibold">Vérification du compte</h3>
        <div className="grid sm:grid-cols-2 gap-2.5">
          {checks.map((c) => (
            <div
              key={c.label}
              className="flex items-center gap-3 rounded-xl border border-border p-3"
            >
              {c.verified ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              )}
              <span className="flex-1 text-sm">{c.label}</span>
              <span
                className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${c.verified ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"}`}
              >
                {c.verified ? "Vérifiée" : "À vérifier"}
              </span>
            </div>
          ))}
        </div>
        {!hiddenInBase("/driver/vehicle") && (
          <Button asChild variant="outline" size="sm" className="w-full gap-2">
            <Link to="/driver/vehicle">
              <FileText className="h-3.5 w-3.5" />
              Voir mes documents (véhicule)
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
