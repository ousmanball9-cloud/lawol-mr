/**
 * Preuve de la CARTE du catalogue face au contrat de la liste (16/10/2026) :
 * `GET /api/v1/offres` ne transporte plus la description intégrale mais un
 * APERÇU (`description_apercu`), `description` restant vide. La carte doit
 * afficher l'aperçu dans les deux cas — y compris quand elle reçoit une offre
 * complète (détail, similaires) — sans jamais finir muette.
 *
 * Aucun réseau : la carte est un simple rendu.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { CarteOffre } from "@/components/offres/carte-offre";
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
  description: "",
  date_limite: "2027-01-20",
  active: true,
};

describe("carte du catalogue — description vs aperçu (contrat de liste)", () => {
  it("payload de LISTE (description vide + aperçu) → l'aperçu est affiché", () => {
    render(
      <CarteOffre
        offre={{ ...BASE, description: "", description_apercu: "Bourse couvrant frais et allocation…" }}
      />
    );
    expect(screen.getByText(/Bourse couvrant frais et allocation/)).toBeTruthy();
  });

  it("offre COMPLÈTE (détail, similaires : pas d'aperçu) → la description est affichée", () => {
    render(<CarteOffre offre={{ ...BASE, description: "Texte intégral de la fiche." }} />);
    expect(screen.getByText(/Texte intégral de la fiche/)).toBeTruthy();
  });

  it("les deux présents → l'aperçu prime (fidélité au contrat de liste)", () => {
    render(
      <CarteOffre
        offre={{ ...BASE, description: "Texte intégral.", description_apercu: "Aperçu court…" }}
      />
    );
    expect(screen.getByText(/Aperçu court/)).toBeTruthy();
    expect(screen.queryByText(/Texte intégral/)).toBeNull();
  });

  it("aucun texte disponible → aucun paragraphe d'aperçu (jamais de vide affiché)", () => {
    const { container } = render(<CarteOffre offre={BASE} />);
    expect(container.querySelectorAll("p").length).toBeGreaterThan(0); // lieu · date
    expect(container.textContent).not.toContain("null");
    expect(container.textContent).not.toContain("undefined");
  });

  it("la carte reste un LIEN vers la fiche (aucune modale dans le catalogue)", () => {
    render(<CarteOffre offre={BASE} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", `/offres/${BASE.id}`);
  });

  it("l'échéance reste affichée (non-régression du badge)", () => {
    render(<CarteOffre offre={{ ...BASE, date_limite: "2027-01-20" }} />);
    expect(document.querySelector('[data-probe="offre-echeance"]')).not.toBeNull();
  });
});
