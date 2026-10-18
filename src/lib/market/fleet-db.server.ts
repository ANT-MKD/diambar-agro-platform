import { and, desc, eq, inArray, ne } from "drizzle-orm";
import type { Db } from "@/db/client.server";
import {
  docRenewalFiles,
  docRenewals,
  documents,
  drivers,
  files,
  maintenanceEntries,
  vehicleChangeFiles,
  vehicleChangeRequests,
  vehicleIssuePhotos,
  vehicleIssues,
  vehicles,
} from "@/db/schema";
import type {
  DriverVehicle,
  DriverWorkCriteria,
  MaintenanceEntry,
  MissionProofPhoto,
  VehicleChangeReason,
  VehicleChangeRequest,
  VehicleIssue,
  VehicleIssueSeverity,
  VehicleIssueType,
  WorkingHours,
} from "@/data/mocks";
import type { StoredFile } from "./disputes-db.server";
import type { ChangeRequestView, DocRenewalView, DriverFleetView, WorkPrefs } from "./fleet-view";
import { photoUrl } from "./disputes-read.server";
import {
  audit,
  fail,
  nextNumber,
  notifyOpsStaff,
  notifyUser,
  requireStaffRole,
  staffRoleOf,
  type Q,
  type Tx,
} from "./market-common.server";
import { loadPeople } from "./people.server";

// Flotte des livreurs en base : fiche du véhicule, problèmes mécaniques,
// entretiens, demande de changement de véhicule et renouvellement des
// documents (validés par l'équipe avant de compter). Aussi le statut en ligne,
// les préférences de travail et le partage de position.

type Me = { id: string; role: "restaurant" | "farmer" | "driver" | "admin" };

/** Équipe qui valide documents et véhicules. */
export const FLEET_STAFF = ["super_admin", "operations"] as const;

type DbVehicleType = (typeof vehicles.$inferSelect)["type"];
const TYPE_TO_DB: Record<DriverVehicle["type"], DbVehicleType> = {
  Moto: "moto",
  Tricycle: "tricycle",
  Camionnette: "camionnette",
  Camion: "camion",
};
const TYPE_FROM_DB: Record<DbVehicleType, DriverVehicle["type"]> = {
  // Pas de vélo dans les fiches véhicule : le deux-roues le plus proche.
  velo: "Moto",
  moto: "Moto",
  tricycle: "Tricycle",
  camionnette: "Camionnette",
  camion: "Camion",
};

type Condition = DriverVehicle["condition"];
const GOOD: Condition = {
  tires: "good",
  brakes: "good",
  battery: "good",
  oil: "good",
  lights: "good",
  body: "good",
};
/** Point du véhicule « à vérifier » tant qu'un problème de ce type est ouvert. */
const ISSUE_TO_CONDITION: Partial<Record<VehicleIssueType, keyof Condition>> = {
  tires: "tires",
  brakes: "brakes",
  battery: "battery",
  engine: "oil",
  lights: "lights",
};

async function storeFiles(tx: Tx, ownerId: string, list: StoredFile[]) {
  const out: { fileId: string; name: string }[] = [];
  for (const f of list) {
    const [file] = await tx
      .insert(files)
      .values({ ownerId, storageKey: f.storageKey, mime: f.mime, sizeBytes: f.size })
      .returning({ id: files.id });
    out.push({ fileId: file.id, name: f.name.slice(0, 120) || "photo" });
  }
  return out;
}

/** Véhicule actif du livreur (le plus récent). */
async function myVehicle(q: Q, driverId: string, lock = false) {
  const base = q
    .select()
    .from(vehicles)
    .where(eq(vehicles.driverId, driverId))
    .orderBy(desc(vehicles.createdAt))
    .limit(1);
  const [v] = lock ? await base.for("update") : await base;
  if (!v) fail("Aucun véhicule enregistré : contactez l'équipe Diambar.");
  return v;
}

const asDriver = (me: Me) => {
  if (me.role !== "driver") fail("Réservé aux livreurs.");
};

// --- Fiche du véhicule -------------------------------------------------------------

export type VehiclePatch = {
  brand?: string;
  model?: string;
  year?: number;
  color?: string;
  mileageKm?: number;
  nextMaintenanceAt?: string | null;
};

