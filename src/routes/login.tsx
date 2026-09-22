import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Lock, Eye, EyeOff, Loader2, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { AuthSplitLayout } from "@/components/auth/split-layout";
import { demoAccounts, type DemoAccount } from "@/data/demo-accounts";
import { auditActions } from "@/data/admin-store";
import { getCurrentUserFn, loginFn } from "@/lib/auth/functions";
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

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await loginFn({ data: { email, password } });
      auditActions.log({
        action: "Connexion réussie",
        target: user.email,
        module: "security",
        level: "info",
        actor: user.name,
      });
      toast.success(`Bienvenue ${user.name}`);
      navigate({ to: dashboardPathForRole(user.role) });
    } catch {
      auditActions.log({
        action: "Connexion échouée",
        target: email,
        module: "security",
        level: "attention",
        status: "failed",
        reason: "Email ou mot de passe incorrect",
      });
      toast.error("Email ou mot de passe incorrect");
    } finally {
      setLoading(false);
    }
  };

  const loginAs = async (account: DemoAccount) => {
    setEmail(account.email);
    setPassword(account.password);
    try {
      const user = await loginFn({ data: { email: account.email, password: account.password } });
      auditActions.log({
        action: "Connexion réussie",
        target: user.email,
        module: "security",
        level: "info",
        actor: user.name,
      });
      toast.success(`Connecté en tant que ${user.name}`);
      navigate({ to: dashboardPathForRole(user.role) });
    } catch {
      auditActions.log({
        action: "Connexion échouée",
        target: account.email,
        module: "security",
        level: "attention",
        status: "failed",
        reason: "Email ou mot de passe incorrect",
      });
      toast.error("Connexion impossible");
    }
  };

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
              <input type="checkbox" className="rounded border-border" />
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
            {demoAccounts.map((a) => (
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
        </div>

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex-1 h-px bg-border" /> ou continuer avec{" "}
          <div className="flex-1 h-px bg-border" />
        </div>
        <div className="space-y-2">
          <button className="w-full glass rounded-xl py-3 font-medium text-sm hover:bg-accent flex items-center justify-center gap-2">
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
          <button className="w-full glass rounded-xl py-3 font-medium text-sm hover:bg-accent">
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
