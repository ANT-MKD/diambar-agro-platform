export interface TrackingPoint {
  lat: number;
  lng: number;
}

export interface TrackingPlace extends TrackingPoint {
  label: string;
}

export type TrackingStep = "pickup" | "transit" | "dropoff";

export interface TrackingSessionConfig {
  trackingId: string;
  pickup: TrackingPlace;
  dropoff: TrackingPlace;
  step: TrackingStep;
  driverName: string;
}

export interface LiveTrackingSnapshot {
  trackingId: string;
  pickup: TrackingPlace;
  dropoff: TrackingPlace;
  driver: TrackingPoint & { heading: number };
  route: TrackingPoint[];
  /** Progression 0-1 le long de l'itinéraire */
  progress: number;
  etaMinutes: number;
  step: TrackingStep;
  driverName: string;
  updatedAt: string;
  /** true = position GPS réelle (pas simulée) */
  gpsLive?: boolean;
}