export async function updateVehicle(db: Db, me: Me, patch: VehiclePatch) {
  asDriver(me);
  return db.transaction(async (tx) => {
    const v = await myVehicle(tx, me.id, true);
    const set: Partial<typeof vehicles.$inferInsert> = {};
    if (patch.brand !== undefined) set.brand = patch.brand.trim().slice(0, 60) || null;
    if (patch.model !== undefined) set.model = patch.model.trim().slice(0, 60) || null;
    if (patch.color !== undefined) set.color = patch.color.trim().slice(0, 40) || null;
    if (patch.year !== undefined) {
      const y = Math.round(patch.year);
      if (y < 1970 || y > new Date().getFullYear() + 1) fail("Année du véhicule invalide.");
      set.year = y;
    }
    if (patch.mileageKm !== undefined) {
      const km = Math.round(patch.mileageKm);
      if (!(km >= v.mileageKm)) fail("Le kilométrage doit être supérieur au précédent.");
      set.mileageKm = km;
    }
    if (patch.nextMaintenanceAt !== undefined) {
      if (patch.nextMaintenanceAt && Number.isNaN(Date.parse(patch.nextMaintenanceAt))) {
        fail("Date d'entretien invalide.");
      }
      set.nextMaintenanceAt = patch.nextMaintenanceAt?.slice(0, 10) || null;
    }
    if (Object.keys(set).length) await tx.update(vehicles).set(set).where(eq(vehicles.id, v.id));
  });
}

/** Nouvelle photo du véhicule ; renvoie l'ancienne clé à supprimer du stockage. */
export async function setVehiclePhoto(db: Db, me: Me, file: StoredFile): Promise<string | null> {
  asDriver(me);
  return db.transaction(async (tx) => {
    const v = await myVehicle(tx, me.id, true);
    const [stored] = await storeFiles(tx, me.id, [file]);
    let old: string | null = null;
    if (v.photoFileId) {
      const [f] = await tx
        .select({ key: files.storageKey })
        .from(files)
        .where(eq(files.id, v.photoFileId));
      old = f?.key ?? null;
    }
    await tx.update(vehicles).set({ photoFileId: stored.fileId }).where(eq(vehicles.id, v.id));
    return old;
  });
}

async function refreshCondition(tx: Tx, vehicleId: string) {
  const open = await tx
    .select({ type: vehicleIssues.type })
    .from(vehicleIssues)
    .where(and(eq(vehicleIssues.vehicleId, vehicleId), ne(vehicleIssues.status, "resolved")));
  const [v] = await tx
    .select({ condition: vehicles.condition })
    .from(vehicles)
    .where(eq(vehicles.id, vehicleId));
  const condition: Condition = {
    ...GOOD,
    body: (v?.condition as Condition | null)?.body ?? "good",
  };
  for (const i of open) {
    const key = ISSUE_TO_CONDITION[i.type];
    if (key) condition[key] = "check";
  }
  await tx.update(vehicles).set({ condition }).where(eq(vehicles.id, vehicleId));
}

export async function reportVehicleIssue(
  db: Db,
  me: Me,
  input: { type: VehicleIssueType; severity: VehicleIssueSeverity; description: string },
  photos: StoredFile[] = [],
): Promise<{ id: string; reference: string }> {
  asDriver(me);
  const description = input.description.trim();
  if (description.length < 5) fail("Décrivez le problème.");
  return db.transaction(async (tx) => {
    const v = await myVehicle(tx, me.id);
    const reference = `VH-${String(await nextNumber(tx, "vehicle_issue_reference_seq")).padStart(4, "0")}`;
    const [issue] = await tx
      .insert(vehicleIssues)
      .values({
        reference,
        vehicleId: v.id,
        driverId: me.id,
        type: input.type,
        severity: input.severity,
        description: description.slice(0, 2000),
      })
      .returning({ id: vehicleIssues.id });
    for (const f of await storeFiles(tx, me.id, photos)) {
      await tx.insert(vehicleIssuePhotos).values({ issueId: issue.id, ...f });
    }
    await refreshCondition(tx, v.id);
    if (input.severity === "high") {
      await notifyOpsStaff(tx, {
        type: "system",
        title: "Problème véhicule grave",
        body: `${reference} : ${description.slice(0, 100)}`,
        link: "/admin/operations",
      });
    }
    return { id: issue.id, reference };
  });
}

