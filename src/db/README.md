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
bun run db:generate --name courte_description

# Appliquer les migrations et les données de départ sur une base
DATABASE_URL=postgres://… bun run db:migrate
DATABASE_URL=postgres://… bun run db:seed            # référentiels seuls
DATABASE_URL=postgres://… bun run db:seed --demo  # + comptes et produits de démo (jamais en production)

# Tester le schéma sur un PostgreSQL local (la base de test est recréée à chaque fois)
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres bun run test:db
```

## Appliquer une migration sur Supabase

1. Générer la migration, puis la tester en local (`bun run test:db`).
2. L'appliquer sur le projet Supabase (outil Supabase ou connecteur), avec le
   même nom que le fichier.
3. Renommer le fichier local (et sa ligne dans `meta/_journal.json`, et son
   instantané dans `meta/`) avec le numéro de version attribué par Supabase,
   pour que l'historique local et celui de Supabase restent identiques.

Ne jamais modifier une migration déjà appliquée : en écrire une nouvelle.

## Réglages du serveur (secrets du déploiement)

| Variable              | Rôle                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`        | Adresse de la base (Supabase, pooler en mode transaction, port 6543). Sans elle : mode démo en mémoire. |
| `SESSION_SECRET`      | 32 caractères minimum, obligatoire hors mode démo.                                                      |
| `ADMIN_EMAIL`         | Adresse du futur super administrateur : seule elle peut faire `/installation` (code reçu par email).    |
| `SETUP_CODE`          | Secours sans envoi d'emails : code de 16 caractères minimum demandé par `/installation`.                |
| `DEMO_MODE`           | `false` avant d'accueillir de vrais utilisateurs (codes et comptes de démo masqués).                    |
| `RESEND_API_KEY`      | Clé d'API Resend (emails : codes, liens, décisions, invitations).                                       |
| `EMAIL_FROM`          | Expéditeur, ex. `Diambar Agro <bonjour@diambar.sn>` (domaine vérifié chez Resend).                      |
| `APP_URL`             | Adresse publique du site pour les liens des emails (facultatif).                                        |
| `SUPABASE_URL`        | Adresse du projet Supabase, pour les photos (Storage).                                                  |
| `SUPABASE_SECRET_KEY` | Clé secrète Supabase (Storage) : jamais dans le code ni envoyée au navigateur.                          |

Ne jamais écrire ces valeurs dans le code ni dans une conversation : uniquement
dans les secrets du déploiement.

## Première installation (base de production)

1. `bun run db:migrate` puis `bun run db:seed` (référentiels seuls, jamais `--demo`).
2. Ouvrir `/installation` et suivre les étapes : identité, code reçu à l'adresse
   `ADMIN_EMAIL` (ou, sans envoi d'emails, le code `SETUP_CODE`), mot de passe et
   double authentification. La page se ferme ensuite définitivement.
3. L'assistant `/admin/setup` s'ouvre : 8 étapes (sécurité, entreprise, zone
   pilote, règles de commande, commission et TVA, paiements, catalogue, équipe).
4. « Ouvrir les inscriptions » : la page d'inscription devient accessible ; chaque
   compte attend la validation de l'équipe dans Validations.
