/**
 * Page client « Paramètres du profil » — export « Mes données ».
 *
 * Preuve visée : le bouton télécharge réellement un JSON contenant le profil,
 * les candidatures et les documents (les 3 GET existants, sans nouvelle route),
 * et affiche un message honnête si l'API refuse. Aucun réseau.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

const etat = vi.hoisted(() => ({ telephone: "22240000001" }));

vi.mock("next/navigation", () => ({
  useParams: () => ({ telephone: etat.telephone }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

import ParametresPage from "@/app/profil/[telephone]/parametres/page";

const PROFIL = {
  id: "11111111-1111-1111-1111-111111111111",
  telephone: "22240000001",
  prenom: "Aminetou",
  nom: "Mint Ahmed",
  email: null,
  ville: "nouakchott",
  filiere: "Informatique",
  niveau: "licence",
  metadata: {},
};

type Appel = { url: string; method: string };

let appels: Appel[];
let echecSur: string | null;

function stubFetch() {
  appels = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const chemin = String(url);
      appels.push({ url: chemin, method: init?.method ?? "GET" });
      if (echecSur && chemin === echecSur) {
        return { ok: false, status: 403, json: async () => ({ detail: "refusé" }) } as unknown as Response;
      }
      if (chemin.endsWith("/historique")) {
        return {
          ok: true,
          status: 200,
          json: async () => [{ offre_id: "o1", statut: "postule" }],
        } as unknown as Response;
      }
      if (chemin.endsWith("/documents")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ documents: [{ id: "d1", nom: "cv.pdf" }] }),
        } as unknown as Response;
      }
      return { ok: true, status: 200, json: async () => PROFIL } as unknown as Response;
    })
  );
}

let blobs: Blob[];
let telechargements: string[];
const protoUrl = URL as unknown as {
  createObjectURL?: (b: Blob) => string;
  revokeObjectURL?: (u: string) => void;
};
let anciens: { c?: (b: Blob) => string; r?: (u: string) => void };

beforeEach(() => {
  echecSur = null;
  stubFetch();
  blobs = [];
  telechargements = [];
  anciens = { c: protoUrl.createObjectURL, r: protoUrl.revokeObjectURL };
  protoUrl.createObjectURL = (b: Blob) => {
    blobs.push(b);
    return "blob:test";
  };
  protoUrl.revokeObjectURL = vi.fn();
  HTMLAnchorElement.prototype.click = function () {
    telechargements.push(this.download);
  };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  protoUrl.createObjectURL = anciens.c;
  protoUrl.revokeObjectURL = anciens.r;
});

describe("export « Mes données »", () => {
  it("télécharge un JSON contenant profil + candidatures + documents (3 GET existants)", async () => {
    render(<ParametresPage />);

    const bouton = await screen.findByRole("button", { name: /Exporter mes données/i });
    bouton.click();

    await waitFor(() => expect(blobs).toHaveLength(1));

    const charge = JSON.parse(await blobs[0].text());
    expect(charge.profil).toMatchObject({ prenom: "Aminetou" });
    expect(charge.candidatures).toEqual([{ offre_id: "o1", statut: "postule" }]);
    expect(charge.documents).toEqual([{ id: "d1", nom: "cv.pdf" }]);
    expect(typeof charge.exporte_le).toBe("string");

    // Aucune route inventée : les 3 endpoints gardés existants seulement
    // (le profil est lu au montage PUIS à l'export → 2 appels, attendu).
    const urls = [...new Set(appels.map((a) => a.url))].sort();
    expect(urls).toEqual(
      [
        "/api/v1/profils/22240000001",
        "/api/v1/profils/22240000001/historique",
        "/api/v1/profils/22240000001/documents",
      ].sort()
    );
    expect(appels.every((a) => a.method === "GET")).toBe(true);
    expect(telechargements[0]).toMatch(/^lawol-mes-donnees-22240000001\.json$/);
    expect(await screen.findByText(/Export téléchargé/i)).toBeInTheDocument();
  });

  it("refus de l'API sur l'historique → message d'échec, aucun fichier vide téléchargé", async () => {
    echecSur = "/api/v1/profils/22240000001/historique";
    render(<ParametresPage />);

    const bouton = await screen.findByRole("button", { name: /Exporter mes données/i });
    bouton.click();

    await waitFor(() =>
      expect(screen.getByText(/Export impossible/i)).toBeInTheDocument()
    );
    expect(blobs).toHaveLength(0);
    expect(telechargements).toHaveLength(0);
  });
});
