import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useId, useState } from "react";
import { KeyRound, Loader2, Lock, ServerCog, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AuthSplitLayout } from "@/components/auth/split-layout";
import { PasswordStrength } from "@/components/auth/password-strength";
import { getInstallationStateFn, installFn } from "@/lib/auth/installation";

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

function InstallationPage() {
  const { state } = Route.useLoaderData();
  return (
    <AuthSplitLayout>
      {state === "ready" ? <InstallForm /> : <Closed state={state} />}
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
      body: "Le code d'installation (SETUP_CODE, 16 caractères minimum) n'est pas défini dans les réglages secrets du serveur. Ajoutez-le, puis rechargez cette page.",
    },
    no_database: {
      icon: ServerCog,
      title: "Mode démonstration",
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
      <Link
        to="/login"
        className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 text-white hover:bg-neutral-800 py-3 font-semibold"
      >
        Aller à la connexion
      </Link>
    </div>
  );
}

type Form = {
  setupCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirm: string;
};

function InstallForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState<Form>({
    setupCode: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
  });
  const [loading, setLoading] = useState(false);
  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await installFn({ data: form });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(`Bienvenue ${res.user.name} : votre compte super administrateur est créé.`);
      navigate({ to: "/admin/setup" });
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : NETWORK_ERROR);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
        <ShieldCheck className="h-6 w-6" aria-hidden />
      </div>
      <h1 className="mt-5 display-xl text-4xl">Installation de la plateforme</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Créez le compte du super administrateur. Cette page ne fonctionne qu'une fois : dès que le
        compte existe, elle se ferme définitivement.
      </p>

      <div className="mt-6 space-y-3">
        <Field
          label="Code d'installation"
          type="password"
          autoComplete="off"
          value={form.setupCode}
          onChange={set("setupCode")}
          hint="Le code secret défini sur le serveur (SETUP_CODE)."
          icon
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Prénom"
            autoComplete="given-name"
            value={form.firstName}
            onChange={set("firstName")}
          />
          <Field
            label="Nom"
            autoComplete="family-name"
            value={form.lastName}
            onChange={set("lastName")}
          />
        </div>
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={set("email")}
        />
        <Field
          label="Téléphone"
          type="tel"
          autoComplete="tel-national"
          value={form.phone}
          onChange={set("phone")}
          hint="9 chiffres, sans l'indicatif (ex. 77 123 45 67)."
        />
        <div>
          <Field
            label="Mot de passe"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={set("password")}
            hint="12 caractères minimum : c'est le compte le plus puissant de la plateforme."
          />
          <PasswordStrength value={form.password} />
        </div>
        <Field
          label="Confirmer le mot de passe"
          type="password"
          autoComplete="new-password"
          value={form.confirm}
          onChange={set("confirm")}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 text-white hover:bg-neutral-800 py-3 font-semibold disabled:opacity-50"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        Créer le super administrateur
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  hint,
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  hint?: string;
  icon?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative mt-1.5">
        {icon && (
          <KeyRound
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
        )}
        <input
          id={id}
          type={type}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className={`w-full rounded-2xl border border-border bg-white py-3 text-sm focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 ${icon ? "pl-9 pr-3" : "px-3"}`}
        />
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-[11px] text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
