/**
 * Preuve du « calendrier de selection » - contrat
 * `docs/contrat-metadata-offres.md` 2.3, lot V4-E.
 *
 * Deux couches, une seule regle : le silence est le cas majoritaire.
 *  - LIB (`lib/calendrier.ts`) : `calendrierAffichable` ne rend une liste que
 *    si >= 2 etapes datees, valides, sans doublon et strictement croissantes.
 *  - FICHE (`components/offres/calendrier.tsx`) : aucune sonde, aucun texte de
 *    remplacement des que la garde tombe.
 *
 * Aucun reseau : rendu pur.
 */
import { afterEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import {
  calendrierAffichable,
  formaterDateEtape,
  libelleEtape,
} from "@/lib/calendrier";
import { BlocCalendrier } from "@/components/offres/calendrier";

afterEach(cleanup);

const sonde = (nom: string) => document.querySelector(`[data-probe="${nom}"]`);

const DEUX_ETAPES = [
  { etape: "candidature", date: "2027-01-15" },
  { etape: "resultat", date: "2027-04-30" },
];

describe("lib — garde d'affichage (contrat 2.3)", () => {
  it("accepte deux etapes datees et les rend dans l'ordre", () => {
    expect(calendrierAffichable(DEUX_ETAPES)).toEqual(DEUX_ETAPES);
  });

  it("accepte trois etapes (ordre metier libre tant que les dates montent)", () => {
    const trois = [
      { etape: "candidature", date: "2027-01-15" },
      { etape: "entretien", date: "2027-02-20" },
      { etape: "resultat", date: "2027-04-30" },
    ];
    expect(calendrierAffichable(trois)).toEqual(trois);
  });

  it("reste muet sur une cle absente (null / undefined)", () => {
    expect(calendrierAffichable(null)).toBeNull();
    expect(calendrierAffichable(undefined)).toBeNull();
  });

  it("reste muet sur une liste vide ou une seule etape", () => {
    expect(calendrierAffichable([])).toBeNull();
    expect(calendrierAffichable([DEUX_ETAPES[0]])).toBeNull();
  });

  it("reste muet sur une date mal formee (relative, FR, non calendaire)", () => {
    expect(
      calendrierAffichable([
        { etape: "candidature", date: "debut janvier" },
        { etape: "resultat", date: "2027-04-30" },
      ]),
    ).toBeNull();
    expect(
      calendrierAffichable([
        { etape: "candidature", date: "15/01/2027" },
        { etape: "resultat", date: "2027-04-30" },
      ]),
    ).toBeNull();
    expect(
      calendrierAffichable([
        { etape: "candidature", date: "2027-02-30" },
        { etape: "resultat", date: "2027-04-30" },
      ]),
    ).toBeNull();
    expect(
      calendrierAffichable([
        { etape: "candidature", date: 20270115 },
        { etape: "resultat", date: "2027-04-30" },
      ]),
    ).toBeNull();
  });

  it("reste muet sur un ordre incoherent (le parcours remonte le temps)", () => {
    expect(
      calendrierAffichable([
        { etape: "candidature", date: "2027-05-01" },
        { etape: "resultat", date: "2027-01-10" },
      ]),
    ).toBeNull();
  });

  it("reste muet sur des dates egales (pas de jalons distincts)", () => {
    expect(
      calendrierAffichable([
        { etape: "candidature", date: "2027-01-15" },
        { etape: "resultat", date: "2027-01-15" },
      ]),
    ).toBeNull();
  });

  it("reste muet sur une etape hors contrat ou un doublon d'etape", () => {
    expect(
      calendrierAffichable([
        { etape: "inscription", date: "2027-01-15" },
        { etape: "resultat", date: "2027-04-30" },
      ]),
    ).toBeNull();
    expect(
      calendrierAffichable([
        { etape: "candidature", date: "2027-01-15" },
        { etape: "candidature", date: "2027-04-30" },
      ]),
    ).toBeNull();
  });

  it("reste muet sur une entree non-objet", () => {
    expect(calendrierAffichable(["2027-01-15", "2027-04-30"])).toBeNull();
  });

  it("nomme les etapes et les dates en francais, sans invention", () => {
    expect(libelleEtape("candidature")).toBe("Candidature");
    expect(libelleEtape("preselection")).toBe("Présélection");
    expect(libelleEtape("entretien")).toBe("Entretien");
    expect(libelleEtape("resultat")).toBe("Résultat");
    expect(formaterDateEtape("2027-01-15")).toBe("15 janvier 2027");
    expect(formaterDateEtape("inconnue")).toBe("inconnue");
  });
});

describe("fiche — bloc calendrier", () => {
  it("affiche deux jalons quand le calendrier est valide", () => {
    render(createElement(BlocCalendrier, { calendrier: DEUX_ETAPES }));
    expect(sonde("detail-calendrier")).not.toBeNull();
    const etapes = document.querySelectorAll('[data-probe="calendrier-etape"]');
    expect(etapes).toHaveLength(2);
    expect(etapes[0]?.textContent).toContain("Candidature");
    expect(etapes[0]?.textContent).toContain("15 janvier 2027");
    expect(etapes[1]?.textContent).toContain("Résultat");
    expect(etapes[1]?.textContent).toContain("30 avril 2027");
  });

  it("reste totalement muet sans calendrier (0 etape)", () => {
    const { container } = render(
      createElement(BlocCalendrier, { calendrier: null }),
    );
    expect(sonde("detail-calendrier")).toBeNull();
    expect(container.textContent).not.toContain("Calendrier");
  });

  it("reste muet sur une seule etape", () => {
    const { container } = render(
      createElement(BlocCalendrier, { calendrier: [DEUX_ETAPES[0]] }),
    );
    expect(sonde("detail-calendrier")).toBeNull();
    expect(container.textContent).not.toContain("inconnu");
  });

  it("reste muet sur une date mal formee", () => {
    render(
      createElement(BlocCalendrier, {
        calendrier: [
          { etape: "candidature", date: "2027-13-01" },
          { etape: "resultat", date: "2027-04-30" },
        ],
      }),
    );
    expect(sonde("detail-calendrier")).toBeNull();
  });

  it("reste muet sur un ordre incoherent", () => {
    render(
      createElement(BlocCalendrier, {
        calendrier: [
          { etape: "candidature", date: "2027-06-01" },
          { etape: "resultat", date: "2027-02-01" },
        ],
      }),
    );
    expect(sonde("detail-calendrier")).toBeNull();
  });
});
