/**
 * Preuve du générateur de dossier de candidature (`/offres/[id]`) :
 *
 *  1. le bouton « Générer mon dossier » appelle la BONNE route proxy
 *     (`POST /api/v1/candidatures/{offre}/dossier`) avec les pièces cochées ;
 *  2. une erreur serveur affiche un message honnête (aucun email envoyé) ;
 *  3. un dossier prêt rend le lien de téléchargement signé (60 s) ;
 *  4. décocher une pièce l'exclut du corps ; coffre vide → invitation à le remplir.
 *
 * Aucun réseau : `fetch` est mocké, le cookie de session est posé à la main.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DossierPieces } from "@/components/offres/dossier-pieces";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href?: string; children?: ReactNode }) => (
    <a href={typeof href === "string" ? href : "#"}>{children}</a>
  ),
}));

const TEL = "2221234567";
const OFFRE_ID = "11111111-2222-3333-4444-555555555555";
const URL_PDF = "https://faux.supabase.co/storage/v1/object/sign/documents/dossier.pdf?token=x";

const DOCUMENTS = {
  documents: [
    { id: "doc-cv", nom: "CV_2026.pdf" },
    { id: "doc-releve", nom: "Releves_notes.pdf" },
  ],
};

function jeton(tel = TEL): string {
  const payload = Buffer.from(
    JSON.stringify({ tel, exp: Math.floor(Date.now() / 1000) + 3600 })
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${payload}.signature-factice`;
}

function connecter() {
  document.cookie = `lawol_token=${jeton()}; path=/`;
}

type Appel = { url: string; methode: string | undefined; corps: unknown };

let appels: Appel[] = [];

/** `fetch` mocké : coffre + génération, réponses configurables. */
function mockerFetch(
  options: { documents?: unknown; generationStatut?: number; generation?: unknown } = {}
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      const corps = init?.body ? JSON.parse(String(init.body)) : null;
      appels.push({ url: u, methode: init?.method, corps });
      if (u.includes("/documents")) {
        return new Response(JSON.stringify(options.documents ?? DOCUMENTS), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      const statut = options.generationStatut ?? 200;
      const payload =
        statut === 200
          ? (options.generation ?? {
              statut: "dossier_pret",
              url: URL_PDF,
              expire_dans: 60,
              pieces: ["CV_2026.pdf", "Releves_notes.pdf"],
            })
          : { detail: "erreur" };
      return new Response(JSON.stringify(payload), {
        status: statut,
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

describe("dossier de candidature — génération réelle", () => {
  it("affiche les pièces du coffre et le bouton appelle la BONNE route avec la sélection", async () => {
    connecter();
    mockerFetch();
    render(<DossierPieces offreId={OFFRE_ID} />);

    // Les cases viennent du coffre, pas d'une liste statique.
    await waitFor(() =>
      expect(document.querySelectorAll('[data-probe="detail-dossier-case"]').length).toBe(2)
    );
    expect(screen.getByLabelText("CV_2026.pdf")).toBeChecked();
    expect(screen.getByLabelText("Releves_notes.pdf")).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: /générer mon dossier/i }));

    await waitFor(() =>
      expect(appels.some((a) => a.url.endsWith(`/dossier`))).toBe(true)
    );
    const appel = appels.find((a) => a.url.endsWith("/dossier"));
    expect(appel?.methode).toBe("POST");
    expect(appel?.url).toBe(`/api/v1/candidatures/${OFFRE_ID}/dossier`);
    expect(appel?.corps).toEqual({
      telephone: TEL,
      pieces: ["doc-cv", "doc-releve"],
    });
  });

  it("une pièce décochée est exclue du corps envoyé", async () => {
    connecter();
    mockerFetch();
    render(<DossierPieces offreId={OFFRE_ID} />);

    await waitFor(() => expect(screen.getByLabelText("Releves_notes.pdf")).toBeChecked());
    fireEvent.click(screen.getByLabelText("Releves_notes.pdf"));
    fireEvent.click(screen.getByRole("button", { name: /générer mon dossier/i }));

    await waitFor(() => expect(appels.some((a) => a.url.endsWith("/dossier"))).toBe(true));
    expect(appels.find((a) => a.url.endsWith("/dossier"))?.corps).toEqual({
      telephone: TEL,
      pieces: ["doc-cv"],
    });
  });

  it("erreur serveur → message honnête, aucun lien de téléchargement", async () => {
    connecter();
    mockerFetch({ generationStatut: 500 });
    render(<DossierPieces offreId={OFFRE_ID} />);

    fireEvent.click(screen.getByRole("button", { name: /générer mon dossier/i }));

    await waitFor(() =>
      expect(probe("detail-dossier-message")?.textContent).toContain(
        "Aucun email n'a été envoyé"
      )
    );
    expect(probe("detail-dossier-lien")).toBeNull();
    expect(probe("detail-dossier-message")?.textContent).not.toContain("Dossier prêt");
  });

  it("succès → lien de téléchargement signé + mention des 60 secondes", async () => {
    connecter();
    mockerFetch();
    render(<DossierPieces offreId={OFFRE_ID} />);

    fireEvent.click(screen.getByRole("button", { name: /générer mon dossier/i }));

    await waitFor(() => expect(probe("detail-dossier-lien")).not.toBeNull());
    const lien = probe("detail-dossier-lien") as HTMLAnchorElement;
    expect(lien.getAttribute("href")).toBe(URL_PDF);
    expect(lien.getAttribute("target")).toBe("_blank");
    expect(probe("detail-dossier-message")?.textContent).toContain("60 secondes");
    expect(probe("detail-dossier-message")?.textContent).toContain("Dossier prêt");
  });

  it("session refusée (401) → invitation à se reconnecter, pas de lien", async () => {
    connecter();
    mockerFetch({ generationStatut: 401 });
    render(<DossierPieces offreId={OFFRE_ID} />);

    fireEvent.click(screen.getByRole("button", { name: /générer mon dossier/i }));

    await waitFor(() =>
      expect(probe("detail-dossier-message")?.textContent).toContain("session a expiré")
    );
    expect(probe("detail-dossier-lien")).toBeNull();
  });

  it("coffre vide → aucune case, invitation à déposer des pièces", async () => {
    connecter();
    mockerFetch({ documents: { documents: [] } });
    render(<DossierPieces offreId={OFFRE_ID} />);

    await waitFor(() =>
      expect(probe("detail-dossier-generateur")?.textContent).toContain(
        "Ton coffre-fort est vide"
      )
    );
    expect(document.querySelectorAll('[data-probe="detail-dossier-case"]').length).toBe(0);
    expect(screen.getByRole("link", { name: /coffre-fort/i })).toHaveAttribute(
      "href",
      `/profil/${TEL}/documents`
    );
  });
});
