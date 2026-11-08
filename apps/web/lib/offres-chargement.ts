/**
 * Chargement du catalogue `/offres` — la couche I/O, hors React (05/11/2026).
 *
 * Séparée de la page pour deux raisons :
 *   · la page ne garde que l'état et le rendu (l'URL reste la seule source de
 *     vérité des facettes, cf. `lib/offres-url.ts`) ;
 *   · la stratégie de pagination se lit ici, en un endroit.
 *
 * UN SEUL MODE : toutes les facettes sont exprimables par l'API, donc on ne
 * demande qu'UNE page (13 lignes) par affichage. `GET /api/v1/offres` accepte
 * `tri`, `q`, `categorie`, `filiere`, `pays`, `financement`, `cloture30`,
 * `limit`, `offset` — et répond une LISTE NUE, sans total.
 */
import type { Offre, TriOffres } from "@/components/offres/types";
import {
  AUCUN_FILTRE,
  LIMITE_PAGE_SONDEE,
  OFFRES_PAR_PAGE,
  TOUTES_CATEGORIES,
  offsetDepuisPage,
} from "@/lib/offres-url";
import { jalonFetchDebut, jalonFetchFin } from "@/lib/perf-offres";

/** Filtres réellement exprimables par `GET /api/v1/offres` (enums identiques). */
export type RequeteCatalogue = {
  tri: TriOffres;
  /** Recherche texte, déjà trimée (`q`). */
  q: string;
  /** `toutes` ou une catégorie de bourse. */
  categorie: string;
  /** `tous` ou une filière. */
  filiere: string;
  /** `tous` ou un pays d'études. */
  pays: string;
  /** `tous` ou une valeur de `TYPES_FINANCEMENT` (enum API, égalité exacte). */
  financement: string;
  /** Fenêtre « clôture dans moins de 30 jours » (`date_limite ≤ today+29`). */
  cloture30: boolean;
};

/** Une page servie par l'API : les cartes + la réponse de la sonde. */
export type PageApi = { cartes: Offre[]; aSuivante: boolean };

/**
 * Paramètres serveur de la requête.
 * `filiere`, `pays`, `financement` et `cloture30` sont poussés au serveur : les
 * enums de `lib/referentiels.ts` sont ceux de l'API, donc le sous-ensemble
 * filtré est identique — et la pagination porte sur CE sous-ensemble, pas sur
 * le catalogue entier.
 * `type_offre=bourse` : le catalogue public ne sert QUE des bourses — les
 * offres d'emploi/stage collectées restent en base (matching, admin) mais ne
 * sont jamais publiées ici (décision produit du 16/10).
 */
export function parametresRequete(requete: RequeteCatalogue): URLSearchParams {
  const parametres = new URLSearchParams({ tri: requete.tri, type_offre: "bourse" });
  if (requete.q) parametres.set("q", requete.q);
  if (requete.categorie !== TOUTES_CATEGORIES) parametres.set("categorie", requete.categorie);
  if (requete.filiere !== AUCUN_FILTRE) parametres.set("filiere", requete.filiere);
  if (requete.pays !== AUCUN_FILTRE) parametres.set("pays", requete.pays);
  if (requete.financement !== AUCUN_FILTRE) parametres.set("financement", requete.financement);
  if (requete.cloture30) parametres.set("cloture30", "1");
  return parametres;
}

/**
 * Charge UNE page (12 cartes) et rien de plus.
 *
 * `limit=13` = 12 cartes + 1 sonde : si l'API renvoie 13 lignes, il en existe
 * au moins une après cette page. On jette la 13ᵉ (jamais affichée) et on retient
 * le fait. Aucun total n'est demandé ni inventé.
 */
export async function chargerPageApi(requete: RequeteCatalogue, page: number): Promise<PageApi> {
  const parametres = parametresRequete(requete);
  parametres.set("limit", String(LIMITE_PAGE_SONDEE));
  parametres.set("offset", String(offsetDepuisPage(page)));
  // V2-06 : jalon AVANT la requête, fin en `finally` (même si l'API échoue,
  // sinon un échec laisserait une durée de fetch fantôme). Instrumentation
  // seule : aucun effet sur le chargement.
  jalonFetchDebut();
  try {
    const res = await fetch(`/api/v1/offres?${parametres.toString()}`);
    if (!res.ok) throw new Error();
    const data: unknown = await res.json();
    if (!Array.isArray(data)) throw new Error();
    const lignes = data as Offre[];
    return {
      cartes: lignes.slice(0, OFFRES_PAR_PAGE),
      aSuivante: lignes.length > OFFRES_PAR_PAGE,
    };
  } finally {
    jalonFetchFin();
  }
}
