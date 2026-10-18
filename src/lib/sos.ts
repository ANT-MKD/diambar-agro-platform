import { supportTicketActions } from "@/data/support";

// Numéros d'urgence publics au Sénégal. Le numéro de l'équipe Diambar est
// celui saisi dans Paramètres → Entreprise (jamais un numéro inventé).
export const EMERGENCY_NUMBERS = { police: "17", pompiers: "18", samu: "1515" };

/** Appelle l'équipe si son numéro est renseigné ; sinon rappelle les numéros
 * d'urgence. Renvoie vrai si l'appel a été lancé. */
export function callTeam(companyPhone: string): boolean {
  const digits = companyPhone.replace(/[^\d+]/g, "");
  if (digits.replace(/\D/g, "").length < 9) return false;
  window.location.href = `tel:${digits}`;
  return true;
}

export const EMERGENCY_TEXT = `Urgence : police ${EMERGENCY_NUMBERS.police}, pompiers ${EMERGENCY_NUMBERS.pompiers}, SAMU ${EMERGENCY_NUMBERS.samu}.`;

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
