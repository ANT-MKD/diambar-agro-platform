# Base de données

PostgreSQL hébergé chez Supabase (projet de travail : `diambar-agro-dev`).
L'application se connecte directement à la base depuis le serveur ; la Data API
de Supabase est désactivée et toutes les tables sont verrouillées (RLS activée
sans règle, droits retirés aux rôles publics `anon` et `authenticated`).

## Fichiers

| Fichier                         | Rôle                                                |
| ------------------------------- | --------------------------------------------------- |
| `schema.ts`                     | Les tables du pilote (source de vérité)             |
| `client.server.ts`              | Connexion à la base (`createDb`)                    |
| `seed.ts`                       | Données de départ : référentiels, et démo en option |
| `cli/migrate.ts`, `cli/seed.ts` | Commandes `db:migrate` et `db:seed`                 |
| `schema.db.test.ts`             | Tests du schéma sur une vraie base PostgreSQL       |
| `../../supabase/migrations/`    | Migrations SQL, appliquées dans l'ordre             |

## Commandes

```sh
# Après une modification de schema.ts : générer la migration SQL
npm run db:generate -- --name courte_description

# Appliquer les migrations et les données de départ sur une base
DATABASE_URL=postgres://… npm run db:migrate
DATABASE_URL=postgres://… npm run db:seed            # référentiels seuls
DATABASE_URL=postgres://… npm run db:seed -- --demo  # + comptes et produits de démo (jamais en production)

# Tester le schéma sur un PostgreSQL local (la base de test est recréée à chaque fois)
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres npm run test:db
```

## Appliquer une migration sur Supabase

1. Générer la migration, puis la tester en local (`npm run test:db`).
2. L'appliquer sur le projet Supabase (outil Supabase ou connecteur), avec le
   même nom que le fichier.
3. Renommer le fichier local (et sa ligne dans `meta/_journal.json`, et son
   instantané dans `meta/`) avec le numéro de version attribué par Supabase,
   pour que l'historique local et celui de Supabase restent identiques.

Ne jamais modifier une migration déjà appliquée : en écrire une nouvelle.
