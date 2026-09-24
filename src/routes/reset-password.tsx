import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useState } from "react";
import { Lock, Loader2, TriangleAlert, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { AuthSplitLayout } from "@/components/auth/split-layout";
import { PasswordStrength } from "@/components/auth/password-strength";
import { resetPasswordFn, validateResetTokenFn, type ResetTokenState } from "@/lib/auth/functions";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (s: Record<string, unknown>): { token?: string } => ({
    token: (s.token as string) || undefined,
  }),
  head: () => ({ meta: [{ title: "Nouveau mot de passe · Diambar Agro" }] }),
  component: ResetPage,
});

const INVALID_COPY: Record<
  NonNullable<ResetTokenState["reason"]>,
  { title: string; body: string }
> = {
  missing: {
    title: "Lien incomplet",
    body: "Ouvrez le lien reçu en entier, ou demandez-en un nouveau.",
  },
  expired: {
    title: "Ce lien a expiré",
    body: "Les liens de réinitialisation ne sont valables que 30 minutes. Demandez-en un nouveau.",
  },
  used: {
    title: "Lien déjà utilisé",
    body: "Chaque lien ne sert qu'une fois. Si vous n'avez pas changé votre mot de passe vous-même, demandez un nouveau lien.",
  },
};

function ResetPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [reason, setReason] = useState<ResetTokenState["reason"]>();
  const pwId = useId();
  const confirmId = useId();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setChecking(false);
      setValid(false);
      setReason("missing");
      return;
    }
    validateResetTokenFn({ data: { token } })
      .then((r) => {
        setValid(r.valid);
        setReason(r.reason);
      })
      .catch(() => {
        setValid(false);
        setReason("expired");
      })
      .finally(() => setChecking(false));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw !== confirm) return toast.error("Les mots de passe diffèrent");
    if (pw.length < 8) return toast.error("8 caractères minimum");
    setLoading(true);
    try {
      await resetPasswordFn({ data: { token: token!, password: pw } });
      setDone(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      toast.error(message || "Ce lien a expiré");
      setReason(message.includes("déjà été utilisé") ? "used" : "expired");
      setValid(false);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <AuthSplitLayout>
        <div className="grid place-items-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AuthSplitLayout>
    );
  }

  if (!valid) {
    return (
      <AuthSplitLayout>
        <div className="text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-destructive/10 text-destructive">
            <TriangleAlert className="h-8 w-8" />
          </div>
          <h1 className="mt-6 font-display text-2xl font-bold">
            {INVALID_COPY[reason ?? "expired"].title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {INVALID_COPY[reason ?? "expired"].body}
          </p>
          <Link
            to="/forgot-password"
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-primary text-primary-foreground py-3 font-semibold"
          >
            Demander un nouveau lien
          </Link>
        </div>
      </AuthSplitLayout>
    );
  }

  if (done) {
    return (
      <AuthSplitLayout>
        <div className="text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/10 text-emerald-500">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="mt-6 font-display text-2xl font-bold">Mot de passe modifié</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Votre mot de passe a été mis à jour. Reconnectez-vous avec votre nouveau mot de passe.
          </p>
          <button
            onClick={() => navigate({ to: "/login" })}
            className="mt-6 w-full rounded-xl bg-primary text-primary-foreground py-3 font-semibold"
          >
            Se connecter
          </button>
        </div>
      </AuthSplitLayout>
    );
  }

  return (
    <AuthSplitLayout>
      <div>
        <h1 className="font-display text-2xl font-bold">Nouveau mot de passe</h1>
        <p className="mt-1 text-sm text-muted-foreground">Choisissez un mot de passe sécurisé</p>
        <form onSubmit={submit}>
          <div className="mt-6">
            <label htmlFor={pwId} className="text-sm font-medium">
              Nouveau mot de passe
            </label>
            <div className="mt-1.5 relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                id={pwId}
                type="password"
                autoComplete="new-password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                required
                className="w-full glass rounded-xl pl-10 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <PasswordStrength value={pw} />
          </div>
          <div className="mt-3">
            <label htmlFor={confirmId} className="text-sm font-medium">
              Confirmer
            </label>
            <input
              id={confirmId}
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="mt-1.5 w-full glass rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-3 font-semibold disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Mettre à jour
          </button>
          <Link
            to="/login"
            className="mt-3 block text-center text-sm text-muted-foreground hover:text-foreground"
          >
            Retour
          </Link>
        </form>
      </div>
    </AuthSplitLayout>
  );
}
