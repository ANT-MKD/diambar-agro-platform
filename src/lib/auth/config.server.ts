/**
 * Mode démonstration.
 *
 * Les codes et liens de vérification sont aussi affichés à l'écran (en plus de
 * l'email, s'il est configuré) et des comptes de démonstration sont proposés
 * en un clic. Acceptable pour une démo, pas pour de vrais utilisateurs :
 * n'importe qui pourrait prendre n'importe quel compte.
 *
 * Réglage : variable d'environnement DEMO_MODE ("true" ou "false").
 * Sans réglage, le mode démo est actif en développement et coupé en
 * production — une mise en ligne publique en mode démo doit donc être un
 * choix explicite (voir wrangler.jsonc).
 */
export function isDemoMode(): boolean {
  const flag = process.env.DEMO_MODE?.trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  // import.meta.env.PROD est figé par Vite au build : fiable sur Cloudflare
  // Workers, où process.env.NODE_ENV n'est pas forcément défini.
  return !import.meta.env.PROD;
}

/** Longueur minimale du code d'installation (SETUP_CODE). */
export const MIN_SETUP_CODE_LENGTH = 16;

/**
 * Code secret demandé par la page /installation pour créer le premier super
 * administrateur. Réglage : variable d'environnement SETUP_CODE (secret du
 * déploiement, jamais dans le code). Trop court ou absent : installation
 * impossible.
 */
export function setupCode(): string | null {
  const code = process.env.SETUP_CODE?.trim();
  return code && code.length >= MIN_SETUP_CODE_LENGTH ? code : null;
}

/**
 * Adresse email du futur super administrateur, déclarée dans les réglages du
 * déploiement (variable ADMIN_EMAIL, pas un secret). Seule cette adresse peut
 * faire l'installation, après avoir saisi le code reçu par email.
 */
export function adminEmail(): string | null {
  const v = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
}
