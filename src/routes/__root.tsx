import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { MotionConfig } from "framer-motion";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { CookieConsentBanner } from "@/components/common/cookie-consent-banner";
import { getPublicInfoFn } from "@/lib/public-info";
import { DEFAULT_PUBLIC_INFO, type PublicInfo } from "@/lib/public-info-model";

// Organisation décrite avec les coordonnées saisies dans Paramètres →
// Entreprise, et seulement celles-là : rien n'est inventé.
function organizationJsonLd(info: PublicInfo) {
  const { company } = info;
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: company.name,
    description:
      "Plateforme d'approvisionnement agricole qui connecte agriculteurs, restaurants et livreurs au Sénégal.",
    ...(company.email ? { email: company.email } : {}),
    ...(company.phone ? { telephone: company.phone.replace(/\s/g, "") } : {}),
    address: {
      "@type": "PostalAddress",
      ...(company.address ? { streetAddress: company.address } : {}),
      addressLocality: "Dakar",
      addressCountry: "SN",
    },
  };
}

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-gradient-emerald">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page introuvable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Cette page n'existe pas ou a été déplacée.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const message = error instanceof Error ? error.message : undefined;
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Une erreur est survenue</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {message || "Quelque chose s'est mal passé."}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Réessayer
          </button>
          <a
            href="/"
            className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold hover:bg-accent"
          >
            Accueil
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // Coordonnées et tarifs du site public : lus une fois par chargement de page.
  loader: () => getPublicInfoFn().catch(() => DEFAULT_PUBLIC_INFO),
  staleTime: Infinity,
  head: ({ loaderData }) => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Diambar Agro — Du Champ à Votre Cuisine" },
      {
        name: "description",
        content:
          "Produits frais des producteurs sénégalais, livrés le lendemain aux restaurants. Pilote à Dakar, inscription gratuite.",
      },
      { name: "theme-color", content: "#059669" },
      { property: "og:title", content: "Diambar Agro — Du Champ à Votre Cuisine" },
      { property: "og:description", content: "Logistique alimentaire moderne au Sénégal." },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/og-image.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "/og-image.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(organizationJsonLd(loaderData ?? DEFAULT_PUBLIC_INFO)),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

// Espaces connectés : le thème choisi par l'utilisateur s'applique. Partout
// ailleurs (site public, connexion, inscription), le thème clair est imposé.
const PORTAL_PREFIXES = ["/farmer", "/restaurant", "/driver", "/admin"];

function isPublicPath(pathname: string): boolean {
  return !PORTAL_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <QueryClientProvider client={queryClient}>
      {/* Respecte "réduire les animations" du système : neutralise les
          animations non essentielles de framer-motion pour les visiteurs
          qui l'ont activé, sans avoir à auditer chaque motion.div. */}
      <MotionConfig reducedMotion="user">
        <ThemeProvider forcedTheme={isPublicPath(pathname) ? "light" : undefined}>
          <Outlet />
          <Toaster richColors position="top-right" />
          <CookieConsentBanner />
        </ThemeProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
