"use client";

import type { CandidatureEntreprise, OffreEntreprise } from "./types";

type Props = {
  offres: OffreEntreprise[];
  candidatures: CandidatureEntreprise[];
};

const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formaterDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : DATE_FORMAT.format(d);
}

/**
 * Onglet « Tableau de bord » : statistiques clés + dernières candidatures.
 */
export function OngletTableau({ offres, candidatures }: Props) {
  const nbOffres = offres.length;
  const nbCandidatures = candidatures.length;
  const nbPostulees = candidatures.filter((c) => c.postule).length;
  const dernieres = candidatures.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-foreground">
          Tableau de bord
        </h1>
        <p className="text-sm text-muted-foreground">
          Vue d&apos;ensemble de ton activité sur LAWOL.mr.
        </p>
      </div>

      {/* Statistiques */}
      <div data-probe="ent-stats" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { libelle: "Offres publiées", valeur: nbOffres },
          { libelle: "Candidatures reçues", valeur: nbCandidatures },
          { libelle: "Candidats postulés", valeur: nbPostulees },
        ].map((carte) => (
          <div
            key={carte.libelle}
            className="rounded-lg border border-border bg-card px-4 py-3 shadow-[0_1px_3px_rgba(10,10,10,0.04)]"
          >
            <span className="block text-xs text-muted-foreground">{carte.libelle}</span>
            <span className="font-display text-2xl font-bold tracking-[-0.02em] text-foreground">
              {carte.valeur}
            </span>
          </div>
        ))}
      </div>

      {/* Dernières candidatures */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-[0_1px_3px_rgba(10,10,10,0.04)]">
        <h2 className="mb-4 font-display text-lg font-bold tracking-[-0.01em] text-foreground">
          Dernières candidatures
        </h2>
        {dernieres.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-background px-4 py-10 text-center">
            <p className="text-muted-foreground">
              Aucune candidature pour le moment. Elle apparaîtra ici dès qu&apos;un étudiant
              postulera à tes offres.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {dernieres.map((c) => (
              <li key={c.match_id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {c.profil.prenom} {c.profil.nom}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {c.offre.titre} — {c.offre.ville}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-sm">
                  <span className="text-muted-foreground">{formaterDate(c.date_match)}</span>
                  <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    Score {c.score}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
