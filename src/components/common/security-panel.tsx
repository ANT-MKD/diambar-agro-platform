import { useState } from "react";
import { toast } from "sonner";
import { Monitor, Smartphone, ShieldCheck, KeyRound, Copy, LogOut, History } from "lucide-react";
import { SettingsCard, FieldRow, ToggleRow } from "@/components/common/settings-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PasswordStrength } from "@/components/auth/password-strength";
import { useSecurity, securityActions } from "@/data/security";
import { relativeTime } from "@/lib/format";

export function SecurityPanel({ title = "Sécurité", description = "Protégez votre compte." }: { title?: string; description?: string }) {
  const sec = useSecurity();
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [step, setStep] = useState<"idle" | "verify">("idle");
  const [channel, setChannel] = useState<"sms" | "email" | "app">("sms");
  const [code, setCode] = useState("");

  const save = () => {
    if (!pwd.current) { toast.error("Saisissez votre mot de passe actuel"); return false; }
    if (pwd.next.length < 8) { toast.error("Le nouveau mot de passe doit faire au moins 8 caractères"); return false; }
    if (pwd.next !== pwd.confirm) { toast.error("Les mots de passe ne correspondent pas"); return false; }
    securityActions.markPasswordChanged();
    setPwd({ current: "", next: "", confirm: "" });
    return true;
  };

  const toggleTwoFa = (on: boolean) => {
    if (!on) { securityActions.disableTwoFa(); setStep("idle"); toast.success("Double authentification désactivée"); return; }
    const generated = securityActions.startTwoFa(channel);
    setStep("verify");
    toast.info(`Code de vérification envoyé (${channel === "sms" ? "SMS" : channel === "email" ? "e-mail" : "application"})`, { description: `Code démo : ${generated}` });
  };

  const confirm = () => {
    if (securityActions.confirmTwoFa(code)) {
      setStep("idle"); setCode("");
      toast.success("Double authentification activée · codes de secours générés");
    } else {
      toast.error("Code incorrect");
    }
  };

  return (
    <>
      <SettingsCard title={title} description={description} onSave={save}>
        <FieldRow label="Mot de passe actuel"><Input type="password" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} /></FieldRow>
        <FieldRow label="Nouveau mot de passe">
          <Input type="password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} />
          <PasswordStrength value={pwd.next} />
        </FieldRow>
        <FieldRow label="Confirmer"><Input type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} /></FieldRow>
        <div className="text-xs text-muted-foreground">Dernière modification {relativeTime(sec.passwordUpdatedAt)}.</div>
      </SettingsCard>

      <div className="glass rounded-2xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-4 w-4" /></div>
          <div className="flex-1">
            <h3 className="font-semibold">Double authentification</h3>
            <p className="text-sm text-muted-foreground mt-1">Un code à usage unique est demandé à chaque nouvelle connexion.</p>
          </div>
        </div>

        {!sec.twoFa && step === "idle" && (
          <div className="flex flex-wrap gap-2">
            {(["sms", "email", "app"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setChannel(c)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${channel === c ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent"}`}
              >
                {c === "sms" ? "Par SMS" : c === "email" ? "Par e-mail" : "Application d'authentification"}
              </button>
            ))}
          </div>
        )}

        <ToggleRow
          label={sec.twoFa ? "Activée" : "Désactivée"}
          description={sec.twoFa ? `Canal : ${sec.twoFaChannel === "sms" ? "SMS" : sec.twoFaChannel === "email" ? "E-mail" : "Application"}` : "Activez pour recevoir un code de vérification"}
          checked={sec.twoFa}
          onChange={toggleTwoFa}
        />

        {step === "verify" && !sec.twoFa && (
          <div className="rounded-xl border border-border p-4 space-y-3">
            <div className="text-sm font-medium">Saisissez le code à 6 chiffres reçu</div>
            <div className="flex gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} placeholder="123456" className="max-w-40" />
              <Button onClick={confirm}>Vérifier</Button>
              <Button variant="ghost" onClick={() => { setStep("idle"); setCode(""); }}>Annuler</Button>
            </div>
          </div>
        )}

        {sec.twoFa && (
          <div className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium"><KeyRound className="h-4 w-4 text-muted-foreground" />Codes de secours</div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { securityActions.regenerateCodes(); toast.success("Nouveaux codes générés"); }}>Régénérer</Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { navigator.clipboard?.writeText(sec.recoveryCodes.join("\n")); toast.success("Codes copiés"); }}>
                  <Copy className="h-3.5 w-3.5" />Copier
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {sec.recoveryCodes.map((c) => (
                <div key={c} className="rounded-lg bg-muted/50 px-3 py-2 text-center font-mono text-xs">{c}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Sessions actives</h3>
            <p className="text-sm text-muted-foreground mt-1">Déconnectez les appareils que vous ne reconnaissez pas.</p>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { securityActions.revokeAllOthers(); toast.success("Toutes les autres sessions ont été déconnectées"); }}>
            <LogOut className="h-3.5 w-3.5" />Tout déconnecter
          </Button>
        </div>
        <div className="space-y-2">
          {sec.sessions.map((s) => {
            const Icon = s.kind === "mobile" ? Smartphone : Monitor;
            return (
              <div key={s.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{s.device}</div>
                  <div className="text-xs text-muted-foreground">{s.place} · {s.at}</div>
                </div>
                {s.current ? (
                  <span className="text-[10px] font-semibold rounded-full bg-primary/10 text-primary px-2 py-0.5">Actuelle</span>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => { securityActions.revokeSession(s.id); toast.success("Session déconnectée"); }}>Déconnecter</Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold">Historique de connexion</h3>
        </div>
        <div className="space-y-2">
          {sec.logins.slice(0, 8).map((l) => (
            <div key={l.id} className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm">
              <span className={`h-2 w-2 rounded-full ${l.result === "success" ? "bg-emerald-500" : "bg-destructive"}`} />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{l.device}</div>
                <div className="text-xs text-muted-foreground">{l.place} · {l.ip} · {relativeTime(l.at)}</div>
              </div>
              <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${l.result === "success" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-destructive/10 text-destructive"}`}>
                {l.result === "success" ? "Réussie" : "Échouée"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
