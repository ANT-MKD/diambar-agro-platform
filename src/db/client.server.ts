import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

/**
 * Connexion à la base PostgreSQL (Supabase).
 *
 * - `prepare: false` : obligatoire derrière le pooler de connexions de
 *   Supabase (mode transaction), sans effet ailleurs.
 * - Sur Cloudflare Workers, une connexion ne peut pas être réutilisée d'une
 *   requête à l'autre : créer la connexion dans la requête et la fermer à la
 *   fin (`close()`), ce que fera le lot 1.1.
 */
export function createDb(url: string, options: { max?: number } = {}) {
  const client = postgres(url, { prepare: false, max: options.max ?? 1 });
  return {
    db: drizzle(client, { schema }),
    close: () => client.end({ timeout: 5 }),
  };
}

export type Db = ReturnType<typeof createDb>["db"];
