/**
 * Référentiels métier du web LAWOL — SOURCE UNIQUE (backlog V3-05, constat A3/A4
 * de `docs/chasse/00-etat-des-lieux.md`).
 *
 * Règle : aucune liste de valeurs métier (filière, ville, niveau, pays, type
 * d'offre, catégorie de bourse, financement) ne se recopie dans une page ou un
 * composant. On importe d'ici — `components/offres/types.ts` ré-exporte pour ne
 * casser aucun import historique.
 *
 * Ajouter une filière / une ville / un niveau = UNE ligne ici (+ l'enum backend
 * `apps/api/app/modules/shared/models.py`).
 */

/** Couple valeur persistée (enum backend) → libellé affiché. */
export type Option = { valeur: string; label: string };

/**
 * Enum `Filiere` de `apps/api` — liste complète (35 valeurs), affichée TELLE
 * QUELLE par les formulaires : un étudiant en génie des procédés, en cybersécurité
 * ou en urbanisme doit pouvoir se déclarer (décision produit du 04/11/2026 :
 * la curation à 10 options est supprimée, elle obligeait à choisir « Autre »).
 */
export const FILIERES: Option[] = [
  { valeur: "informatique", label: "Informatique" },
  { valeur: "genie_civil", label: "Génie civil" },
  { valeur: "electrique", label: "Électrique" },
  { valeur: "mecanique", label: "Mécanique" },
  { valeur: "gestion", label: "Gestion" },
  { valeur: "finance", label: "Finance" },
  { valeur: "droit", label: "Droit" },
  { valeur: "medecine", label: "Médecine" },
  { valeur: "agronomie", label: "Agronomie" },
  { valeur: "genie_procedes", label: "Génie des procédés" },
  { valeur: "environnement", label: "Environnement" },
  { valeur: "genie_chimique", label: "Génie chimique" },
  { valeur: "genie_industriel", label: "Génie industriel" },
  { valeur: "telecoms", label: "Télécoms" },
  { valeur: "reseaux", label: "Réseaux" },
  { valeur: "cybersecurite", label: "Cybersécurité" },
  { valeur: "data_science", label: "Data Science" },
  { valeur: "intelligence_artificielle", label: "Intelligence artificielle" },
  { valeur: "mathematiques", label: "Mathématiques" },
  { valeur: "physique", label: "Physique" },
  { valeur: "chimie", label: "Chimie" },
  { valeur: "biologie", label: "Biologie" },
  { valeur: "geologie", label: "Géologie" },
  { valeur: "hydraulique", label: "Hydraulique" },
  { valeur: "topographie", label: "Topographie" },
  { valeur: "architecture", label: "Architecture" },
  { valeur: "urbanisme", label: "Urbanisme" },
  { valeur: "sciences_politiques", label: "Sciences politiques" },
  { valeur: "sociologie", label: "Sociologie" },
  { valeur: "psychologie", label: "Psychologie" },
  { valeur: "langues", label: "Langues" },
  { valeur: "lettres", label: "Lettres" },
  { valeur: "histoire", label: "Histoire" },
  { valeur: "geographie", label: "Géographie" },
  { valeur: "autre", label: "Autre" },
];

/** Enum `Ville` de `apps/api` (ordre SQL, même liste que le schéma). */
export const VILLES: Option[] = [
  { valeur: "nouakchott", label: "Nouakchott" },
  { valeur: "nouadhibou", label: "Nouadhibou" },
  { valeur: "kaedi", label: "Kaédi" },
  { valeur: "rosso", label: "Rosso" },
  { valeur: "aleg", label: "Aleg" },
  { valeur: "autre", label: "Autre" },
];

/**
 * Niveaux d'études (`profils.niveau`). Pas d'enum backend : la valeur persistée
 * EST le libellé (`M2`, `L3`…), d'où un simple tableau de chaînes.
 */
export const NIVEAUX: string[] = ["L1", "L2", "L3", "M1", "M2", "Autre"];

/** Enum `PaysEtudes` pour les bourses. */
export const PAYS_ETUDES: Option[] = [
  { valeur: "france", label: "France" },
  { valeur: "canada", label: "Canada" },
  { valeur: "usa", label: "États-Unis" },
  { valeur: "allemagne", label: "Allemagne" },
  { valeur: "royaume_uni", label: "Royaume-Uni" },
  { valeur: "espagne", label: "Espagne" },
  { valeur: "italie", label: "Italie" },
  { valeur: "belgique", label: "Belgique" },
  { valeur: "suisse", label: "Suisse" },
  { valeur: "pays_bas", label: "Pays-Bas" },
  { valeur: "suede", label: "Suède" },
  { valeur: "norvege", label: "Norvège" },
  { valeur: "finlande", label: "Finlande" },
  { valeur: "danemark", label: "Danemark" },
  { valeur: "autriche", label: "Autriche" },
  { valeur: "irlande", label: "Irlande" },
  { valeur: "portugal", label: "Portugal" },
  { valeur: "grece", label: "Grèce" },
  { valeur: "pologne", label: "Pologne" },
  { valeur: "turquie", label: "Turquie" },
  { valeur: "maroc", label: "Maroc" },
  { valeur: "tunisie", label: "Tunisie" },
  { valeur: "algerie", label: "Algérie" },
  { valeur: "senegal", label: "Sénégal" },
  { valeur: "cote_ivoire", label: "Côte d'Ivoire" },
  // Destinations hors Europe/Afrique de l'Ouest (mesure du 27/10/2026 : 38
  // offres actives nommaient un de ces pays — invisibles au filtre « Pays »).
  { valeur: "japon", label: "Japon" },
  { valeur: "chine", label: "Chine" },
  { valeur: "coree_sud", label: "Corée du Sud" },
  { valeur: "inde", label: "Inde" },
  { valeur: "afrique_du_sud", label: "Afrique du Sud" },
  { valeur: "australie", label: "Australie" },
  { valeur: "nouvelle_zelande", label: "Nouvelle-Zélande" },
  { valeur: "russie", label: "Russie" },
  { valeur: "qatar", label: "Qatar" },
  { valeur: "arabie_saoudite", label: "Arabie saoudite" },
  { valeur: "egypte", label: "Égypte" },
  { valeur: "bresil", label: "Brésil" },
  { valeur: "mexique", label: "Mexique" },
  { valeur: "autre", label: "Autre pays" },
];

