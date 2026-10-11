/**
 * Mode démonstration.
 *
 * Tant qu'aucun fournisseur de SMS ni d'email n'est branché, le seul moyen de
 * montrer l'inscription, la double authentification et le mot de passe oublié
 * est d'afficher le code ou le lien à l'écran, et de proposer des comptes de
 * démonstration en un clic. C'est acceptable pour une démo, pas pour de vrais
 * utilisateurs : n'importe qui pourrait prendre n'importe quel compte.
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

type CodePurpose = "inscription" | "double authentification";

/**
 * Envoi d'un code de vérification. Aucun fournisseur SMS/email n'est encore
 * branché (étape 1) : en mode démo le code est renvoyé pour être affiché ; hors
 * démo il n'est jamais renvoyé au navigateur, seulement écrit dans le journal
 * du serveur pour l'équipe technique.
 */
export function deliverCode(purpose: CodePurpose, destination: string, code: string) {
  if (isDemoMode()) return { devCode: code };
  console.info(`[auth] code de ${purpose} pour ${destination} : envoi à brancher (étape 1)`);
  return { devCode: undefined };
}

export function deliverResetLink(email: string, link: string) {
  if (isDemoMode()) return { devResetLink: link };
  console.info(
    `[auth] lien de réinitialisation demandé pour ${email} : envoi à brancher (étape 1)`,
  );
  return { devResetLink: undefined };
}
