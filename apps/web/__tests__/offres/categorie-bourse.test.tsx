/**
 * Catégorie de bourse — affichage honnête + filtre SERVEUR (20/10/2026).
 *
 * Preuves visées :
 *   1. la carte affiche un badge lisible pour une catégorie connue ;
 *   2. `inconnu` (et l'absence de valeur) n'affiche RIEN — jamais « Inconnu » ;
 *   3. la fiche (modale) suit la même règle ;
 *   4. le select « Catégorie » envoie `?categorie=` à l'API (pas un filtrage
 *      local) et conserve l'axe catalogue `type_offre=bourse` ;
 *   5. le lien de l'accueil `?categorie=gouvernementale` filtre dès le premier
 *      chargement ;
 *   6. la carte « Bourse gouvernementale » de l'accueil n'existe QUE si le
 *      comptage réel `/api/v1/offres/categories` est > 0 (zéro mensonge).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CarteOffre } from "@/components/offres/carte-offre";
import { OffreDetailModal } from "@/components/offre-detail-modal";
import { TypesBourses } from "@/components/landing/types-bourses";
import type { Offre } from "@/components/offres/types";

const etat = vi.hoisted(() => ({ recherche: "" }));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href?: string; children?: ReactNode }) => (
    <a href={typeof href === "string" ? href : "#"}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(etat.recherche),
}));

// Le chrome global (header/footer/session) n'est pas le sujet de ces preuves.
vi.mock("@/components/chrome/chrome", () => ({
  Chrome: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

const BASE: Offre = {
  id: "11111111-2222-3333-4444-555555555555",
  titre: "Bourse gouvernementale Chevening",
  entreprise: "FCDO",
  pays_etudes: "royaume_uni",
  filieres_cibles: ["informatique"],
  type_offre: "bourse",
  type_financement: "fully_funded",
  description: "",
  date_limite: "2027-01-20",
  active: true,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ carte */

describe("carte — badge catégorie de bourse", () => {
  it("catégorie connue → badge lisible affiché", () => {
    render(<CarteOffre offre={{ ...BASE, categorie_bourse: "gouvernementale" }} />);
    const badge = document.querySelector('[data-probe="offre-categorie"]');
    expect(badge).not.toBeNull();
    expect(badge).toHaveTextContent("Gouvernementale");
  });

  it("chaque catégorie filtrable a son libellé FR", () => {
    const cas: [string, string][] = [
      ["institutionnelle", "Institutionnelle"],
      ["fondation", "Fondation"],
      ["entreprise", "Entreprise"],
    ];
    for (const [valeur, label] of cas) {
      const { container, unmount } = render(
        <CarteOffre offre={{ ...BASE, categorie_bourse: valeur }} />
      );
      expect(container.querySelector('[data-probe="offre-categorie"]')).toHaveTextContent(label);
      unmount();
    }
  });

  it("inconnu ou absent → aucun badge (jamais « Inconnu »)", () => {
    const { container, unmount } = render(
      <CarteOffre offre={{ ...BASE, categorie_bourse: "inconnu" }} />
    );
    expect(container.querySelector('[data-probe="offre-categorie"]')).toBeNull();
    expect(container.textContent).not.toMatch(/inconnu/i);
    unmount();

    const { container: sansValeur } = render(<CarteOffre offre={BASE} />);
    expect(sansValeur.querySelector('[data-probe="offre-categorie"]')).toBeNull();
  });
});

/* ------------------------------------------------------------------- fiche */

describe("fiche — badge catégorie de bourse", () => {
  const props = {
    postule: false,
    statut: null,
    enCours: false,
    onPostuler: () => {},
    onStatut: () => {},
    onFermer: () => {},
  };

  it("catégorie connue → badge sur la fiche", () => {
    render(
      <OffreDetailModal
        offre={{
          id: BASE.id,
          titre: BASE.titre,
          entreprise: BASE.entreprise,
          ville: "Nouakchott",
          type_offre: "bourse",
          date_limite: "2027-01-20",
          description: "",
          categorie_bourse: "fondation",
        }}
        {...props}
      />
    );
    expect(document.querySelector('[data-probe="fiche-categorie"]')).toHaveTextContent("Fondation");
  });

  it("inconnu → aucun badge sur la fiche", () => {
    render(
      <OffreDetailModal
        offre={{
          id: BASE.id,
          titre: BASE.titre,
          entreprise: BASE.entreprise,
          ville: "Nouakchott",
          type_offre: "bourse",
          date_limite: "2027-01-20",
          description: "",
          categorie_bourse: "inconnu",
        }}
        {...props}
      />
    );
    expect(document.querySelector('[data-probe="fiche-categorie"]')).toBeNull();
  });
});

