// Remplit la base avec les données de départ.
//   DATABASE_URL=postgres://… npm run db:seed            → référentiels seuls
//   DATABASE_URL=postgres://… npm run db:seed -- --demo  → + comptes et produits de démo
// Ne jamais lancer --demo sur la base de production.
import { createDb } from "../client.server.ts";
import { seedDemo, seedReference } from "../seed.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL manquant.");
  process.exit(1);
}
const withDemo = process.argv.includes("--demo");
const { db, close } = createDb(url);
try {
  console.log("Référentiels :", await seedReference(db));
  if (withDemo) console.log("Démo :", await seedDemo(db));
} finally {
  await close();
}
