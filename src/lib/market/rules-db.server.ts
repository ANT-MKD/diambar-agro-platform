import { eq } from "drizzle-orm";
import { settings } from "@/db/schema";
import {
  DEFAULT_RULES,
  normalizeDeliveryHours,
  normalizeDriverPay,
  type DeliveryHours,
  type DriverPay,
} from "@/lib/platform-rules";
import type { Q } from "./market-common.server";

// Lecture d'un réglage isolé de la plateforme (dans ou hors transaction).

async function settingValue(q: Q, key: string): Promise<unknown> {
  const [row] = await q
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key));
  return row?.value;
}

export async function readDriverPay(q: Q): Promise<DriverPay> {
  return normalizeDriverPay(await settingValue(q, "driver_pay"));
}

export async function readDeliveryHours(q: Q): Promise<DeliveryHours> {
  return normalizeDeliveryHours(await settingValue(q, "delivery_hours"));
}

export async function readMinPayout(q: Q): Promise<number> {
  const v = await settingValue(q, "min_payout");
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : DEFAULT_RULES.minPayout;
}
