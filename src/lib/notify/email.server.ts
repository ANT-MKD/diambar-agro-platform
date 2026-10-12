// Envoi d'emails transactionnels par Resend (https://resend.com), via son API
// HTTP : fonctionne aussi bien sur Node que sur Cloudflare Workers.
//
// Réglages (secrets du déploiement, jamais dans le code) :
// - RESEND_API_KEY : clé d'API Resend (droit « envoi » suffit) ;
// - EMAIL_FROM : expéditeur, ex. « Diambar Agro <bonjour@diambar.sn> ». Sans
//   domaine vérifié chez Resend : « Diambar Agro <onboarding@resend.dev> », qui
//   n'envoie qu'à l'adresse du compte Resend (tests uniquement) ;
// - EMAIL_REPLY_TO (facultatif) : adresse qui reçoit les réponses ;
// - RESEND_API_URL (facultatif) : autre adresse d'API, pour les tests.

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Type de message (lettres, chiffres, tirets), pour les statistiques Resend. */
  tag: string;
  /** Évite un double envoi si la même demande est rejouée. */
  idempotencyKey?: string;
};

export type SendResult = { ok: true; id: string } | { ok: false; error: string };

const SEND_TIMEOUT_MS = 8_000;

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY?.trim() && !!process.env.EMAIL_FROM?.trim();
}

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) return { ok: false, error: "envoi d'emails non configuré" };
  const base = (process.env.RESEND_API_URL?.trim() || "https://api.resend.com").replace(/\/$/, "");
  const replyTo = process.env.EMAIL_REPLY_TO?.trim();
  try {
    const res = await fetch(`${base}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(message.idempotencyKey ? { "Idempotency-Key": message.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        tags: [{ name: "type", value: message.tag }],
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    const body = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
    if (!res.ok || !body?.id) {
      const error = `Resend ${res.status}${body?.message ? ` : ${body.message}` : ""}`;
      // Jamais le contenu du message dans le journal (codes, liens).
      console.error(`[email] échec d'envoi (${message.tag}) : ${error}`);
      return { ok: false, error };
    }
    return { ok: true, id: body.id };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[email] échec d'envoi (${message.tag}) : ${error}`);
    return { ok: false, error };
  }
}
