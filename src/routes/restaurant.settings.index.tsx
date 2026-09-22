import { createFileRoute, Link } from "@tanstack/react-router";
import { User, Building2, CreditCard, Shield, Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRestaurantProfile, useRestaurantTeam } from "@/data/store";
import { useSecurity } from "@/data/security";
import { relativeTime } from "@/lib/format";
import { restaurantCompletionPct } from "@/lib/profile-completion";

export const Route = createFileRoute("/restaurant/settings/")({
  head: () => ({
    meta: [
      { title: "Paramètres · Restaurant · Diambar Agro" },
      { name: "description", content: "Vue d'ensemble des paramètres de votre restaurant." },
    ],
  }),
  component: SettingsOverview,
});

function SettingsOverview() {
  const profile = useRestaurantProfile();
  const team = useRestaurantTeam();
  const security = useSecurity();

  const completion = restaurantCompletionPct(profile);
  const openDays = Object.values(profile.receptionHours).filter((s) => s.open).length;

  const cards = [
    {
      to: "/restaurant/settings/profile",
      icon: User,
      title: "Profil",
      lines: [`${completion}% complet`, profile.manager || "Aucun responsable défini"],
    },
    {
      to: "/restaurant/settings/establishment",
      icon: Building2,
      title: "Établissement",
      lines: [`${profile.city} · ${profile.capacity} couverts`, `${openDays}/7 jours de réception`],
    },
    {
      to: "/restaurant/settings/payments",
      icon: CreditCard,
      title: "Paiement",
      lines: [
        `${profile.enabledPaymentMethods.length} méthode(s) active(s)`,
        profile.paymentTermsDays === 0 ? "Comptant" : `Délai : ${profile.paymentTermsDays} jours`,
      ],
    },
    {
      to: "/restaurant/settings/security",
      icon: Shield,
      title: "Sécurité",
      lines: [
        security.twoFa ? "2FA activée" : "2FA désactivée",
        `Mot de passe modifié ${relativeTime(security.passwordUpdatedAt)}`,
      ],
    },
    {
      to: "/restaurant/settings/team",
      icon: Users,
      title: "Équipe",
      lines: [
        `${team.length} membre(s)`,
        `${team.filter((m) => m.status === "invited").length} invitation(s) en attente`,
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h3 className="font-semibold text-lg">Vue d'ensemble</h3>
          <p className="text-sm text-muted-foreground mt-1">
            État réel de votre compte restaurant, en un coup d'œil.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/restaurant/settings/profile">Modifier le profil</Link>
          </Button>
          <Button asChild>
            <Link to="/restaurant/settings/establishment">Voir mon établissement</Link>
          </Button>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="glass rounded-2xl p-5 space-y-3 hover:ring-2 hover:ring-primary/30 transition group"
          >
            <div className="flex items-center justify-between">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <c.icon className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition" />
            </div>
            <div>
              <h3 className="font-semibold">{c.title}</h3>
              {c.lines.map((line) => (
                <p key={line} className="text-sm text-muted-foreground">
                  {line}
                </p>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
