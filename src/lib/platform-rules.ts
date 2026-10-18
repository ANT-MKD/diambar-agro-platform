// Règles de la plateforme réglées par l'admin, avec leurs valeurs par défaut :
// lues par le serveur (qui fait foi) et envoyées aux écrans, pour que tout
// affiche la même chose que ce que le serveur applique.

/** Rémunération des livreurs et choix du véhicule (page Tarifs de livraison). */
export type DriverPay = {
  /** Prise en charge fixe de chaque course (F CFA). */
  base: number;
  perKm: number;
  /** Par kg au-delà de `freeKg`. */
  perKgOver: number;
  freeKg: number;
  /** Course payée au moins ce montant. */
  minimum: number;
  /** Commission de Diambar sur la course (%). */
  commissionRate: number;
  /** Jusqu'à ce poids : moto ; jusqu'à `vanMaxKg` : camionnette ; au-delà : camion. */
  motoMaxKg: number;
  vanMaxKg: number;
};

export const DEFAULT_DRIVER_PAY: DriverPay = {
  base: 1000,
  perKm: 120,
  perKgOver: 10,
  freeKg: 20,
  minimum: 1500,
  commissionRate: 20,
  motoMaxKg: 30,
  vanMaxKg: 80,
};

const num = (v: unknown, d: number, min = 0, max = 10_000_000) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;

export function normalizeDriverPay(v: unknown): DriverPay {
  const o = (v && typeof v === "object" ? v : {}) as Partial<Record<keyof DriverPay, unknown>>;
  const d = DEFAULT_DRIVER_PAY;
  const motoMaxKg = num(o.motoMaxKg, d.motoMaxKg, 1, 5000);
  return {
    base: Math.round(num(o.base, d.base, 0, 100_000)),
    perKm: Math.round(num(o.perKm, d.perKm, 0, 10_000)),
    perKgOver: Math.round(num(o.perKgOver, d.perKgOver, 0, 10_000)),
    freeKg: num(o.freeKg, d.freeKg, 0, 10_000),
    minimum: Math.round(num(o.minimum, d.minimum, 0, 100_000)),
    commissionRate: num(o.commissionRate, d.commissionRate, 0, 90),
    motoMaxKg,
    vanMaxKg: Math.max(motoMaxKg, num(o.vanMaxKg, d.vanMaxKg, 1, 50_000)),
  };
}

/** Heures de livraison possibles (« 06:00 » à « 20:00 »), heure de Dakar. */
export type DeliveryHours = { from: string; to: string };

export const DEFAULT_DELIVERY_HOURS: DeliveryHours = { from: "06:00", to: "20:00" };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function normalizeDeliveryHours(v: unknown): DeliveryHours {
  const o = (v && typeof v === "object" ? v : {}) as { from?: unknown; to?: unknown };
  const from =
    typeof o.from === "string" && HHMM.test(o.from) ? o.from : DEFAULT_DELIVERY_HOURS.from;
  const to = typeof o.to === "string" && HHMM.test(o.to) ? o.to : DEFAULT_DELIVERY_HOURS.to;
  return minutesOf(to) > minutesOf(from) ? { from, to } : DEFAULT_DELIVERY_HOURS;
}

/** « 09:30 » → 570. */
export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Règles connues des écrans (mode serveur : celles de la base). */
export type PlatformRules = {
  cutoffHour: number;
  minOrderPerProducer: number;
  receptionWindowHours: number;
  paymentDeadlineHour: number;
  /** Plus petit retrait possible (producteurs et livreurs). */
  minPayout: number;
  deliveryHours: DeliveryHours;
  driverPay: DriverPay;
};

export const DEFAULT_RULES: PlatformRules = {
  cutoffHour: 18,
  minOrderPerProducer: 5000,
  receptionWindowHours: 48,
  paymentDeadlineHour: 20,
  minPayout: 1000,
  deliveryHours: DEFAULT_DELIVERY_HOURS,
  driverPay: DEFAULT_DRIVER_PAY,
};
