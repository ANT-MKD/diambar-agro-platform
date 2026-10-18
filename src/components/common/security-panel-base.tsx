import { useEffect, useState } from "react";
import { toast } from "sonner";
import { History, ShieldCheck } from "lucide-react";
import { SettingsCard, FieldRow } from "@/components/common/settings-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PasswordStrength } from "@/components/auth/password-strength";
import {
  changePasswordFn,
  mySecurityFn,
  sendMyTwoFaCodeFn,
  setMyTwoFaFn,
  type MySecurity,
} from "@/lib/auth/account-security";
import { relativeTime } from "@/lib/format";

// Sécurité du compte en mode base : tout passe par le serveur (mot de passe,
// double authentification par email, journal des connexions).

const errorText = (err: unknown) =>
  err instanceof Error && err.message ? err.message : "Action impossible. Réessayez.";

export function SecurityPanelBase({
  title = "Sécurité",
  description = "Protégez votre compte.",
}: {
  title?: string;
  description?: string;
}) {
  const [sec, setSec] = useState<MySecurity | null>(null);
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [step, setStep] = useState<"idle" | "code" | "disable">("idle");
  const [code, setCode] = useState("");
  const [disablePwd, setDisablePwd] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = () =>
    mySecurityFn()
      .then(setSec)
      .catch(() => setSec(null));
  useEffect(() => {
    void reload();
  }, []);

  const savePassword = async () => {
    if (!pwd.current) {
      toast.error("Saisissez votre mot de passe actuel");
      return false;
    }
    if (pwd.next.length < 8) {
      toast.error("Le nouveau mot de passe doit faire au moins 8 caractères");
      return false;
    }
    if (pwd.next !== pwd.confirm) {
      toast.error("Les mots de passe ne correspondent pas");
      return false;
    }
    try {
      const res = await changePasswordFn({ data: { current: pwd.current, next: pwd.next } });
      if (!res.ok) {
        toast.error(res.message);
        return false;
      }
    } catch (err) {
      toast.error(errorText(err));
      return false;
    }
    setPwd({ current: "", next: "", confirm: "" });
    void reload();
    return true;
  };

  const sendCode = async () => {
    setBusy(true);
    try {
      const res = await sendMyTwoFaCodeFn();
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setStep("code");
      toast.success(`Code envoyé à ${res.sentTo}`, {
        ...(res.devCode ? { description: `Code (développement) : ${res.devCode}` } : {}),
      });
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const setTwoFa = async (enabled: boolean) => {
    setBusy(true);
    try {
      const res = await setMyTwoFaFn({
        data: enabled ? { enabled, code } : { enabled, password: disablePwd },
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(
        enabled ? "Double authentification activée" : "Double authentification désactivée",
      );
      setStep("idle");
      setCode("");
      setDisablePwd("");
      void reload();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SettingsCard title={title} description={description} onSave={savePassword}>
        <FieldRow label="Mot de passe actuel">
          <Input
            type="password"
            autoComplete="current-password"
            value={pwd.current}
            onChange={(e) => setPwd({ ...pwd, current: e.target.value })}
          />
        </FieldRow>
        <FieldRow label="Nouveau mot de passe">
          <Input
            type="password"
            autoComplete="new-password"
            value={pwd.next}
            onChange={(e) => setPwd({ ...pwd, next: e.target.value })}
          />
          <PasswordStrength value={pwd.next} />
        </FieldRow>
        <FieldRow label="Confirmer">
          <Input
            type="password"
            autoComplete="new-password"
            value={pwd.confirm}
            onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
          />
        </FieldRow>
        <div className="text-xs text-muted-foreground">
          {sec?.passwordChangedAt
            ? `Dernière modification ${relativeTime(sec.passwordChangedAt)}. `
            : ""}
          Changer de mot de passe déconnecte vos autres appareils.
        </div>
      </SettingsCard>

      <div className="glass rounded-2xl p-6 space-y-4" data-testid="two-fa">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">Double authentification</h3>
            <p className="text-sm text-muted-foreground mt-1">
              À chaque connexion, un code à usage unique est envoyé à {sec?.email ?? "votre email"}.
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${sec?.twoFaEnabled ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}
          >
            {sec?.twoFaEnabled ? "Activée" : "Désactivée"}
          </span>
        </div>

        {sec && !sec.twoFaEnabled && !sec.codeDelivery && (
          <p className="text-sm text-muted-foreground">
            Activable dès que l'envoi des emails sera configuré sur le serveur.
          </p>
        )}
        {sec && !sec.twoFaEnabled && sec.codeDelivery && step === "idle" && (
          <Button variant="outline" disabled={busy} onClick={() => void sendCode()}>
            Activer : recevoir un code par email
          </Button>
        )}
        {step === "code" && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="two-fa-code">
                Code reçu
              </label>
              <Input
                id="two-fa-code"
                inputMode="numeric"
                className="w-40"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </div>
            <Button disabled={busy || code.length !== 6} onClick={() => void setTwoFa(true)}>
              Confirmer
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => void sendCode()}>
              Renvoyer
            </Button>
          </div>
        )}
        {sec?.twoFaEnabled && step !== "disable" && (
          <Button variant="outline" onClick={() => setStep("disable")}>
            Désactiver
          </Button>
        )}
        {step === "disable" && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="two-fa-password">
                Mot de passe
              </label>
              <Input
                id="two-fa-password"
                type="password"
                autoComplete="current-password"
                className="w-56"
                value={disablePwd}
                onChange={(e) => setDisablePwd(e.target.value)}
              />
            </div>
            <Button
              variant="destructive"
              disabled={busy || !disablePwd}
              onClick={() => void setTwoFa(false)}
            >
              Confirmer la désactivation
            </Button>
            <Button variant="ghost" onClick={() => setStep("idle")}>
              Annuler
            </Button>
          </div>
        )}
      </div>

      <div className="glass rounded-2xl p-6 space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          Activité récente du compte
        </h3>
        {!sec?.events.length ? (
          <p className="text-sm text-muted-foreground">Aucune activité enregistrée.</p>
        ) : (
          <ul className="space-y-1.5" data-testid="security-events">
            {sec.events.map((e, i) => (
              <li
                key={`${e.at}-${i}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
              >
                <span className={e.status === "success" ? "" : "text-destructive"}>{e.action}</span>
                <span className="text-xs text-muted-foreground">{relativeTime(e.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
