/**
 * CTA WhatsApp — lit le réglage public `support_whatsapp` au chargement, avec
 * REPLI sur `lib/contact.ts` (source unique de secours : jamais de numéro
 * inventé, jamais un CTA mort).
 *
 * Preuves :
 *   1. réglage exploitable → lien wa.me construit avec le numéro de la table ;
 *   2. réglage vide {} ou numéro hors bornes → repli e-mail (pas de wa.me) ;
 *   3. API injoignable → repli e-mail ;
 *   4. le rendu initial (avant la réponse) reste le repli, donc le statique tient.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { CtaWhatsApp } from "@/components/contact/cta-whatsapp";

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

describe("CtaWhatsApp", () => {
  it("rend le REPLI e-mail par défaut (aucun numéro dans lib/contact.ts)", () => {
    render(<CtaWhatsApp />);
    expect(screen.getByText(/lawol@lawol\.mr/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /WhatsApp/i })).toBeNull();
  });

  it("réglage exploitable → lien wa.me construit depuis la table", async () => {
    stubFetch({ corps: { support_whatsapp: "2221234567" } });
    render(<CtaWhatsApp />);

    const lien = await screen.findByRole("link", { name: /WhatsApp/i });
    expect(lien).toHaveAttribute("data-probe", "cta-whatsapp");
    expect(lien.getAttribute("href")).toContain("wa.me/2221234567");
    expect(lien).toHaveAttribute("target", "_blank");
  });

  it("réglage vide {} → repli e-mail (jamais de numéro inventé)", async () => {
    stubFetch({ corps: {} });
    render(<CtaWhatsApp />);
    await waitFor(() => expect(screen.getByText(/lawol@lawol\.mr/)).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: /WhatsApp/i })).toBeNull();
  });

  it("numéro hors bornes (trop court) → repli e-mail", async () => {
    stubFetch({ corps: { support_whatsapp: "12" } });
    render(<CtaWhatsApp />);
    await waitFor(() => expect(screen.getByText(/lawol@lawol\.mr/)).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: /WhatsApp/i })).toBeNull();
  });

  it("API injoignable → repli e-mail, le CTA ne casse pas la page", async () => {
    stubFetch({ echec: true });
    render(<CtaWhatsApp />);
    await waitFor(() => expect(screen.getByText(/lawol@lawol\.mr/)).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: /WhatsApp/i })).toBeNull();
  });
});
