/**
 * Preuve du « dossier de décision » de la fiche bourse `/offres/[id]` :
 *
 *  1. FINANCEMENT — libellé honnête : `inconnu` (et toute valeur legacy) →
 *     « Financement non précisé », sans jamais inventer montant ni taux ;
 *  2. DOSSIER — pièces USUELLES présentées comme génériques + lien coffre-fort ;
 *  3. SUIVI — connecté avec un match : statut courant + « J'ai postulé » +
 *     changement de statut via les proxys EXISTANTS ; connecté sans match ;
 *     non connecté → invitation à se connecter, zéro appel réseau.
 *
 * Aucun réseau : `fetch` est mocké, le cookie de session est posé à la main.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BlocFinancement, labelFinancementHonteux } from "@/components/offres/financement";
import { DossierPieces } from "@/components/offres/dossier-pieces";
import { SuiviCandidature, libelleStatut } from "@/components/offres/suivi-candidature";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href?: string; children?: ReactNode }) => (
    <a href={typeof href === "string" ? href : "#"}>{children}</a>
  ),
}));

const TEL = "2221234567";
const OFFRE_ID = "11111111-2222-3333-4444-555555555555";

/** Token de session factice, bien formé et non expiré (l'API revérifie la signature). */
function jeton(tel = TEL, expDansSecondes = 3600): string {
  const payload = Buffer.from(
    JSON.stringify({ tel, exp: Math.floor(Date.now() / 1000) + expDansSecondes })
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${payload}.signature-factice`;
}

function connecter(tel = TEL) {
  document.cookie = `lawol_token=${jeton(tel)}; path=/`;
}

type Appel = { url: string; methode: string | undefined };

let appels: Appel[] = [];

/** `fetch` mocké : historique + mutations des proxys, tout en mémoire. */
function mockerFetch(options: { historique?: unknown; historiqueStatut?: number } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      appels.push({ url: u, methode: init?.method });
      if (u.includes("/historique")) {
        const statut = options.historiqueStatut ?? 200;
        return new Response(statut === 200 ? JSON.stringify(options.historique ?? []) : "{}", {
          status: statut,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    })
  );
}

function probe(nom: string): Element | null {
  return document.querySelector(`[data-probe="${nom}"]`);
}

beforeEach(() => {
  appels = [];
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.cookie = "lawol_token=; path=/; max-age=0";
});

describe("financement — libellé honnête, jamais de montant ni de taux", () => {
  it("inconnu → « Financement non précisé », sans montant ni pourcentage", () => {
    const { container } = render(<BlocFinancement typeFinancement="inconnu" />);
    const bloc = container.querySelector('[data-probe="detail-financement"]');
    expect(bloc).not.toBeNull();
    expect(bloc?.textContent).toContain("Financement non précisé");
    expect(bloc?.textContent).not.toMatch(/\d+\s?%/); // aucun taux
    expect(bloc?.textContent).not.toMatch(/[€$£]/); // aucun montant
    expect(bloc?.textContent).not.toMatch(/\b(EUR|USD|MRU|MRO)\b/);
  });

  it.each([
    ["fully_funded", "100% financée (fully funded)"],
    ["partiel", "Partiellement financée"],
    ["auto_finance", "Auto-financée"],
  ])("valeur renseignée %s → %s", (valeur, libelle) => {
    expect(labelFinancementHonteux(valeur)).toBe(libelle);
    const { container } = render(<BlocFinancement typeFinancement={valeur} />);
    expect(
      container.querySelector('[data-probe="detail-financement-valeur"]')?.textContent
    ).toBe(libelle);
  });

  it.each(["bizarre", "", null, undefined])(
    "valeur hors enum (%s) → « Financement non précisé »",
    (valeur) => {
      expect(labelFinancementHonteux(valeur)).toBe("Financement non précisé");
    }
  );
});

describe("dossier — pièces usuelles génériques + coffre-fort", () => {
  it("présente une liste générique (jamais « exigé pour cette bourse ») et vise /connexion sans session", async () => {
    const { container } = render(<DossierPieces />);
    const bloc = container.querySelector('[data-probe="detail-dossier"]');
    expect(bloc?.textContent).toContain("Liste générique");
    expect(bloc?.textContent).toContain("vérifie toujours l'annonce officielle");
    expect(container.querySelectorAll('[data-probe="detail-piece"]').length).toBeGreaterThanOrEqual(
      5
    );
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /coffre-fort/i })).toHaveAttribute(
        "href",
        "/connexion"
      )
    );
  });

  it("connecté → lien vers le coffre-fort de l'espace personnel", async () => {
    connecter();
    render(<DossierPieces />);
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /coffre-fort/i })).toHaveAttribute(
        "href",
        `/profil/${TEL}/documents`
      )
    );
  });
});

describe("suivi de candidature — chemin connecté (fetch mocké)", () => {
  it("match trouvé → statut affiché, « J'ai postulé » puis le select appellent les BONS proxys", async () => {
    connecter();
    mockerFetch({
      historique: [
        { id: "m-1", postule: false, statut_candidature: "a_preparer", offre: { id: OFFRE_ID } },
      ],
    });

    render(<SuiviCandidature offreId={OFFRE_ID} />);

    // 1. l'état connecté est résolu depuis le proxy historique EXISTANT
    await waitFor(() => expect(probe("detail-suivi-statut")?.textContent).toBe("À préparer"));
    expect(appels[0]?.url).toContain(`/api/v1/profils/${TEL}/historique`);

    // 2. « J'ai postulé » → POST /api/v1/matches/m-1/postule
    fireEvent.click(screen.getByRole("button", { name: /j'ai postulé/i }));
    await waitFor(() =>
      expect(appels.some((a) => a.url.endsWith("/api/v1/matches/m-1/postule"))).toBe(true)
    );
    const post = appels.find((a) => a.url.endsWith("/api/v1/matches/m-1/postule"));
    expect(post?.methode).toBe("POST");
    await waitFor(() => expect(probe("detail-suivi-statut")?.textContent).toBe("Postulé"));

    // 3. une fois postulé, le select de statut → PATCH /api/v1/matches/m-1/statut
    const select = await screen.findByLabelText("Statut de candidature");
    fireEvent.change(select, { target: { value: "entretien" } });
    await waitFor(() =>
      expect(appels.some((a) => a.url.endsWith("/api/v1/matches/m-1/statut"))).toBe(true)
    );
    const patch = appels.find((a) => a.url.endsWith("/api/v1/matches/m-1/statut"));
    expect(patch?.methode).toBe("PATCH");
    expect(probe("detail-suivi-statut")?.textContent).toBe("Entretien");

    // 4. aucun appel à un autre match que celui de CETTE offre
    expect(appels.every((a) => a.url.includes("m-1") || a.url.includes("/historique"))).toBe(true);
  });

  it("le corps du PATCH porte le statut choisi", async () => {
    connecter();
    mockerFetch({
      historique: [
        { id: "m-2", postule: true, statut_candidature: "postule", offre: { id: OFFRE_ID } },
      ],
    });
    const corps: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const u = String(url);
        if (u.includes("/historique")) {
          return new Response(
            JSON.stringify([
              { id: "m-2", postule: true, statut_candidature: "postule", offre: { id: OFFRE_ID } },
            ]),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
        if (u.includes("/statut")) corps.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      })
    );

    render(<SuiviCandidature offreId={OFFRE_ID} />);
    const select = await screen.findByLabelText("Statut de candidature");
    fireEvent.change(select, { target: { value: "accepte" } });
    await waitFor(() => expect(corps).toEqual([{ statut: "accepte" }]));
  });

  it("match absent → message « pas dans tes matchs », aucun bouton candidater, aucune mutation", async () => {
    connecter();
    mockerFetch({
      historique: [{ id: "m-9", postule: false, statut_candidature: null, offre: { id: "autre" } }],
    });

    render(<SuiviCandidature offreId={OFFRE_ID} />);

    await waitFor(() => expect(probe("detail-suivi-sans-match")).not.toBeNull());
    expect(probe("detail-suivi-postule")).toBeNull();
    expect(screen.getByRole("link", { name: /mon espace/i })).toHaveAttribute(
      "href",
      `/profil/${TEL}`
    );
    expect(appels).toHaveLength(1);
    expect(appels[0]?.url).toContain("/historique");
  });

  it("ne confond pas deux matchs : sélectionne celui dont l'offre est affichée", async () => {
    connecter();
    mockerFetch({
      historique: [
        { id: "m-autre", postule: true, statut_candidature: "accepte", offre: { id: "autre" } },
        {
          id: "m-bon",
          postule: false,
          statut_candidature: "a_preparer",
          offre: [{ id: OFFRE_ID }], // Supabase peut renvoyer un tableau
        },
      ],
    });

    render(<SuiviCandidature offreId={OFFRE_ID} />);
    await waitFor(() => expect(probe("detail-suivi-statut")?.textContent).toBe("À préparer"));
    fireEvent.click(screen.getByRole("button", { name: /j'ai postulé/i }));
    await waitFor(() =>
      expect(appels.some((a) => a.url.endsWith("/api/v1/matches/m-bon/postule"))).toBe(true)
    );
    expect(appels.some((a) => a.url.includes("m-autre"))).toBe(false);
  });

  it("non connecté → invitation à se connecter, AUCUN appel réseau", async () => {
    mockerFetch();
    render(<SuiviCandidature offreId={OFFRE_ID} />);

    await waitFor(() => expect(probe("detail-suivi-anonyme")).not.toBeNull());
    expect(screen.getByRole("link", { name: /se connecter/i })).toHaveAttribute(
      "href",
      "/connexion"
    );
    expect(probe("detail-suivi-postule")).toBeNull();
    expect(appels).toHaveLength(0);
  });

  it("session refusée par l'API (401) → invitation à se connecter", async () => {
    connecter();
    mockerFetch({ historiqueStatut: 401 });
    render(<SuiviCandidature offreId={OFFRE_ID} />);
    await waitFor(() => expect(probe("detail-suivi-anonyme")).not.toBeNull());
    expect(appels).toHaveLength(1);
  });

  it("libellé du statut : repli honnête (pas de statut → à préparer / postulé)", () => {
    expect(libelleStatut({ id: "m", postule: false, statut_candidature: null })).toBe("À préparer");
    expect(libelleStatut({ id: "m", postule: true, statut_candidature: null })).toBe("Postulé");
    expect(libelleStatut({ id: "m", postule: true, statut_candidature: "refuse" })).toBe("Refusé");
    // valeur legacy non reconnue → repli sur l'état réellement connu
    expect(libelleStatut({ id: "m", postule: true, statut_candidature: "legacy" })).toBe("Postulé");
    expect(libelleStatut({ id: "m", postule: false, statut_candidature: "legacy" })).toBe(
      "À préparer"
    );
  });
});
