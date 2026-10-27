/** Offre publique — forme renvoyée par GET /api/v1/offres et /api/v1/offres/{id}. */
export type Offre = {
  id: string;
  titre: string;
  entreprise: string;
  pays_etudes: string | null;
  filieres_cibles: string[];
  type_offre: string;
  type_financement: string;
  description: string;
  /** Aperçu court servi par la LISTE `/api/v1/offres` (la carte n'affiche que
   *  deux lignes) : dans la liste, `description` est vide et seul cet aperçu
   *  porte du texte. Le DÉTAIL `/api/v1/offres/{id}` remplit `description`
   *  (texte intégral) et laisse l'aperçu vide. */
  description_apercu?: string | null;
  date_limite: string;
  contact_email?: string | null;
  contact_whatsapp?: string | null;
  source_name?: string | null;
  source_url?: string | null;
  /** Qui finance la bourse — `gouvernementale | institutionnelle | fondation |
   *  entreprise | inconnu` (enum backend). Absent sur les charges anciennes. */
  categorie_bourse?: string | null;
  active: boolean;
};

/** Clé du type mis en vedette (« Bourse » en tête des filtres et sélections). */
export const TYPE_EN_TETE = "bourse";

/**
 * Ordre d'affichage du catalogue /offres :
 *  · « urgent »   (défaut) → échéance la plus proche d'abord (bourses sans date
 *    exploitable en dernier ; expirées rejetées en fin de liste).
 *  · « recentes » → ordre naturel de l'API, qui renvoie déjà `date_scrape DESC`
 *    (offres les plus fraîches en tête) : aucun réordonnancement.
 */
export type TriOffres = "urgent" | "recentes";

/** Enum Filiere de l'apps/api (ordre d'affichage du filtre). */
export const FILIERES: { valeur: string; label: string }[] = [
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

/** Enum Pays d'études pour les bourses. */
export const PAYS_ETUDES: { valeur: string; label: string }[] = [
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
  { valeur: "autre", label: "Autre pays" },
];

/** Enum Type de financement. */
export const TYPES_FINANCEMENT: { valeur: string; label: string }[] = [
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
const LABELS_PAYS = new Map(PAYS_ETUDES.map((p) => [p.valeur, p.label]));
const LABELS_FINANCEMENT = new Map(TYPES_FINANCEMENT.map((t) => [t.valeur, t.label]));
const LABELS_CATEGORIES = new Map<string, string>(
  CATEGORIES_BOURSE.map((c) => [c.valeur, c.label])
);

/** Libellé lisible d'une filière (valeur enum → label, repli : snake_case → texte). */
export function labelFiliere(valeur: string): string {
  return LABELS_FILIERES.get(valeur) ?? valeur.replace(/_/g, " ");
}

/** Libellé lisible d'un pays d'études. */
export function labelPays(valeur: string): string {
  return LABELS_PAYS.get(valeur) ?? valeur.replace(/_/g, " ");
}

/** Libellé lisible d'un type de financement. */
export function labelFinancement(valeur: string): string {
  return LABELS_FINANCEMENT.get(valeur) ?? valeur.replace(/_/g, " ");
}

/** Libellé d'une catégorie de bourse ; `null` si inconnue ou absente (rien à
 *  afficher : mieux vaut aucun badge qu'un badge « Inconnu »). */
export function labelCategorieBourse(valeur: string | null | undefined): string | null {
  if (!valeur) return null;
  return LABELS_CATEGORIES.get(valeur) ?? null;
}

/**
 * Libellés du type d'offre (nature), valeurs SQL historiques incluses.
 *
 * Pourquoi cette table existe (27/10/2026) : la carte du profil affichait
 * « Bourse d'études » **en dur** pour tout match, y compris un stage PFE ou un
 * emploi junior. L'étudiant lisait donc un badge faux sur sa propre page.
 */
const LABELS_TYPES_OFFRE = new Map<string, string>([
  ["bourse", "Bourse d'études"],
  ["stage_pfe", "Stage PFE"],
  ["stage_ete", "Stage d'été"],
  ["emploi_junior", "Emploi junior"],
  ["alternance", "Alternance"],
]);

/** Libellé lisible du type d'offre ; repli : snake_case → texte (jamais faux). */
export function labelTypeOffre(valeur: string | null | undefined): string {
  if (!valeur) return "Offre";
  return LABELS_TYPES_OFFRE.get(valeur) ?? valeur.replace(/_/g, " ");
}

/** Vrai si la valeur est une catégorie filtrable (tout le reste → « toutes »). */
export function estCategorieBourse(valeur: string | null | undefined): valeur is CategorieBourse {
  return Boolean(valeur && LABELS_CATEGORIES.has(valeur));
}
