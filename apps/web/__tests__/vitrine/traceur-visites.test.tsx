/**
 * Traceur de visites — compteur des pages PUBLIQUES (chantier admin).
 *
 * Le composant est monté dans `app/layout.tsx` : il envoie `POST /api/v1/visites`
 * avec le seul chemin courant. Preuves visées :
 *   1. une visite, une requête — avec le bon chemin et en POST JSON ;
 *   2. StrictMode (double effet en dev) ne double PAS le comptage ;
 *   3. `ADMIN`, `PROFIL` et `API` sont exclus : aucun appel ;
 *   4. un changement de vue (nouveau chemin) produit un nouvel envoi unique ;
 *   5. échec réseau → totalement silencieux (ni exception, ni message, ni console).
 *
 * Vie privée : le corps transmis ne contient QUE `{ chemin }` — le test le
 * vérifie explicitement (aucune IP, aucun user-agent, aucun identifiant).
 */
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { TraceurVisites, estPageComptable } from "@/components/vitrine/traceur-visites";

const etat = vi.hoisted(() => ({ chemin: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => etat.chemin,
}));

type Appel = { url: string; init: RequestInit | undefined };

let appels: Appel[];

function stubFetch(echec = false) {
  appels = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (echec) throw new Error("réseau coupé");
      appels.push({ url: String(url), init });
      return new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    })
  );
}

beforeEach(() => {
  etat.chemin = "/";
  stubFetch();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("TraceurVisites — page publique", () => {
  it("envoie une seule requête, en POST JSON, avec le seul chemin courant", async () => {
    etat.chemin = "/offres";
    render(<TraceurVisites />);

    await waitFor(() => expect(appels).toHaveLength(1));
    expect(appels[0].url).toBe("/api/v1/visites");
    expect(appels[0].init?.method).toBe("POST");
    expect(appels[0].init?.body).toBe(JSON.stringify({ chemin: "/offres" }));
    // Vie privée : RIEN d'autre que le chemin dans le corps.
    expect(JSON.parse(String(appels[0].init?.body))).toEqual({ chemin: "/offres" });
  });

  it("StrictMode (effet joué deux fois en dev) ne double pas le comptage", async () => {
    etat.chemin = "/";
    render(
      <StrictMode>
        <TraceurVisites />
      </StrictMode>
    );

    await waitFor(() => expect(appels.length).toBeGreaterThanOrEqual(1));
    // Laisse le second effet s'exécuter, puis vérifie qu'aucune 2e requête n'est partie.
    await new Promise((r) => setTimeout(r, 0));
    expect(appels).toHaveLength(1);
  });

  it("ne rend RIEN dans le DOM (aucun style, aucun texte)", () => {
    const { container } = render(<TraceurVisites />);
    expect(container.firstChild).toBeNull();
  });
});

describe("TraceurVisites — exclusions", () => {
  it.each([
    ["/admin"],
    ["/admin/statistiques"],
    ["/admin/parametres"],
    ["/admin-login"],
    ["/profil/2221234567"],
    ["/profil/2221234567/documents"],
    ["/api/v1/visites"],
  ])("ne compte jamais %s", async (chemin) => {
    etat.chemin = chemin;
    render(<TraceurVisites />);
    await new Promise((r) => setTimeout(r, 0));
    expect(appels).toHaveLength(0);
  });

  it("estPageComptable : vrai pour le public, faux pour admin/profil/api", () => {
    expect(estPageComptable("/")).toBe(true);
    expect(estPageComptable("/offres")).toBe(true);
    expect(estPageComptable("/offres/42")).toBe(true);
    expect(estPageComptable("/admin")).toBe(false);
    expect(estPageComptable("/admin/statistiques")).toBe(false);
    expect(estPageComptable("/profil/2221234567")).toBe(false);
    expect(estPageComptable("/api/v1/visites")).toBe(false);
  });
});

describe("TraceurVisites — changement de vue", () => {
  it("un nouveau chemin déclenche un nouvel envoi unique", async () => {
    etat.chemin = "/";
    const { rerender } = render(<TraceurVisites />);
    await waitFor(() => expect(appels).toHaveLength(1));

    etat.chemin = "/offres";
    rerender(<TraceurVisites />);

    await waitFor(() => expect(appels).toHaveLength(2));
    expect(appels[1].init?.body).toBe(JSON.stringify({ chemin: "/offres" }));
  });
});

describe("TraceurVisites — échec silencieux", () => {
  it("panne réseau : ni exception, ni message, ni erreur console", async () => {
    stubFetch(true);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    etat.chemin = "/offres";
    expect(() => render(<TraceurVisites />)).not.toThrow();

    await new Promise((r) => setTimeout(r, 0));
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
