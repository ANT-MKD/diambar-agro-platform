import { createServerFn } from "@tanstack/react-start";
import { isDemoMode } from "./config.server";
import { requireStaff } from "./guard.server";
import { withAccountStore } from "./store.server";
import type { AccountRecord, Application, ApplicationDecision, StaffRole } from "./store.server";

export type { Application, ApplicationDecision };

// Dossiers d'inscription (comptes en attente de validation), lus et décidés
// côté serveur. Les droits sont vérifiés ici : voir les dossiers = toute
// l'équipe ; décider = super administrateur ou opérations.

const DECIDERS: StaffRole[] = ["super_admin", "operations"];

function canDecide(account: AccountRecord): boolean {
  return !!account.staffRole && DECIDERS.includes(account.staffRole);
}

export type ApplicationsPage = {
  demoMode: boolean;
  canDecide: boolean;
  applications: Application[];
};

export const listApplicationsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<ApplicationsPage> =>
    withAccountStore(async (store) => {
      const me = await requireStaff(store);
      return {
        demoMode: isDemoMode(),
        canDecide: canDecide(me),
        applications: await store.listApplications(),
      };
    }),
);

/** Pour le menu de l'administration : dossiers réels en attente. */
export const applicationsSummaryFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ pending: number; demoMode: boolean }> =>
    withAccountStore(async (store) => {
      await requireStaff(store);
      const all = await store.listApplications();
      return {
        pending: all.filter((a) => a.status === "pending").length,
        demoMode: isDemoMode(),
      };
    }),
);

export const getApplicationFn = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => {
    if (typeof input.id !== "string" || input.id.length > 64) throw new Error("Dossier inconnu");
    return input;
  })
  .handler(async ({ data }): Promise<{ canDecide: boolean; application: Application | null }> =>
    withAccountStore(async (store) => {
      const me = await requireStaff(store);
      return { canDecide: canDecide(me), application: await store.getApplication(data.id) };
    }),
  );

export type DecideApplicationResult =
  { ok: true; application: Application } | { ok: false; message: string };

export const decideApplicationFn = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; decision: ApplicationDecision; note?: string }) => {
    if (!["approve", "reject", "needs_correction"].includes(input.decision)) {
      throw new Error("Décision inconnue");
    }
    const note = (input.note ?? "").trim();
    if (input.decision !== "approve" && note.length < 5) {
      throw new Error("Expliquez la raison en quelques mots : la personne la lira.");
    }
    if (note.length > 1000) throw new Error("Message trop long (1000 caractères maximum)");
    return { id: String(input.id).slice(0, 64), decision: input.decision, note };
  })
  .handler(async ({ data }): Promise<DecideApplicationResult> =>
    withAccountStore(async (store) => {
      const me = await requireStaff(store, DECIDERS);
      const result = await store.decideApplication({
        id: data.id,
        decision: data.decision,
        note: data.note,
        actorId: me.id,
      });
      if (!result.ok) {
        return {
          ok: false,
          message:
            result.reason === "not_found"
              ? "Ce dossier n'existe plus."
              : "Ce dossier a déjà été traité par un autre membre de l'équipe.",
        };
      }
      return { ok: true, application: result.application };
    }),
  );
