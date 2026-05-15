import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, MailCheck, ArrowLeft } from "lucide-react";
import { AuthSplitLayout } from "@/components/auth/split-layout";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Mot de passe oublié · Diambar Agro" }] }),
  component: ForgotPage,
});

function ForgotPage() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  return (
    <AuthSplitLayout>
      <Link to="/login" className="text-sm text-muted-foreground inline-flex items-center gap-1 mb-4 hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" />Retour à la connexion</Link>
      {!sent ? (
        <form onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
          <h1 className="font-display text-2xl font-bold">Mot de passe oublié ?</h1>
          <p className="mt-1 text-sm text-muted-foreground">Entrez votre email pour recevoir un lien de réinitialisation.</p>
          <div className="mt-6">
            <label className="text-sm font-medium">Email</label>
            <div className="mt-1.5 relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full glass rounded-xl pl-10 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
          <button type="submit" className="mt-6 w-full rounded-xl bg-primary text-primary-foreground py-3 font-semibold">Envoyer le lien</button>
        </form>
      ) : (
        <div className="text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-500/10 text-emerald-500">
            <MailCheck className="h-10 w-10" />
          </div>
          <h1 className="mt-6 font-display text-2xl font-bold">Email envoyé !</h1>
          <p className="mt-2 text-sm text-muted-foreground">Un lien de réinitialisation a été envoyé à <span className="font-medium text-foreground">{email}</span></p>
          <Link to="/login" className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-primary text-primary-foreground py-3 font-semibold">Retour à la connexion</Link>
        </div>
      )}
    </AuthSplitLayout>
  );
}
