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

const LABELS_FILIERES = new Map(FILIERES.map((f) => [f.valeur, f.label]));
const LABELS_PAYS = new Map(PAYS_ETUDES.map((p) => [p.valeur, p.label]));
const LABELS_FINANCEMENT = new Map(TYPES_FINANCEMENT.map((t) => [t.valeur, t.label]));

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
