import { useSyncExternalStore } from "react";

export type SessionEntry = {
  id: string;
  device: string;
  place: string;
  at: string;
  current: boolean;
  kind: "desktop" | "mobile";
};

export type LoginEntry = {
  id: string;
  at: string;
  device: string;
  ip: string;
  place: string;
  result: "success" | "failed";
};

export type SecurityState = {
  twoFa: boolean;
  twoFaChannel: "sms" | "email" | "app";
  recoveryCodes: string[];
  sessions: SessionEntry[];
  logins: LoginEntry[];
  passwordUpdatedAt: string;
};

type Listener = () => void;

const KEY = "diambar:security";

const initial: SecurityState = {
  twoFa: false,
  twoFaChannel: "sms",
  recoveryCodes: [],
  passwordUpdatedAt: "2025-03-02T10:00:00Z",
  sessions: [
    { id: "s1", device: "Chrome · Windows", place: "Thiès, Sénégal", at: "Session actuelle", current: true, kind: "desktop" },
    { id: "s2", device: "Diambar App · Android", place: "Dakar, Sénégal", at: "Il y a 2 jours", current: false, kind: "mobile" },
    { id: "s3", device: "Safari · iPhone", place: "Mbour, Sénégal", at: "Il y a 9 jours", current: false, kind: "mobile" },
  ],
  logins: [
    { id: "l1", at: "2025-05-15T08:12:00Z", device: "Chrome · Windows", ip: "41.82.14.203", place: "Thiès", result: "success" },
    { id: "l2", at: "2025-05-14T19:44:00Z", device: "Diambar App · Android", ip: "196.1.95.12", place: "Dakar", result: "success" },
    { id: "l3", at: "2025-05-13T22:07:00Z", device: "Inconnu · Linux", ip: "102.64.8.71", place: "Abidjan", result: "failed" },
    { id: "l4", at: "2025-05-11T07:31:00Z", device: "Safari · iPhone", ip: "41.82.9.88", place: "Mbour", result: "success" },
  ],
};

let state: SecurityState = initial;
if (typeof window !== "undefined") {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...initial, ...(JSON.parse(raw) as SecurityState) };
  } catch { /* ignore */ }
}

const listeners = new Set<Listener>();
function set(next: (prev: SecurityState) => SecurityState) {
  state = next(state);
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }
  listeners.forEach((l) => l());
}

export function useSecurity() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => state,
    () => state,
  );
}

function randomCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
}

export const securityActions = {
  pendingCode: "" as string,
  startTwoFa: (channel: SecurityState["twoFaChannel"]) => {
    securityActions.pendingCode = String(Math.floor(100000 + Math.random() * 899999));
    set((s) => ({ ...s, twoFaChannel: channel }));
    return securityActions.pendingCode;
  },
  confirmTwoFa: (code: string) => {
    if (code.trim() !== securityActions.pendingCode) return false;
    set((s) => ({ ...s, twoFa: true, recoveryCodes: Array.from({ length: 6 }, randomCode) }));
    securityActions.pendingCode = "";
    return true;
  },
  disableTwoFa: () => set((s) => ({ ...s, twoFa: false, recoveryCodes: [] })),
  regenerateCodes: () => set((s) => ({ ...s, recoveryCodes: Array.from({ length: 6 }, randomCode) })),
  revokeSession: (id: string) => set((s) => ({ ...s, sessions: s.sessions.filter((x) => x.id !== id) })),
  revokeAllOthers: () => set((s) => ({ ...s, sessions: s.sessions.filter((x) => x.current) })),
  markPasswordChanged: () =>
    set((s) => ({
      ...s,
      passwordUpdatedAt: new Date().toISOString(),
      logins: [
        { id: `l_${Date.now()}`, at: new Date().toISOString(), device: "Session actuelle", ip: "41.82.14.203", place: "Thiès", result: "success" },
        ...s.logins,
      ],
    })),
};