/* ----------------------------------------------------- filtre côté serveur */

function stubOffres() {
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request) => {
      urls.push(String(url));
      return new Response(JSON.stringify([{ ...BASE, categorie_bourse: "gouvernementale" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    })
  );
  return urls;
}

describe("/offres — catégorie filtrée par le serveur", () => {
  it("changer le select envoie ?categorie= à l'API, sans perdre type_offre=bourse", async () => {
    etat.recherche = "";
    const urls = stubOffres();
    const { default: OffresPage } = await import("@/app/offres/page");

    render(<OffresPage />);
    const select = await screen.findByLabelText("Filtrer par catégorie de bourse");
    // Aucune catégorie au départ : l'API ne reçoit pas de `categorie`.
    expect(urls.every((u) => !u.includes("categorie="))).toBe(true);

    fireEvent.change(select, { target: { value: "entreprise" } });

    await waitFor(() =>
      expect(urls.some((u) => u.includes("categorie=entreprise"))).toBe(true)
    );
    const dernier = urls[urls.length - 1];
    expect(dernier).toContain("type_offre=bourse");
    expect(dernier).toContain("tri=urgent");
  });

  it("le lien de l'accueil (?categorie=gouvernementale) filtre dès le 1er chargement", async () => {
    etat.recherche = "categorie=gouvernementale";
    const urls = stubOffres();
    const { default: OffresPage } = await import("@/app/offres/page");

    render(<OffresPage />);
    const select = await screen.findByLabelText("Filtrer par catégorie de bourse");
    expect((select as HTMLSelectElement).value).toBe("gouvernementale");
    expect(urls[0]).toContain("categorie=gouvernementale");
    expect(urls[0]).toContain("type_offre=bourse");
  });

  it("une valeur d'URL inconnue retombe sur « toutes » (aucun filtre inventé)", async () => {
    etat.recherche = "categorie=mytho";
    const urls = stubOffres();
    const { default: OffresPage } = await import("@/app/offres/page");

    render(<OffresPage />);
    const select = await screen.findByLabelText("Filtrer par catégorie de bourse");
    expect((select as HTMLSelectElement).value).toBe("toutes");
    expect(urls.every((u) => !u.includes("categorie="))).toBe(true);
  });
});

/* ------------------------------------------------- accueil : zéro mensonge */

function stubCategories(corps: unknown, statut = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: statut >= 200 && statut < 300,
      status: statut,
      json: async () => corps,
    })) as unknown as typeof fetch
  );
}

/** Un montage = un relevé : le cache module a été retiré (pas d'état partagé). */
function monterTypesBourses() {
  return render(<TypesBourses />);
}

describe("accueil — carte « Bourse gouvernementale » conditionnée au comptage réel", () => {
  it("comptage 0 → la carte n'est pas rendue", async () => {
    stubCategories({ gouvernementale: 0, institutionnelle: 12, fondation: 3, entreprise: 1 });
    const { container } = monterTypesBourses();
    await waitFor(() =>
      expect(container.querySelectorAll("h3").length).toBe(3)
    );
    expect(screen.queryByText("Bourse gouvernementale")).toBeNull();
    expect(container.querySelector('[data-probe="type-bourse-gouvernementale"]')).toBeNull();
  });

  it("comptage indisponible (502) → la carte n'est pas rendue", async () => {
    stubCategories({ error: "API inaccessible" }, 502);
    const { container } = monterTypesBourses();
    await waitFor(() => expect(container.querySelectorAll("h3").length).toBe(3));
    expect(screen.queryByText("Bourse gouvernementale")).toBeNull();
  });

  it("comptage > 0 → la carte apparaît et mène à /offres?categorie=gouvernementale", async () => {
    stubCategories({ gouvernementale: 4, institutionnelle: 12, fondation: 3, entreprise: 1 });
    monterTypesBourses();
    const carte = await screen.findByRole("link", { name: /Bourse gouvernementale/i });
    expect(carte).toHaveAttribute("href", "/offres?categorie=gouvernementale");
    expect(carte).toHaveTextContent("Offertes par des gouvernements étrangers");
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(4);
  });
});