export async function resolveVehicleIssue(db: Db, me: Me, id: string) {
  return db.transaction(async (tx) => {
    const [i] = await tx.select().from(vehicleIssues).where(eq(vehicleIssues.id, id));
    if (!i) fail("Problème introuvable.");
    if (me.role === "admin") {
      await requireStaffRole(tx, me.id, FLEET_STAFF);
    } else if (i.driverId !== me.id) {
      fail("Problème introuvable.");
    }
    if (i.status === "resolved") return;
    await tx
      .update(vehicleIssues)
      .set({ status: "resolved", resolvedAt: new Date() })
      .where(eq(vehicleIssues.id, id));
    await refreshCondition(tx, i.vehicleId);
  });
}

export async function logMaintenance(db: Db, me: Me, label: string) {
  asDriver(me);
  const text = label.trim().slice(0, 200);
  if (text.length < 2) fail("Décrivez l'entretien réalisé.");
  return db.transaction(async (tx) => {
    const v = await myVehicle(tx, me.id, true);
    await tx
      .insert(maintenanceEntries)
      .values({ vehicleId: v.id, label: text, mileageKm: v.mileageKm });
    // L'entretien prévu est fait : la date programmée est levée.
    await tx.update(vehicles).set({ nextMaintenanceAt: null }).where(eq(vehicles.id, v.id));
  });
}

// --- Changement de véhicule ----------------------------------------------------------

export type NewVehicleInput = VehicleChangeRequest["newVehicle"];

export async function requestVehicleChange(
  db: Db,
  me: Me,
  input: { reason: VehicleChangeReason; newVehicle: NewVehicleInput },
  docs: StoredFile[] = [],
): Promise<{ id: string; reference: string }> {
  asDriver(me);
  const nv = input.newVehicle;
  if (!TYPE_TO_DB[nv.type]) fail("Type de véhicule invalide.");
  if (!nv.plate.trim()) fail("Indiquez l'immatriculation.");
  if (!(nv.capacityKg > 0)) fail("Indiquez la capacité de charge.");
  if (!docs.length) fail("Joignez la carte grise (photo).");
  return db.transaction(async (tx) => {
    const [pending] = await tx
      .select({ reference: vehicleChangeRequests.reference })
      .from(vehicleChangeRequests)
      .where(
        and(eq(vehicleChangeRequests.driverId, me.id), eq(vehicleChangeRequests.status, "pending")),
      );
    if (pending) fail(`Une demande est déjà en cours (${pending.reference}).`);
    const reference = `VCR-${String(await nextNumber(tx, "vehicle_change_reference_seq")).padStart(4, "0")}`;
    const [r] = await tx
      .insert(vehicleChangeRequests)
      .values({
        reference,
        driverId: me.id,
        reason: input.reason,
        newVehicle: {
          type: nv.type,
          brand: nv.brand.trim().slice(0, 60),
          model: nv.model.trim().slice(0, 60),
          year: Math.round(nv.year) || null,
          plate: nv.plate.trim().toUpperCase().slice(0, 20),
          capacityKg: Math.round(nv.capacityKg),
          mileageKm: Math.max(0, Math.round(nv.mileageKm || 0)),
        },
      })
      .returning({ id: vehicleChangeRequests.id });
    for (const f of await storeFiles(tx, me.id, docs)) {
      await tx.insert(vehicleChangeFiles).values({ requestId: r.id, ...f });
    }
    await notifyOpsStaff(tx, {
      type: "system",
      title: "Changement de véhicule à valider",
      body: `${reference} : ${nv.type} ${nv.plate.trim().toUpperCase()}`,
      link: "/admin/documents",
    });
    return { id: r.id, reference };
  });
}

