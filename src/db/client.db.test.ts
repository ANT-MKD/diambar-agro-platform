// Connexion à la base : jamais deux requêtes en vol sur une même connexion
// (le pooler de Supabase en mode transaction peut alors en bloquer une).
// Ne tourne que si TEST_DATABASE_URL est défini.
import net from "node:net";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "./client.server";

const adminUrl = process.env.TEST_DATABASE_URL;

/**
 * Relais TCP vers la base, comme un pooler : il transmet les réponses de la
 * base message par message et compte les requêtes que le client envoie alors
 * que la précédente n'a pas encore reçu ReadyForQuery.
 */
function strictPooler(target: URL) {
  let pipelined = 0;
  const server = net.createServer((client) => {
    const upstream = net.connect(Number(target.port || 5432), target.hostname);
    let started = false;
    let waiting = 0;
    let fromClient = Buffer.alloc(0);
    let fromServer = Buffer.alloc(0);
    let relay = Promise.resolve();
    client.on("data", (chunk) => {
      fromClient = Buffer.concat([fromClient, chunk]);
      for (;;) {
        // Message de démarrage : sans octet de type.
        const head = started ? 1 : 0;
        if (fromClient.length < head + 4) break;
        const length = fromClient.readInt32BE(head);
        if (fromClient.length < head + length) break;
        if (started) {
          const type = String.fromCharCode(fromClient[0]);
          if ("PBQ".includes(type) && waiting > 0) pipelined++;
          if (type === "S" || type === "Q") waiting++;
        }
        started = true;
        fromClient = fromClient.subarray(head + length);
      }
      upstream.write(chunk);
    });
    upstream.on("data", (chunk) => {
      fromServer = Buffer.concat([fromServer, chunk]);
      while (fromServer.length >= 5) {
        const length = fromServer.readInt32BE(1);
        if (fromServer.length < length + 1) break;
        const message = fromServer.subarray(0, length + 1);
        fromServer = fromServer.subarray(length + 1);
        relay = relay
          .then(() => new Promise<void>((resolve) => setImmediate(resolve)))
          .then(() => {
            if (message[0] === 0x5a && waiting > 0) waiting--; // Z : ReadyForQuery
            client.write(message);
          });
      }
    });
    client.on("close", () => upstream.end());
    upstream.on("close", () => client.end());
    client.on("error", () => undefined);
    upstream.on("error", () => undefined);
  });
  return { server, pipelined: () => pipelined };
}

describe.skipIf(!adminUrl)("connexion à la base", () => {
  const target = new URL(adminUrl ?? "postgres://localhost");
  const pooler = strictPooler(target);
  let url: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => pooler.server.listen(0, "127.0.0.1", resolve));
    const proxied = new URL(target);
    proxied.hostname = "127.0.0.1";
    proxied.port = String((pooler.server.address() as net.AddressInfo).port);
    url = proxied.toString();
  });

  afterAll(() => {
    pooler.server.close();
  });

  it("attend la fin de chaque requête avant d'envoyer la suivante", async () => {
    const { db, close } = createDb(url);
    try {
      const results = await Promise.all([
        db.execute(sql`select 1 as n`),
        db.execute(sql`select ${2}::int as n`),
        db.transaction(async (tx) => tx.execute(sql`select ${3}::int as n`)),
        db.execute(sql`select 4 as n`),
        db.execute(sql`select ${5}::int as n`),
      ]);
      expect(results.map((r) => Number(r[0].n))).toEqual([1, 2, 3, 4, 5]);
    } finally {
      await close();
    }
    expect(pooler.pipelined()).toBe(0);
  });
});
