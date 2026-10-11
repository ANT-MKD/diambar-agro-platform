import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Logo } from "@/components/common/logo";
import { getCurrentUserFn } from "@/lib/auth/functions";
import { dashboardPathForRole } from "@/lib/auth/roles";
import type { Role } from "@/data/mocks";

export const Route = createFileRoute("/onboarding")({
  validateSearch: (s: Record<string, unknown>) => ({ role: (s.role as string) || "farmer" }),
  loader: async () => ({ user: await getCurrentUserFn() }),
  head: () => ({ meta: [{ title: "Bienvenue · Diambar Agro" }] }),
  component: Onboarding,
});

const flows: Record<Role, { greeting: string; steps: string[]; cta: string }> = {
  farmer: {
    greeting: "Votre compte agriculteur est créé ✓",
    steps: [
      "Compléter votre profil (photo, bio, certifications)",
      "Ajouter votre premier produit",
      "Configurer Wave / Orange Money",
    ],
    cta: "Aller au dashboard",
  },
  restaurant: {
    greeting: "Votre compte restaurant est prêt ✓",
    steps: [
      "Compléter le profil (horaires, photos)",
      "Explorer le catalogue de produits",
      "Passer votre première commande",
    ],
    cta: "Explorer le catalogue",
  },
  driver: {
    greeting: "Dossier en cours de vérification ✓",
    steps: [
      "Vérification documents (24-48h)",
      "Configurer votre wallet Wave",
      "Définir vos zones de couverture",
    ],
    cta: "Configurer mon wallet",
  },
  admin: {
    greeting: "Accès administrateur activé ✓",
    steps: [
      "Activer l'authentification 2FA",
      "Vérifier les comptes en attente",
      "Configurer les commissions",
    ],
    cta: "Accéder au panneau admin",
  },
};

function Onboarding() {
  const { role: searchRole } = Route.useSearch();
  const { user } = Route.useLoaderData();
  // Le rôle réel de la session (si connecté juste après l'inscription)
  // prévaut sur le paramètre d'URL, plus facile à falsifier.
  const role = (user?.role ?? (searchRole as Role)) || "farmer";
  const f = flows[role] ?? flows.farmer;
  const name = user?.name ?? "sur Diambar Agro";

  return (
    <div className="min-h-screen bg-hero text-foreground flex flex-col">
      <div className="p-6">
        <Logo />
      </div>
      <div className="flex-1 grid place-items-center px-4">
        <div className="max-w-xl w-full glass-strong rounded-3xl p-8 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary shadow-lg shadow-primary/40">
            <CheckCircle2 className="h-9 w-9 text-primary-foreground" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold">
            {user ? `Bienvenue ${name} !` : "Bienvenue !"}
          </h1>
          <p className="mt-2 text-muted-foreground">{f.greeting}</p>
          <div className="mt-8 space-y-3 text-left">
            {f.steps.map((s, i) => (
              <div key={i} className="flex items-center gap-3 glass rounded-xl p-3">
                <div className="grid h-7 w-7 place-items-center rounded-full bg-primary/20 text-primary text-sm font-bold">
                  {i + 1}
                </div>
                <span className="text-sm">{s}</span>
              </div>
            ))}
          </div>
          <Link
            to={dashboardPathForRole(role)}
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-6 py-3 font-semibold"
          >
            {f.cta} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