/** Enum `TypeOffre` (nature). Ordre = ordre d'affichage des cases de préférences. */
export const TYPES_OFFRES: Record<string, string> = {
  stage_pfe: "Stage PFE",
  stage_ete: "Stage été",
  emploi_junior: "Emploi junior",
  alternance: "Alternance",
  bourse: "Bourse d'études",
};

/** Enum `TypeFinancement`. */
export const TYPES_FINANCEMENT: Option[] = [
  { valeur: "fully_funded", label: "100% financée (fully funded)" },
  { valeur: "partiel", label: "Partiellement financée" },
  { valeur: "auto_finance", label: "Auto-financée" },
  { valeur: "inconnu", label: "Non précisé" },
];

/**
 * Catégories de bourse servies par l'API (`categorie_bourse`, filtre `?categorie=`).
 * Cette liste ne porte QUE les valeurs filtrables : `inconnu` (et l'absence de
 * valeur) ne s'affiche jamais et ne se filtre pas — zéro mensonge.
 */
export type CategorieBourse =
  | "gouvernementale"
  | "institutionnelle"
  | "fondation"
  | "entreprise";

export const CATEGORIES_BOURSE: { valeur: CategorieBourse; label: string }[] = [
  { valeur: "gouvernementale", label: "Gouvernementale" },
  { valeur: "institutionnelle", label: "Institutionnelle" },
  { valeur: "fondation", label: "Fondation" },
  { valeur: "entreprise", label: "Entreprise" },
];

const LABELS_FILIERES = new Map(FILIERES.map((f) => [f.valeur, f.label]));
const LABELS_VILLES = new Map(VILLES.map((v) => [v.valeur, v.label]));
const LABELS_PAYS = new Map(PAYS_ETUDES.map((p) => [p.valeur, p.label]));
const LABELS_FINANCEMENT = new Map(TYPES_FINANCEMENT.map((t) => [t.valeur, t.label]));
const LABELS_TYPES_OFFRE = new Map(Object.entries(TYPES_OFFRES));
const LABELS_CATEGORIES = new Map<string, string>(
  CATEGORIES_BOURSE.map((c) => [c.valeur, c.label])
);

/** snake_case → texte lisible (repli commun, jamais un libellé faux). */
function repli(valeur: string): string {
  return valeur.replace(/_/g, " ");
}

/** Libellé lisible d'une filière (valeur enum → label, repli : snake_case → texte). */
export function labelFiliere(valeur: string): string {
  return LABELS_FILIERES.get(valeur) ?? repli(valeur);
}

/** Libellé lisible d'une ville. */
export function labelVille(valeur: string): string {
  return LABELS_VILLES.get(valeur) ?? repli(valeur);
}

/** Libellé lisible d'un niveau d'études (la valeur fait foi). */
export function labelNiveau(valeur: string): string {
  return NIVEAUX.includes(valeur) ? valeur : repli(valeur);
}

/** Libellé lisible d'un pays d'études. */
export function labelPays(valeur: string): string {
  return LABELS_PAYS.get(valeur) ?? repli(valeur);
}

/** Libellé lisible d'un type de financement. */
export function labelFinancement(valeur: string): string {
  return LABELS_FINANCEMENT.get(valeur) ?? repli(valeur);
}

/** Libellé lisible du type d'offre ; repli : snake_case → texte (jamais faux). */
export function labelTypeOffre(valeur: string | null | undefined): string {
  if (!valeur) return "Offre";
  return LABELS_TYPES_OFFRE.get(valeur) ?? repli(valeur);
}

/** Libellé d'une catégorie de bourse ; `null` si inconnue ou absente (rien à
 *  afficher : mieux vaut aucun badge qu'un badge « Inconnu »). */
export function labelCategorieBourse(valeur: string | null | undefined): string | null {
  if (!valeur) return null;
  return LABELS_CATEGORIES.get(valeur) ?? null;
}

/** Vrai si la valeur est une catégorie filtrable (tout le reste → « toutes »). */
export function estCategorieBourse(valeur: string | null | undefined): valeur is CategorieBourse {
  return Boolean(valeur && LABELS_CATEGORIES.has(valeur));
}
