import { useSyncExternalStore } from "react";

export type TourStop = {
  id: string;
  kind: "pickup" | "dropoff";
  label: string;
  address: string;
  city: string;
  contactPhone: string;
  windowStart: string;
  windowEnd: string;
  weightKg: number;
  missionRef: string;
  done: boolean;
};

export type Tour = {
  id: string;
  reference: string;
  date: string;
  status: "planned" | "running" | "done";
  vehicle: string;
  stops: TourStop[];
  distanceKm: number;
  payout: number;
};

type Listener = () => void;
const KEY = "diambar:driver-tours";

const seed: Tour[] = [
  {
    id: "t1",
    reference: "TRN-118",
    date: "2025-05-16",
    status: "planned",
    vehicle: "Camionnette · DK-4821-B",
    distanceKm: 96,
    payout: 21500,
    stops: [
      {
        id: "t1s1",
        kind: "pickup",
        label: "Ferme Diallo",
        address: "Route de Khombole km 3",
        city: "Thiès",
        contactPhone: "+221 77 123 45 67",
        windowStart: "06:30",
        windowEnd: "07:15",
        weightKg: 45,
        missionRef: "MIS-4210",
        done: false,
      },
      {
        id: "t1s2",
        kind: "pickup",
        label: "Coopérative Sow",
        address: "Zone maraîchère",
        city: "Pikine",
        contactPhone: "+221 78 200 33 44",
        windowStart: "08:00",
        windowEnd: "08:30",
        weightKg: 22,
        missionRef: "MIS-4211",
        done: false,
      },
      {
        id: "t1s3",
        kind: "dropoff",
        label: "Le Baobab",
        address: "Place de l'Indépendance",
        city: "Dakar",
        contactPhone: "+221 78 900 11 22",
        windowStart: "09:15",
        windowEnd: "10:00",
        weightKg: 45,
        missionRef: "MIS-4210",
        done: false,
      },
      {
        id: "t1s4",
        kind: "dropoff",
        label: "Hôtel Téranga",
        address: "Corniche Ouest",
        city: "Dakar",
        contactPhone: "+221 77 444 88 99",
        windowStart: "10:15",
        windowEnd: "11:00",
        weightKg: 22,
        missionRef: "MIS-4211",
        done: false,
      },
    ],
  },
  {
    id: "t2",
    reference: "TRN-117",
    date: "2025-05-15",
    status: "running",
    vehicle: "Camionnette · DK-4821-B",
    distanceKm: 61,
    payout: 16000,
    stops: [
      {
        id: "t2s1",
        kind: "pickup",
        label: "Niayes Ndoye",
        address: "Ferme Niayes",
        city: "Mbour",
        contactPhone: "+221 76 555 11 22",
        windowStart: "07:00",
        windowEnd: "07:45",
        weightKg: 120,
        missionRef: "MIS-4212",
        done: true,
      },
      {
        id: "t2s2",
        kind: "dropoff",
        label: "Chez Aminata",
        address: "Thiès centre",
        city: "Thiès",
        contactPhone: "+221 77 555 22 88",
        windowStart: "09:00",
        windowEnd: "09:45",
        weightKg: 60,
        missionRef: "MIS-4212",
        done: true,
      },
      {
        id: "t2s3",
        kind: "dropoff",
        label: "Le Baobab",
        address: "Dakar Plateau",
        city: "Dakar",
        contactPhone: "+221 78 900 11 22",
        windowStart: "11:00",
        windowEnd: "11:45",
        weightKg: 60,
        missionRef: "MIS-4212",
        done: false,
      },
    ],
  },
];

let state: Tour[] = seed;
if (typeof window !== "undefined") {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = JSON.parse(raw) as Tour[];
  } catch {
    /* ignore */
  }
}

const listeners = new Set<Listener>();
function set(next: (p: Tour[]) => Tour[]) {
  state = next(state);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }
  listeners.forEach((l) => l());
}

export function useTours() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

function reorder<T>(arr: T[], from: number, to: number) {
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export const tourActions = {
  move: (tourId: string, index: number, dir: -1 | 1) =>
    set((tours) =>
      tours.map((t) => {
        if (t.id !== tourId) return t;
        const to = index + dir;
        if (to < 0 || to >= t.stops.length) return t;
        return { ...t, stops: reorder(t.stops, index, to) };
      }),
    ),
  toggleStop: (tourId: string, stopId: string) =>
    set((tours) =>
      tours.map((t) =>
        t.id === tourId
          ? { ...t, stops: t.stops.map((s) => (s.id === stopId ? { ...s, done: !s.done } : s)) }
          : t,
      ),
    ),
  start: (tourId: string) =>
    set((tours) => tours.map((t) => (t.id === tourId ? { ...t, status: "running" } : t))),
  finish: (tourId: string) =>
    set((tours) =>
      tours.map((t) =>
        t.id === tourId
          ? { ...t, status: "done", stops: t.stops.map((s) => ({ ...s, done: true })) }
          : t,
      ),
    ),
  optimize: (tourId: string) =>
    set((tours) =>
      tours.map((t) => {
        if (t.id !== tourId) return t;
        const pickups = t.stops
          .filter((s) => s.kind === "pickup")
          .sort((a, b) => a.windowStart.localeCompare(b.windowStart));
        const drops = t.stops
          .filter((s) => s.kind === "dropoff")
          .sort((a, b) => a.windowStart.localeCompare(b.windowStart));
        return {
          ...t,
          stops: [...pickups, ...drops],
          distanceKm: Math.max(20, Math.round(t.distanceKm * 0.92)),
        };
      }),
    ),
  reset: () => set(() => seed),
};
