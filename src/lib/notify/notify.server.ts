import { getRequestUrl } from "@tanstack/react-start/server";
import { isDemoMode } from "@/lib/auth/config.server";
import { emailConfigured, emailTestSenderOnly, sendEmail } from "./email.server";
import type { EmailContent } from "./templates";

// Point d'entrée des messages envoyés aux personnes. Pour l'instant : emails
// par Resend. (Les SMS s'ajouteront ici, derrière les mêmes fonctions.)

/** missing : rien n'est configuré ; test_sender : expéditeur de test de
 * Resend, qui n'envoie qu'au propriétaire du compte ; ready : tout le monde. */
export type EmailStatus = "missing" | "test_sender" | "ready";

export function emailStatus(): EmailStatus {
  if (!emailConfigured()) return "missing";
  return emailTestSenderOnly() ? "test_sender" : "ready";
}

/**
 * Un code de vérification peut-il réellement parvenir à la personne ? En mode
 * démo il s'affiche à l'écran ; sinon il faut l'envoi d'emails configuré.
 * Sans cela, demander un code bloquerait la personne.
 */
export function codeDeliveryAvailable(): boolean {
  return isDemoMode() || emailConfigured();
}

/** Les inscriptions publiques peuvent-elles ouvrir ? Il faut que n'importe
 * qui reçoive son code : démo (code à l'écran) ou domaine vérifié. */
export function publicCodeDeliveryAvailable(): boolean {
  return isDemoMode() || emailStatus() === "ready";
}

/** Adresse publique de l'application (liens dans les emails) : APP_URL si
 * défini, sinon l'adresse de la requête en cours. */
export function appUrl(path: string): string {
  const configured = process.env.APP_URL?.trim().replace(/\/$/, "");
  let origin = configured;
  if (!origin) {
    try {
      origin = getRequestUrl({ xForwardedHost: true }).origin;
    } catch {
      origin = "http://localhost:3000";
    }
  }
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

export type CodeDelivery =
  { ok: true; devCode?: string; emailed: boolean } | { ok: false; message: string };

const SEND_FAILED =
  "L'email n'a pas pu être envoyé. Vérifiez l'adresse saisie, puis réessayez dans un instant.";

/**
 * Envoie un code à 6 chiffres. En mode démo, le code est aussi renvoyé pour
 * être affiché à l'écran (et envoyé par email si l'envoi est configuré). Hors
 * démo, le code n'est jamais renvoyé au navigateur.
 */
export async function deliverCode(
  to: string,
  content: EmailContent,
  code: string,
): Promise<CodeDelivery> {
  const demo = isDemoMode();
  if (!emailConfigured()) {
    if (demo) return { ok: true, devCode: code, emailed: false };
    return {
      ok: false,
      message: "L'envoi des codes n'est pas encore configuré. Réessayez plus tard.",
    };
  }
  const sent = await sendEmail({ to, ...content });
  if (!sent.ok && !demo) return { ok: false, message: SEND_FAILED };
  return { ok: true, emailed: sent.ok, ...(demo ? { devCode: code } : {}) };
}

/** Message d'information (validation, refus, invitation…) : un échec d'envoi
 * n'empêche jamais l'action, il est seulement signalé. */
export async function notify(to: string, content: EmailContent): Promise<boolean> {
  if (!emailConfigured()) return false;
  return (await sendEmail({ to, ...content })).ok;
}
