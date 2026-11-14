/**
 * Preuve d'affichage de l'indice d'origine (contrat 2.2, lot V4-D) sur les deux
 * ecrans :
 *  - CARTE : suffixe compact sur la ligne existante « pays · categorie », probe
 *    `offre-origine`. Interdit d'ajouter une hauteur : le probe doit vivre dans
 *    le MEME paragraphe que `offre-categorie`, et la carte garder ses 3 zones.
 *  - FICHE : fait `essentiel-origine`, rendu SEULEMENT si l'indice existe.
 * Le cas majoritaire est le silence : aucune sonde, aucun texte de remplacement.
 *
 * Aucun reseau : rendu pur.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { CarteOffre } from "@/components/offres/carte-offre";
import { FicheEssentiel } from "@/components/offres/essentiel";
import type { Offre } from "@/components/offres/types";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href?: string; children?: ReactNode }) => (
    <a href={typeof href === "string" ? href : "#"}>{children}</a>
  ),
}));

afterEach(cleanup);

const BASE: Offre = {
  id: "11111111-2222-3333-4444-555555555555",
  titre: "Bourse ESRC doctorat",
  entreprise: "WRDTP",
  pays_etudes: "royaume_uni",
  filieres_cibles: ["informatique"],
  type_offre: "bourse",
  type_financement: "fully_funded",
  description: "Bourse ouverte aux etudiants internationaux.",
  date_limite: "2027-01-20",
  categorie_bourse: "gouvernementale",
  active: true,
};

const sonde = (nom: string) => document.querySelector(`[data-probe="${nom}"]`);

describe("carte — indice d'origine (suffixe, sans hauteur ajoutee)", () => {
  it("affiche « compatible » quand l'indice est source", () => {
    render(
      <CarteOffre
        offre={{ ...BASE, origine_eligible: { indice: "compatible", preuve: "source" } }}
      />,
    );
    expect(sonde("offre-origine")).not.toBeNull();
    expect(sonde("offre-origine")?.textContent).toBe("compatible");
  });

  it("affiche « non compatible » quand l'indice est negatif", () => {
    render(
      <CarteOffre
        offre={{ ...BASE, origine_eligible: { indice: "incompatible", preuve: "texte" } }}
      />,
    );
    expect(sonde("offre-origine")?.textContent).toBe("non compatible");
  });

  it("reste muette quand l'API se tait", () => {
    render(<CarteOffre offre={{ ...BASE, origine_eligible: null }} />);
    expect(sonde("offre-origine")).toBeNull();
  });

  it("reste muette sur un indice sans preuve (jamais de remplacement)", () => {
    const { container } = render(
      <CarteOffre
        offre={
          {
            ...BASE,
            origine_eligible: { indice: "compatible" },
          } as unknown as Offre
        }
      />,
    );
    expect(sonde("offre-origine")).toBeNull();
    expect(container.textContent).not.toContain("non communiqu");
  });

  it("se pose dans le paragraphe existant « pays · categorie » (aucune ligne en plus)", () => {
    const { container } = render(
      <CarteOffre
        offre={{ ...BASE, origine_eligible: { indice: "compatible", preuve: "texte" } }}
      />,
    );
    const categorie = sonde("offre-categorie");
    const origine = sonde("offre-origine");
    expect(categorie).not.toBeNull();
    expect(origine).not.toBeNull();
    expect(origine?.parentElement).toBe(categorie?.parentElement);
    // 3 zones : identite / faits / echeance-CTA (cible verify-carte-compacte).
    expect(container.querySelectorAll("[data-zone]").length).toBe(3);
  });
});

describe("fiche — fait d'origine dans « L'essentiel »", () => {
  it("affiche le fait seulement quand l'indice existe", () => {
    render(
      <FicheEssentiel
        offre={{ ...BASE, origine_eligible: { indice: "incompatible", preuve: "source" } }}
      />,
    );
    expect(sonde("essentiel-origine")).not.toBeNull();
    expect(sonde("essentiel-origine")?.textContent).toBe("non compatible");
  });

  it("ne rend aucun fait quand l'API se tait", () => {
    render(<FicheEssentiel offre={{ ...BASE, origine_eligible: null }} />);
    expect(sonde("essentiel-origine")).toBeNull();
  });

  it("ne rend aucun fait sur un indice sans preuve", () => {
    render(
      <FicheEssentiel
        offre={
          {
            ...BASE,
            origine_eligible: { indice: "compatible" },
          } as unknown as Offre
        }
      />,
    );
    expect(sonde("essentiel-origine")).toBeNull();
  });
});
