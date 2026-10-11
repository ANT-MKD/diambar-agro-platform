// Applique les migrations de supabase/migrations sur la base DATABASE_URL.
// Sert aux tests locaux ; sur Supabase, les mêmes fichiers sont appliqués
// dans le même ordre (outil Supabase ou connecteur).
//   DATABASE_URL=postgres://… npm run db:migrate
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "../client.server.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL manquant.");
  process.exit(1);
}
const { db, close } = createDb(url);
try {
  await migrate(db, { migrationsFolder: "supabase/migrations" });
  console.log("Migrations appliquées.");
} finally {
  await close();
}
