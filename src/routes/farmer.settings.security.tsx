import { createFileRoute } from "@tanstack/react-router";
import { SecurityPanel } from "@/components/common/security-panel";

export const Route = createFileRoute("/farmer/settings/security")({
  head: () => ({
    meta: [
      { title: "Sécurité · Paramètres agriculteur · Diambar Agro" },
      { name: "description", content: "Mot de passe, double authentification et sessions actives de votre compte producteur." },
      { property: "og:title", content: "Sécurité · Paramètres agriculteur" },
      { property: "og:description", content: "Protégez votre compte Diambar Agro." },
    ],
  }),
  component: SecuritySettings,
});

function SecuritySettings() {
  return <SecurityPanel description="Protégez l'accès à votre exploitation." />;
}
