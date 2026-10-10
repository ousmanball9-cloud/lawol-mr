const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Parse une date_limite backend : ISO « 2026-11-30 » ou française « 30/11/2026 ». */
export function parserDateLimite(valeur: string): Date | null {
  const brut = valeur?.trim() ?? "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(brut);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const fr = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/.exec(brut);
  if (fr) return new Date(Number(fr[3]), Number(fr[2]) - 1, Number(fr[1]));
  return null;
}

/** « Avant le 30 nov. 2026 », ou la valeur brute si non parsable. */
export function labelAvantLe(date: Date | null, brut: string): string {
  return date ? `Avant le ${DATE_FORMAT.format(date)}` : `Date limite : ${brut}`;
}

/** Jours restants en jours calendaires (0 = jour même de date_limite, négatif = dépassé). */
export function joursRestants(date: Date | null): number | null {
  if (!date) return null;
  const maintenant = new Date();
  const debutAujourdhui = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  const jourLimite = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((jourLimite.getTime() - debutAujourdhui.getTime()) / 86_400_000);
}
