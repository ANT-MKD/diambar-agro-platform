// Paramètres courants de la plateforme (après l'installation), partagés par
// le serveur et les écrans : blocage après échecs de connexion et mode
// maintenance. Les valeurs vivent dans la table settings.

export type LoginSecurity = { maxAttempts: number; lockoutMinutes: number };
export type Maintenance = { active: boolean; message: string };

export const DEFAULT_LOGIN_SECURITY: LoginSecurity = { maxAttempts: 5, lockoutMinutes: 15 };
export const DEFAULT_MAINTENANCE_MESSAGE =
  "Diambar Agro est en maintenance. Nous revenons très vite.";

const int = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : fallback;

export function readLoginSecurity(value: unknown): LoginSecurity {
  const v = (value ?? {}) as Partial<LoginSecurity>;
  return {
    maxAttempts: int(v.maxAttempts, 1, 20, DEFAULT_LOGIN_SECURITY.maxAttempts),
    lockoutMinutes: int(v.lockoutMinutes, 1, 1440, DEFAULT_LOGIN_SECURITY.lockoutMinutes),
  };
}

export function readMaintenance(value: unknown): Maintenance {
  const v = (value ?? {}) as Partial<Maintenance>;
  return {
    active: v.active === true,
    message:
      typeof v.message === "string" && v.message.trim()
        ? v.message.trim()
        : DEFAULT_MAINTENANCE_MESSAGE,
  };
}
