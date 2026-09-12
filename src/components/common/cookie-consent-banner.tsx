import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { loadCookieConsent, saveCookieConsent, subscribeCookieConsent } from "@/lib/cookie-consent";
import { Button } from "@/components/ui/button";

const AUTHENTICATED_PREFIXES = ["/farmer", "/restaurant", "/driver", "/admin"];

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const sync = () => setVisible(!loadCookieConsent());
    sync();
    return subscribeCookieConsent(sync);
  }, []);

  // Ces espaces authentifiés ont leur propre barre de nav mobile et le pied
  // de sidebar ancrés en bas de l'écran : un bandeau plein écran les
  // recouvrirait. Le consentement se demande sur le site public.
  const inAuthenticatedApp = AUTHENTICATED_PREFIXES.some((p) => pathname.startsWith(p));

  if (!visible || inAuthenticatedApp) return null;

  const acceptAll = () => {
    saveCookieConsent({ analytics: true, marketing: true });
    setVisible(false);
  };

  const essentialOnly = () => {
    saveCookieConsent({ analytics: false, marketing: false });
    setVisible(false);
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[100] glass-strong border-t border-border p-4 shadow-lg md:p-6"
      role="dialog"
      aria-label="Préférences cookies"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Nous utilisons des cookies essentiels au fonctionnement du site et, avec votre accord, des
          cookies d&apos;analyse et marketing.{" "}
          <Link to="/legal/privacy" className="font-medium text-primary hover:underline">
            En savoir plus
          </Link>
        </p>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={essentialOnly}>
            Essentiels uniquement
          </Button>
          <Button size="sm" onClick={acceptAll}>
            Tout accepter
          </Button>
        </div>
      </div>
    </div>
  );
}
