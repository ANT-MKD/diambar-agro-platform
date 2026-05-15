import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { AuthSplitLayout } from "@/components/auth/split-layout";
import { PasswordStrength } from "@/components/auth/password-strength";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Nouveau mot de passe · Diambar Agro" }] }),
  component: ResetPage,
});

function ResetPage() {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  return (
    <AuthSplitLayout>
      <div>
        <h1 className="font-display text-2xl font-bold">Nouveau mot de passe</h1>
        <p className="mt-1 text-sm text-muted-foreground">Choisissez un mot de passe sécurisé</p>
        <form onSubmit={(e) => { e.preventDefault(); if (pw !== confirm) return toast.error("Les mots de passe diffèrent"); toast.success("Mot de passe mis à jour (simulé)"); }}>
          <div className="mt-6">
            <label className="text-sm font-medium">Nouveau mot de passe</label>
            <div className="mt-1.5 relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required className="w-full glass rounded-xl pl-10 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <PasswordStrength value={pw} />
          </div>
          <div className="mt-3">
            <label className="text-sm font-medium">Confirmer</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className="mt-1.5 w-full glass rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <button type="submit" className="mt-6 w-full rounded-xl bg-primary text-primary-foreground py-3 font-semibold">Mettre à jour</button>
          <Link to="/login" className="mt-3 block text-center text-sm text-muted-foreground hover:text-foreground">Retour</Link>
        </form>
      </div>
    </AuthSplitLayout>
  );
}
