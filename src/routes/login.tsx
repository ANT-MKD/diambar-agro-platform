import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ShieldAlert,
  Clock,
  Ban,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { AuthSplitLayout } from "@/components/auth/split-layout";
import { OtpInput } from "@/components/auth/otp-input";
import { demoAccounts, type DemoAccount } from "@/data/demo-accounts";
import { auditActions, useAuditLogs, useLoginSecurity } from "@/data/admin-store";
import { getCurrentUserFn, loginFn, verifyTwoFaFn, type LoginResult } from "@/lib/auth/functions";
import { dashboardPathForRole } from "@/lib/auth/roles";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const user = await getCurrentUserFn();
    if (user) {
      throw redirect({ to: dashboardPathForRole(user.role) });
    }
  },
  head: () => ({ meta: [{ title: "Connexion · Diambar Agro" }] }),
  component: LoginPage,
});

const BLOCKED_COPY: Record<
  "pending" | "suspended" | "rejected",
  { icon: LucideIcon; title: string; body: string; cta?: string }
> = {
  pending: {
    icon: Clock,
    title: "Dossier en cours de validation",
    body: "Votre compte n'est pas encore activé — notre équipe vérifie votre dossier. Vous recevrez un message dès que c'est fait.",
  },
  suspended: {
    icon: ShieldAlert,
    title: "Compte temporairement suspendu",
    body: "Votre accès à Diambar Agro est actuellement suspendu. Contactez le support pour en connaître le motif.",
    cta: "Contacter le support",
  },
  rejected: {
    icon: Ban,
    title: "Dossier refusé",
    body: "Votre demande d'inscription n'a pas été validée. Contactez le support si vous pensez qu'il s'agit d'une erreur.",
    cta: "Contacter le support",
  },
};

