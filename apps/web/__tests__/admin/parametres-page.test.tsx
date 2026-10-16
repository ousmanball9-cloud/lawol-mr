/**
 * Page admin « Paramètres » — édition des 4 réglages publics.
 *
 * Preuve visée : la page LIT `/api/v1/parametres`, affiche ce que la table porte
 * (jamais un écran muet), et ENREGISTRE chaque clé via PUT /api/v1/admin/parametres
 * — en annonçant clairement succès, refus d'auth et lecture impossible.
 * Aucun réseau : `fetch` est remplacé.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdminParametresPage from "@/app/admin/parametres/page";

const REGLAGES_TABLE = {
  support_whatsapp: "2221234567",
  email_contact: "support@lawol.mr",
  reseaux: ["https://facebook.com/lawol", "https://instagram.com/lawol"],
  mode_maintenance: true,
};

type Appel = { url: string; method: string; body?: unknown };

function stubFetch(options: { getStatut?: number; putStatut?: number } = {}) {
  const appels: Appel[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      appels.push({
        url: String(url),
        method,
        body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
      });
      const statut = method === "PUT" ? options.putStatut ?? 200 : options.getStatut ?? 200;
      return {
        ok: statut >= 200 && statut < 300,
        status: statut,
        json: async () => REGLAGES_TABLE,
        text: async () => JSON.stringify(REGLAGES_TABLE),
      } as unknown as Response;
    })
  );
  return appels;
}

beforeEach(() => stubFetch());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("page Paramètres — lecture du contrat", () => {
  it("affiche les valeurs de la table (whatsapp, e-mail, réseaux lignes, maintenance)", async () => {
    render(<AdminParametresPage />);

    await waitFor(() =>
      expect(screen.getByLabelText(/Numéro WhatsApp du support/i)).toHaveValue("2221234567")
    );
    expect(screen.getByLabelText(/E-mail de contact/i)).toHaveValue("support@lawol.mr");
    expect(screen.getByLabelText(/Réseaux sociaux/i)).toHaveValue(
      "https://facebook.com/lawol\nhttps://instagram.com/lawol"
    );
    expect(screen.getByLabelText(/Mode maintenance/i)).toBeChecked();
  });

  it("table vide / API injoignable → formulaire éditable + message honnête", async () => {
    stubFetch({ getStatut: 502 });
    render(<AdminParametresPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/Réglages indisponibles/i);
    // Malgré la panne de lecture, le formulaire reste éditable (jamais d'écran mort).
    expect(screen.getByLabelText(/Numéro WhatsApp du support/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Enregistrer/i })).toBeInTheDocument();
  });
});

describe("page Paramètres — enregistrement", () => {
  it("PUT les 4 clés (réseaux en tableau) et annonce le succès", async () => {
    const appels = stubFetch();
    render(<AdminParametresPage />);
    await waitFor(() =>
      expect(screen.getByLabelText(/E-mail de contact/i)).toHaveValue("support@lawol.mr")
    );

    fireEvent.change(screen.getByLabelText(/E-mail de contact/i), {
      target: { value: "aide@lawol.mr" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/i }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/enregistrés/i));

    const puts = appels.filter((a) => a.method === "PUT");
    expect(puts).toHaveLength(4);
    expect(puts.map((p) => (p.body as { cle: string }).cle).sort()).toEqual([
      "email_contact",
      "mode_maintenance",
      "reseaux",
      "support_whatsapp",
    ]);
    const email = puts.find((p) => (p.body as { cle: string }).cle === "email_contact");
    expect((email!.body as { valeur: unknown }).valeur).toBe("aide@lawol.mr");
    const reseaux = puts.find((p) => (p.body as { cle: string }).cle === "reseaux");
    expect((reseaux!.body as { valeur: unknown }).valeur).toEqual([
      "https://facebook.com/lawol",
      "https://instagram.com/lawol",
    ]);
    const maintenance = puts.find(
      (p) => (p.body as { cle: string }).cle === "mode_maintenance"
    );
    expect((maintenance!.body as { valeur: unknown }).valeur).toBe(true);
  });

  it("session admin refusée (403) → message de reconnexion", async () => {
    stubFetch({ putStatut: 403 });
    render(<AdminParametresPage />);
    await waitFor(() =>
      expect(screen.getByLabelText(/E-mail de contact/i)).toHaveValue("support@lawol.mr")
    );

    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/Session administrateur expirée/i)
    );
  });
});
