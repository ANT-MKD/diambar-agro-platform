import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decodeImage,
  isStored,
  NOT_STORED_PREFIX,
  publicUrl,
  signedUrl,
  storageConfigured,
  uploadObject,
} from "./storage.server";

const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("images envoyées par le navigateur", () => {
  it("accepte une vraie image PNG", () => {
    const img = decodeImage(PNG_1PX);
    expect(img.ok).toBe(true);
    if (img.ok) {
      expect(img.mime).toBe("image/png");
      expect(img.ext).toBe("png");
    }
  });

  it("refuse un faux fichier déguisé en image", () => {
    const fake = `data:image/jpeg;base64,${btoa("<script>alert(1)</script>")}`;
    expect(decodeImage(fake)).toEqual({
      ok: false,
      message: "Ce fichier n'est pas une image valide.",
    });
  });

  it("refuse les formats non prévus et les données illisibles", () => {
    expect(decodeImage("data:image/gif;base64,R0lGODlh").ok).toBe(false);
    expect(decodeImage("http://exemple.sn/photo.png").ok).toBe(false);
  });

  it("refuse une photo de plus de 2 Mo", () => {
    const big = new Uint8Array(2 * 1024 * 1024 + 10);
    big.set([0xff, 0xd8]);
    let bin = "";
    for (const b of big) bin += String.fromCharCode(b);
    expect(decodeImage(`data:image/jpeg;base64,${btoa(bin)}`)).toEqual({
      ok: false,
      message: "Photo trop lourde (2 Mo maximum).",
    });
  });
});

describe("Supabase Storage", () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
    vi.restoreAllMocks();
  });

  it("sans réglages : rien n'est envoyé ni montré", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SECRET_KEY;
    expect(storageConfigured()).toBe(false);
    expect(publicUrl("produits/a/b.png")).toBeNull();
    expect(await uploadObject("produits", "a/b.png", new Uint8Array([1]), "image/png")).toEqual({
      ok: false,
      error: "stockage non configuré",
    });
  });

  it("lien public seulement pour l'espace « produits »", () => {
    process.env.SUPABASE_URL = "https://projet.supabase.co/";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_x";
    expect(publicUrl("produits/f1/p 1/x.png")).toBe(
      "https://projet.supabase.co/storage/v1/object/public/produits/f1/p%201/x.png",
    );
    expect(publicUrl("preuves/m1/x.png")).toBeNull();
    expect(isStored(`${NOT_STORED_PREFIX}x.png`)).toBe(false);
  });

  it("envoie avec la clé secrète, sans jamais la mettre dans le lien", async () => {
    process.env.SUPABASE_URL = "https://projet.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_x";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ signedURL: "/object/sign/preuves/m1/x.png?token=t" })),
      );
    expect((await uploadObject("preuves", "m1/x.png", new Uint8Array([1]), "image/png")).ok).toBe(
      true,
    );
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://projet.supabase.co/storage/v1/object/preuves/m1/x.png");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sb_secret_x");
    const signed = await signedUrl("preuves/m1/x.png");
    expect(signed).toBe(
      "https://projet.supabase.co/storage/v1/object/sign/preuves/m1/x.png?token=t",
    );
    expect(signed).not.toContain("sb_secret");
  });
});
