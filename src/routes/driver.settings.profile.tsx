import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import { SettingsCard, FieldRow } from "@/components/common/settings-shell";
import { driverProfile } from "@/data/mocks";
import { useDriverSettings, driverSettingsActions } from "@/data/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/driver/settings/profile")({
  head: () => ({ meta: [{ title: "Profil · Paramètres livreur" }] }),
  component: ProfileSettings,
});

function ProfileSettings() {
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
          src={settings.profile.avatar}
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
        <Button asChild variant="outline" size="sm" className="w-full gap-2">
          <Link to="/driver/vehicle">
            <FileText className="h-3.5 w-3.5" />
            Voir mes documents (véhicule)
          </Link>
        </Button>
      </div>
    </div>
  );
}
