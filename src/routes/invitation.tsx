import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useId, useState } from "react";
import { Loader2, ShieldCheck, TimerOff } from "lucide-react";
import { toast } from "sonner";
import { AuthSplitLayout } from "@/components/auth/split-layout";
import { PasswordStrength } from "@/components/auth/password-strength";
import { acceptInvitationFn, getInvitationFn } from "@/lib/auth/invitation";

export const Route = createFileRoute("/invitation")({
  validateSearch: (s: Record<string, unknown>): { token: string } => ({
    token: typeof s.token === "string" ? s.token : "",
  }),
  loaderDeps: ({ search }) => ({ token: search.token }),
  loader: ({ deps }) => getInvitationFn({ data: { token: deps.token } }),
  head: () => ({
    meta: [
      { title: "Invitation · Diambar Agro" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: InvitationPage,
});

function InvitationPage() {
  const info = Route.useLoaderData();
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const phoneId = useId();
  const pwId = useId();
  const confirmId = useId();

  if (!info.valid) {
    return (
      <AuthSplitLayout>
        <div>
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-neutral-100 text-neutral-700">
            <TimerOff className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="mt-5 display-xl text-4xl">
            {info.reason === "used" ? "Invitation déjà utilisée" : "Invitation expirée"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {info.reason === "used"
              ? "Le compte a déjà été créé avec ce lien. Connectez-vous avec votre email et votre mot de passe."
              : "Ce lien n'est plus valable (72 heures maximum). Demandez une nouvelle invitation au super administrateur."}
          </p>
          <Link
            to="/login"
            className="mt-6 w-full inline-flex items-center justify-center rounded-full bg-neutral-900 text-white hover:bg-neutral-800 py-3 font-semibold"
          >
            Aller à la connexion
          </Link>
        </div>
      </AuthSplitLayout>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await acceptInvitationFn({ data: { token, phone, password, confirm } });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(`Bienvenue ${res.user.name}`);
      navigate({ to: "/admin/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Action impossible.");
    } finally {
      setLoading(false);
    }
  };

  const input =
    "mt-1.5 w-full rounded-2xl border border-border bg-white px-3 py-3 text-sm focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10";

  return (
    <AuthSplitLayout>
      <form onSubmit={submit}>
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
          <ShieldCheck className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="mt-5 display-xl text-4xl">Bienvenue {info.firstName}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Vous rejoignez l'équipe Diambar Agro (rôle : {info.roleLabel}) avec l'adresse{" "}
          <strong className="text-foreground">{info.email}</strong>. Choisissez votre mot de passe.
        </p>
        <div className="mt-6 space-y-3">
          <div>
            <label htmlFor={phoneId} className="text-sm font-medium">
              Téléphone
            </label>
            <input
              id={phoneId}
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="77 123 45 67"
              className={input}
            />
          </div>
          <div>
            <label htmlFor={pwId} className="text-sm font-medium">
              Mot de passe
            </label>
            <input
              id={pwId}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={`${pwId}-hint`}
              className={input}
            />
            <p id={`${pwId}-hint`} className="mt-1 text-[11px] text-muted-foreground">
              12 caractères minimum.
            </p>
            <PasswordStrength value={password} />
          </div>
          <div>
            <label htmlFor={confirmId} className="text-sm font-medium">
              Confirmer le mot de passe
            </label>
            <input
              id={confirmId}
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={input}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 text-white hover:bg-neutral-800 py-3 font-semibold disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Créer mon compte
        </button>
      </form>
    </AuthSplitLayout>
  );
}
