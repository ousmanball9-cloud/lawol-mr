import { describe, expect, it } from "vitest";

import {
  CONTACT_WHATSAPP,
  construireLienWhatsApp,
  lienContactWhatsApp,
} from "../../lib/contact";

/**
 * Le numéro support est une donnée publique mais sensible (CTA client) : il ne
 * doit exister qu'à UN endroit (`lib/contact.ts`) et ne jamais être inventé.
 * Ces tests verrouillent les trois propriétés : numéro renseigné et exploitable,
 * lien qui pointe bien dessus, et refus net de tout numéro invalide.
 */
describe("contact WhatsApp — source unique", () => {
  it("le numéro officiel est renseigné et dans les bornes (8 à 15 chiffres)", () => {
    expect(CONTACT_WHATSAPP).not.toBe("");
    expect(CONTACT_WHATSAPP).toMatch(/^\d{8,15}$/);
  });

  it("le lien de contact pointe exactement le numéro officiel", () => {
    expect(lienContactWhatsApp()).toBe(
      `https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(
        "Bonjour LAWOL, je veux recevoir les bourses qui matchent mon profil."
      )}`
    );
  });

  it("nettoie les séparateurs d'un numéro lisible (+222 48168149)", () => {
    expect(construireLienWhatsApp("+222 48168149")).toContain("wa.me/22248168149");
  });

  it("numéro vide → null (aucun CTA rendu, jamais de numéro inventé)", () => {
    expect(construireLienWhatsApp("")).toBeNull();
    expect(construireLienWhatsApp("   ")).toBeNull();
  });

  it("hors bornes → null (trop court, trop long)", () => {
    expect(construireLienWhatsApp("1234567")).toBeNull();
    expect(construireLienWhatsApp("1234567890123456")).toBeNull();
  });
});
