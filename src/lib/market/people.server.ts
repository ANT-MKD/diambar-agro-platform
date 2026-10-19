import { inArray } from "drizzle-orm";
import { farmers, restaurants, users } from "@/db/schema";
import type { Q } from "./market-common.server";

// Noms affichés : établissement pour un restaurant, exploitation pour un
// producteur, prénom et nom pour les autres.

export type Person = { name: string; role: "restaurant" | "farmer" | "driver" | "admin" };

export async function loadPeople(q: Q, ids: Iterable<string | null | undefined>) {
  const list = [...new Set([...ids].filter((x): x is string => !!x))];
  const out = new Map<string, Person>();
  if (!list.length) return out;
  const [people, restos, farms] = await Promise.all([
    q
      .select({
        id: users.id,
        role: users.role,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(inArray(users.id, list)),
    q
      .select({ id: restaurants.userId, name: restaurants.name })
      .from(restaurants)
      .where(inArray(restaurants.userId, list)),
    q
      .select({ id: farmers.userId, name: farmers.farmName })
      .from(farmers)
      .where(inArray(farmers.userId, list)),
  ]);
  for (const p of people) {
    const full = `${p.firstName} ${p.lastName}`.trim();
    const name =
      p.role === "restaurant"
        ? (restos.find((r) => r.id === p.id)?.name ?? full)
        : p.role === "farmer"
          ? (farms.find((f) => f.id === p.id)?.name ?? full)
          : full;
    out.set(p.id, { name: name || "—", role: p.role });
  }
  return out;
}