/** Équipe : valide (le nouveau véhicule remplace l'ancien) ou refuse. */
export async function decideVehicleChange(
  db: Db,
  me: Me,
  id: string,
  input: { approve: boolean; note?: string },
) {
  const note = input.note?.trim().slice(0, 300) ?? "";
  if (!input.approve && note.length < 5) fail("Indiquez le motif du refus.");
  return db.transaction(async (tx) => {
    await requireStaffRole(tx, me.id, FLEET_STAFF);
    const [r] = await tx
      .select()
      .from(vehicleChangeRequests)
      .where(eq(vehicleChangeRequests.id, id))
      .for("update");
    if (!r) fail("Demande introuvable.");
    if (r.status !== "pending") fail("Cette demande a déjà été traitée.");
    const nv = r.newVehicle as NewVehicleInput;
    if (input.approve) {
      const [old] = await tx
        .select()
        .from(vehicles)
        .where(eq(vehicles.driverId, r.driverId))
        .orderBy(desc(vehicles.createdAt))
        .limit(1);
      // L'ancien véhicule ne prend plus de course ; ses échéances ne
      // passent pas au nouveau (ses documents seront à envoyer).
      if (old) await tx.update(vehicles).set({ status: "blocked" }).where(eq(vehicles.id, old.id));
      await tx.insert(vehicles).values({
        driverId: r.driverId,
        type: TYPE_TO_DB[nv.type] ?? "moto",
        plate: nv.plate,
        capacityKg: nv.capacityKg,
        brand: nv.brand || null,
        model: nv.model || null,
        year: nv.year || null,
        mileageKm: nv.mileageKm || 0,
        condition: GOOD,
      });
    }
    await tx
      .update(vehicleChangeRequests)
      .set({
        status: input.approve ? "approved" : "rejected",
        note: note || null,
        decidedBy: me.id,
        decidedAt: new Date(),
      })
      .where(eq(vehicleChangeRequests.id, id));
    await notifyUser(tx, r.driverId, {
      type: "system",
      title: input.approve ? "Nouveau véhicule validé" : "Changement de véhicule refusé",
      body: input.approve
        ? `${r.reference} : ${nv.type} ${nv.plate}. Envoyez son assurance et son contrôle technique.`
        : `${r.reference} : ${note}`,
      link: "/driver/vehicle",
    });
    await audit(tx, {
      module: "deliveries",
      actorId: me.id,
      action: input.approve ? "Changement de véhicule validé" : "Changement de véhicule refusé",
      targetType: "user",
      targetId: r.driverId,
      after: { reference: r.reference, note: note || undefined },
    });
  });
}

// --- Documents (assurance, contrôle technique) -----------------------------------------

export async function submitDocRenewal(
  db: Db,
  me: Me,
  input: { doc: "insurance" | "inspection"; newExpiry: string },
  photos: StoredFile[],
) {
  asDriver(me);
  if (!photos.length) fail("Ajoutez la photo du document.");
  const expiry = new Date(input.newExpiry);
  if (Number.isNaN(expiry.getTime()) || expiry.getTime() <= Date.now()) {
    fail("La nouvelle date d'expiration doit être dans le futur.");
  }
  return db.transaction(async (tx) => {
    const v = await myVehicle(tx, me.id);
    // Un nouvel envoi remplace celui qui attendait encore.
    await tx
      .update(docRenewals)
      .set({ status: "rejected", note: "Remplacé par un nouvel envoi", decidedAt: new Date() })
      .where(
        and(
          eq(docRenewals.driverId, me.id),
          eq(docRenewals.doc, input.doc),
          eq(docRenewals.status, "pending"),
        ),
      );
    const [r] = await tx
      .insert(docRenewals)
      .values({
        driverId: me.id,
        vehicleId: v.id,
        doc: input.doc,
        newExpiry: input.newExpiry.slice(0, 10),
      })
      .returning({ id: docRenewals.id });
    for (const f of await storeFiles(tx, me.id, photos)) {
      await tx.insert(docRenewalFiles).values({ renewalId: r.id, ...f });
    }
    await notifyOpsStaff(tx, {
      type: "system",
      title: "Document livreur à vérifier",
      body: `${input.doc === "insurance" ? "Assurance" : "Contrôle technique"} jusqu'au ${expiry.toLocaleDateString("fr-FR")}`,
      link: "/admin/documents",
    });
    return { id: r.id };
  });
}

