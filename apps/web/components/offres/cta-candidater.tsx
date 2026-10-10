"use client";

import { ExternalLink, Mail, MessageCircle } from "lucide-react";
import { lienMailto, lienSecurise, lienWhatsApp, texteWhatsApp } from "./liens";
import type { Offre } from "./types";

const CANAL =
  "flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-foreground transition-colors duration-150 hover:border-signature hover:text-signature";

/**
 * CTA candidater : mailto (sujet + corps pré-remplis) si contact_email,
 * bouton wa.me (texte pré-rempli, window.open comme handlePartager) si
 * contact_whatsapp, lien source_url sécurisé si présent.
 */
export function CtaCandidater({ offre }: { offre: Offre }) {
  const email = offre.contact_email?.trim() || null;
  const whatsapp = offre.contact_whatsapp?.trim() || null;
  const source = offre.source_url?.trim() ? lienSecurise(offre.source_url.trim()) : null;
  const aUnCanal = Boolean(email || whatsapp || source);

  return (
    <div data-probe="detail-cta" className="rounded-lg border border-border bg-muted/50 p-4">
      <h3 className="mb-3 text-sm font-semibold text-foreground">Comment postuler</h3>
      {aUnCanal ? (
        <div className="flex flex-col gap-2">
          {email && (
            <a href={lienMailto(offre, email)} className={CANAL}>
              <Mail className="h-4 w-4 shrink-0 text-signature" />
              Postuler par e-mail
              <span className="truncate text-muted-foreground">{email}</span>
            </a>
          )}
          {whatsapp && (
            <button
              type="button"
              onClick={() =>
                window.open(
                  `${lienWhatsApp(whatsapp)}?text=${encodeURIComponent(texteWhatsApp(offre))}`,
                  "_blank",
                  "noopener,noreferrer"
                )
              }
              className={CANAL}
            >
              <MessageCircle className="h-4 w-4 shrink-0 text-signature" />
              Écrire sur WhatsApp
            </button>
          )}
          {source && (
            <a href={source} target="_blank" rel="noopener noreferrer" className={CANAL}>
              <ExternalLink className="h-4 w-4 shrink-0 text-signature" />
              Voir l&apos;offre originale
              {offre.source_name ? ` — ${offre.source_name}` : ""}
            </a>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Aucun canal de candidature indiqué — cherche l&apos;entreprise sur Google ou LinkedIn.
        </p>
      )}
    </div>
  );
}
