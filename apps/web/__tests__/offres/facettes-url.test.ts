import { describe, expect, it } from "vitest";

import {
  FACETTES_PAR_DEFAUT,
  MAX_RECHERCHE,
  cleFiltres,
  ecrireFacettes,
  lireFacettes,
  memeParametres,
  urlOffres,
} from "../../lib/offres-url";

/**
 * V2-04 — les facettes du catalogue vivent dans l'URL.
 *
 * Deux promesses, verrouillées ici :
 *   1. LECTURE tolérante : une URL bricolée à la main (`?pays=zzz`) ne casse
 *      jamais le catalogue — la valeur inconnue retombe sur le défaut.
 *   2. ÉCRITURE propre : un défaut n'apparaît JAMAIS dans l'URL, sinon un lien
 *      partagé traîne `tri=urgent&filiere=tous&page=1` et devient illisible.
 *
 * Le module est pur : aucun test n'a besoin de React ni de Next.
 */
const lire = (requete: string) => lireFacettes(new URLSearchParams(requete));

describe("lireFacettes — lecture tolérante", () => {
  it("une URL vide donne exactement le catalogue par défaut", () => {
    expect(lire("")).toEqual(FACETTES_PAR_DEFAUT);
  });

  it("lit un lien partageable complet (le cas WhatsApp)", () => {
    const f = lire("pays=allemagne&tri=recentes&filiere=informatique");
    expect(f.pays).toBe("allemagne");
    expect(f.tri).toBe("recentes");
    expect(f.filiere).toBe("informatique");
  });

  it("ignore une valeur inconnue au lieu de casser la page", () => {
    const f = lire("pays=zzz&tri=nimporte&filiere=inconnue&categorie=bidon");
    expect(f.pays).toBe("tous");
    expect(f.tri).toBe("urgent");
    expect(f.filiere).toBe("tous");
    expect(f.categorie).toBe("toutes");
  });

  it("lit les bascules et la pagination", () => {
    const f = lire("cloture30=1&expirees=true&page=3");
    expect(f.cloture30).toBe(true);
    expect(f.expirees).toBe(true);
    expect(f.page).toBe(3);
  });

  it("une page illisible ou négative retombe sur la première", () => {
    expect(lire("page=abc").page).toBe(1);
    expect(lire("page=-4").page).toBe(1);
    expect(lire("page=0").page).toBe(1);
  });

  it("nettoie et plafonne la recherche (même borne que l'API)", () => {
    expect(lire("recherche=%20%20bourse%20%20").recherche).toBe("bourse");
    expect(lire(`recherche=${"a".repeat(200)}`).recherche).toHaveLength(MAX_RECHERCHE);
  });

  it("accepte une catégorie de bourse réelle (lien de la carte d'accueil)", () => {
    expect(lire("categorie=gouvernementale").categorie).toBe("gouvernementale");
  });
});

describe("ecrireFacettes — URL propre", () => {
  it("n'écrit RIEN pour le catalogue par défaut", () => {
    expect(ecrireFacettes(FACETTES_PAR_DEFAUT).toString()).toBe("");
  });

  it("n'écrit que ce qui filtre vraiment", () => {
    const url = ecrireFacettes({ ...FACETTES_PAR_DEFAUT, pays: "france", tri: "recentes" });
    expect(url.toString()).toBe("pays=france&tri=recentes");
  });

  it("omet page=1 mais écrit les pages suivantes", () => {
    expect(ecrireFacettes({ ...FACETTES_PAR_DEFAUT, page: 1 }).toString()).toBe("");
    expect(ecrireFacettes({ ...FACETTES_PAR_DEFAUT, page: 2 }).toString()).toBe("page=2");
  });

  it("conserve les paramètres étrangers au catalogue sans les dupliquer", () => {
    const existantes = new URLSearchParams("utm_source=whatsapp&pays=france&page=4");
    const url = ecrireFacettes({ ...FACETTES_PAR_DEFAUT, pays: "allemagne" }, existantes);
    expect(url.get("utm_source")).toBe("whatsapp");
    expect(url.get("pays")).toBe("allemagne");
    expect(url.getAll("pays")).toHaveLength(1);
    expect(url.get("page")).toBeNull();
  });

  it("produit une URL courte et stable", () => {
    expect(urlOffres(FACETTES_PAR_DEFAUT)).toBe("/offres");
    expect(urlOffres({ ...FACETTES_PAR_DEFAUT, pays: "france" })).toBe("/offres?pays=france");
  });
});

describe("comparaisons — ce qui évite la boucle URL → état → URL", () => {
  it("deux URLs aux paramètres inversés décrivent le même état", () => {
    expect(
      memeParametres(new URLSearchParams("a=1&b=2"), new URLSearchParams("b=2&a=1"))
    ).toBe(true);
    expect(memeParametres(new URLSearchParams("a=1"), new URLSearchParams("a=2"))).toBe(false);
  });

  it("la frappe et la pagination ne créent pas d'entrée d'historique", () => {
    const base = { ...FACETTES_PAR_DEFAUT, pays: "france" };
    expect(cleFiltres({ ...base, recherche: "bourse" })).toBe(cleFiltres(base));
    expect(cleFiltres({ ...base, page: 3 })).toBe(cleFiltres(base));
    expect(cleFiltres({ ...base, pays: "canada" })).not.toBe(cleFiltres(base));
  });
});
