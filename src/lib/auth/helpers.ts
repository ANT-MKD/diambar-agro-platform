// Petites règles partagées par les écrans de connexion et les fonctions
// serveur. Pures (sans état ni accès réseau) pour pouvoir être testées.

/** Un email se compare sans tenir compte des majuscules ni des espaces. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Numéro sénégalais ramené à ses 9 chiffres (ex. « 771234567 »), quelle que
 * soit la saisie : « 77 123 45 67 », « +221 77 123 45 67 », « 00221771234567 ».
 * Retourne null si le numéro n'a pas la bonne longueur.
 */
export function normalizeSenegalPhone(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00221")) digits = digits.slice(5);
  else if (digits.startsWith("221") && digits.length === 12) digits = digits.slice(3);
  return /^\d{9}$/.test(digits) ? digits : null;
}

/** « 771234567 » → « 77 123 45 67 ». */
export function formatSenegalPhone(nineDigits: string): string {
  const d = nineDigits;
  return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`;
}

/** Code à 6 chiffres tiré avec le générateur cryptographique (pas Math.random). */
export function generateSixDigitCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(100000 + (buf[0] % 900000));
}

/** Comparaison en temps constant, pour ne pas laisser deviner un code chiffre par chiffre. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Compte les échecs par clé (email, identifiant de code…) sur une fenêtre
 * glissante. Utilisé côté serveur ; l'état vit en mémoire de l'instance, ce
 * qui freine un essai en rafale mais ne remplace pas un compteur partagé
 * (base de données), prévu à l'étape 1.
 */
export class AttemptLimiter {
  private readonly failures = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  private recent(key: string, now: number): number[] {
    const list = (this.failures.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (list.length) this.failures.set(key, list);
    else this.failures.delete(key);
    return list;
  }

  /** Minutes restantes avant de pouvoir réessayer, 0 si l'accès est libre. */
  lockedMinutes(key: string, now = Date.now()): number {
    const list = this.recent(key, now);
    if (list.length < this.max) return 0;
    const oldestCounted = list[list.length - this.max];
    return Math.max(1, Math.ceil((this.windowMs - (now - oldestCounted)) / 60_000));
  }

  /** Nombre d'essais encore permis avant blocage. */
  remaining(key: string, now = Date.now()): number {
    return Math.max(0, this.max - this.recent(key, now).length);
  }

  fail(key: string, now = Date.now()) {
    const list = this.recent(key, now);
    list.push(now);
    this.failures.set(key, list);
  }

  reset(key: string) {
    this.failures.delete(key);
  }
}

type RegisterDetailsInput = {
  farmName?: string;
  location?: string;
  restaurantName?: string;
  address?: string;
  professionalPhone?: string;
  vehicleType?: string;
  licenseNumber?: string;
  zones?: string[];
};

/** Contrôle minimal des informations métier (étape 3 de l'inscription),
 * appliqué à l'écran puis revérifié par le serveur. */
export function registerDetailsProblem(
  role: "farmer" | "restaurant" | "driver",
  d: RegisterDetailsInput,
): string | null {
  const filled = (v?: string, min = 2) => (v ?? "").trim().length >= min;
  if (role === "farmer") {
    if (!filled(d.farmName)) return "Indiquez le nom de votre exploitation";
    if (!filled(d.location)) return "Indiquez la localisation de votre exploitation";
  }
  if (role === "restaurant") {
    if (!filled(d.restaurantName)) return "Indiquez le nom de votre établissement";
    if (!filled(d.address, 5)) return "Indiquez l'adresse complète de livraison";
    if (d.professionalPhone && normalizeSenegalPhone(d.professionalPhone) === null) {
      return "Le téléphone professionnel doit compter 9 chiffres";
    }
  }
  if (role === "driver") {
    const vehicle = d.vehicleType ?? "Moto";
    if (vehicle !== "Vélo" && !filled(d.licenseNumber, 4)) return "Indiquez votre numéro de permis";
    if (!d.zones?.length) return "Choisissez au moins une zone de livraison";
  }
  return null;
}