export async function decideDocRenewal(
  db: Db,
  me: Me,
  id: string,
  input: { approve: boolean; note?: string },
) {
  const note = input.note?.trim().slice(0, 300) ?? "";
  if (!input.approve && note.length < 5) fail("Indiquez le motif du refus.");
  return db.transaction(async (tx) => {
    await requireStaffRole(tx, me.id, FLEET_STAFF);
    const [r] = await tx.select().from(docRenewals).where(eq(docRenewals.id, id)).for("update");
    if (!r) fail("Document introuvable.");
    if (r.status !== "pending") fail("Ce document a déjà été traité.");
    const label = r.doc === "insurance" ? "Assurance" : "Contrôle technique";
    if (input.approve) {
      await tx
        .update(vehicles)
        .set(
          r.doc === "insurance"
            ? { insuranceExpiresAt: r.newExpiry }
            : { inspectionExpiresAt: r.newExpiry },
        )
        .where(eq(vehicles.id, r.vehicleId));
      // Trace au dossier du livreur (pièce validée).
      const [first] = await tx
        .select({ fileId: docRenewalFiles.fileId })
        .from(docRenewalFiles)
        .where(eq(docRenewalFiles.renewalId, r.id))
        .limit(1);
      if (first) {
        await tx.insert(documents).values({
          userId: r.driverId,
          vehicleId: r.vehicleId,
          kind: r.doc === "insurance" ? "assurance" : "visite_technique",
          fileId: first.fileId,
          expiresAt: r.newExpiry,
          status: "ok",
        });
      }
    }
    await tx
      .update(docRenewals)
      .set({
        status: input.approve ? "approved" : "rejected",
        note: note || null,
        decidedBy: me.id,
        decidedAt: new Date(),
      })
      .where(eq(docRenewals.id, id));
    await notifyUser(tx, r.driverId, {
      type: "system",
      title: input.approve ? "Document validé" : "Document refusé",
      body: input.approve
        ? `${label} valable jusqu'au ${new Date(r.newExpiry).toLocaleDateString("fr-FR")}`
        : `${label} : ${note}`,
      link: "/driver/vehicle",
    });
    await audit(tx, {
      module: "deliveries",
      actorId: me.id,
      action: input.approve ? "Document livreur validé" : "Document livreur refusé",
      targetType: "user",
      targetId: r.driverId,
      after: { doc: r.doc, newExpiry: r.newExpiry, note: note || undefined },
    });
  });
}

// --- Disponibilité et préférences --------------------------------------------------

export async function setDriverOnline(db: Db, me: Me, online: boolean) {
  asDriver(me);
  await db.update(drivers).set({ isOnline: online }).where(eq(drivers.userId, me.id));
}

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function updateWorkSettings(
  db: Db,
  me: Me,
  patch: {
    workPrefs?: Partial<WorkPrefs>;
    workingHours?: WorkingHours;
    locationSharing?: boolean;
  },
) {
  asDriver(me);
  const [d] = await db.select().from(drivers).where(eq(drivers.userId, me.id));
  if (!d) fail("Compte livreur introuvable.");
  const set: Partial<typeof drivers.$inferInsert> = { updatedAt: new Date() };
  if (patch.workPrefs) {
    const cur = (d.workPrefs as WorkPrefs | null) ?? null;
    const next = { ...(cur ?? {}), ...patch.workPrefs } as WorkPrefs;
    if (next.radius !== undefined && !(next.radius >= 1 && next.radius <= 200)) {
      fail("Rayon d'action invalide.");
    }
    if (next.criteria) {
      const c = next.criteria;
      if (!(c.minPayout >= 0) || !(c.maxWeightKg > 0)) fail("Critères invalides.");
      next.criteria = {
        minPayout: Math.round(c.minPayout),
        maxWeightKg: Math.round(c.maxWeightKg),
        acceptedUrgencies: c.acceptedUrgencies.filter((u) =>
          ["standard", "priority", "express"].includes(u),
        ),
        acceptedCities: c.acceptedCities.map((x) => x.slice(0, 60)).slice(0, 30),
      };
    }
    set.workPrefs = next;
  }
  if (patch.workingHours) {
    for (const day of DAYS) {
      const h = patch.workingHours[day];
      if (!h || !HHMM.test(h.start) || !HHMM.test(h.end)) fail("Horaires invalides.");
      if (h.enabled && h.start >= h.end) fail("L'heure de fin doit suivre l'heure de début.");
    }
    set.workingHours = patch.workingHours;
  }
  if (patch.locationSharing !== undefined) set.locationSharing = patch.locationSharing;
  await db.update(drivers).set(set).where(eq(drivers.userId, me.id));
}

