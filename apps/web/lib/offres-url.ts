/**
 * Facettes du catalogue `/offres` ⇄ URL (V2-04).
 *
 * Objectif produit : un lien collé dans un navigateur neuf
 * (`/offres?pays=allemagne&tri=recentes&filiere=informatique`) rend EXACTEMENT
 * les offres filtrées, et le retour arrière restaure les filtres.
 *
 * Deux règles, testées dans `__tests__/offres/facettes-url.test.ts` :
 *   1. LECTURE tolérante — une valeur inconnue ou invalide est ignorée (repli sur
 *      le défaut), un paramètre inconnu (`utm_source`…) n'empêche rien. Une URL
 *      bricolée à la main ne casse jamais le catalogue.
 *   2. ÉCRITURE propre — un défaut n'apparaît JAMAIS dans l'URL : pas de
 *      `tri=urgent`, `page=1`, `filiere=tous`, `categorie=toutes` ni
 *      `recherche=` vide. Un lien partagé ne porte que ce qui filtre vraiment.
 *
 * Le module est pur (aucun import React/Next) : la page décide quand écrire,
 * l'URL ne décide jamais toute seule — c'est ce qui interdit la boucle
 * URL → état → URL.
 */
import {
  FILIERES,
  PAYS_ETUDES,
  TYPES_FINANCEMENT,
  estCategorieBourse,
} from "@/components/offres/types";
import type { TriOffres } from "@/components/offres/types";

/** Valeur « aucune restriction » des facettes à choix simple. */
export const AUCUN_FILTRE = "tous";
/** Valeur « aucune restriction » de la catégorie de bourse (pluriel, historique). */
export const TOUTES_CATEGORIES = "toutes";
/** Longueur maximale d'une recherche : même plafond que le nettoyage de l'API. */
export const MAX_RECHERCHE = 80;

/** Taille d'une page du catalogue — source unique pour la page ET pour l'API. */
export const OFFRES_PAR_PAGE = 12;

/**
 * On demande UNE ligne de plus que la page (12 + 1 = 13) : la 13ᵉ n'est jamais
 * affichée, sa seule présence répond à « y a-t-il une page suivante ? ».
 *
 * Pourquoi une sonde et pas un total : `GET /api/v1/offres` renvoie une LISTE
 * nue (aucun champ `total` dans le corps) et le backend ne compte pas. Plutôt
 * que d'inventer un nombre de pages, la pagination est « au fil de l'eau » :
 * Précédent · Page N · Suivant (cf. `PaginationOffres`). C'est une décision
 * assumée, pas un oubli.
 */
export const LIMITE_PAGE_SONDEE = OFFRES_PAR_PAGE + 1;

/**
 * Offset serveur de la page `page` (1 = première page → offset 0).
 * Une valeur illisible retombe sur la première page : une URL bricolée ne doit
 * jamais produire un offset négatif ou non entier.
 */
export function offsetDepuisPage(page: number): number {
  const sure = Number.isSafeInteger(page) && page > 0 ? page : 1;
  return (sure - 1) * OFFRES_PAR_PAGE;
}

export type FacettesOffres = {
  /** Texte cherché (`?recherche=`), déjà trimé. */
  recherche: string;
  /** `toutes` ou une valeur de `CATEGORIES_BOURSE` (filtrée CÔTÉ SERVEUR). */
  categorie: string;
  /** `tous` ou une valeur de `FILIERES`. */
  filiere: string;
  /** `tous` ou une valeur de `PAYS_ETUDES`. */
  pays: string;
  /** `tous` ou une valeur de `TYPES_FINANCEMENT`. */
  financement: string;
  tri: TriOffres;
  /** Filtre « Clôture dans moins de 30 jours ». */
  cloture30: boolean;
  /** État explicite « Afficher les expirées » (masquées par défaut). */
  expirees: boolean;
  /** Page affichée (1 = première, jamais écrite dans l'URL). */
  page: number;
};

/** Catalogue sans aucun filtre — la référence qui n'écrit RIEN dans l'URL. */
export const FACETTES_PAR_DEFAUT: FacettesOffres = {
  recherche: "",
  categorie: TOUTES_CATEGORIES,
  filiere: AUCUN_FILTRE,
  pays: AUCUN_FILTRE,
  financement: AUCUN_FILTRE,
  tri: "urgent",
  cloture30: false,
  expirees: false,
  page: 1,
};

/** Les clés qui appartiennent aux facettes (tout le reste est préservé tel quel). */
export const CLES_FACETTES = [
  "recherche",
  "categorie",
  "filiere",
  "pays",
  "financement",
  "tri",
  "cloture30",
  "expirees",
  "page",
] as const;

/** Tout ce qui sait lire un paramètre : `URLSearchParams`, `ReadonlyURLSearchParams`… */
type LecteurParametres = { get(nom: string): string | null };

const valeursConnues = (liste: { valeur: string }[]) => new Set(liste.map((v) => v.valeur));

