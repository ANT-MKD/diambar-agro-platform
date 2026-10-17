import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Database,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ServerCog,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { AuthSplitLayout } from "@/components/auth/split-layout";
import { OtpInput } from "@/components/auth/otp-input";
import { PasswordStrength } from "@/components/auth/password-strength";
import {
  getInstallationStateFn,
  installFinishFn,
  installResendFn,
  installRestartFn,
  installStartFn,
  installVerifyFn,
  type InstallationInfo,
} from "@/lib/auth/installation";

export const Route = createFileRoute("/installation")({
  loader: () => getInstallationStateFn(),
  head: () => ({
    meta: [
      { title: "Installation · Diambar Agro" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: InstallationPage,
});

const NETWORK_ERROR = "Connexion impossible. Vérifiez votre accès à internet et réessayez.";

const primaryButton =
  "w-full inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 text-white hover:bg-neutral-800 py-3 font-semibold disabled:opacity-50";

function InstallationPage() {
  const info = Route.useLoaderData();
  return (
    <AuthSplitLayout>
      {info.state === "ready" ? <InstallWizard info={info} /> : <Closed state={info.state} />}
    </AuthSplitLayout>
  );
}

function Closed({ state }: { state: "installed" | "not_configured" | "no_database" }) {
  const copy = {
    installed: {
      icon: Lock,
      title: "Installation terminée",
      body: "La plateforme a déjà son super administrateur. Cette page ne sert plus : connectez-vous normalement.",
    },
    not_configured: {
      icon: ServerCog,
      title: "Installation non configurée",
      body: "Dans les réglages du serveur, déclarez votre adresse email (ADMIN_EMAIL) et l'envoi d'emails (RESEND_API_KEY et EMAIL_FROM). À défaut, un code d'installation (SETUP_CODE, 16 caractères minimum). Puis rechargez cette page.",
    },
    no_database: {
      icon: ServerCog,
      title: "Base de données non reliée",
      body: "Aucune base de données n'est branchée : les comptes de démonstration sont utilisés. L'installation se fait sur la plateforme reliée à la base.",
    },
  }[state];
  return (
    <div>
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-neutral-100 text-neutral-700">
        <copy.icon className="h-6 w-6" aria-hidden />
      </div>
      <h1 className="mt-5 display-xl text-4xl">{copy.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{copy.body}</p>
      <Link to="/login" className={`mt-6 ${primaryButton}`}>
        Aller à la connexion
      </Link>
    </div>
  );
}

// --- Parcours en étapes ---------------------------------------------------------------

type Step = 1 | 2 | 3 | 4;
const STEP_LABELS = ["Bienvenue", "Identité", "Vérification", "Mot de passe"];

function Stepper({ step, skipVerify }: { step: Step; skipVerify: boolean }) {
  const labels = skipVerify ? STEP_LABELS.filter((_, i) => i !== 2) : STEP_LABELS;
  const position = skipVerify && step === 4 ? 3 : step;
  return (
    <div className="mb-6" data-testid="install-stepper">
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Étape {position}/{labels.length} · {labels[position - 1]}
        </span>
        <span>{Math.round((position / labels.length) * 100)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${(position / labels.length) * 100}%` }}
        />
      </div>
    </div>
  );
}

function InstallWizard({ info }: { info: InstallationInfo }) {
  const navigate = useNavigate();
  const byEmail = info.method === "email";
  // Sans envoi d'emails, pas d'étape de vérification : le code
  // d'installation accepté suffit.
  const skipVerify = !info.emailReady;
  const [step, setStep] = useState<Step>(
    info.resume === "password" ? 4 : info.resume === "verify" ? 3 : 1,
  );
  const [identity, setIdentity] = useState({
    firstName: "",
    lastName: "",
    email: info.pendingEmail ?? "",
    phone: "",
    setupCode: "",
  });
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState({ password: "", confirm: "" });
  const [twoFa, setTwoFa] = useState(info.emailReady);
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const run = async (fn: () => Promise<void>) => {
    setLoading(true);
    try {
      await fn();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : NETWORK_ERROR);
    } finally {
      setLoading(false);
    }
  };

  const restart = () =>
    run(async () => {
      await installRestartFn();
      setOtp("");
      setStep(2);
    });

  const submitIdentity = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const res = await installStartFn({
        data: { ...identity, setupCode: byEmail ? undefined : identity.setupCode },
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      if (res.next === "verify") {
        setOtp("");
        setResendIn(res.resendInSeconds);
        toast.info("Code envoyé par email", {
          description: `À ${identity.email.trim()}. Pensez aux courriers indésirables.`,
        });
        setStep(3);
      } else {
        setStep(4);
      }
    });
  };

  const submitCode = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (otp.replace(/\s/g, "").length < 6) {
      toast.error("Code à 6 chiffres requis");
      return;
    }
    void run(async () => {
      const res = await installVerifyFn({ data: { code: otp } });
      if (!res.ok) {
        toast.error(res.message);
        setOtp("");
        if (res.restart) setStep(2);
        return;
      }
      toast.success("Adresse email vérifiée");
      setStep(4);
    });
  };

  const resend = () =>
    run(async () => {
      const res = await installResendFn();
      if (res.ok) {
        setOtp("");
        setResendIn(res.resendInSeconds);
        toast.info("Nouveau code envoyé");
      } else if (res.waitSeconds) {
        setResendIn(res.waitSeconds);
      } else {
        toast.error(res.message);
        if (res.restart) setStep(2);
      }
    });

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.password.length < 12) {
      toast.error("12 caractères minimum");
      return;
    }
    if (password.password !== password.confirm) {
      toast.error("Les mots de passe diffèrent");
      return;
    }
    void run(async () => {
      const res = await installFinishFn({ data: { ...password, twoFa } });
      if (!res.ok) {
        toast.error(res.message);
        if (res.restart) setStep(2);
        return;
      }
      toast.success(`Bienvenue ${res.user.name} : votre compte super administrateur est créé.`);
      navigate({ to: "/admin/setup" });
    });
  };

  return (
    <div>
      <Stepper step={step} skipVerify={skipVerify} />

      {step === 1 && (
        <div data-testid="install-welcome">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
            <ShieldCheck className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="mt-5 display-xl text-4xl">Bienvenue sur Diambar Agro</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Créons le compte du super administrateur, celui qui a tous les droits. Cette page ne
            sert qu'une fois : dès que le compte existe, elle se ferme définitivement.
          </p>
          <ul className="mt-6 space-y-2 text-sm">
            <Check ok icon={Database}>
              Base de données branchée
            </Check>
            <Check ok={info.emailReady} icon={Mail}>
              {info.emailReady
                ? "Envoi d'emails prêt"
                : "Envoi d'emails non configuré : pas de vérification par email ni de double authentification pour l'instant"}
            </Check>
            <Check ok icon={KeyRound}>
              {byEmail
                ? "Protection : seule l'adresse déclarée sur le serveur peut installer, avec un code reçu par email"
                : "Protection : le code d'installation défini sur le serveur"}
            </Check>
          </ul>
          <button type="button" onClick={() => setStep(2)} className={`mt-8 ${primaryButton}`}>
            Commencer
          </button>
        </div>
      )}

      {step === 2 && (
        <form onSubmit={submitIdentity} data-testid="install-identity">
          <BackButton onClick={() => setStep(1)} />
          <h1 className="display-xl text-4xl">Qui êtes-vous ?</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ces informations identifient le super administrateur dans l'application et dans le
            journal d'audit.
          </p>
          <div className="mt-6 space-y-3">
            {!byEmail && (
              <Field
                label="Code d'installation"
                type="password"
                autoComplete="off"
                value={identity.setupCode}
                onChange={(v) => setIdentity({ ...identity, setupCode: v })}
                hint="Le code secret défini sur le serveur (SETUP_CODE)."
              />
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Prénom"
                autoComplete="given-name"
                value={identity.firstName}
                onChange={(v) => setIdentity({ ...identity, firstName: v })}
              />
              <Field
                label="Nom"
                autoComplete="family-name"
                value={identity.lastName}
                onChange={(v) => setIdentity({ ...identity, lastName: v })}
              />
            </div>
            <Field
              label="Email"
              type="email"
              autoComplete="email"
              value={identity.email}
              onChange={(v) => setIdentity({ ...identity, email: v })}
              hint={
                byEmail
                  ? "L'adresse déclarée sur le serveur pour l'installation (ADMIN_EMAIL). Un code vous y sera envoyé."
                  : info.emailReady
                    ? "Un code vous y sera envoyé pour la vérifier."
                    : undefined
              }
            />
            <Field
              label="Téléphone"
              type="tel"
              autoComplete="tel-national"
              value={identity.phone}
              onChange={(v) => setIdentity({ ...identity, phone: v })}
              hint="9 chiffres, sans l'indicatif (ex. 77 123 45 67)."
            />
          </div>
          <button type="submit" disabled={loading} className={`mt-6 ${primaryButton}`}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {skipVerify ? "Continuer" : "Recevoir le code"}
          </button>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={submitCode} data-testid="install-verify">
          <BackButton onClick={restart} label="Changer d'adresse" />
          <h1 className="display-xl text-4xl">Vérifiez votre email</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Code envoyé à{" "}
            <span className="font-medium text-foreground">{identity.email.trim()}</span>. Il est
            valable 10 minutes. Pas reçu ? Regardez dans les courriers indésirables.
          </p>
          <div className="mt-8">
            <OtpInput value={otp} onChange={setOtp} />
          </div>
          <button type="submit" disabled={loading} className={`mt-6 ${primaryButton}`}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Vérifier
          </button>
          <button
            type="button"
            disabled={resendIn > 0 || loading}
            onClick={() => void resend()}
            className="mt-3 w-full text-sm font-medium text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
          >
            {resendIn > 0 ? `Renvoyer le code dans ${resendIn} s` : "Renvoyer le code"}
          </button>
        </form>
      )}

      {step === 4 && (
        <form onSubmit={submitPassword} data-testid="install-password">
          <h1 className="display-xl text-4xl">Votre mot de passe</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            C'est le compte le plus puissant de la plateforme : choisissez un mot de passe long, que
            vous n'utilisez nulle part ailleurs, et gardez-le dans un gestionnaire de mots de passe.
          </p>
          <div className="mt-6 space-y-3">
            <div>
              <Field
                label="Mot de passe"
                type="password"
                autoComplete="new-password"
                value={password.password}
                onChange={(v) => setPassword({ ...password, password: v })}
                hint="12 caractères minimum."
              />
              <PasswordStrength value={password.password} />
            </div>
            <Field
              label="Confirmer le mot de passe"
              type="password"
              autoComplete="new-password"
              value={password.confirm}
              onChange={(v) => setPassword({ ...password, confirm: v })}
            />
            <label
              className={`flex gap-3 rounded-2xl border border-border p-4 text-sm ${info.emailReady ? "" : "opacity-60"}`}
            >
              <input
                type="checkbox"
                checked={twoFa}
                disabled={!info.emailReady}
                onChange={(e) => setTwoFa(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-emerald-600"
              />
              <span>
                <span className="font-medium">Double authentification (recommandée)</span>
                <span className="block text-xs text-muted-foreground">
                  {info.emailReady
                    ? "À chaque connexion, un code à 6 chiffres vous est envoyé par email après le mot de passe."
                    : "Disponible une fois l'envoi d'emails configuré (Paramètres → Sécurité)."}
                </span>
              </span>
            </label>
          </div>
          <button type="submit" disabled={loading} className={`mt-6 ${primaryButton}`}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Créer le super administrateur
          </button>
          <button
            type="button"
            onClick={restart}
            className="mt-3 w-full text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Recommencer
          </button>
        </form>
      )}
    </div>
  );
}

function Check({
  ok,
  icon: Icon,
  children,
}: {
  ok: boolean;
  icon: typeof Database;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-border px-4 py-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="flex-1">{children}</span>
      {ok ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Prêt" />
      ) : (
        <CircleAlert className="h-4 w-4 shrink-0 text-amber-600" aria-label="À configurer" />
      )}
    </li>
  );
}

function BackButton({ onClick, label = "Retour" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="mt-1.5 w-full rounded-2xl border border-border bg-white px-3 py-3 text-sm focus:border-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-600/10"
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-[11px] text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
