/**
 * Calendrier de selection d'une offre — contrat
 * `docs/contrat-metadata-offres.md` 2.3 (lot V4-E).
 *
 * Regle de SILENCE, identique au contrat : `null` quand il n'y a pas de
 * parcours sur a montrer. Une seule etape se confond avec `date_limite` et
 * fabriquerait un faux parcours ; un ordre qui remonte le temps est le melange
 * de deux cycles, pas un calendrier. Dans tous ces cas l'ecran ne rend RIEN —
 * jamais un jalon reconstitue, jamais un texte de remplacement.
 *
 * Ce module est pur : il ne lit que la valeur servie par l'API (elle-meme
 * servie telle quelle depuis `metadata['calendrier']` si conforme).
 */

export type EtapeCalendrier =
  | "candidature"
  | "preselection"
  | "entretien"
  | "resultat";

export type CalendrierEtape = {
  etape: EtapeCalendrier;
  /** Date ISO `YYYY-MM-DD`, jamais relative. */
  date: string;
};

/** Les 4 etapes autorisees par le contrat, dans l'ordre metier. */
export const ETAPES_CALENDRIER: readonly EtapeCalendrier[] = [
  "candidature",
  "preselection",
  "entretien",
  "resultat",
] as const;

const LIBELLES: Record<EtapeCalendrier, string> = {
  candidature: "Candidature",
  preselection: "Présélection",
  entretien: "Entretien",
  resultat: "Résultat",
};

const FORMAT_DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function estEtape(valeur: unknown): valeur is EtapeCalendrier {
  return (
    typeof valeur === "string" &&
    (ETAPES_CALENDRIER as readonly string[]).includes(valeur)
  );
}

/** Vrai si `valeur` est une date calendaire reelle au format `YYYY-MM-DD`. */
function estDateIso(valeur: unknown): valeur is string {
  if (typeof valeur !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valeur)) {
    return false;
  }
  const [annee, mois, jour] = valeur.split("-").map(Number);
  const date = new Date(annee, mois - 1, jour);
  return (
    date.getFullYear() === annee &&
    date.getMonth() === mois - 1 &&
    date.getDate() === jour
  );
}

/**
 * Calendrier affichable, ou `null` (silence).
 *
 * Exige au moins 2 etapes, chacune objet `{ etape, date }`, etape du contrat et
 * unique, date ISO reelle, et dates STRICTEMENT croissantes dans l'ordre stocke
 * (contrat : ordre chronologique a l'ecriture).
 */
export function calendrierAffichable(
  calendrier: unknown,
): CalendrierEtape[] | null {
  if (!Array.isArray(calendrier) || calendrier.length < 2) return null;

  const etapes = new Set<EtapeCalendrier>();
  const retenues: CalendrierEtape[] = [];
  let precedente: string | null = null;

  for (const entree of calendrier) {
    if (typeof entree !== "object" || entree === null || Array.isArray(entree)) {
      return null;
    }
    const { etape, date } = entree as Record<string, unknown>;
    if (!estEtape(etape) || etapes.has(etape)) return null;
    if (!estDateIso(date)) return null;
    if (precedente !== null && date <= precedente) return null;
    etapes.add(etape);
    precedente = date;
    retenues.push({ etape, date });
  }

  return retenues;
}

/** Libelle francais d'une etape du contrat. */
export function libelleEtape(etape: EtapeCalendrier): string {
  return LIBELLES[etape];
}

/**
 * « 15 janvier 2027 » pour une date ISO valide ; la valeur brute sinon.
 * Aucune date inventee, aucun decalage de fuseau (construction locale).
 */
export function formaterDateEtape(valeur: string): string {
  if (!estDateIso(valeur)) return valeur;
  const [annee, mois, jour] = valeur.split("-").map(Number);
  return FORMAT_DATE.format(new Date(annee, mois - 1, jour));
}
