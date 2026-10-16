/**
 * CTA WhatsApp — lit le réglage public `support_whatsapp` au chargement, avec
 * REPLI sur `lib/contact.ts` (source unique de secours : jamais de numéro
 * inventé, jamais un CTA mort).
 *
 * Depuis le 16/10/2026 `lib/contact.ts` porte le numéro officiel : le repli
 * n'est donc plus la voie e-mail mais le CTA WhatsApp officiel. Les attentes
 * sont construites À PARTIR de la constante importée, jamais recopiées — le
 * test suit la source au lieu de la figer (le merge des deux branches avait
 * rendu 4 tests menteurs en recopiant « repli e-mail »).
 *
 * Le cas « lib/contact.ts ne porte AUCUN numéro » (repli e-mail) vit dans
 * `cta-whatsapp-sans-numero.test.tsx`, qui mocke le module.
 *
 * Preuves :
 *   1. le rendu initial (avant la réponse) porte déjà le repli officiel ;
 *   2. réglage exploitable → le lien vient de la table (le réglage prime) ;
 *   3. réglage vide {} → on GARDE le repli officiel (jamais de numéro inventé) ;
 *   4. numéro hors bornes → le réglage est ignoré, repli officiel conservé ;
 *   5. API injoignable → repli officiel, le CTA ne casse pas la page.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { CtaWhatsApp } from "@/components/contact/cta-whatsapp";
import { CONTACT_WHATSAPP } from "@/lib/contact";

/** Repli officiel, construit depuis la source (aucun numéro écrit en dur ici). */
const LIEN_OFFICIEL = `wa.me/${CONTACT_WHATSAPP}`;

function stubFetch(options: { ok?: boolean; corps?: unknown; echec?: boolean } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      if (options.echec) throw new Error("réseau coupé");
      return {
        ok: options.ok ?? true,
        status: options.ok === false ? 502 : 200,
        json: async () => options.corps ?? {},
      };
    }) as unknown as typeof fetch
  );
}

beforeEach(() => stubFetch());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CtaWhatsApp — avec le numéro officiel de lib/contact.ts", () => {
  it("le rendu initial (avant la réponse de l'API) porte déjà le repli officiel", () => {
    render(<CtaWhatsApp />);

    const lien = screen.getByRole("link", { name: /WhatsApp/i });
    expect(lien).toHaveAttribute("data-probe", "cta-whatsapp");
    expect(lien.getAttribute("href")).toContain(LIEN_OFFICIEL);
    expect(lien).toHaveAttribute("target", "_blank");
    // Le repli e-mail ne doit plus apparaître : un numéro est configuré.
    expect(screen.queryByText(/lawol@lawol\.mr/)).toBeNull();
  });

  it("réglage exploitable → le lien vient de la table et prime sur le repli", async () => {
    stubFetch({ corps: { support_whatsapp: "2221234567" } });
    render(<CtaWhatsApp />);

    const lien = await screen.findByRole("link", { name: /WhatsApp/i });
    await waitFor(() =>
      expect(lien.getAttribute("href")).toContain("wa.me/2221234567")
    );
    expect(lien.getAttribute("href")).not.toContain(CONTACT_WHATSAPP);
  });

  it("réglage vide {} → on GARDE le repli officiel (jamais de numéro inventé)", async () => {
    stubFetch({ corps: {} });
    render(<CtaWhatsApp />);

    const lien = await screen.findByRole("link", { name: /WhatsApp/i });
    await waitFor(() => expect(lien.getAttribute("href")).toContain(LIEN_OFFICIEL));
    expect(screen.queryByText(/lawol@lawol\.mr/)).toBeNull();
  });

  it("numéro hors bornes (trop court) → réglage ignoré, repli officiel conservé", async () => {
    stubFetch({ corps: { support_whatsapp: "12" } });
    render(<CtaWhatsApp />);

    const lien = await screen.findByRole("link", { name: /WhatsApp/i });
    await waitFor(() => expect(lien.getAttribute("href")).toContain(LIEN_OFFICIEL));
    expect(lien.getAttribute("href")).not.toContain("wa.me/12");
  });

  it("API injoignable → repli officiel, le CTA ne casse pas la page", async () => {
    stubFetch({ echec: true });
    render(<CtaWhatsApp />);

    const lien = screen.getByRole("link", { name: /WhatsApp/i });
    expect(lien.getAttribute("href")).toContain(LIEN_OFFICIEL);
    expect(screen.queryByText(/lawol@lawol\.mr/)).toBeNull();
  });
});
