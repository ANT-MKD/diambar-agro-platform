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
 * - Une requête à la fois par connexion (`oneAtATime`) : voir plus bas.
 */
export function createDb(url: string, options: { max?: number } = {}) {
  const max = options.max ?? 1;
  const client = postgres(url, { prepare: false, max });
  return {
    db: drizzle(oneAtATime(client, max), { schema }),
    close: () => client.end({ timeout: 5 }),
  };
}

export type Db = ReturnType<typeof createDb>["db"];

/**
 * Par défaut, postgres.js envoie les requêtes lancées ensemble
 * (`Promise.all`) sur la même connexion sans attendre la fin de la
 * précédente. Le pooler de Supabase en mode transaction peut alors les
 * répartir sur deux connexions à la base et en laisser une bloquée jusqu'à la
 * limite de durée de la fonction (plusieurs minutes d'attente en ligne).
 *
 * Ici, au plus `slots` requêtes ou transactions en cours à la fois, chacune
 * sur sa propre connexion ; les suivantes attendent leur tour. À l'intérieur
 * d'une transaction, la connexion reste réservée : rien à faire.
 * client.db.test.ts le vérifie à travers un relais strict.
 */
function oneAtATime(client: postgres.Sql, slots: number): postgres.Sql {
  let free = slots;
  const waiting: (() => void)[] = [];
  const run = async <T>(task: () => PromiseLike<T>): Promise<T> => {
    if (free > 0) free--;
    else await new Promise<void>((resolve) => waiting.push(resolve));
    try {
      return await task();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else free++;
    }
  };
  return new Proxy(client, {
    get(target, prop, receiver) {
      // Drizzle n'utilise que `unsafe` (avec ou sans `.values()`) et `begin`.
      if (prop === "unsafe") {
        return (...args: Parameters<postgres.Sql["unsafe"]>) => {
          let values = false;
          let result: Promise<unknown> | undefined;
          const pending = {
            values() {
              values = true;
              return pending;
            },
            then(onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
              result ??= run(() => {
                const query = target.unsafe(...args);
                return values ? query.values() : query;
              });
              return result.then(onFulfilled, onRejected);
            },
          };
          return pending;
        };
      }
      if (prop === "begin") {
        return (...args: Parameters<postgres.Sql["begin"]>) =>
          run(() => (target.begin as (...a: typeof args) => Promise<unknown>)(...args));
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}
