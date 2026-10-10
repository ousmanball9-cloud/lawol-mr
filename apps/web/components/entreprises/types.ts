/** Entreprise de l'annuaire — forme de GET /api/v1/entreprises (EntreprisePublique). */
export type Entreprise = {
  id: string;
  nom: string;
  ville: string;
  secteur: string | null;
  nb_offres_actives: number;
};

/** Offre d'une fiche entreprise — forme de OffreEntrepriseResume (API P6-A). */
export type OffreEntreprise = {
  id: string;
  titre: string;
  ville: string;
  type_offre: string;
  date_limite: string;
  statut_publication: string;
  active: boolean;
  url_publique: string | null;
  nb_matches: number;
  nb_postules: number;
};

/** Fiche complète — forme de GET /api/v1/entreprises/{id} (EntrepriseFiche). */
export type FicheEntreprise = Entreprise & {
  description: string | null;
  site_url: string | null;
  telephone: string | null;
  email_contact: string | null;
  logo_url: string | null;
  verifiee: boolean;
  created_at: string | null;
  offres: OffreEntreprise[];
};

/** Enum Ville de l'apps/api (options du filtre ville). */
export const VILLES: { valeur: string; label: string }[] = [
  { valeur: "nouakchott", label: "Nouakchott" },
  { valeur: "nouadhibou", label: "Nouadhibou" },
  { valeur: "kaedi", label: "Kaédi" },
  { valeur: "rosso", label: "Rosso" },
  { valeur: "aleg", label: "Aleg" },
  { valeur: "autre", label: "Autre" },
];
