"use client";

import { ExternalLink } from "lucide-react";
import { BADGES_TYPE, TYPES_OFFRES } from "@/components/offre-detail-modal";
import type { OffreEntreprise } from "./types";

const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formaterDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : DATE_FORMAT.format(d);
}

const STATUT_LABEL: Record<string, string> = {
  active: "Active",
  pending_review: "En attente",
  rejetee: "Rejetée",
};

const STATUT_STYLE: Record<string, string> = {
  active: "border-green-200 bg-green-50 text-green-800",
  pending_review: "border-amber-200 bg-amber-50 text-amber-900",
  rejetee: "border-red-200 bg-red-50 text-red-700",
};

/**
 * Onglet « Mes offres » : liste des offres avec statut, compteurs et lien public.
 */
export function OngletOffres({ offres }: { offres: OffreEntreprise[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-foreground">
          Mes offres
        </h1>
        <p className="text-sm text-muted-foreground">
          Toutes les offres que tu as déposées, avec leur statut de publication.
        </p>
      </div>

      {offres.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-background px-4 py-10 text-center">
          <p className="text-muted-foreground">
            Aucune offre déposée pour le moment. Va dans l&apos;onglet « Déposer une offre » pour
            publier ta première annonce.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {offres.map((offre) => (
            <div
              key={offre.id}
              data-probe="ent-offre"
              className="rounded-lg border border-border bg-card p-4 shadow-[0_1px_3px_rgba(10,10,10,0.04)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-semibold text-foreground">{offre.titre}</h2>
                  <p className="text-sm text-muted-foreground">
                    {offre.ville} — {formaterDate(offre.date_limite)}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    STATUT_STYLE[offre.statut_publication] ?? STATUT_STYLE.pending_review
                  }`}
                >
                  {STATUT_LABEL[offre.statut_publication] ?? offre.statut_publication}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span
                  className={`badge-offre inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${
                    BADGES_TYPE[offre.type_offre] ?? "border border-border bg-muted text-muted-foreground"
                  }`}
                >
                  {TYPES_OFFRES[offre.type_offre] || offre.type_offre}
                </span>
                <span>{offre.nb_matches} match{offre.nb_matches > 1 ? "s" : ""}</span>
                <span>{offre.nb_postules} postul{offre.nb_postules > 1 ? "és" : "é"}</span>
                {offre.url_publique && (
                  <a
                    href={offre.url_publique}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-signature transition-colors duration-150 hover:text-signature-deep"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Lien public
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
