import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ArrowLeft, Check, KeyRound, Sprout } from "lucide-react";
import { Logo } from "@/components/common/logo";
import { SoftGlow } from "@/components/landing/ui";

/**
 * Mise en page des écrans d'authentification, dans le style du site public :
 * fond crème, grands titres serrés, panneau d'ambiance à gauche sur ordinateur
 * (sans image externe), formulaire à droite.
 */
export function AuthSplitLayout({ children }: { children: ReactNode }) {
  return (
    <div className="public-surface min-h-screen lg:grid lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-[#e6f2df] p-10 lg:flex lg:flex-col lg:justify-between">
        <SoftGlow />
        <div className="relative">
          <Logo />
        </div>
        <div className="relative">
          <p className="eyebrow text-emerald-800">Pilote · Dakar</p>
          <p className="display-xl mt-4 max-w-md text-6xl">
            Du champ à votre cuisine, sans détour.
          </p>
          <div className="mt-10 max-w-sm rounded-[1.6rem] border border-black/5 bg-white/90 p-5 shadow-xl shadow-emerald-900/10">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Livraison du jour</span>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                En route
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Sprout className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
              Tomates 20 kg · Ferme Diallo, Rufisque
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-neutral-900 px-4 py-3 text-white">
              <KeyRound className="h-4 w-4 text-emerald-300" aria-hidden />
              <span className="text-xs text-white/70">Code de remise</span>
              <span className="ml-auto font-mono text-lg font-bold tracking-[0.25em]">4827</span>
            </div>
          </div>
        </div>
        <ul className="relative flex flex-wrap gap-2 text-sm">
          {["Livraison J+1", "48 h pour vérifier", "Sans abonnement"].map((t) => (
            <li
              key={t}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 font-medium"
            >
              <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
              {t}
            </li>
          ))}
        </ul>
      </aside>

      <div className="flex min-h-screen flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6">
          <div className="lg:hidden">
            <Logo />
          </div>
          <Link
            to="/"
            className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-black/5 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Retour au site
          </Link>
        </div>
        <div className="flex flex-1 items-start justify-center px-4 pb-12 pt-2 sm:items-center sm:px-8">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}
