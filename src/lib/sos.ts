import { supportTicketActions } from "@/data/support";

// Numéro d'astreinte Diambar (à remplacer par le vrai numéro avant le
// lancement) et numéros d'urgence publics au Sénégal.
export const SUPPORT_HOTLINE = "+221 33 800 00 00";
export const EMERGENCY_NUMBERS = { police: "17", pompiers: "18", samu: "1515" };

/** Alerte SOS : ticket de priorité urgente, avec la position GPS si le
 * téléphone la donne (sinon l'alerte part quand même, sans attendre). */
export function sendSos(opts: { fromName: string; missionRef?: string }): Promise<string> {
  const create = (position?: string) =>
    supportTicketActions.create({
      subject: "🚨 SOS livreur — rappel immédiat",
      message: [
        "Le livreur déclenche une alerte SOS et demande un rappel immédiat.",
        opts.missionRef ? `Mission : ${opts.missionRef}.` : "",
        position ? `Position : ${position}` : "Position non disponible.",
      ]
        .filter(Boolean)
        .join(" "),
      fromName: opts.fromName,
      fromRole: "driver",
      category: "delivery",
      orderRef: opts.missionRef,
      priority: "urgent",
    }).id;

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(create());
  }
  return new Promise((resolve) => {
    let done = false;
    const finish = (pos?: string) => {
      if (done) return;
      done = true;
      resolve(create(pos));
    };
    setTimeout(() => finish(), 4000);
    navigator.geolocation.getCurrentPosition(
      (p) =>
        finish(
          `https://maps.google.com/?q=${p.coords.latitude.toFixed(5)},${p.coords.longitude.toFixed(5)}`,
        ),
      () => finish(),
      { enableHighAccuracy: true, timeout: 3500 },
    );
  });
}
