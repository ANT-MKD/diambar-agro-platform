import { z } from "zod";
import { createDb } from "@/db/client.server";
import { verifySignedToken } from "@/lib/auth/tokens.server";
import { MarketError } from "./market-common.server";
import { reportPosition } from "./positions-db.server";

// POST /api/driver-position : le téléphone du livreur envoie sa position.
// Pas de cookie : l'application Android envoie depuis le natif (requêtes non
// ralenties en arrière-plan), avec le jeton signé de startGpsSessionFn.

const body = z.object({
  lat: z.number().finite(),
  lng: z.number().finite(),
  accuracy: z.number().finite().nullish(),
  heading: z.number().finite().nullish(),
  speedKmh: z.number().finite().nullish(),
  at: z.number().finite().nullish(),
});

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export async function handleDriverPosition(request: Request): Promise<Response> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const claims = token ? await verifySignedToken<{ kind: string; driverId: string }>(token) : null;
  if (!claims || claims.kind !== "gps" || !claims.driverId) {
    return json(401, { ok: false, message: "Jeton absent ou expiré." });
  }
  // Une position tient en quelques dizaines d'octets : rien de plus gros n'est lu.
  if (Number(request.headers.get("content-length") ?? 0) > 2000) {
    return json(413, { ok: false, message: "Requête trop grande." });
  }
  const text = await request.text();
  if (text.length > 2000) return json(413, { ok: false, message: "Requête trop grande." });
  let input: z.infer<typeof body>;
  try {
    input = body.parse(JSON.parse(text));
  } catch {
    return json(400, { ok: false, message: "Position illisible." });
  }
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return json(503, { ok: false, message: "Base de données non configurée." });
  const { db, close } = createDb(url);
  try {
    const { tracking } = await reportPosition(db, claims.driverId, input);
    return json(200, { ok: true, tracking });
  } catch (err) {
    if (err instanceof MarketError) return json(400, { ok: false, message: err.message });
    console.error("[position]", err);
    return json(500, { ok: false, message: "Enregistrement impossible." });
  } finally {
    await close().catch(() => undefined);
  }
}
