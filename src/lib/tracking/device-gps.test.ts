import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shouldSend, startDeviceGps, type GpsFix, type GpsStatus } from "./device-gps";

const fix = (lat: number, at: number): GpsFix => ({
  lat,
  lng: -17.4377,
  accuracy: 10,
  heading: null,
  speedKmh: null,
  at,
});
// ~1 m de latitude ≈ 0,000009°.
const METER = 0.000009;

describe("shouldSend", () => {
  it("premier point, puis au plus toutes les 10 s et après 40 m, ou une fois par minute", () => {
    const t = 1_000_000;
    expect(shouldSend(null, fix(14.66, t), t)).toBe(true);
    const prev = { fix: fix(14.66, t), sentAt: t };
    expect(shouldSend(prev, fix(14.66 + 100 * METER, t + 5_000), t + 5_000)).toBe(false);
    expect(shouldSend(prev, fix(14.66 + 20 * METER, t + 20_000), t + 20_000)).toBe(false);
    expect(shouldSend(prev, fix(14.66 + 100 * METER, t + 12_000), t + 12_000)).toBe(true);
    expect(shouldSend(prev, fix(14.66, t + 60_000), t + 60_000)).toBe(true);
  });
});

describe("startDeviceGps (navigateur)", () => {
  let onPosition: PositionCallback;
  let onError: PositionErrorCallback | null | undefined;
  const clearWatch = vi.fn();
  const fetchMock = vi.fn();
  let now = 1_700_000_000_000;

  const position = (lat: number): GeolocationPosition =>
    ({
      coords: {
        latitude: lat,
        longitude: -17.4377,
        accuracy: 8,
        heading: Number.NaN,
        speed: 5,
        altitude: null,
        altitudeAccuracy: null,
      },
      timestamp: now,
    }) as unknown as GeolocationPosition;
  const reply = (status: number, data: unknown) =>
    Promise.resolve(new Response(JSON.stringify(data), { status }));
  const flush = () => new Promise((r) => setTimeout(r, 0));

  beforeEach(() => {
    vi.spyOn(Date, "now").mockImplementation(() => now);
    vi.stubGlobal("navigator", {
      geolocation: {
        watchPosition: (ok: PositionCallback, err?: PositionErrorCallback | null) => {
          onPosition = ok;
          onError = err;
          return 7;
        },
        clearWatch,
      },
    });
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    clearWatch.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("envoie avec le jeton, espace les envois et s'arrête quand le serveur le demande", async () => {
    const getSession = vi
      .fn()
      .mockResolvedValueOnce({ token: "t1", expiresAt: new Date(now + 3_600_000).toISOString() })
      .mockResolvedValueOnce({ token: "t2", expiresAt: new Date(now + 3_600_000).toISOString() });
    const statuses: GpsStatus[] = [];
    const onServerStop = vi.fn();
    const stop = startDeviceGps({
      getSession,
      onStatus: (s) => statuses.push(s),
      onServerStop,
      endpoint: "https://exemple.test/api/driver-position",
    });
    expect(statuses.at(-1)?.state).toBe("starting");

    fetchMock.mockReturnValueOnce(reply(200, { ok: true, tracking: true }));
    onPosition(position(14.66));
    await flush();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://exemple.test/api/driver-position");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer t1");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ lat: 14.66, accuracy: 8, heading: null, speedKmh: 18 });
    expect(statuses.at(-1)).toMatchObject({ state: "active", native: false, sendFailing: false });

    // 3 s plus tard : rien. 12 s et 100 m plus loin : envoyé.
    now += 3_000;
    onPosition(position(14.66 + 100 * METER));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Jeton refusé (401) : renouvelé puis renvoyé une fois.
    now += 9_000;
    fetchMock
      .mockReturnValueOnce(reply(401, { ok: false }))
      .mockReturnValueOnce(reply(200, { ok: true, tracking: false }));
    onPosition(position(14.66 + 200 * METER));
    await flush();
    await flush();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const retry = fetchMock.mock.calls[2][1] as RequestInit;
    expect((retry.headers as Record<string, string>).authorization).toBe("Bearer t2");
    // Plus de course démarrée : le suivi s'arrête de lui-même.
    expect(onServerStop).toHaveBeenCalledTimes(1);
    expect(clearWatch).toHaveBeenCalledWith(7);
    stop();
  });

  it("réseau coupé : signalé, puis nouvel essai au plus tôt 15 s plus tard", async () => {
    const statuses: GpsStatus[] = [];
    const stop = startDeviceGps({
      getSession: async () => ({
        token: "t",
        expiresAt: new Date(now + 3_600_000).toISOString(),
      }),
      onStatus: (s) => statuses.push(s),
      endpoint: "/api/driver-position",
    });
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    onPosition(position(14.66));
    await flush();
    await flush();
    expect(statuses.at(-1)?.sendFailing).toBe(true);
    now += 5_000;
    onPosition(position(14.66));
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    now += 11_000;
    fetchMock.mockReturnValueOnce(reply(200, { ok: true, tracking: true }));
    onPosition(position(14.66));
    await flush();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(statuses.at(-1)?.sendFailing).toBe(false);
    stop();
    expect(clearWatch).toHaveBeenCalled();
  });

  it("autorisation refusée : état « denied »", () => {
    const statuses: GpsStatus[] = [];
    const stop = startDeviceGps({
      getSession: async () => ({ token: "t", expiresAt: new Date(now + 1e6).toISOString() }),
      onStatus: (s) => statuses.push(s),
    });
    onError?.({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError);
    expect(statuses.at(-1)?.state).toBe("denied");
    stop();
  });
});
