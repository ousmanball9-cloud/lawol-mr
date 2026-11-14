/**
 * Indice d'eligibilite par origine — contrat `docs/contrat-metadata-offres.md` 2.2.
 *
 * Regle de SILENCE : `null` quand il n'y a rien de sur a ecrire. `inconnu`, un
 * indice hors contrat ou une preuve absente ne produisent aucun libelle : un
 * indice sans provenance n'est pas affichable, et l'ecran n'invente jamais une
 * eligibilite.
 *
 * Ne JAMAIS masquer une offre sur cet indice (decision du 05/11/2026) :
 * `pays_etudes` dit *ou l'on etudie*, pas *qui peut candidater*. Ce module ne
 * sert qu'a NOMMER un indice deja publie par la source.
 */

export type IndiceOrigine = "compatible" | "incompatible";

/** D'ou vient l'indice : `source` = champ publie, `texte` = phrase du descriptif. */
export type PreuveOrigine = "texte" | "source";

export type OrigineEligible = {
  indice: IndiceOrigine;
  preuve: PreuveOrigine;
};

/** Libelles compacts : ils tiennent en suffixe de la ligne « pays · categorie ». */
const LIBELLES: Record<IndiceOrigine, string> = {
  compatible: "compatible",
  incompatible: "non compatible",
};

const PREUVES: PreuveOrigine[] = ["texte", "source"];

/** « compatible » / « non compatible » — ou `null` (silence, cas majoritaire). */
export function libelleOrigine(
  origine: OrigineEligible | null | undefined,
): string | null {
  if (!origine || typeof origine !== "object") return null;
  const { indice, preuve } = origine;
  if (indice !== "compatible" && indice !== "incompatible") return null;
  if (!PREUVES.includes(preuve)) return null;
  return LIBELLES[indice];
}

/** Vrai si l'indice peut etre montre (meme regle que `libelleOrigine`). */
export function origineAffichable(
  origine: OrigineEligible | null | undefined,
): boolean {
  return libelleOrigine(origine) !== null;
}
