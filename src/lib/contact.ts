/** Numéro au format international sans espaces ni « + » (wa.me, tel:). */
export function digitsOnly(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

/** Lien WhatsApp vers un numéro, avec un message prérempli facultatif. */
export function whatsappLink(phone: string, text?: string) {
  const base = `https://wa.me/${digitsOnly(phone)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function telLink(phone: string) {
  return `tel:+${digitsOnly(phone)}`;
}
