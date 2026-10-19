// Erreurs de connexion à la base, expliquées en français : la personne qui
// installe l'application voit la cause (mot de passe, adresse, tables
// manquantes…) au lieu de la requête qui a échoué. Jamais l'adresse de la
// base ni le mot de passe dans le message.

type ErrorLike = { message?: unknown; code?: unknown; cause?: unknown; errno?: unknown };

/** L'erreur d'origine : Drizzle enveloppe l'erreur du pilote dans `cause`. */
function rootCause(err: unknown): ErrorLike | null {
  let e = err as ErrorLike | null;
  for (let i = 0; i < 5 && e && typeof e === "object" && e.cause; i++) e = e.cause as ErrorLike;
  return e && typeof e === "object" ? e : null;
}

const has = (s: string, re: RegExp) => re.test(s);

/** Explication de l'erreur si elle vient de la connexion ou du schéma de la
 * base, sinon null (l'erreur est alors traitée normalement). */
export function explainDbError(err: unknown): string | null {
  const root = rootCause(err);
  if (!root) return null;
  const code = String(root.code ?? "");
  const message = String(root.message ?? "");
  const where = "Vérifiez la ligne DATABASE_URL du fichier .env (ou des réglages du serveur).";

  if (code === "28P01" || has(message, /password authentication failed/i)) {
    return `Connexion à la base refusée : mot de passe incorrect. ${where} Remplacez [YOUR-PASSWORD], crochets compris, par le mot de passe de la base (Supabase → Project Settings → Database).`;
  }
  if (has(message, /tenant or user not found/i)) {
    return `Connexion à la base refusée : identifiant inconnu. Recopiez l'adresse « Transaction pooler » depuis Supabase → Connect. ${where}`;
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN" || has(message, /getaddrinfo/i)) {
    return `Adresse de la base introuvable. Utilisez l'adresse « Transaction pooler » (port 6543), copiée telle quelle depuis Supabase → Connect, et vérifiez votre connexion internet. ${where}`;
  }
  if (code === "ENETUNREACH" || code === "EHOSTUNREACH" || code === "EADDRNOTAVAIL") {
    return `Base injoignable depuis ce réseau. Utilisez l'adresse « Transaction pooler » (port 6543) et non « Direct connection ». ${where}`;
  }
  if (code === "ECONNREFUSED") {
    return `La base refuse la connexion : adresse ou port incorrect (le « Transaction pooler » utilise le port 6543). ${where}`;
  }
  if (code === "ETIMEDOUT" || code === "CONNECT_TIMEOUT" || has(message, /timeout/i)) {
    return "La base ne répond pas. Vérifiez votre connexion internet, puis que le projet Supabase est actif (un projet gratuit se met en pause après une semaine sans activité : bouton « Restore project »).";
  }
  if (code === "ERR_INVALID_URL" || has(message, /invalid url/i)) {
    return `Adresse de la base mal écrite. Un caractère spécial du mot de passe (@ # / ? :) peut casser l'adresse : choisissez un mot de passe avec seulement des lettres et des chiffres. ${where}`;
  }
  if (code === "42P01" || has(message, /relation .* does not exist/i)) {
    return "Les tables de l'application n'existent pas dans cette base. Lancez « bun run db:migrate » puis « bun run db:seed », ou vérifiez que DATABASE_URL vise le bon projet Supabase.";
  }
  if (code === "3D000" || has(message, /database .* does not exist/i)) {
    return `Base de données introuvable : la fin de l'adresse doit être « /postgres ». ${where}`;
  }
  if (has(message, /ssl|certificate/i)) {
    return `Connexion sécurisée (SSL) à la base impossible. ${where}`;
  }
  if (code.startsWith("08") || code.startsWith("57P")) {
    return `Connexion à la base interrompue (code ${code}). Réessayez dans un instant.`;
  }
  return null;
}
