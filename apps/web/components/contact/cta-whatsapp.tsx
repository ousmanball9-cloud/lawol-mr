"use client";

import { useEffect, useState } from "react";
import { construireLienWhatsApp, lienContactWhatsApp } from "@/lib/contact";

/**
 * CTA de contact WhatsApp — lit le réglage PUBLIC `support_whatsapp` de la table
 * `parametres` au chargement, avec REPLI sur `lib/contact.ts` (source unique de
 * secours : aucun numéro n'est inventé).
 *
 * Pourquoi côté client : la valeur peut changer en admin à tout moment et le
 * rendu statique ne doit pas être cassé. L'état initial = repli `lib/contact.ts`
 * (identique au rendu serveur d'avant), puis la table prend la main si elle
 * porte un numéro exploitable.
 *
 * Sans numéro (ni table, ni repli) : la voie e-mail est proposée, comme avant.
 */
export function CtaWhatsApp() {
  const [lien, setLien] = useState<string | null>(() => lienContactWhatsApp());

  useEffect(() => {
    let annule = false;
    fetch("/api/v1/parametres", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Record<string, unknown> | null) => {
        if (annule || !data) return;
        const numero =
          typeof data.support_whatsapp === "string" ? data.support_whatsapp : "";
        // Réglage prioritaire s'il est exploitable ; sinon on GARDE le repli.
        const depuisTable = construireLienWhatsApp(numero);
        if (depuisTable) setLien(depuisTable);
      })
      .catch(() => {
        // Table/API indisponible : le repli `lib/contact.ts` reste affiché.
      });
    return () => {
      annule = true;
    };
  }, []);

  if (!lien) {
    return (
      <p data-probe="cta-whatsapp-repli" className="text-gray-600 mb-4">
        Notre équipe répond aux questions sur l&apos;inscription, les bourses reçues et
        la modification de ton profil. Écris-nous par e-mail :{" "}
        <a
          href="mailto:lawol@lawol.mr"
          className="text-signature underline underline-offset-4 hover:text-signature-deep"
        >
          lawol@lawol.mr
        </a>
        .
      </p>
    );
  }

  return (
    <>
      <p className="text-gray-600 mb-4">
        Le canal le plus rapide : WhatsApp. Notre équipe répond aux questions sur
        l&apos;inscription, les bourses reçues et la modification de ton profil.
      </p>
      <p className="mb-6">
        <a
          data-probe="cta-whatsapp"
          href={lien}
          target="_blank"
          rel="noopener"
          className="inline-block rounded-lg bg-signature px-5 py-2.5 text-sm font-medium text-white hover:bg-signature-deep"
        >
          Écrire à LAWOL.mr sur WhatsApp
        </a>
      </p>
    </>
  );
}
