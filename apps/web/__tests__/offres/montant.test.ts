import { describe, expect, it } from "vitest";
import { formaterMontant, montantAffichable } from "@/lib/montant";

/**
 * Contrat `docs/contrat-metadata-offres.md` §2.1 : l'écran n'affiche un montant
 * que si la valeur est certaine. Ces tests fixent la règle de SILENCE — c'est
 * elle qui protège du « 0 € » et du « par an » inventé.
 */
describe("formaterMontant", () => {
  it("écrit un montant mensuel avec sa périodicité", () => {
    expect(formaterMontant({ valeur: 1400, devise: "EUR", periode: "mois" })).toBe(
      "1\u202f400 € / mois",
    );
  });

  it("écrit un montant annuel avec sa périodicité", () => {
    expect(formaterMontant({ valeur: 21805, devise: "GBP", periode: "an" })).toBe(
      "21\u202f805 £ / an",
    );
  });

  it("n'ajoute AUCUN qualificatif quand la périodicité n'est pas publiée", () => {
    expect(formaterMontant({ valeur: 36000, devise: "EUR", periode: "total" })).toBe(
      "36\u202f000 €",
    );
  });

  it("gère une devise sans symbole connu (code affiché tel quel)", () => {
    expect(formaterMontant({ valeur: 35468, devise: "NZD", periode: "an" })).toBe(
      "35\u202f468 NZ$ / an",
    );
    expect(formaterMontant({ valeur: 1000, devise: "CHF", periode: "total" })).toBe(
      "1\u202f000 CHF",
    );
  });

  it("renvoie null plutôt qu'un montant faux", () => {
    expect(formaterMontant(null)).toBeNull();
    expect(formaterMontant(undefined)).toBeNull();
    expect(formaterMontant({ valeur: 0, devise: "EUR", periode: "mois" })).toBeNull();
    expect(formaterMontant({ valeur: -5, devise: "EUR", periode: "mois" })).toBeNull();
    expect(formaterMontant({ valeur: Number.NaN, devise: "EUR", periode: "mois" })).toBeNull();
    // Devise non ISO ou période hors contrat : aucune invention d'affichage.
    expect(formaterMontant({ valeur: 500, devise: "euros", periode: "mois" })).toBeNull();
    expect(
      formaterMontant({
        valeur: 500,
        devise: "EUR",
        periode: "semaine" as unknown as "mois",
      }),
    ).toBeNull();
  });

  it("montantAffichable suit exactement la même règle", () => {
    expect(montantAffichable({ valeur: 500, devise: "USD", periode: "total" })).toBe(true);
    expect(montantAffichable(null)).toBe(false);
    expect(montantAffichable({ valeur: 0, devise: "USD", periode: "total" })).toBe(false);
  });
});
