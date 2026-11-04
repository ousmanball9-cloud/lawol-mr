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

/**
 * Référentiels métier (filières, villes, niveaux, pays, types d'offre, types de
 * financement, catégories de bourse) + leurs libellés : SOURCE UNIQUE dans
 * `lib/referentiels.ts` (backlog V3-05, constat A3/A4 de la chasse 0).
 *
 * Ce fichier ne fait que ré-exporter : les imports historiques
 * `@/components/offres/types` continuent de fonctionner à l'identique, et il
 * n'existe plus qu'un seul endroit où ajouter une valeur métier.
 */
export {
  FILIERES,
  FILIERES_FORMULAIRE,
  VILLES,
  NIVEAUX,
  PAYS_ETUDES,
  TYPES_OFFRES,
  TYPES_FINANCEMENT,
  CATEGORIES_BOURSE,
  labelFiliere,
  labelVille,
  labelNiveau,
  labelPays,
  labelFinancement,
  labelTypeOffre,
  labelCategorieBourse,
  estCategorieBourse,
} from "@/lib/referentiels";
export type { CategorieBourse, Option } from "@/lib/referentiels";
