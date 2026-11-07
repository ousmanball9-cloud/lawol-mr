/**
 * Montant annoncé d'une offre — contrat `docs/contrat-metadata-offres.md` §2.1.
 *
 * Règle de silence : chaque fonction renvoie `null` quand il n'y a rien à dire.
 * Aucun appelant ne doit fabriquer un « non communiqué », un `0` ou un « € »
 * orphelin : la carte n'affiche RIEN, la fiche écrit l'absence à sa façon.
 *
 * `periode = "total"` veut dire « aucune périodicité publiée » : on n'ajoute
 * alors aucun qualificatif de durée (écrire « / an » serait une invention).
 */

export type PeriodeMontant = "mois" | "an" | "total";

export type Montant = {
  valeur: number;
  /** Code ISO 4217 à 3 lettres (`EUR`, `USD`, `HKD`, `NZD`…). */
  devise: string;
  periode: PeriodeMontant;
};

/** Symbole lisible ; une devise sans symbole connu s'affiche par son code. */
const SYMBOLES: Record<string, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  HKD: "HK$",
  NZD: "NZ$",
  CAD: "CA$",
  AUD: "AU$",
  SGD: "S$",
  BRL: "R$",
};

const SUFFIXE_PERIODE: Record<PeriodeMontant, string> = {
  mois: " / mois",
  an: " / an",
  total: "",
};

const NOMBRE = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/** « 1 400 € / mois », « 36 000 € », « 344 400 HK$ / an » — ou `null`. */
export function formaterMontant(montant: Montant | null | undefined): string | null {
  if (!montant) return null;
  const { valeur, devise, periode } = montant;
  if (!Number.isFinite(valeur) || valeur <= 0) return null;
  if (typeof devise !== "string" || !/^[A-Z]{3}$/.test(devise)) return null;
  if (periode !== "mois" && periode !== "an" && periode !== "total") return null;

  const symbole = SYMBOLES[devise] ?? devise;
  return `${NOMBRE.format(valeur)} ${symbole}${SUFFIXE_PERIODE[periode]}`;
}

/** Vrai si le montant peut être montré (même règle que `formaterMontant`). */
export function montantAffichable(montant: Montant | null | undefined): boolean {
  return formaterMontant(montant) !== null;
}
