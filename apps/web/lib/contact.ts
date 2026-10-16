/**
 * Contact public de LAWOL.mr — SOURCE UNIQUE du numéro WhatsApp.
 *
 * Règle : aucun numéro n'est inventé. Tant que `CONTACT_WHATSAPP` reste vide,
 * `lienContactWhatsApp()` renvoie `null` et le CTA WhatsApp n'est PAS affiché
 * (les pages concernées masquent le bouton et laissent la voie e-mail). Dès
 * qu'un numéro réel est disponible, il suffit de le renseigner ici — chiffres
 * internationaux sans « + » ni espaces (indicatif 222 suivi de 8 chiffres).
 */

/** Numéro WhatsApp public — vide = non configuré (aucun CTA WhatsApp rendu). */
export const CONTACT_WHATSAPP = "";

/** Message pré-rempli du CTA WhatsApp. */
export const CONTACT_WHATSAPP_MESSAGE =
  "Bonjour LAWOL, je veux recevoir les bourses qui matchent mon profil.";

/**
 * Construit l'URL wa.me pour un numéro donné, ou `null` si le numéro est absent
 * ou hors bornes (8 à 15 chiffres). Fonction pure : c'est elle qui décide si un
 * numéro est exploitable, jamais un appelant.
 */
export function construireLienWhatsApp(numero: string): string | null {
  const chiffres = numero.replace(/\D/g, "");
  if (chiffres.length < 8 || chiffres.length > 15) return null;
  return `https://wa.me/${chiffres}?text=${encodeURIComponent(
    CONTACT_WHATSAPP_MESSAGE
  )}`;
}

/**
 * URL wa.me du CTA de contact, ou `null` si aucun numéro public n'est configuré.
 * Les appelants doivent tester `null` et ne rien afficher dans ce cas.
 */
export function lienContactWhatsApp(): string | null {
  return construireLienWhatsApp(CONTACT_WHATSAPP);
}
