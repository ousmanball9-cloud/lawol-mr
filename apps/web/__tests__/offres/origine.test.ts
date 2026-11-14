import { describe, expect, it } from "vitest";
import { libelleOrigine, origineAffichable } from "@/lib/origine";

/**
 * Contrat `docs/contrat-metadata-offres.md` 2.2 : l'indice d'eligibilite par
 * origine n'est affichable que si `indice` vaut compatible/incompatible ET que
 * `preuve` est presente. Ces tests fixent la regle de SILENCE : `inconnu`, une
 * preuve manquante ou une valeur hors contrat ne produisent aucun libelle.
 * Aucun ecran ne doit deduire une eligibilite depuis `pays_etudes`.
 */
describe("libelleOrigine", () => {
  it("ecrit l'indice compatible, preuve par le texte", () => {
    expect(libelleOrigine({ indice: "compatible", preuve: "texte" })).toBe("compatible");
  });

  it("ecrit l'indice compatible, preuve par la source", () => {
    expect(libelleOrigine({ indice: "compatible", preuve: "source" })).toBe("compatible");
  });

  it("ecrit l'indice incompatible en negatif compact", () => {
    expect(libelleOrigine({ indice: "incompatible", preuve: "texte" })).toBe("non compatible");
    expect(libelleOrigine({ indice: "incompatible", preuve: "source" })).toBe("non compatible");
  });

  it("renvoie null quand l'API se tait (null / undefined)", () => {
    expect(libelleOrigine(null)).toBeNull();
    expect(libelleOrigine(undefined)).toBeNull();
  });

  it("renvoie null sur un indice hors contrat (inconnu inclus)", () => {
    expect(
      libelleOrigine({ indice: "inconnu", preuve: "texte" } as unknown as {
        indice: "compatible";
        preuve: "texte";
      }),
    ).toBeNull();
    expect(
      libelleOrigine({ indice: "probable", preuve: "texte" } as unknown as {
        indice: "compatible";
        preuve: "texte";
      }),
    ).toBeNull();
  });

  it("renvoie null sans preuve : un indice sans provenance n'est pas affichable", () => {
    expect(
      libelleOrigine({ indice: "compatible", preuve: "" } as unknown as {
        indice: "compatible";
        preuve: "texte";
      }),
    ).toBeNull();
    expect(
      libelleOrigine({ indice: "compatible" } as unknown as {
        indice: "compatible";
        preuve: "texte";
      }),
    ).toBeNull();
    expect(
      libelleOrigine({ indice: "compatible", preuve: "deduction" } as unknown as {
        indice: "compatible";
        preuve: "texte";
      }),
    ).toBeNull();
  });

  it("origineAffichable suit exactement la meme regle", () => {
    expect(origineAffichable({ indice: "incompatible", preuve: "source" })).toBe(true);
    expect(origineAffichable(null)).toBe(false);
    expect(origineAffichable(undefined)).toBe(false);
    expect(
      origineAffichable({ indice: "compatible" } as unknown as {
        indice: "compatible";
        preuve: "texte";
      }),
    ).toBe(false);
  });
});
