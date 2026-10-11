import { demoAccounts } from "@/data/demo-accounts";
import type { DemoAccount } from "@/data/demo-accounts";
import { platformUsers } from "@/data/admin-mocks";
import type { Role } from "@/data/mocks";
import type { RegisterDetails } from "./session.server";
import { normalizeEmail, normalizeSenegalPhone } from "./helpers";

// --- Annuaire des comptes (mémoire du serveur) ------------------------------
// Sans base de données, ces structures permettent au parcours de rester réel
// d'un bout à l'autre (inscription -> connexion, mot de passe oublié ->
// nouveau mot de passe). Elles ne survivent pas à un redémarrage du serveur
// et ne sont pas partagées entre instances : la vraie persistance arrive à
// l'étape 1 (base de données). Ce module n'est importé que par du code
// serveur : les mots de passe de démonstration ne partent jamais au navigateur.

export type CurrentUser = {
  email: string;
  role: Role;
  name: string;
  avatar: string;
};

export type AccountStatus = "active" | "pending" | "suspended" | "rejected";

const runtimeAccounts: DemoAccount[] = [];
const passwordOverrides = new Map<string, string>();
const accountDetails = new Map<string, RegisterDetails & { acceptedTermsAt: string }>();

function allAccounts(): DemoAccount[] {
  return [...demoAccounts, ...runtimeAccounts];
}

export function findAccount(email: string): DemoAccount | undefined {
  const key = normalizeEmail(email);
  return allAccounts().find((a) => normalizeEmail(a.email) === key);
}

export function findDemoAccount(email: string): DemoAccount | undefined {
  const key = normalizeEmail(email);
  return demoAccounts.find((a) => normalizeEmail(a.email) === key);
}

export function checkPassword(account: DemoAccount, password: string): boolean {
  return (passwordOverrides.get(account.email) ?? account.password) === password;
}

export function setPassword(email: string, password: string) {
  const account = findAccount(email);
  if (account) passwordOverrides.set(account.email, password);
}

export function toCurrentUser(account: DemoAccount): CurrentUser {
  return { email: account.email, role: account.role, name: account.name, avatar: account.avatar };
}

/** Statut réel du compte, lu dans l'annuaire PlatformUser (admin-mocks.ts).
 * Un compte absent de l'annuaire (comptes de démo historiques, compte inscrit
 * dans cette session) est considéré actif : la validation des nouveaux
 * dossiers par l'administration arrive avec la base de données (étape 1). */
export function accountStatus(email: string): AccountStatus {
  const key = normalizeEmail(email);
  const record = platformUsers.find((u) => normalizeEmail(u.email) === key);
  return record?.status ?? "active";
}

export function emailTaken(email: string): boolean {
  const key = normalizeEmail(email);
  return !!findAccount(email) || platformUsers.some((u) => normalizeEmail(u.email) === key);
}

export function phoneTaken(phone: string): boolean {
  const wanted = normalizeSenegalPhone(phone);
  if (!wanted) return false;
  return platformUsers.some((u) => normalizeSenegalPhone(u.phone) === wanted);
}

export function createAccount(input: {
  role: Role;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  details?: RegisterDetails;
  acceptedTermsAt: string;
}): DemoAccount {
  const account: DemoAccount = {
    role: input.role,
    email: normalizeEmail(input.email),
    password: input.password,
    name: `${input.firstName} ${input.lastName}`,
    avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(input.firstName)}`,
    emoji: input.role === "farmer" ? "🌾" : input.role === "restaurant" ? "🍽️" : "🚚",
    tone: "from-primary/20 to-primary/0 border-primary/40 text-primary",
  };
  runtimeAccounts.push(account);
  accountDetails.set(account.email, {
    ...(input.details ?? {}),
    acceptedTermsAt: input.acceptedTermsAt,
  });
  return account;
}

/** Ce que la page de connexion peut afficher d'un compte de démonstration —
 * jamais le mot de passe. */
export type PublicDemoAccount = Pick<
  DemoAccount,
  "email" | "role" | "name" | "emoji" | "tone" | "label" | "kind"
>;

export function publicDemoAccounts(): PublicDemoAccount[] {
  return demoAccounts.map(({ email, role, name, emoji, tone, label, kind }) => ({
    email,
    role,
    name,
    emoji,
    tone,
    label,
    kind,
  }));
}
