import type { Offre } from "./types";

/** Nettoie un numéro mauritanien pour wa.me : chiffres seulement, préfixe 222 si besoin. */
export function lienWhatsApp(brut: string): string {
  let numero = brut.replace(/\D/g, "");
  if (numero.startsWith("00222")) numero = numero.slice(2);
  else if (!numero.startsWith("222")) numero = `222${numero}`;
  return `https://wa.me/${numero}`;
}

/** Garde uniquement les URL http(s) (anti javascript: injecté). */
export function lienSecurise(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

/** Lien mailto avec sujet et corps pré-remplis. */
export function lienMailto(offre: Offre, email: string): string {
  const sujet = `Candidature — ${offre.titre}`;
  const corps = [
    "Bonjour,",
    "",
    `Je vous adresse ma candidature pour l'offre « ${offre.titre} » chez ${offre.entreprise} (${offre.ville}).`,
    "",
    "Vous trouverez ci-joint mon CV et ma lettre de motivation.",
    "",
    "Cordialement,",
  ].join("\n");
  return `mailto:${email}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
}

/** Message WhatsApp pré-rempli (fenêtre wa.me ouverte en onglet, pattern handlePartager). */
export function texteWhatsApp(offre: Offre): string {
  return `Bonjour, je suis intéressé(e) par votre offre « ${offre.titre} » — ${offre.entreprise} (${offre.ville}).`;
}
