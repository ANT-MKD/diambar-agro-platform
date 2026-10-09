import { useSession } from "@tanstack/react-start/server";
import type { Role } from "@/data/mocks";
import { isDemoMode } from "./config.server";

export type PendingTwoFa = {
  /** Identifiant aléatoire du code en cours, pour compter les essais côté serveur. */
  id: string;
  email: string;
  role: Role;
  code: string;
  expiresAt: number;
  sentAt: number;
  attempts: number;
  rememberMe: boolean;
};

/** Informations spécifiques au métier (étape 3 de l'inscription) — tous les
 * champs sont optionnels côté type puisqu'ils dépendent du rôle choisi. */
export type RegisterDetails = {
  farmName?: string;
  location?: string;
  areaHectares?: string;
  productTypes?: string[];
  restaurantName?: string;
  address?: string;
  professionalPhone?: string;
  ninea?: string;
  vehicleType?: string;
  licenseNumber?: string;
  zones?: string[];
};

export type PendingRegistration = {
  email: string;
  phone: string;
  role: Role;
  firstName: string;
  lastName: string;
  city: string;
  password: string;
  details?: RegisterDetails;
  acceptedTermsAt: string;
  id: string;
  code: string;
  expiresAt: number;
  sentAt: number;
  attempts: number;
};

export type AuthSessionData = {
  email?: string;
  role?: Role;
  pendingTwoFa?: PendingTwoFa;
  pendingRegistration?: PendingRegistration;
};

const MIN_SECRET_LENGTH = 32;

// Repli accepté uniquement en mode démonstration. Hors démo, l'application
// refuse de créer une session sans vrai secret : avec ce repli public, tout
// le monde pourrait fabriquer un cookie « administrateur » ou un lien de
// réinitialisation valide.
const FALLBACK_DEMO_SECRET = "diambar-agro-demo-session-secret-please-rotate";
let warnedFallback = false;

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= MIN_SECRET_LENGTH) return secret;
  if (!isDemoMode()) {
    throw new Error(
      `SESSION_SECRET manquant ou trop court (${MIN_SECRET_LENGTH} caractères minimum) : ` +
        "définissez-le dans les secrets du déploiement.",
    );
  }
  if (!warnedFallback) {
    warnedFallback = true;
    console.warn("[auth] SESSION_SECRET absent : secret de démonstration utilisé (mode démo).");
  }
  return FALLBACK_DEMO_SECRET;
}

const SHORT_SESSION_SECONDS = 60 * 60 * 24; // 1 jour — session non prolongée
const REMEMBER_ME_SECONDS = 60 * 60 * 24 * 30; // 30 jours — "Se souvenir de moi"

/**
 * Session scellée (chiffrée + signée) côté serveur : le secret ne quitte
 * jamais le serveur, contrairement à un token construit côté client.
 *
 * `rememberMe` fait réellement varier la durée du cookie de session : sans
 * elle la session expire en 24h, avec elle en 30 jours. Le choix n'est
 * mémorisé qu'au moment de la connexion (on ne peut pas changer le maxAge
 * d'un cookie déjà émis sans le réémettre).
 */
export function authSession(rememberMe = false) {
  // Not a React hook: this is TanStack Start's server-only session helper,
  // only ever called from inside createServerFn handlers (request scope).
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useSession<AuthSessionData>({
    password: getSessionSecret(),
    name: "diambar_session",
    maxAge: rememberMe ? REMEMBER_ME_SECONDS : SHORT_SESSION_SECONDS,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      // Cookie envoyé uniquement en HTTPS une fois en ligne (import.meta.env.PROD
      // est figé au build ; process.env.NODE_ENV peut manquer sur Workers).
      secure: import.meta.env.PROD,
      path: "/",
    },
  });
}