const FILIERES_CONNUES = valeursConnues(FILIERES);
const PAYS_CONNUS = valeursConnues(PAYS_ETUDES);
const FINANCEMENTS_CONNUS = valeursConnues(TYPES_FINANCEMENT);

/** Valeur d'enum valide, sinon le défaut (aucune valeur inventée). */
function lireEnum(
  source: LecteurParametres,
  nom: string,
  connues: Set<string>,
  defaut: string
): string {
  const brut = source.get(nom);
  return brut !== null && connues.has(brut) ? brut : defaut;
}

/** `1`/`true` = actif ; toute autre valeur retombe sur l'état par défaut. */
function lireBascule(source: LecteurParametres, nom: string): boolean {
  const brut = source.get(nom);
  return brut === "1" || brut === "true";
}

/** Entier ≥ 2 (page 1 = défaut, donc absente) ; tout le reste → 1. */
function lirePage(brut: string | null): number {
  if (!brut || !/^\d+$/.test(brut)) return 1;
  const valeur = Number(brut);
  return Number.isSafeInteger(valeur) && valeur > 1 ? valeur : 1;
}

/**
 * Lit les facettes d'une URL. Jamais d'exception : une valeur invalide est
 * ignorée (repli sur le défaut), un paramètre inconnu est simplement laissé
 * de côté par la lecture (mais préservé à l'écriture).
 */
export function lireFacettes(source: LecteurParametres): FacettesOffres {
  const recherche = (source.get("recherche") ?? "").trim().slice(0, MAX_RECHERCHE);
  const categorie = source.get("categorie");
  const tri = source.get("tri");
  return {
    recherche,
    categorie: estCategorieBourse(categorie) ? categorie : TOUTES_CATEGORIES,
    filiere: lireEnum(source, "filiere", FILIERES_CONNUES, AUCUN_FILTRE),
    pays: lireEnum(source, "pays", PAYS_CONNUS, AUCUN_FILTRE),
    financement: lireEnum(source, "financement", FINANCEMENTS_CONNUS, AUCUN_FILTRE),
    tri: tri === "recentes" ? "recentes" : "urgent",
    cloture30: lireBascule(source, "cloture30"),
    expirees: lireBascule(source, "expirees"),
    page: lirePage(source.get("page")),
  };
}

/**
 * Sérialise les facettes en paramètres d'URL, en n'écrivant QUE ce qui filtre
 * (un défaut est omis). `existantes` permet de conserver les paramètres qui
 * n'appartiennent pas au catalogue (`utm_source`…) sans les dupliquer.
 */
export function ecrireFacettes(
  facettes: FacettesOffres,
  existantes?: URLSearchParams
): URLSearchParams {
  const parametres = new URLSearchParams(existantes);
  for (const cle of CLES_FACETTES) parametres.delete(cle);

  const recherche = facettes.recherche.trim().slice(0, MAX_RECHERCHE);
  if (recherche) parametres.set("recherche", recherche);
  if (estCategorieBourse(facettes.categorie)) parametres.set("categorie", facettes.categorie);
  if (FILIERES_CONNUES.has(facettes.filiere)) parametres.set("filiere", facettes.filiere);
  if (PAYS_CONNUS.has(facettes.pays)) parametres.set("pays", facettes.pays);
  if (FINANCEMENTS_CONNUS.has(facettes.financement)) {
    parametres.set("financement", facettes.financement);
  }
  if (facettes.tri === "recentes") parametres.set("tri", "recentes");
  if (facettes.cloture30) parametres.set("cloture30", "1");
  if (facettes.expirees) parametres.set("expirees", "1");
  if (facettes.page > 1) parametres.set("page", String(Math.floor(facettes.page)));

  return parametres;
}

/** URL complète du catalogue (`/offres` ou `/offres?…`). */
export function urlOffres(facettes: FacettesOffres, existantes?: URLSearchParams): string {
  const requete = ecrireFacettes(facettes, existantes).toString();
  return requete ? `/offres?${requete}` : "/offres";
}

/**
 * Égalité d'URL indépendante de l'ORDRE des paramètres : `?a=1&b=2` et
 * `?b=2&a=1` décrivent le même état — comparer les chaînes brutes ferait
 * réécrire l'URL à chaque rendu (source de boucle).
 */
export function memeParametres(a: URLSearchParams, b: URLSearchParams): boolean {
  const signature = (parametres: URLSearchParams) =>
    [...parametres.entries()]
      .map(([cle, valeur]) => `${cle}=${valeur}`)
      .sort()
      .join("&");
  return signature(a) === signature(b);
}

/**
 * Signature des facettes SANS la recherche ni la page : c'est elle qui décide
 * si un changement mérite une entrée d'historique (filtre) ou une simple
 * réécriture (frappe, pagination).
 */
export function cleFiltres(facettes: FacettesOffres): string {
  return ecrireFacettes({ ...facettes, recherche: "", page: 1 }).toString();
}
