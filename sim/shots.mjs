// Simulation : un livreur roule de la zone des Niayes (Pikine) au Plateau.
// Son « téléphone » envoie sa position comme un vrai (GPS simulé, avec cap et
// vitesse) ; on photographie ce que voient le restaurant, l'équipe et le
// livreur, sur les vraies cartes Mapbox. Base jetable du runner.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = "http://127.0.0.1:8090";
const OUT = new URL("../captures/", import.meta.url).pathname;
const FRAMES = `${OUT}frames/`;
fs.mkdirSync(FRAMES, { recursive: true });
const { missionId, orderId } = JSON.parse(fs.readFileSync("/tmp/sim.json", "utf8"));
const TOKEN = process.env.MAPBOX_TOKEN;
const FARM = { lat: 14.759, lng: -17.388 };
const PLATEAU = { lat: 14.6693, lng: -17.4373 };
const sql = postgres(process.env.SIM_DATABASE_URL, { max: 1 });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// --- Trajet réaliste : itinéraire Mapbox entre la ferme et le restaurant ----------
async function roadPath() {
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/${FARM.lng},${FARM.lat};${PLATEAU.lng},${PLATEAU.lat}` +
    `?geometries=geojson&overview=full&access_token=${TOKEN}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Directions ${res.status}`);
  const data = await res.json();
  return data.routes[0].geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
}
const rad = (d) => (d * Math.PI) / 180;
function km(a, b) {
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
function bearing(a, b) {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
/** Point à la fraction `f` du trajet, avec le cap de la route à cet endroit. */
function along(path, f) {
  const total = path.slice(1).reduce((s, p, i) => s + km(path[i], p), 0);
  let walked = 0;
  for (let i = 1; i < path.length; i++) {
    const seg = km(path[i - 1], path[i]);
    if (walked + seg >= total * f) {
      const t = seg ? (total * f - walked) / seg : 0;
      const a = path[i - 1];
      const b = path[i];
      return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t, heading: bearing(a, b) };
    }
    walked += seg;
  }
  const a = path.at(-2);
  const b = path.at(-1);
  return { ...b, heading: bearing(a, b) };
}

// --- Navigateurs -----------------------------------------------------------------
async function login(page, email) {
  await page.goto(`${BASE}/login`);
  await page.waitForTimeout(1500);
  for (const t of ["Tout accepter", "Accepter", "Refuser"]) {
    const b = page.getByRole("button", { name: t });
    if (await b.count()) {
      await b.first().click().catch(() => {});
      break;
    }
  }
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', "demo1234");
  await page.click('button[type="submit"]');
  for (let i = 0; i < 40 && page.url().includes("/login"); i++) await page.waitForTimeout(500);
  await page.waitForTimeout(1000);
}
async function context(browser, { theme = "light", mobile = false } = {}) {
  const ctx = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 860 },
    deviceScaleFactor: 2,
    locale: "fr-FR",
  });
  await ctx.addInitScript((t) => {
    try {
      localStorage.setItem("theme", t);
    } catch {}
  }, theme);
  return ctx;
}
const card = (page) => page.locator("div.overflow-hidden.rounded-2xl.border.bg-card").first();
async function shot(page, name, locator = card(page)) {
  await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await locator.screenshot({ path: `${OUT}${name}.png` });
  log("capture", name);
}
async function engine(page) {
  return (await page.locator(".mapboxgl-map").count())
    ? "Mapbox"
    : (await page.locator(".leaflet-container").count())
      ? "OpenStreetMap (repli)"
      : "aucune carte";
}

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const errors = [];
try {
  const path = await roadPath().catch((e) => {
    log(`itinéraire Mapbox indisponible (${e.message}) : ligne droite`);
    return Array.from({ length: 21 }, (_, i) => ({
      lat: FARM.lat + ((PLATEAU.lat - FARM.lat) * i) / 20,
      lng: FARM.lng + ((PLATEAU.lng - FARM.lng) * i) / 20,
    }));
  });
  log(`itinéraire : ${path.length} points`);
  const steps = [0.03, 0.14, 0.26, 0.38, 0.5, 0.62, 0.74, 0.85, 0.94].map((f) => along(path, f));

  // Téléphone du livreur : GPS simulé (position, cap, vitesse), piloté d'ici.
  const dctx = await context(browser, { mobile: true });
  await dctx.addInitScript(() => {
    const watchers = new Map();
    let next = 1;
    let last = null;
    const fix = (p) => ({
      coords: {
        latitude: p.lat,
        longitude: p.lng,
        accuracy: 12,
        heading: p.heading,
        speed: 9,
        altitude: null,
        altitudeAccuracy: null,
      },
      timestamp: Date.now(),
    });
    const geo = {
      watchPosition(ok) {
        const id = next++;
        watchers.set(id, ok);
        if (last) setTimeout(() => ok(fix(last)), 50);
        return id;
      },
      clearWatch(id) {
        watchers.delete(id);
      },
      getCurrentPosition(ok) {
        if (last) ok(fix(last));
      },
    };
    Object.defineProperty(navigator, "geolocation", { value: geo, configurable: true });
    window.__simMove = (p) => {
      last = p;
      for (const cb of watchers.values()) cb(fix(p));
    };
  });
  const driver = await dctx.newPage();
  driver.on("pageerror", (e) => errors.push(`livreur: ${e.message}`));
  await login(driver, "livreur@diambar.sn");
  await driver.goto(`${BASE}/driver/missions/${missionId}`);
  await driver.waitForTimeout(3000);
  await driver.evaluate((p) => window.__simMove(p), steps[0]);

  // Restaurant et équipe, pages ouvertes pendant toute la course.
  const rctx = await context(browser);
  const resto = await rctx.newPage();
  resto.on("pageerror", (e) => errors.push(`restaurant: ${e.message}`));
  await login(resto, "restaurant@diambar.sn");
  await resto.goto(`${BASE}/restaurant/orders/${orderId}`);
  const actx = await context(browser);
  const admin = await actx.newPage();
  admin.on("pageerror", (e) => errors.push(`équipe: ${e.message}`));
  await login(admin, "admin@diambar.sn");
  await admin.goto(`${BASE}/admin/deliveries/${missionId}`);

  await resto.getByText(/avant la livraison/).waitFor({ timeout: 60000 });
  await resto.waitForTimeout(10000);
  log("carte restaurant :", await engine(resto));
  const box = await card(resto).boundingBox();

  for (let i = 0; i < steps.length; i++) {
    if (i > 0) await driver.evaluate((p) => window.__simMove(p), steps[i]);
    // Le téléphone envoie, puis le restaurant se met à jour (toutes les 15 s).
    await resto.waitForTimeout(17000);
    await resto.screenshot({ path: `${FRAMES}f${String(i).padStart(2, "0")}.png`, clip: box });
    const eta = (await resto.getByText(/avant la livraison/).first().textContent().catch(() => "")) ?? "";
    log(`étape ${i + 1}/${steps.length} · ${eta.trim()}`);
    if (i === 4) {
      await shot(
        driver,
        "5-livreur-telephone",
        driver.locator("div.glass.rounded-2xl.overflow-hidden", { hasText: "Partager au restaurant" }).first(),
      );
    }
  }
  await shot(resto, "1-restaurant-livraison");

  // Équipe : la course (trajet réel en vert, reste de l'itinéraire), la flotte.
  await admin.reload();
  await admin.getByText(/GPS · /).waitFor({ timeout: 60000 });
  await admin.waitForTimeout(12000);
  log("carte équipe :", await engine(admin));
  await shot(admin, "3-equipe-course");
  await admin.goto(`${BASE}/admin/deliveries`);
  await admin.getByText(/livreur\(s\) localisé/).waitFor({ timeout: 60000 });
  await admin.waitForTimeout(10000);
  await shot(admin, "4-equipe-livreurs-en-course");

  // Restaurant en thème sombre (Mapbox de nuit).
  const nctx = await context(browser, { theme: "dark" });
  const night = await nctx.newPage();
  await login(night, "restaurant@diambar.sn");
  await night.goto(`${BASE}/restaurant/orders/${orderId}`);
  await night.getByText(/avant la livraison/).waitFor({ timeout: 60000 });
  await night.waitForTimeout(12000);
  await shot(night, "2-restaurant-theme-sombre");

  // Animation : le livreur avance, le reste de l'itinéraire raccourcit.
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-framerate", "1.2", "-i", `${FRAMES}f%02d.png`,
    "-vf", "fps=6,scale=900:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160[p];[b][p]paletteuse=dither=bayer:bayer_scale=4",
    "-loop", "0", `${OUT}simulation.gif`,
  ]);
  log("animation : simulation.gif");
  const [{ n }] = await sql`select count(*)::int as n from mission_positions where mission_id = ${missionId}`;
  log(`trajet enregistré : ${n} points`);
} finally {
  log("erreurs JS :", errors.length ? errors.join(" | ").slice(0, 800) : "aucune");
  await browser.close();
  await sql.end();
}
