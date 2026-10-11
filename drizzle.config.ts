import { defineConfig } from "drizzle-kit";

// Les migrations sont générées dans supabase/migrations au format attendu par
// Supabase (horodatage en préfixe). Elles s'appliquent dans l'ordre, sur une
// base locale pour les tests comme sur le projet Supabase.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./supabase/migrations",
  migrations: { prefix: "supabase" },
  strict: true,
  verbose: true,
});
