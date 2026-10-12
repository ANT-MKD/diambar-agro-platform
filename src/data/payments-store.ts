import { useSyncExternalStore } from "react";
import type {
  AdminPayment,
  AdminPayout,
  AdminRefund,
  MerchantNumbers,
} from "@/lib/market/payment-view";
import type { AdminAccount } from "@/lib/market/types";
import type { InvoiceView } from "@/lib/market/documents-view";
import { createStore } from "./persist";

// Paiements du pilote venus du serveur (mode base de données) : numéros
// marchands où le restaurant paie, et liste des paiements pour l'admin.
// Sans base, ces magasins restent vides et les écrans ne montrent rien.

export const merchantStore = createStore<MerchantNumbers | null>(null);
export const adminPaymentsStore = createStore<AdminPayment[]>([]);
/** Admin : ce que Diambar doit à chaque producteur et livreur. */
export const adminAccountsStore = createStore<AdminAccount[]>([]);
export const adminPayoutsStore = createStore<AdminPayout[]>([]);
export const adminRefundsStore = createStore<AdminRefund[]>([]);
/** Restaurant (et admin) : factures émises en base. */
export const invoicesStore = createStore<InvoiceView[]>([]);

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

export function useAdminAccounts(): AdminAccount[] {
  return useSyncExternalStore(
    adminAccountsStore.subscribe,
    adminAccountsStore.get,
    adminAccountsStore.get,
  );
}

export function useAdminPayouts(): AdminPayout[] {
  return useSyncExternalStore(
    adminPayoutsStore.subscribe,
    adminPayoutsStore.get,
    adminPayoutsStore.get,
  );
}

export function useAdminRefunds(): AdminRefund[] {
  return useSyncExternalStore(
    adminRefundsStore.subscribe,
    adminRefundsStore.get,
    adminRefundsStore.get,
  );
}

export function useInvoices(): InvoiceView[] {
  return useSyncExternalStore(invoicesStore.subscribe, invoicesStore.get, invoicesStore.get);
}
