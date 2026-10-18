import type {
  DriverVehicle,
  DriverWorkCriteria,
  MaintenanceEntry,
  MissionProofPhoto,
  VehicleChangeRequest,
  VehicleIssue,
  WorkingHours,
} from "@/data/mocks";

// Flotte d'un livreur telle que les écrans la reçoivent (mode base).

export type WorkPrefs = {
  radius: number;
  autoAccept: boolean;
  criteria: DriverWorkCriteria;
};

export type DocRenewalView = {
  id: string;
  driverId: string;
  driverName: string;
  doc: "insurance" | "inspection";
  newExpiry: string;
  photos: MissionProofPhoto[];
  status: "pending" | "approved" | "rejected";
  at: string;
  decidedAt?: string;
  decidedBy?: string;
  note?: string;
};

export type ChangeRequestView = VehicleChangeRequest & {
  driverId: string;
  driverName: string;
  note?: string;
};

export type DriverFleetView = {
  vehicle: DriverVehicle | null;
  issues: VehicleIssue[];
  maintenance: MaintenanceEntry[];
  changeRequests: ChangeRequestView[];
  renewals: DocRenewalView[];
  online: boolean;
  workPrefs: WorkPrefs | null;
  workingHours: WorkingHours | null;
  locationSharing: boolean;
};
