import { useSession } from "@tanstack/react-start/server";
import type { Role } from "@/data/mocks";

export type PendingTwoFa = {
  email: string;
  role: Role;
  code: string;
  expiresAt: number;
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
  code: string;
  expiresAt: number;
};

export type AuthSessionData = {
  email?: string;
  role?: Role;
  pendingTwoFa?: PendingTwoFa;
  pendingRegistration?: PendingRegistration;
};

const MIN_SECRET_LENGTH = 32;

// Démo uniquement : sans backend, il n'y a pas de secret d'infra à fournir.
// En production, définir SESSION_SECRET (32+ caractères) côté serveur
// (variable d'env Cloudflare Workers) plutôt que d'utiliser ce repli.
const FALLBACK_DEMO_SECRET = "diambar-agro-demo-session-secret-please-rotate";

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= MIN_SECRET_LENGTH) return secret;
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
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
  });
}
