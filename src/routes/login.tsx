import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useState } from "react";
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
import { DemoNotice } from "@/components/auth/demo-notice";
import { auditActions, useAuditLogs, useLoginSecurity } from "@/data/admin-store";
import {
  demoLoginFn,
  getAuthConfigFn,
  getCurrentUserFn,
  loginFn,
  resendTwoFaFn,
  verifyTwoFaFn,
  type CurrentUser,
  type LoginResult,
  type PublicDemoAccount,
} from "@/lib/auth/functions";
import { normalizeEmail } from "@/lib/auth/helpers";
import { dashboardPathForRole, ROLE_LABEL } from "@/lib/auth/roles";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const user = await getCurrentUserFn();
    if (user) {
      throw redirect({ to: dashboardPathForRole(user.role) });
    }
  },
  loader: () => getAuthConfigFn(),
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

const NETWORK_ERROR = "Connexion impossible. Vérifiez votre accès à internet et réessayez.";

function LoginPage() {
  const navigate = useNavigate();
  const config = Route.useLoaderData();
  const logs = useAuditLogs();
  const { maxAttempts, lockoutMinutes } = useLoginSecurity();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState<"pending" | "suspended" | "rejected" | null>(null);
  const [twoFa, setTwoFa] = useState<{ email: string } | null>(null);
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const passwordId = useId();

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  /** Blocage réglé par l'administration (Paramètres → Sécurité), compté sur
   * le journal de ce navigateur. Le serveur applique en plus son propre
   * blocage (5 échecs / 15 min), qui ne dépend pas du navigateur. */
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

  const logLocked = (targetEmail: string, reason: string) =>
    auditActions.log({
      action: "Connexion bloquée",
      target: targetEmail,
      module: "security",
      level: "critical",
      status: "blocked",
      reason,
    });

  const lockedToast = (minutes: number) =>
    toast.error(
      `Trop de tentatives échouées. Réessayez dans ${minutes} minute${minutes > 1 ? "s" : ""}.`,
    );

  const finishLogin = (user: CurrentUser) => {
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
    switch (result.kind) {
      case "success":
        finishLogin(result.user);
        return;
      case "needs_two_fa":
        setTwoFa({ email: result.email });
        setCode("");
        setResendIn(result.resendInSeconds);
        toast.info("Code de vérification envoyé", {
          description: result.devCode ? `Code démo : ${result.devCode}` : undefined,
        });
        return;
      case "invalid":
        auditActions.log({
          action: "Connexion échouée",
          target: targetEmail,
          module: "security",
          level: "attention",
          status: "failed",
          reason: "Email ou mot de passe incorrect",
        });
        toast.error("Email ou mot de passe incorrect", {
          description:
            result.remaining <= 2
              ? `Encore ${result.remaining} essai${result.remaining > 1 ? "s" : ""} avant un blocage de 15 minutes.`
              : undefined,
        });
        return;
      case "locked":
        logLocked(targetEmail, "Trop d'échecs de connexion (blocage serveur)");
        lockedToast(result.minutes);
        return;
      case "blocked":
        auditActions.log({
          action: "Connexion refusée (compte non actif)",
          target: targetEmail,
          module: "security",
          level: "attention",
          status: "blocked",
          reason: result.reason,
        });
        setBlocked(result.reason);
        return;
    }
  };

  const attempt = async (targetEmail: string, run: () => Promise<LoginResult>) => {
    const blockedMinutes = lockoutMinutesLeft(targetEmail);
    if (blockedMinutes > 0) {
      logLocked(
        targetEmail,
        `${maxAttempts} échecs ou plus dans les ${lockoutMinutes} dernières minutes`,
      );
      lockedToast(blockedMinutes);
      return;
    }
    let result: LoginResult;
    try {
      result = await run();
    } catch {
      // Panne réseau ou serveur : ce n'est pas un échec d'identifiants, on ne
      // le compte pas dans le blocage.
      toast.error(NETWORK_ERROR);
      return;
    }
    handleResult(result, targetEmail);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBlocked(null);
    setLoading(true);
    const targetEmail = normalizeEmail(email);
    try {
      await attempt(targetEmail, () =>
        loginFn({ data: { email: targetEmail, password, rememberMe } }),
      );
    } finally {
      setLoading(false);
    }
  };

  const loginAs = async (account: PublicDemoAccount) => {
    setEmail(account.email);
    setPassword("");
    setBlocked(null);
    setLoading(true);
    try {
      await attempt(account.email, () =>
        demoLoginFn({ data: { email: account.email, rememberMe } }),
      );
    } finally {
      setLoading(false);
    }
  };

  const leaveTwoFa = () => {
    setTwoFa(null);
    setCode("");
  };

  const submitTwoFa = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!twoFa) return;
    if (code.replace(/\s/g, "").length < 6) {
      toast.error("Code à 6 chiffres requis");
      return;
    }
    setLoading(true);
    try {
      const res = await verifyTwoFaFn({ data: { code } });
      if (res.ok) {
        finishLogin(res.user);
        return;
      }
      toast.error(res.message);
      setCode("");
      if (res.restart) leaveTwoFa();
    } catch {
      toast.error(NETWORK_ERROR);
    } finally {
      setLoading(false);
    }
  };

  const resendTwoFa = async () => {
    try {
      const res = await resendTwoFaFn();
      if (res.ok) {
        setCode("");
        setResendIn(res.resendInSeconds);
        toast.info("Nouveau code envoyé", {
          description: res.devCode ? `Code démo : ${res.devCode}` : undefined,
        });
      } else if (res.waitSeconds) {
        setResendIn(res.waitSeconds);
      } else {
        toast.error(res.message);
        leaveTwoFa();
      }
    } catch {
      toast.error(NETWORK_ERROR);
    }
  };

  if (twoFa) {
    return (
      <AuthSplitLayout>
        <form onSubmit={submitTwoFa}>
          {config.demoMode && <DemoNotice />}
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-7 w-7" aria-hidden />
          </div>
          <h1 className="mt-4 text-center font-display text-2xl font-bold">
            Vérification en deux étapes
          </h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            Saisissez le code à 6 chiffres envoyé pour {twoFa.email}. Il est valable 5 minutes.
          </p>
          <div className="mt-8">
            <OtpInput value={code} onChange={setCode} />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-3 font-semibold disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Vérifier
          </button>
          <button
            type="button"
            disabled={resendIn > 0}
            onClick={resendTwoFa}
            className="mt-3 w-full text-sm font-medium text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
          >
            {resendIn > 0 ? `Renvoyer le code dans ${resendIn} s` : "Renvoyer le code"}
          </button>
          <button
            type="button"
            onClick={leaveTwoFa}
            className="mt-2 w-full text-sm text-muted-foreground hover:text-foreground"
          >
            Annuler et revenir à la connexion
          </button>
        </form>
      </AuthSplitLayout>
    );
  }

  if (blocked) {
    const copy = BLOCKED_COPY[blocked];
    return (
      <AuthSplitLayout>
        <div className="text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-destructive/10 text-destructive">
            <copy.icon className="h-8 w-8" aria-hidden />
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
        {config.demoMode && <DemoNotice />}
        <h1 className="font-display text-3xl font-bold">Bon retour 👋</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connectez-vous à votre espace Diambar Agro
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <Field
            icon={Mail}
            type="email"
            autoComplete="username"
            placeholder="vous@exemple.com"
            value={email}
            onChange={setEmail}
            label="Email"
            required
          />
          <div>
            <label htmlFor={passwordId} className="text-sm font-medium">
              Mot de passe
            </label>
            <div className="mt-1.5 relative">
              <Lock
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                aria-hidden
              />
              <input
                id={passwordId}
                name="password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full glass rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                aria-pressed={show}
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
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Se connecter
          </button>
        </form>

        {config.demoMode && config.demoAccounts.length > 0 && (
          <DemoAccountsPanel accounts={config.demoAccounts} onPick={loginAs} />
        )}

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

function DemoAccountsPanel({
  accounts,
  onPick,
}: {
  accounts: PublicDemoAccount[];
  onPick: (account: PublicDemoAccount) => void;
}) {
  const tile = (a: PublicDemoAccount) => (
    <button
      key={a.email}
      type="button"
      onClick={() => onPick(a)}
      className={`text-left rounded-xl border bg-gradient-to-br ${a.tone} p-3 hover:scale-[1.02] transition`}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg" aria-hidden>
          {a.emoji}
        </span>
        <span className="text-xs font-semibold capitalize">{a.label ?? ROLE_LABEL[a.role]}</span>
      </div>
      <div className="mt-1 text-[10px] opacity-80 truncate">{a.email}</div>
    </button>
  );
  return (
    <div className="mt-6 rounded-2xl border border-border bg-card/60 p-4">
      <div className="mb-3">
        <div className="text-sm font-semibold">Comptes de démonstration</div>
        <div className="text-[11px] text-muted-foreground">Connexion en 1 clic</div>
      </div>
      <div className="grid grid-cols-2 gap-2">{accounts.filter((a) => !a.kind).map(tile)}</div>
      <details className="mt-3">
        <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
          Tester un compte restreint (suspendu, en attente…)
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {accounts.filter((a) => a.kind === "test").map(tile)}
        </div>
      </details>
    </div>
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
  autoComplete,
}: {
  icon: LucideIcon;
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  autoComplete?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="mt-1.5 relative">
        <Icon
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
          aria-hidden
        />
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="w-full glass rounded-xl pl-10 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
    </div>
  );
}
