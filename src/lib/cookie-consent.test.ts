import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadCookieConsent, saveCookieConsent, subscribeCookieConsent } from "./cookie-consent";

describe("cookie-consent", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null before any decision is saved", () => {
    expect(loadCookieConsent()).toBeNull();
  });

  it("round-trips a saved decision", () => {
    const saved = saveCookieConsent({ analytics: true, marketing: false });
    expect(saved.essential).toBe(true);
    expect(saved.analytics).toBe(true);
    expect(saved.marketing).toBe(false);
    expect(saved.decidedAt).toEqual(expect.any(String));

    const loaded = loadCookieConsent();
    expect(loaded).toEqual(saved);
  });

  it("notifies subscribers when a decision is saved", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCookieConsent(listener);
    saveCookieConsent({ analytics: false, marketing: false });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    saveCookieConsent({ analytics: true, marketing: true });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