// --- Lecture ---------------------------------------------------------------------

async function photosOf(
  q: Q,
  rows: { ownerKey: string; fileId: string; name: string }[],
): Promise<Map<string, MissionProofPhoto[]>> {
  const out = new Map<string, MissionProofPhoto[]>();
  if (!rows.length) return out;
  const meta = await q
    .select({
      id: files.id,
      key: files.storageKey,
      mime: files.mime,
      size: files.sizeBytes,
      at: files.createdAt,
    })
    .from(files)
    .where(
      inArray(
        files.id,
        rows.map((r) => r.fileId),
      ),
    );
  for (const r of rows) {
    const f = meta.find((m) => m.id === r.fileId);
    if (!f) continue;
    const list = out.get(r.ownerKey) ?? [];
    list.push({
      id: r.fileId,
      name: r.name,
      size: f.size,
      mime: f.mime,
      dataUrl: (await photoUrl(f.key)) ?? "",
      at: f.at.toISOString(),
    });
    out.set(r.ownerKey, list);
  }
  return out;
}

async function renewalViews(q: Q, rows: (typeof docRenewals.$inferSelect)[]) {
  if (!rows.length) return [];
  const fileRows = await q
    .select()
    .from(docRenewalFiles)
    .where(
      inArray(
        docRenewalFiles.renewalId,
        rows.map((r) => r.id),
      ),
    );
  const people = await loadPeople(q, [
    ...rows.map((r) => r.driverId),
    ...rows.map((r) => r.decidedBy),
  ]);
  const photos = await photosOf(
    q,
    fileRows.map((f) => ({ ownerKey: f.renewalId, fileId: f.fileId, name: f.name })),
  );
  return rows.map((r): DocRenewalView => ({
    id: r.id,
    driverId: r.driverId,
    driverName: people.get(r.driverId)?.name ?? "Livreur",
    doc: r.doc,
    newExpiry: r.newExpiry,
    photos: photos.get(r.id) ?? [],
    status: r.status,
    at: r.createdAt.toISOString(),
    decidedAt: r.decidedAt?.toISOString(),
    decidedBy: r.decidedBy ? people.get(r.decidedBy)?.name : undefined,
    note: r.note ?? undefined,
  }));
}

async function changeViews(q: Q, rows: (typeof vehicleChangeRequests.$inferSelect)[]) {
  if (!rows.length) return [];
  const fileRows = await q
    .select()
    .from(vehicleChangeFiles)
    .where(
      inArray(
        vehicleChangeFiles.requestId,
        rows.map((r) => r.id),
      ),
    );
  const people = await loadPeople(
    q,
    rows.map((r) => r.driverId),
  );
  const photos = await photosOf(
    q,
    fileRows.map((f) => ({ ownerKey: f.requestId, fileId: f.fileId, name: f.name })),
  );
  return rows.map((r): ChangeRequestView => ({
    id: r.id,
    reference: r.reference,
    reason: r.reason,
    newVehicle: r.newVehicle as NewVehicleInput,
    docs: photos.get(r.id) ?? [],
    status: r.status,
    submittedAt: r.createdAt.toISOString(),
    driverId: r.driverId,
    driverName: people.get(r.driverId)?.name ?? "Livreur",
    note: r.note ?? undefined,
  }));
}

