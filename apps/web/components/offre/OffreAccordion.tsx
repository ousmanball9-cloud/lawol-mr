"use client";

import OffreCard from "./OffreCard";
import type { OffreDetail } from "@/components/offre-detail-modal";

/** Match enrichi côté client (historique + offres matchées). */
export type MatchEnrichi = {
  id: string;
  postule: boolean;
  favori?: boolean;
  statut_candidature?: string | null;
  date_match?: string;
  offre: OffreDetail;
};

/** Groupe d'offres par entreprise pour l'accordéon. */
export type GroupeEntreprise = {
  entreprise: string;
  offres: MatchEnrichi[];
};

/**
 * Accordéon natif `<details>` par entreprise.
 * Chaque `<summary>` = nom entreprise + badge count.
 * À l'intérieur : grille responsive (1 mobile, 2 tablette, 3 desktop) de `OffreCard`.
 * État ouvert/fermé persistant via l'élément `<details>` natif (pas de state React).
 *
 * @param groupes - Tableau de groupes { entreprise, offres[] }
 * @param onPostuler - Callback postuler (id)
 * @param onFavori - Callback toggle favori (id, favori)
 * @param onStatut - Callback changement statut (id, statut)
 * @param onPartager - Callback partage (offre)
 */
export default function OffreAccordion({
  groupes,
  onPostuler,
  onFavori,
  onStatut,
  onPartager,
}: {
  groupes: GroupeEntreprise[];
  onPostuler: (id: string) => void;
  onFavori: (id: string, favori: boolean) => void;
  onStatut: (id: string, statut: string | null) => void;
  onPartager: (offre: OffreDetail) => void;
}) {
  if (groupes.length === 0) {
    return (
      <div data-probe="accordion-vide" className="rounded-lg border border-dashed border-border bg-background px-4 py-10 text-center">
        <p className="text-muted-foreground">Aucune offre à afficher.</p>
      </div>
    );
  }

  return (
    <div data-probe="offre-accordion" className="space-y-3" role="region" aria-label="Offres groupées par entreprise">
      {groupes.map((groupe) => (
        <details
          key={groupe.entreprise}
          data-probe="groupe-entreprise"
          data-entreprise={groupe.entreprise}
          className="group rounded-lg border border-border bg-card overflow-hidden shadow-[0_1px_3px_rgba(10,10,10,0.04)]"
        >
          <summary
            role="button"
            aria-expanded={false}
            className="flex items-center gap-2 cursor-pointer p-3 bg-muted/50 rounded-t-lg transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signature/60"
            onClick={(e) => {
              // Nécessaire pour que aria-expanded se mette à jour avant le toggle natif
              const target = e.currentTarget as HTMLElement;
              const details = target.parentElement as HTMLDetailsElement;
              target.setAttribute("aria-expanded", details.open ? "false" : "true");
            }}
          >
            <span className="font-medium text-foreground">{groupe.entreprise}</span>
            <span
              data-probe="badge-count"
              className="ml-auto inline-flex items-center rounded-full bg-signature/10 px-2.5 py-0.5 text-xs font-semibold text-signature"
            >
              {groupe.offres.length} offre{groupe.offres.length > 1 ? "s" : ""}
            </span>
          </summary>

          <div className="p-4">
            <div
              data-probe="grille-offres-entreprise"
              className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              role="list"
              aria-label={`Offres de ${groupe.entreprise}`}
            >
              {groupe.offres.map((match) => (
                <OffreCard
                  key={match.id}
                  offre={match.offre}
                  postule={match.postule}
                  statut={match.statut_candidature ?? null}
                  favori={!!match.favori}
                  onPostuler={onPostuler}
                  onFavori={onFavori}
                  onStatut={onStatut}
                  onPartager={onPartager}
                  compact
                />
              ))}
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}