"use client";

import type { CandidatureEntreprise } from "./types";

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
 * Onglet « Candidatures » : liste des étudiants qui ont postulé aux offres de l'entreprise.
 */
export function OngletCandidatures({ candidatures }: { candidatures: CandidatureEntreprise[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-foreground">
          Candidatures
        </h1>
        <p className="text-sm text-muted-foreground">
          Les étudiants qui ont postulé à tes offres.
        </p>
      </div>

      {candidatures.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-background px-4 py-10 text-center">
          <p className="text-muted-foreground">
            Aucune candidature pour le moment. Elle apparaîtra ici dès qu&apos;un étudiant
            postulera à tes offres.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {candidatures.map((c) => (
            <div
              key={c.match_id}
              data-probe="ent-candidature"
              className="rounded-lg border border-border bg-card p-4 shadow-[0_1px_3px_rgba(10,10,10,0.04)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-semibold text-foreground">
                    {c.profil.prenom} {c.profil.nom}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {c.profil.filiere.replace(/_/g, " ")} — {c.profil.niveau}
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                  Score {c.score}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span>{c.profil.telephone}</span>
                <span>{c.profil.universite}</span>
                <span>{c.profil.ville}</span>
              </div>

              <div className="mt-3 border-t border-border pt-3">
                <p className="text-sm text-muted-foreground">
                  A postulé à <span className="font-medium text-foreground">{c.offre.titre}</span>{" "}
                  le {formaterDate(c.date_match)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
