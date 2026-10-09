import { createSignedToken, verifySignedToken } from "@/lib/auth/tokens.server";
import type { AccessRole } from "./requests.server";

// Invitation à s'inscrire, envoyée par l'administration après une demande
// d'accès acceptée. Lien signé, valable 7 jours, utilisable une seule fois.

export const INVITE_TTL_MS = 7 * 24 * 60 * 60_000;

export type InvitePayload = {
  kind: "invite";
  requestId: string;
  role: AccessRole;
  fullName: string;
  phone: string;
  jti: string;
};

const usedInvites = new Set<string>();

export async function createInviteToken(p: Omit<InvitePayload, "kind" | "jti">): Promise<string> {
  const buf = new Uint8Array(12);
  crypto.getRandomValues(buf);
  const jti = Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
  return createSignedToken<InvitePayload>({ ...p, kind: "invite", jti }, INVITE_TTL_MS);
}

export type InviteState =
  | { valid: true; payload: InvitePayload }
  | { valid: false; reason: "missing" | "expired" | "used" };

export async function readInvite(token: string | undefined): Promise<InviteState> {
  if (!token) return { valid: false, reason: "missing" };
  const payload = await verifySignedToken<InvitePayload>(token);
  if (!payload || payload.kind !== "invite") return { valid: false, reason: "expired" };
  if (usedInvites.has(payload.jti)) return { valid: false, reason: "used" };
  return { valid: true, payload };
}

/** Marque l'invitation comme utilisée. Retourne false si elle l'était déjà. */
export function consumeInvite(jti: string): boolean {
  if (usedInvites.has(jti)) return false;
  usedInvites.add(jti);
  return true;
}
