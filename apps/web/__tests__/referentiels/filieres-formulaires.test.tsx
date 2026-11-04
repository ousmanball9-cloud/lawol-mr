/**
 * Preuve « 35 filières partout » (décision produit du 04/11/2026).
 *
 * Le référentiel unique `lib/referentiels.ts` porte les 35 valeurs de l'enum
 * backend. Jusqu'ici les DEUX formulaires n'en proposaient que 10 (curation
 * historique) : un étudiant en cybersécurité, en urbanisme ou en génie des
 * procédés devait choisir « Autre ». Ces tests figent le contraire : le
 * référentiel ET les deux formulaires exposent les 35 valeurs.
 *
 * Aucun réseau : `fetch` est neutralisé (la page profil reste fonctionnelle en
 * état « erreur de chargement », le <select> est rendu avant les données).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useParams: () => ({ telephone: "22240000001" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

import { FILIERES } from "@/lib/referentiels";
import EditProfilPage from "@/app/profil/[telephone]/edit/page";
import { OffreForm } from "@/components/admin/offre-form";

/** Valeurs qui n'étaient PAS proposées par la curation à 10 options. */
const FILIERES_HORS_CURATION = [
  "genie_procedes",
  "environnement",
  "genie_chimique",
  "genie_industriel",
  "telecoms",
  "reseaux",
  "cybersecurite",
  "data_science",
  "intelligence_artificielle",
  "mathematiques",
  "physique",
  "chimie",
  "biologie",
  "geologie",
  "hydraulique",
  "topographie",
  "architecture",
  "urbanisme",
  "sciences_politiques",
  "sociologie",
  "psychologie",
  "langues",
  "lettres",
  "histoire",
  "geographie",
];

beforeEach(() => {
  // La page profil appelle GET /api/v1/profils/{tel} : on simule un échec propre,
  // ce qui rend le formulaire (loading → false) sans dépendre du réseau.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }))
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("référentiel unique des filières", () => {
  it("porte les 35 valeurs de l'enum, sans doublon", () => {
    expect(FILIERES).toHaveLength(35);
    expect(new Set(FILIERES.map((f) => f.valeur)).size).toBe(35);
    for (const valeur of FILIERES_HORS_CURATION) {
      expect(FILIERES.some((f) => f.valeur === valeur)).toBe(true);
    }
  });
});

describe("formulaire de profil (/profil/[tel]/edit)", () => {
  it("propose les 35 filières, pas la sélection courte de 10", async () => {
    render(<EditProfilPage />);

    const select = await screen.findByLabelText(/Filière/i);
    // 35 valeurs + l'option vide « -- Sélectionne ta filière -- ».
    const options = within(select as HTMLElement).getAllByRole("option");
    expect(options).toHaveLength(FILIERES.length + 1);

    const valeurs = options.map((o) => (o as HTMLOptionElement).value).filter(Boolean);
    expect(valeurs).toEqual(FILIERES.map((f) => f.valeur));
    // Le libellé affiché vient du référentiel (une seule vérité de texte).
    expect(options.some((o) => o.textContent === "Génie des procédés")).toBe(true);
    expect(options.some((o) => o.textContent === "Cybersécurité")).toBe(true);
  });
});

describe("formulaire admin de création d'offre", () => {
  it("propose les 35 filières cibles (aucune = toutes)", () => {
    render(<OffreForm onCreated={() => {}} />);

    const legend = screen.getByText(/Filières cibles/i);
    const fieldset = legend.closest("fieldset");
    expect(fieldset).not.toBeNull();

    const cases = within(fieldset as HTMLElement).getAllByRole("checkbox");
    expect(cases).toHaveLength(FILIERES.length);
  });
});
