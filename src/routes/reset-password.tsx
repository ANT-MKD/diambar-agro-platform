import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, Loader2, TriangleAlert, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { AuthSplitLayout } from "@/components/auth/split-layout";
import { PasswordStrength } from "@/components/auth/password-strength";
import { resetPasswordFn, validateResetTokenFn } from "@/lib/auth/functions";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (s: Record<string, unknown>): { token?: string } => ({
    token: (s.token as string) || undefined,
  }),
  head: () => ({ meta: [{ title: "Nouveau mot de passe · Diambar Agro" }] }),
  component: ResetPage,
});

function ResetPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setChecking(false);
      setValid(false);
      return;
    }
    validateResetTokenFn({ data: { token } })
      .then((r) => setValid(r.valid))
      .catch(() => setValid(false))
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
      toast.error(err instanceof Error ? err.message : "Ce lien a expiré");
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
          <h1 className="mt-6 font-display text-2xl font-bold">Ce lien a expiré</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Les liens de réinitialisation ne sont valables que 30 minutes. Demandez-en un nouveau.
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
            <label className="text-sm font-medium">Nouveau mot de passe</label>
            <div className="mt-1.5 relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                required
                className="w-full glass rounded-xl pl-10 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <PasswordStrength value={pw} />
          </div>
          <div className="mt-3">
            <label className="text-sm font-medium">Confirmer</label>
            <input
              type="password"
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
