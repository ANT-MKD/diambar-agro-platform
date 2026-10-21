import type { CapacitorConfig } from "@capacitor/cli";

// Application Android Diambar Agro : elle ouvre le site en ligne (toujours à
// jour, sans republier l'application) et ajoute ce que le navigateur ne sait
// pas faire : envoyer la position du livreur en arrière-plan, pendant qu'il
// suit Waze ou Google Maps ou que l'écran est éteint.
// Adresse du site : CAP_SERVER_URL au moment de la compilation (sinon celle
// de production ci-dessous).
const serverUrl = (
  process.env.CAP_SERVER_URL?.trim() || "https://diambar-agro-platform-six.vercel.app"
).replace(/\/+$/, "");

const config: CapacitorConfig = {
  appId: "sn.diambaragro.app",
  appName: "Diambar Agro",
  // Pages de secours embarquées (chargement, pas de connexion).
  webDir: "android-shell",
  server: {
    url: serverUrl,
    errorPath: "offline.html",
  },
  android: {
    // Requis par le suivi en arrière-plan (@capacitor-community/background-geolocation).
    useLegacyBridge: true,
  },
};

export default config;
