import { normalizeSenegalPhone } from "@/lib/auth/helpers";

// Demandes d'accès au pilote (« accès sur demande »).
// Conservées en mémoire du serveur tant que la base de données n'existe pas
// (étape 1) : elles disparaissent au redémarrage et ne sont pas partagées
// entre instances. Seuls des administrateurs connectés peuvent les lire.

export type AccessRole = "restaurant" | "farmer" | "driver";
export type AccessStatus = "new" | "contacted" | "invited" | "registered" | "declined";

export type AccessRequest = {
  id: string;
  createdAt: string;
  role: AccessRole;
  fullName: string;
  /** 9 chiffres, sans indicatif. */
  phone: string;
  organization?: string;
  city: string;
  area?: string;
  message?: string;
  status: AccessStatus;
  invitedAt?: string;
  registeredAt?: string;
  history: { at: string; by: string; label: string }[];
};

const requests: AccessRequest[] = [];

function newId(): string {
  const buf = new Uint8Array(6);
  crypto.getRandomValues(buf);
  return "acc_" + Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function addRequest(
  input: Omit<AccessRequest, "id" | "createdAt" | "status" | "history" | "phone"> & {
    phone: string;
  },
): AccessRequest {
  const now = new Date().toISOString();
  const request: AccessRequest = {
    ...input,
    phone: normalizeSenegalPhone(input.phone) ?? input.phone,
    id: newId(),
    createdAt: now,
    status: "new",
    history: [{ at: now, by: input.fullName, label: "Demande envoyée depuis le site" }],
  };
  requests.unshift(request);
  return request;
}

/** Une demande encore ouverte existe-t-elle déjà pour ce numéro ? */
export function openRequestForPhone(phone: string): AccessRequest | undefined {
  const wanted = normalizeSenegalPhone(phone);
  return requests.find(
    (r) => r.phone === wanted && (r.status === "new" || r.status === "contacted"),
  );
}

export function listRequests(): AccessRequest[] {
  return [...requests];
}

export function getRequest(id: string): AccessRequest | undefined {
  return requests.find((r) => r.id === id);
}

export function updateRequest(
  id: string,
  patch: Partial<Pick<AccessRequest, "status" | "invitedAt" | "registeredAt">>,
  by: string,
  label: string,
): AccessRequest | undefined {
  const r = getRequest(id);
  if (!r) return undefined;
  Object.assign(r, patch);
  r.history.push({ at: new Date().toISOString(), by, label });
  return r;
}
