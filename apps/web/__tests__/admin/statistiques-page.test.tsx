/**
 * Page admin « Statistiques » — total + tableau par jour (30 derniers jours).
 *
 * Preuve visée : la page consomme `GET /api/v1/admin/stats/visites` (proxy gardé)
 * et rend le total toutes périodes, la somme des 30 jours et une ligne par jour
 * fourni — sans jamais mourir quand le refus d'auth ou la table vide arrivent.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import AdminStatistiquesPage from "@/app/admin/statistiques/page";

type Reponse = { statut: number; corps: unknown };

function stubFetch(reponse: Reponse) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: reponse.statut >= 200 && reponse.statut < 300,
      status: reponse.statut,
      json: async () => reponse.corps,
    })) as unknown as typeof fetch
  );
}

beforeEach(() =>
  stubFetch({
    statut: 200,
    corps: {
      total: 152,
      par_jour: [
        { jour: "2026-10-01", nb: 3 },
        { jour: "2026-10-02", nb: 7 },
      ],
    },
  })
);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("page Statistiques", () => {
  it("affiche le total (toutes périodes) et la somme des 30 derniers jours", async () => {
    render(<AdminStatistiquesPage />);
    await waitFor(() => expect(screen.getByText("152")).toBeInTheDocument());
    // 3 + 7 = 10 sur la fenêtre de 30 jours
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("rend une ligne par jour fourni (croissant, jours absents omis)", async () => {
    const { container } = render(<AdminStatistiquesPage />);
    await waitFor(() =>
      expect(container.querySelectorAll('[data-probe="stats-ligne"]')).toHaveLength(2)
    );
    const lignes = container.querySelectorAll('[data-probe="stats-ligne"]');
    expect(lignes[0]).toHaveAttribute("data-jour", "2026-10-01");
    expect(lignes[1]).toHaveAttribute("data-jour", "2026-10-02");
    expect(lignes[0].querySelector('[data-probe="stats-ligne-nb"]')).toHaveTextContent("3");
    expect(lignes[1].querySelector('[data-probe="stats-ligne-nb"]')).toHaveTextContent("7");
  });

  it("série vide → total 0 et message « aucune visite »", async () => {
    stubFetch({ statut: 200, corps: { total: 0, par_jour: [] } });
    render(<AdminStatistiquesPage />);
    await waitFor(() =>
      expect(screen.getByText(/Aucune visite sur les 30 derniers jours/i)).toBeInTheDocument()
    );
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(1);
  });

  it("refus d'auth (401) → message de reconnexion, pas un écran muet", async () => {
    stubFetch({ statut: 401, corps: {} });
    render(<AdminStatistiquesPage />);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/Session administrateur expirée/i)
    );
  });
});
