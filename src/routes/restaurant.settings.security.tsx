import { createFileRoute } from "@tanstack/react-router";
import { SecurityPanel } from "@/components/common/security-panel";

export const Route = createFileRoute("/restaurant/settings/security")({
  head: () => ({
    meta: [
      { title: "Sécurité · Paramètres restaurant · Diambar Agro" },
      { name: "description", content: "Mot de passe, double authentification et appareils connectés à votre compte restaurant." },
      { property: "og:title", content: "Sécurité · Paramètres restaurant" },
      { property: "og:description", content: "Protégez le compte de votre restaurant." },
    ],
  }),
  component: RestaurantSecuritySettings,
});

function RestaurantSecuritySettings() {
  return <SecurityPanel description="Protégez l'accès au compte de votre établissement." />;
}