function LoginPage() {
  const navigate = useNavigate();
  const logs = useAuditLogs();
  const { maxAttempts, lockoutMinutes } = useLoginSecurity();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState<"pending" | "suspended" | "rejected" | null>(null);
  const [twoFa, setTwoFa] = useState<{ email: string; devCode: string } | null>(null);
  const [code, setCode] = useState("");

  /** Vrai blocage, dérivé des événements "Connexion échouée" déjà réels du
   * journal d'audit — aucune IP capturée, donc le blocage est par email
   * tenté, pas par appareil. Retourne le nombre de minutes restantes, ou 0
   * si aucun blocage actif. */
  const lockoutMinutesLeft = (targetEmail: string): number => {
    const cutoff = Date.now() - lockoutMinutes * 60_000;
    const recentFails = logs
      .filter(
        (l) =>
          l.action === "Connexion échouée" &&
          l.target === targetEmail &&
          new Date(l.at).getTime() >= cutoff,
      )
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    if (recentFails.length < maxAttempts) return 0;
    const oldestCounted = recentFails[maxAttempts - 1];
    const remainingMs =
      lockoutMinutes * 60_000 - (Date.now() - new Date(oldestCounted.at).getTime());
    return Math.max(1, Math.ceil(remainingMs / 60_000));
  };

  const finishLogin = (user: { email: string; role: DemoAccount["role"]; name: string }) => {
    auditActions.log({
      action: "Connexion réussie",
      target: user.email,
      module: "security",
      level: "info",
      actor: user.name,
    });
    toast.success(`Bienvenue ${user.name}`);
    navigate({ to: dashboardPathForRole(user.role) });
  };

  const handleResult = (result: LoginResult, targetEmail: string) => {
    if (result.kind === "success") {
      finishLogin(result.user);
      return;
    }
    if (result.kind === "needs_two_fa") {
      setTwoFa({ email: result.email, devCode: result.devCode });
      toast.info("Code de vérification envoyé", {
        description: `Code démo : ${result.devCode}`,
      });
      return;
    }
    // blocked
    auditActions.log({
      action: "Connexion refusée (compte non actif)",
      target: targetEmail,
      module: "security",
      level: "attention",
      status: "blocked",
      reason: result.reason,
    });
    setBlocked(result.reason);
  };

  const attemptLogin = async (targetEmail: string, targetPassword: string) => {
    const blockedMinutes = lockoutMinutesLeft(targetEmail);
    if (blockedMinutes > 0) {
      auditActions.log({
        action: "Connexion bloquée",
        target: targetEmail,
        module: "security",
        level: "critical",
        status: "blocked",
        reason: `${maxAttempts} échecs ou plus dans les ${lockoutMinutes} dernières minutes`,
      });
      toast.error(
        `Trop de tentatives échouées. Réessayez dans ${blockedMinutes} min${blockedMinutes > 1 ? "es" : ""}.`,
      );
      return;
    }
    try {
      const result = await loginFn({
        data: { email: targetEmail, password: targetPassword, rememberMe },
      });
      handleResult(result, targetEmail);
    } catch {
      auditActions.log({
        action: "Connexion échouée",
        target: targetEmail,
        module: "security",
        level: "attention",
        status: "failed",
        reason: "Email ou mot de passe incorrect",
      });
      if (lockoutMinutesLeft(targetEmail) === 0) {
        toast.error("Email ou mot de passe incorrect");
      }
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBlocked(null);
    setLoading(true);
    try {
      await attemptLogin(email, password);
    } finally {
      setLoading(false);
    }
  };

  const loginAs = async (account: DemoAccount) => {
    setEmail(account.email);
    setPassword(account.password);
    setBlocked(null);
    setLoading(true);
    try {
      await attemptLogin(account.email, account.password);
    } finally {
      setLoading(false);
    }
  };

  const submitTwoFa = async () => {
    if (!twoFa) return;
    if (code.length < 6) {
      toast.error("Code à 6 chiffres requis");
      return;
    }
    setLoading(true);
    try {
      const user = await verifyTwoFaFn({ data: { code } });
      finishLogin(user);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Code incorrect");
    } finally {
      setLoading(false);
    }
  };

  if (twoFa) {
    return (
      <AuthSplitLayout>
        <div>
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-center font-display text-2xl font-bold">
            Vérification en deux étapes
          </h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            Entrez le code de vérification pour {twoFa.email}
          </p>
          <div className="mt-8">
            <OtpInput value={code} onChange={setCode} />
          </div>
          <button
            disabled={loading}
            onClick={submitTwoFa}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-3 font-semibold disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Vérifier
          </button>
          <button
            onClick={() => {
              setTwoFa(null);
              setCode("");
            }}
            className="mt-3 w-full text-sm text-muted-foreground hover:text-foreground"
          >
            Annuler et revenir à la connexion
          </button>
        </div>
      </AuthSplitLayout>
    );
  }

  if (blocked) {
    const copy = BLOCKED_COPY[blocked];
    return (
      <AuthSplitLayout>
        <div className="text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-destructive/10 text-destructive">
            <copy.icon className="h-8 w-8" />
          </div>
          <h1 className="mt-6 font-display text-2xl font-bold">{copy.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{copy.body}</p>
          <div className="mt-8 space-y-2">
            {copy.cta && (
              <Link
                to="/contact"
                className="block w-full rounded-xl bg-primary text-primary-foreground py-3 font-semibold"
              >
                {copy.cta}
              </Link>
            )}
            <button
              onClick={() => setBlocked(null)}
              className="w-full text-sm text-muted-foreground hover:text-foreground"
            >
              Retour à la connexion
            </button>
          </div>
        </div>
      </AuthSplitLayout>
    );
  }

  return (
    <AuthSplitLayout>
      <div>
        <h1 className="font-display text-3xl font-bold">Bon retour 👋</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connectez-vous à votre espace Diambar Agro
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <Field
            icon={Mail}
            type="email"
            placeholder="vous@exemple.com"
            value={email}
            onChange={setEmail}
            label="Email"
            required
          />
          <div>
            <label className="text-sm font-medium">Mot de passe</label>
            <div className="mt-1.5 relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full glass rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-muted-foreground">Se souvenir de moi</span>
            </label>
            <Link to="/forgot-password" className="text-primary hover:underline font-medium">
              Mot de passe oublié ?
            </Link>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-3 font-semibold hover:opacity-90 transition disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Se connecter
          </button>
        </form>

        <div className="mt-6 rounded-2xl border border-border bg-card/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold">Comptes de démonstration</div>
              <div className="text-[11px] text-muted-foreground">
                Connexion 1 clic · mdp <code className="font-mono">demo1234</code>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {demoAccounts
              .filter((a) => !a.kind)
              .map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => loginAs(a)}
                  className={`text-left rounded-xl border bg-gradient-to-br ${a.tone} p-3 hover:scale-[1.02] transition`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{a.emoji}</span>
                    <span className="text-xs font-semibold capitalize">{a.label ?? a.role}</span>
                  </div>
                  <div className="mt-1 text-[10px] opacity-80 truncate">{a.email}</div>
                </button>
              ))}
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
              Tester un compte restreint (suspendu, en attente…)
            </summary>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {demoAccounts
                .filter((a) => a.kind === "test")
                .map((a) => (
                  <button
                    key={a.email}
                    type="button"
                    onClick={() => loginAs(a)}
                    className={`text-left rounded-xl border bg-gradient-to-br ${a.tone} p-3 hover:scale-[1.02] transition`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{a.emoji}</span>
                      <span className="text-xs font-semibold">{a.label}</span>
                    </div>
                    <div className="mt-1 text-[10px] opacity-80 truncate">{a.email}</div>
                  </button>
                ))}
            </div>
          </details>
        </div>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex-1 h-px bg-border" /> ou continuer avec{" "}
          <div className="flex-1 h-px bg-border" />
        </div>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() =>
              toast.info("Bientôt disponible", { description: "Connexion Google en préparation." })
            }
            className="w-full glass rounded-xl py-3 font-medium text-sm hover:bg-accent flex items-center justify-center gap-2 opacity-70"
          >
            <svg className="h-4 w-4" viewBox="0 0 48 48">
              <path
                fill="#FFC107"
                d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.3 29 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5c10.8 0 19.5-8.7 19.5-19.5 0-1.2-.1-2.3-.4-3.5z"
              />
              <path
                fill="#FF3D00"
                d="M6.3 14.7l6.6 4.8C14.6 16 19 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.3 29 4.5 24 4.5 16.3 4.5 9.7 8.6 6.3 14.7z"
              />
              <path
                fill="#4CAF50"
                d="M24 43.5c5.2 0 9.9-2 13.4-5.3l-6.2-5.2c-2.1 1.4-4.6 2.2-7.2 2.2-5.3 0-9.7-3.4-11.3-8H6.2v5.1C9.6 39.4 16.2 43.5 24 43.5z"
              />
              <path
                fill="#1976D2"
                d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.4 4.3-4.4 5.6l6.2 5.2c-.4.4 6.5-4.7 6.5-14.3 0-1.2-.1-2.3-.4-3.5z"
              />
            </svg>
            Continuer avec Google
          </button>
          <button
            type="button"
            onClick={() =>
              toast.info("Bientôt disponible", {
                description: "Connexion par téléphone en préparation.",
              })
            }
            className="w-full glass rounded-xl py-3 font-medium text-sm hover:bg-accent opacity-70"
          >
            📱 Continuer avec téléphone
          </button>
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link to="/register" className="text-primary hover:underline font-semibold">
            Créer un compte →
          </Link>
        </p>
      </div>
    </AuthSplitLayout>
  );
}

function Field({
  icon: Icon,
  label,
  type,
  value,
  onChange,
  placeholder,
  required,
}: {
  icon: LucideIcon;
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <div className="mt-1.5 relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          placeholder={placeholder}
          className="w-full glass rounded-xl pl-10 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
    </div>
  );
}
