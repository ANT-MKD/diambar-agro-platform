import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Logo } from "@/components/common/logo";

export const Route = createFileRoute("/onboarding")({
  validateSearch: (s: Record<string, unknown>) => ({ role: (s.role as string) || "farmer" }),
  head: () => ({ meta: [{ title: "Bienvenue · Diambar Agro" }] }),
  component: Onboarding,
});

const flows: Record<
  string,
  { name: string; greeting: string; steps: string[]; cta: string; href: string }
> = {
  farmer: {
    name: "Mamadou",
    greeting: "Votre compte agriculteur est créé ✓",
    steps: [
      "Compléter votre profil (photo, bio, certifications)",
      "Ajouter votre premier produit",
      "Configurer Wave / Orange Money",
    ],
    cta: "Aller au dashboard",
    href: "/farmer/dashboard",
  },
  restaurant: {
    name: "Le Baobab",
    greeting: "Votre compte restaurant est prêt ✓",
    steps: [
      "Compléter le profil (horaires, photos)",
      "Explorer le catalogue de produits",
      "Passer votre première commande",
    ],
    cta: "Explorer le catalogue",
    href: "/farmer/dashboard",
  },
  driver: {
    name: "Oumar",
    greeting: "Dossier en cours de vérification ✓",
    steps: [
      "Vérification documents (24-48h)",
      "Configurer votre wallet Wave",
      "Définir vos zones de couverture",
    ],
    cta: "Configurer mon wallet",
    href: "/farmer/dashboard",
  },
  admin: {
    name: "Admin",
    greeting: "Accès administrateur activé ✓",
    steps: [
      "Activer l'authentification 2FA",
      "Vérifier les comptes en attente",
      "Configurer les commissions",
    ],
    cta: "Accéder au panneau admin",
    href: "/farmer/dashboard",
  },
};

function Onboarding() {
  const { role } = Route.useSearch();
  const f = flows[role] || flows.farmer;
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
          <h1 className="mt-6 font-display text-3xl font-bold">Bienvenue {f.name} !</h1>
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
            to={f.href}
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-6 py-3 font-semibold"
          >
            {f.cta} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