export async function readDriverFleet(q: Q, driverId: string): Promise<DriverFleetView> {
  const [d] = await q.select().from(drivers).where(eq(drivers.userId, driverId));
  const [v] = await q
    .select()
    .from(vehicles)
    .where(eq(vehicles.driverId, driverId))
    .orderBy(desc(vehicles.createdAt))
    .limit(1);
  const [issueRows, maintenanceRows, changeRows, renewalRows] = await Promise.all([
    v
      ? q
          .select()
          .from(vehicleIssues)
          .where(eq(vehicleIssues.vehicleId, v.id))
          .orderBy(desc(vehicleIssues.createdAt))
          .limit(100)
      : Promise.resolve([]),
    v
      ? q
          .select()
          .from(maintenanceEntries)
          .where(eq(maintenanceEntries.vehicleId, v.id))
          .orderBy(desc(maintenanceEntries.doneAt))
          .limit(100)
      : Promise.resolve([]),
    q
      .select()
      .from(vehicleChangeRequests)
      .where(eq(vehicleChangeRequests.driverId, driverId))
      .orderBy(desc(vehicleChangeRequests.createdAt))
      .limit(20),
    q
      .select()
      .from(docRenewals)
      .where(eq(docRenewals.driverId, driverId))
      .orderBy(desc(docRenewals.createdAt))
      .limit(20),
  ]);
  const issuePhotoRows = issueRows.length
    ? await q
        .select()
        .from(vehicleIssuePhotos)
        .where(
          inArray(
            vehicleIssuePhotos.issueId,
            issueRows.map((i) => i.id),
          ),
        )
    : [];
  const issuePhotos = await photosOf(
    q,
    issuePhotoRows.map((p) => ({ ownerKey: p.issueId, fileId: p.fileId, name: p.name })),
  );
  let photo = "";
  if (v?.photoFileId) {
    const [f] = await q
      .select({ key: files.storageKey })
      .from(files)
      .where(eq(files.id, v.photoFileId));
    photo = (f && (await photoUrl(f.key))) || "";
  }
  return {
    vehicle: v
      ? {
          type: TYPE_FROM_DB[v.type],
          brand: v.brand ?? "",
          model: v.model ?? "",
          year: v.year ?? 0,
          plate: v.plate ?? "",
          color: v.color ?? "",
          capacityKg: v.capacityKg,
          mileageKm: v.mileageKm,
          insuranceExpiry: v.insuranceExpiresAt ?? "",
          inspectionExpiry: v.inspectionExpiresAt ?? "",
          photo,
          photos: [],
          nextMaintenanceAt: v.nextMaintenanceAt ?? undefined,
          condition: { ...GOOD, ...((v.condition as Partial<Condition> | null) ?? {}) },
        }
      : null,
    issues: issueRows.map((i) => ({
      id: i.id,
      reference: i.reference,
      type: i.type,
      severity: i.severity,
      description: i.description,
      at: i.createdAt.toISOString(),
      status: i.status,
      photos: issuePhotos.get(i.id),
    })),
    maintenance: maintenanceRows.map((m) => ({
      id: m.id,
      label: m.label,
      at: m.doneAt.toISOString(),
      mileageKm: m.mileageKm,
      status: "done" as const,
    })),
    changeRequests: await changeViews(q, changeRows),
    renewals: await renewalViews(q, renewalRows),
    online: d?.isOnline ?? false,
    workPrefs: (d?.workPrefs as WorkPrefs | null) ?? null,
    workingHours: (d?.workingHours as WorkingHours | null) ?? null,
    locationSharing: d?.locationSharing ?? true,
  };
}

/** Équipe : documents et changements de véhicule à vérifier (et récents). */
export async function readFleetQueue(
  q: Q,
  adminId: string,
): Promise<{ renewals: DocRenewalView[]; changeRequests: ChangeRequestView[] }> {
  const role = await staffRoleOf(q, adminId);
  if (!role || !(FLEET_STAFF as readonly string[]).includes(role)) {
    return { renewals: [], changeRequests: [] };
  }
  const [renewalRows, changeRows] = await Promise.all([
    q.select().from(docRenewals).orderBy(desc(docRenewals.createdAt)).limit(100),
    q
      .select()
      .from(vehicleChangeRequests)
      .orderBy(desc(vehicleChangeRequests.createdAt))
      .limit(100),
  ]);
  return {
    renewals: await renewalViews(q, renewalRows),
    changeRequests: await changeViews(q, changeRows),
  };
}
