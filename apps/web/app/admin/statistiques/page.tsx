"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, BarChart3, CalendarDays, Eye } from "lucide-react";

/**
 * Page admin « Statistiques » — fréquentation du site.
 *
 * Contrat consommé (figé) : GET /api/v1/admin/stats/visites (gardé)
 *   → {total, par_jour: [{jour, nb}]}
 *     · `total`   = toutes périodes ;
 *     · `par_jour` = 30 derniers jours, croissant, jours ABSENTS omis.
 * Le proxy Next (app/api/v1/admin/stats/visites) relaie le cookie admin.
 */

type StatsVisites = {
  total: number;
  par_jour: { jour: string; nb: number }[];
};

/** « 2026-10-16 » → « 16 oct. 2026 » (jamais de fuseau dérivé : lecture locale). */
function jourLisible(jour: string): string {
  const date = new Date(`${jour}T00:00:00`);
  if (Number.isNaN(date.getTime())) return jour;
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AdminStatistiquesPage() {
  const [stats, setStats] = useState<StatsVisites | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    let annule = false;
    fetch("/api/v1/admin/stats/visites", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(
            res.status === 401 || res.status === 403
              ? "Session administrateur expirée — reconnecte-toi."
              : `Statistiques indisponibles (${res.status}).`
          );
        }
        return (await res.json()) as StatsVisites;
      })
      .then((data) => {
        if (!annule) {
          setStats({
            total: Number.isFinite(data?.total) ? data.total : 0,
            par_jour: Array.isArray(data?.par_jour) ? data.par_jour : [],
          });
        }
      })
      .catch((err) =>
        !annule
          ? setErreur(err instanceof Error ? err.message : "Statistiques indisponibles.")
          : undefined
      )
      .finally(() => !annule && setChargement(false));
    return () => {
      annule = true;
    };
  }, []);

  const surTrenteJours = stats?.par_jour.reduce((somme, j) => somme + j.nb, 0) ?? 0;
  const maximum = Math.max(...(stats?.par_jour.map((j) => j.nb) ?? [0]), 1);

  return (
    <div>
      {/* En-tête de page (même gabarit que les autres écrans admin) */}
      <div className="p-4 bg-white border-b border-gray-200 sm:flex sm:items-center sm:justify-between lg:mt-1.5">
        <div className="w-full mb-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-ink sm:text-2xl">
            <BarChart3 className="h-6 w-6 text-signature" aria-hidden="true" />
            Statistiques
          </h1>
          <p className="mt-1 text-sm font-normal text-muted-foreground">
            Fréquentation du site — total et détail des 30 derniers jours
          </p>
        </div>
      </div>

      <div className="p-4">
        {chargement && (
          <div
            data-probe="stats-chargement"
            className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground shadow-sm sm:p-6"
          >
            Chargement des statistiques…
          </div>
        )}

        {erreur && !chargement && (
          <p
            data-probe="stats-erreur"
            role="alert"
            className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {erreur}
          </p>
        )}

        {stats && !chargement && !erreur && (
          <>
            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              <div
                data-probe="stats-total"
                className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Visites (toutes périodes)</p>
                    <p className="font-display text-3xl font-semibold text-ink">
                      {stats.total.toLocaleString("fr-FR")}
                    </p>
                  </div>
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-signature/10 text-signature">
                    <Eye className="h-5 w-5" aria-hidden="true" />
                  </span>
                </div>
              </div>

              <div
                data-probe="stats-trente-jours"
                className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Visites (30 derniers jours)</p>
                    <p className="font-display text-3xl font-semibold text-ink">
                      {surTrenteJours.toLocaleString("fr-FR")}
                    </p>
                  </div>
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-signature/10 text-signature">
                    <CalendarDays className="h-5 w-5" aria-hidden="true" />
                  </span>
                </div>
              </div>
            </div>

            <div
              data-probe="stats-table"
              className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm"
            >
              <table className="w-full text-left text-sm text-ink">
                <caption className="px-4 pt-4 text-left text-xs font-normal text-muted-foreground">
                  Seuls les jours ayant au moins une visite apparaissent (ordre croissant).
                </caption>
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3">Jour</th>
                    <th scope="col" className="px-4 py-3">Visites</th>
                    <th scope="col" className="px-4 py-3">Répartition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stats.par_jour.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-6 text-center text-muted-foreground"
                      >
                        Aucune visite sur les 30 derniers jours.
                      </td>
                    </tr>
                  )}
                  {stats.par_jour.map((jour) => (
                    <tr
                      key={jour.jour}
                      data-probe="stats-ligne"
                      data-jour={jour.jour}
                      className="hover:bg-muted/50"
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-medium">
                        {jourLisible(jour.jour)}
                      </td>
                      <td
                        data-probe="stats-ligne-nb"
                        className="whitespace-nowrap px-4 py-3 font-semibold text-signature"
                      >
                        {jour.nb.toLocaleString("fr-FR")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-2.5 min-w-[6rem] overflow-hidden rounded-full bg-signature/10">
                          <div
                            className="h-full rounded-full bg-signature"
                            style={{ width: `${(jour.nb / maximum) * 100}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
