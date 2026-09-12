import { useSession } from "@tanstack/react-start/server";
import type { Role } from "@/data/mocks";

export type AuthSessionData = {
  email: string;
  role: Role;
};

const MIN_SECRET_LENGTH = 32;

// Démo uniquement : sans backend, il n'y a pas de secret d'infra à fournir.
// En production, définir SESSION_SECRET (32+ caractères) côté serveur
// (variable d'env Cloudflare Workers) plutôt que d'utiliser ce repli.
const FALLBACK_DEMO_SECRET = "diambar-agro-demo-session-secret-please-rotate";

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= MIN_SECRET_LENGTH) return secret;
  return FALLBACK_DEMO_SECRET;
}

/**
 * Session scellée (chiffrée + signée) côté serveur : le secret ne quitte
 * jamais le serveur, contrairement à un token construit côté client.
 */
export function authSession() {
  // Not a React hook: this is TanStack Start's server-only session helper,
  // only ever called from inside createServerFn handlers (request scope).
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useSession<AuthSessionData>({
    password: getSessionSecret(),
    name: "diambar_session",
    maxAge: 60 * 60 * 24 * 7,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
  });
}
