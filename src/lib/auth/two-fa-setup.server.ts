import { codeDeliveryAvailable, deliverCode, emailStatus } from "@/lib/notify/notify.server";
import { twoFaSetupEmail } from "@/lib/notify/templates";
import { generateSixDigitCode, safeEqual } from "./helpers";
import { authSession } from "./session.server";
import type { AccountRecord } from "./store.server";

// Activation de la double authentification : un code envoyé à l'adresse du
// compte prouve que l'email arrive. Partagé par Paramètres → Sécurité et
// l'assistant de configuration.

export type SecurityResult = { ok: true } | { ok: false; message: string };

const TWO_FA_SETUP_TTL_MS = 10 * 60_000;
const TWO_FA_SETUP_COOLDOWN_MS = 30_000;
const TWO_FA_SETUP_MAX_ATTEMPTS = 5;

export type SendCodeResult =
  | { ok: true; sentTo: string; devCode?: string }
  | { ok: false; message: string; waitSeconds?: number };

/** Envoie à l'adresse du compte un code qui prouve que l'email arrive. */
export async function sendTwoFaSetupCode(account: AccountRecord): Promise<SendCodeResult> {
  if (!codeDeliveryAvailable()) {
    return {
      ok: false,
      message:
        "La double authentification sera activable quand l'envoi des emails sera configuré (RESEND_API_KEY et EMAIL_FROM).",
    };
  }
  const session = await authSession();
  const previous = session.data.pendingTwoFaSetup;
  const now = Date.now();
  if (previous?.userId === account.id && now < previous.sentAt + TWO_FA_SETUP_COOLDOWN_MS) {
    const wait = Math.ceil((previous.sentAt + TWO_FA_SETUP_COOLDOWN_MS - now) / 1000);
    return { ok: false, waitSeconds: wait, message: `Patientez ${wait} s avant un nouvel envoi.` };
  }
  const code = generateSixDigitCode();
  await session.update({
    pendingTwoFaSetup: {
      userId: account.id,
      code,
      expiresAt: now + TWO_FA_SETUP_TTL_MS,
      sentAt: now,
      attempts: 0,
    },
  });
  const sent = await deliverCode(
    account.email,
    twoFaSetupEmail({ name: account.firstName, code }),
    code,
  );
  if (!sent.ok) {
    await session.update({ pendingTwoFaSetup: undefined });
    return {
      ok: false,
      message:
        emailStatus() === "test_sender"
          ? `L'email n'a pas pu partir vers ${account.email}. Avec l'adresse d'expédition de test de Resend, seuls les emails vers l'adresse de votre compte Resend partent : la double authentification attendra votre domaine.`
          : sent.message,
    };
  }
  return { ok: true, sentTo: account.email, ...(sent.devCode ? { devCode: sent.devCode } : {}) };
}

export async function checkTwoFaSetupCode(userId: string, code: string): Promise<SecurityResult> {
  const session = await authSession();
  const pending = session.data.pendingTwoFaSetup;
  if (!pending || pending.userId !== userId) {
    return { ok: false, message: "Envoyez-vous d'abord un code de vérification." };
  }
  if (Date.now() > pending.expiresAt || pending.attempts >= TWO_FA_SETUP_MAX_ATTEMPTS) {
    await session.update({ pendingTwoFaSetup: undefined });
    return { ok: false, message: "Code expiré ou trop d'essais : envoyez-vous un nouveau code." };
  }
  if (!safeEqual(code.trim(), pending.code)) {
    const attempts = pending.attempts + 1;
    const left = TWO_FA_SETUP_MAX_ATTEMPTS - attempts;
    if (left <= 0) {
      await session.update({ pendingTwoFaSetup: undefined });
      return { ok: false, message: "Trop d'essais : envoyez-vous un nouveau code." };
    }
    await session.update({ pendingTwoFaSetup: { ...pending, attempts } });
    return {
      ok: false,
      message: `Code incorrect. ${left} essai${left > 1 ? "s" : ""} restant${left > 1 ? "s" : ""}.`,
    };
  }
  await session.update({ pendingTwoFaSetup: undefined });
  return { ok: true };
}
