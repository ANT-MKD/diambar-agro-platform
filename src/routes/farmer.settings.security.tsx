import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Monitor, Smartphone } from "lucide-react";
import { SettingsCard, FieldRow, ToggleRow } from "@/components/common/settings-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PasswordStrength } from "@/components/auth/password-strength";

export const Route = createFileRoute("/farmer/settings/security")({
  head: () => ({
    meta: [
      { title: "Sécurité · Paramètres agriculteur · Diambar Agro" },
      { name: "description", content: "Mot de passe, double authentification et sessions actives de votre compte producteur." },
      { property: "og:title", content: "Sécurité · Paramètres agriculteur" },
      { property: "og:description", content: "Protégez votre compte Diambar Agro." },
    ],
  }),
  component: SecuritySettings,
});

const SESSIONS = [
  { id: "s1", device: "Chrome · Windows", place: "Thiès, Sénégal", at: "Session actuelle", icon: Monitor, current: true },
  { id: "s2", device: "Diambar App · Android", place: "Dakar, Sénégal", at: "Il y a 2 jours", icon: Smartphone, current: false },
];

function SecuritySettings() {
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [twoFa, setTwoFa] = useState(false);
  const [sessions, setSessions] = useState(SESSIONS);

  const save = () => {
    if (!pwd.current) { toast.error("Saisissez votre mot de passe actuel"); return false; }
    if (pwd.next.length < 8) { toast.error("Le nouveau mot de passe doit faire au moins 8 caractères"); return false; }
    if (pwd.next !== pwd.confirm) { toast.error("Les mots de passe ne correspondent pas"); return false; }
    setPwd({ current: "", next: "", confirm: "" });
    return true;
  };

  return (
    <>
      <SettingsCard title="Sécurité" description="Protégez votre compte." onSave={save}>
        <FieldRow label="Mot de passe actuel"><Input type="password" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} /></FieldRow>
        <FieldRow label="Nouveau mot de passe">
          <Input type="password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} />
          <PasswordStrength value={pwd.next} />
        </FieldRow>
        <FieldRow label="Confirmer"><Input type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} /></FieldRow>
        <ToggleRow label="Authentification à 2 facteurs" description="Recevez un code SMS à chaque connexion" checked={twoFa} onChange={setTwoFa} />
      </SettingsCard>

      <div className="glass rounded-2xl p-6 space-y-4">
        <div>
          <h3 className="font-semibold">Sessions actives</h3>
          <p className="text-sm text-muted-foreground mt-1">Déconnectez les appareils que vous ne reconnaissez pas.</p>
        </div>
        <div className="space-y-2">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
              <s.icon className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{s.device}</div>
                <div className="text-xs text-muted-foreground">{s.place} · {s.at}</div>
              </div>
              {s.current ? (
                <span className="text-[10px] font-semibold rounded-full bg-primary/10 text-primary px-2 py-0.5">Actuelle</span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setSessions((a) => a.filter((x) => x.id !== s.id)); toast.success("Session déconnectée"); }}
                >
                  Déconnecter
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}