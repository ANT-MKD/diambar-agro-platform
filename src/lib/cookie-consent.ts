export type CookieConsent = {
  essential: true;
  analytics: boolean;
  marketing: boolean;
  decidedAt: string;
};

const KEY = "diambar-cookie-consent";
const EVENT = "diambar-cookie-consent";

export function loadCookieConsent(): CookieConsent | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CookieConsent) : null;
  } catch {
    return null;
  }
}

export function saveCookieConsent(
  consent: Omit<CookieConsent, "essential" | "decidedAt">,
): CookieConsent {
  const full: CookieConsent = { ...consent, essential: true, decidedAt: new Date().toISOString() };
  try {
    localStorage.setItem(KEY, JSON.stringify(full));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    /* ignore */
  }
  return full;
}

export function subscribeCookieConsent(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
