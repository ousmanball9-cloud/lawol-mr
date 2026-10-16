/**
 * Cas « lib/contact.ts ne porte AUCUN numéro » : le CTA doit masquer WhatsApp et
 * laisser la voie e-mail — jamais un bouton mort, jamais un numéro inventé.
 *
 * Ce cas vit dans SON PROPRE fichier parce que `vi.mock` remplace le module pour
 * tout le fichier de test : impossible de tester « avec » et « sans » numéro
 * dans le même fichier sans bidouiller le registre de modules (et risquer deux
 * instances de React).
 *
 * Le mock conserve la VRAIE fonction `construireLienWhatsApp` (la validation des
 * bornes reste testée) et ne simule que l'absence de numéro configuré.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/contact", async (importOriginal) => {
  const vrai = await importOriginal<typeof import("@/lib/contact")>();
  return {
    ...vrai,
    CONTACT_WHATSAPP: "",
    lienContactWhatsApp: () => vrai.construireLienWhatsApp(""),
  };
});

import { CtaWhatsApp } from "@/components/contact/cta-whatsapp";

function stubFetch(corps: unknown = {}, echec = false) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      if (echec) throw new Error("réseau coupé");
      return { ok: true, status: 200, json: async () => corps };
    }) as unknown as typeof fetch
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CtaWhatsApp — sans aucun numéro configuré (repli e-mail)", () => {
  it("aucun numéro → pas de lien WhatsApp, la voie e-mail est proposée", async () => {
    stubFetch({});
    render(<CtaWhatsApp />);

    expect(screen.queryByRole("link", { name: /WhatsApp/i })).toBeNull();
    expect(screen.getByText(/lawol@lawol\.mr/)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/lawol@lawol\.mr/)).toBeInTheDocument()
    );
  });

  it("réglage hors bornes alors qu'aucun repli n'existe → toujours la voie e-mail", async () => {
    stubFetch({ support_whatsapp: "12" });
    render(<CtaWhatsApp />);

    await waitFor(() =>
      expect(screen.getByText(/lawol@lawol\.mr/)).toBeInTheDocument()
    );
    expect(screen.queryByRole("link", { name: /WhatsApp/i })).toBeNull();
  });

  it("API injoignable → repli e-mail, le CTA ne casse pas la page", async () => {
    stubFetch({}, true);
    render(<CtaWhatsApp />);

    await waitFor(() =>
      expect(screen.getByText(/lawol@lawol\.mr/)).toBeInTheDocument()
    );
    expect(screen.queryByRole("link", { name: /WhatsApp/i })).toBeNull();
  });

  it("un réglage exploitable fait apparaître le CTA même sans repli", async () => {
    stubFetch({ support_whatsapp: "2221234567" });
    render(<CtaWhatsApp />);

    const lien = await screen.findByRole("link", { name: /WhatsApp/i });
    await waitFor(() =>
      expect(lien.getAttribute("href")).toContain("wa.me/2221234567")
    );
  });
});
