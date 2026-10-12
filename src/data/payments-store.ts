import { useSyncExternalStore } from "react";
import type { AdminPayment, MerchantNumbers } from "@/lib/market/payment-view";
import { createStore } from "./persist";

// Paiements du pilote venus du serveur (mode base de données) : numéros
// marchands où le restaurant paie, et liste des paiements pour l'admin.
// Sans base, ces magasins restent vides et les écrans ne montrent rien.

export const merchantStore = createStore<MerchantNumbers | null>(null);
export const adminPaymentsStore = createStore<AdminPayment[]>([]);

export function useMerchantNumbers(): MerchantNumbers | null {
  return useSyncExternalStore(merchantStore.subscribe, merchantStore.get, merchantStore.get);
}

export function useAdminPayments(): AdminPayment[] {
  return useSyncExternalStore(
    adminPaymentsStore.subscribe,
    adminPaymentsStore.get,
    adminPaymentsStore.get,
  );
}
