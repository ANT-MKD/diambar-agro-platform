import { createServerFn } from "@tanstack/react-start";
import { inArray } from "drizzle-orm";
import { createDb } from "@/db/client.server";
import { settings } from "@/db/schema";
import { readDeliveryPricing } from "@/lib/market/delivery-db.server";
import { readCommissionTiers } from "@/lib/market/ledger-db.server";
import { readDriverPay } from "@/lib/market/rules-db.server";
import type { CompanyInfo, PaymentMethodsSetting } from "@/lib/platform/setup-model";
import { DEFAULT_PUBLIC_INFO, type PublicInfo } from "./public-info-model";

// Informations du site public, lues sans session. Sans base (aperçu) ou si la
// base ne répond pas, le site s'affiche avec les valeurs par défaut et sans
// coordonnées plutôt que de tomber en erreur.

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);

export const getPublicInfoFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicInfo> => {
    const url = process.env.DATABASE_URL?.trim();
    if (!url) return DEFAULT_PUBLIC_INFO;
    const { db, close } = createDb(url);
    try {
      const rows = await db
        .select()
        .from(settings)
        .where(
          inArray(settings.key, [
            "company",
            "cutoff_hour",
            "reception_window_hours",
            "payment_deadline_hour",
            "min_payout",
            "payment_methods",
            "pilot_city",
          ]),
        );
      const v = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, unknown>;
      const c = (v.company ?? {}) as Partial<CompanyInfo>;
      const pm = v.payment_methods as Partial<PaymentMethodsSetting> | undefined;
      const d = DEFAULT_PUBLIC_INFO;
      const [tiers, driverPay, pricing] = await Promise.all([
        readCommissionTiers(db),
        readDriverPay(db),
        readDeliveryPricing(db),
      ]);
      return {
        company: {
          name: text(c.tradeName) || text(c.legalName) || DEFAULT_PUBLIC_INFO.company.name,
          email: text(c.email),
          phone: text(c.phone),
          whatsapp: text(c.whatsapp),
          address: text(c.address),
        },
        tiers: tiers.map(({ rate, min, max }) => ({ rate, min, max })),
        driverShare: 100 - driverPay.commissionRate,
        deliveryFrom: pricing.brackets[0]?.fee ?? 0,
        cutoffHour: num(v.cutoff_hour, d.cutoffHour),
        receptionWindowHours: num(v.reception_window_hours, d.receptionWindowHours),
        paymentDeadlineHour: num(v.payment_deadline_hour, d.paymentDeadlineHour),
        minPayout: num(v.min_payout, d.minPayout),
        // Sans réglage, mêmes moyens que l'écran de commande par défaut.
        payments: pm
          ? {
              wave: !!pm.wave?.enabled,
              orangeMoney: !!pm.orangeMoney?.enabled,
              cash: !!pm.cashOnDelivery?.enabled,
            }
          : d.payments,
        pilotCity: text(v.pilot_city) || d.pilotCity,
      };
    } catch (err) {
      console.error("[site public]", err instanceof Error ? err.message : err);
      return DEFAULT_PUBLIC_INFO;
    } finally {
      await close().catch(() => undefined);
    }
  },
);
