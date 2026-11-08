import { describe, expect, it } from "vitest";

import { parametresRequete } from "../../lib/offres-chargement";
import type { RequeteCatalogue } from "../../lib/offres-chargement";

/**
 * V5-A — `financement` et `cloture30` sont désormais servis par
 * `GET /api/v1/offres` : le front doit les transmettre, et n'envoyer AUCUN
 * paramètre quand le filtre est au défaut (« tous » / inactif).
 */
const BASE: RequeteCatalogue = {
  tri: "urgent",
  q: "",
  categorie: "toutes",
  filiere: "tous",
  pays: "tous",
  financement: "tous",
  cloture30: false,
};

const parametres = (patch: Partial<RequeteCatalogue>) =>
  parametresRequete({ ...BASE, ...patch });

describe("parametresRequete — financement et cloture30 côté serveur", () => {
  it("transmet financement seul", () => {
    const p = parametres({ financement: "fully_funded" });
    expect(p.get("financement")).toBe("fully_funded");
    expect(p.has("cloture30")).toBe(false);
  });

  it("transmet cloture30 seul", () => {
    const p = parametres({ cloture30: true });
    expect(p.get("cloture30")).toBe("1");
    expect(p.has("financement")).toBe(false);
  });

  it("transmet les deux filtres ensemble", () => {
    const p = parametres({ financement: "partiel", cloture30: true });
    expect(p.get("financement")).toBe("partiel");
    expect(p.get("cloture30")).toBe("1");
  });

  it("n'écrit aucun paramètre quand les deux filtres sont au défaut", () => {
    const p = parametres({});
    expect(p.has("financement")).toBe(false);
    expect(p.has("cloture30")).toBe(false);
    // Les invariants du catalogue restent écrits.
    expect(p.get("tri")).toBe("urgent");
    expect(p.get("type_offre")).toBe("bourse");
  });
});
