import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emailConfigured, sendEmail } from "./email.server";
import {
  accountApprovedEmail,
  correctionRequestedEmail,
  escapeHtml,
  passwordResetEmail,
  registrationCodeEmail,
} from "./templates";

describe("modèles d'emails", () => {
  it("met le code dans l'objet, le HTML et le texte", () => {
    const e = registrationCodeEmail({ firstName: "Awa", code: "482913" });
    expect(e.subject).toContain("482913");
    expect(e.html).toContain("482913");
    expect(e.text).toContain("Code : 482913");
    expect(e.html).toContain('lang="fr"');
    expect(e.tag).toMatch(/^[a-z0-9-]+$/);
  });

  it("échappe ce que saisissent les utilisateurs", () => {
    const e = correctionRequestedEmail({
      firstName: '<img src=x onerror="alert(1)">',
      note: "Précisez <b>la parcelle</b> & le quartier",
      contactUrl: "https://diambar.sn/contact",
    });
    expect(e.html).not.toContain("<img src=x");
    expect(e.html).toContain("&lt;b&gt;la parcelle&lt;/b&gt; &amp; le quartier");
    expect(e.text).toContain("Précisez <b>la parcelle</b> & le quartier");
  });

  it("donne le lien en bouton et en clair", () => {
    const url = "https://diambar.sn/reset-password?token=abc.def";
    const e = passwordResetEmail({ name: "Moussa", url });
    expect(e.html).toContain(`href="${url}"`);
    expect(e.text).toContain(url);
    expect(accountApprovedEmail({ firstName: "A", loginUrl: "https://x/login" }).html).toContain(
      "https://x/login",
    );
  });

  it("escapeHtml couvre les caractères dangereux", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;",
    );
  });
});

describe("envoi par Resend", () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_FROM = "Diambar Agro <onboarding@resend.dev>";
    process.env.RESEND_API_URL = "https://resend.test";
    delete process.env.EMAIL_REPLY_TO;
  });
  afterEach(() => {
    process.env = { ...env };
    vi.restoreAllMocks();
  });

  const message = { to: "a@exemple.sn", subject: "S", html: "<p>h</p>", text: "t", tag: "test" };

  it("refuse d'envoyer sans clé ni expéditeur", async () => {
    delete process.env.RESEND_API_KEY;
    expect(emailConfigured()).toBe(false);
    expect(await sendEmail(message)).toEqual({ ok: false, error: "envoi d'emails non configuré" });
  });

  it("appelle l'API avec la clé, l'expéditeur et le type", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ id: "em_1" }), { status: 200 }));
    expect(await sendEmail({ ...message, idempotencyKey: "k1" })).toEqual({ ok: true, id: "em_1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://resend.test/emails");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_test_key");
    expect(headers["Idempotency-Key"]).toBe("k1");
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      from: "Diambar Agro <onboarding@resend.dev>",
      to: ["a@exemple.sn"],
      subject: "S",
      tags: [{ name: "type", value: "test" }],
    });
  });

  it("signale un refus de Resend sans écrire le message dans le journal", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "domain not verified" }), { status: 403 }),
    );
    const res = await sendEmail({ ...message, text: "Code : 123456" });
    expect(res).toEqual({ ok: false, error: "Resend 403 : domain not verified" });
    expect(log.mock.calls.flat().join(" ")).not.toContain("123456");
  });

  it("signale une panne réseau", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNRESET"));
    expect(await sendEmail(message)).toEqual({ ok: false, error: "ECONNRESET" });
  });
});
