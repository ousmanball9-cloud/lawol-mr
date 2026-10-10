/** Offre publique — forme renvoyée par GET /api/v1/offres et /api/v1/offres/{id}. */
export type Offre = {
  id: string;
  titre: string;
  entreprise: string;
  ville: string;
  filieres_cibles: string[];
  type_offre: string;
  description: string;
  date_limite: string;
  contact_email?: string | null;
  contact_whatsapp?: string | null;
  source_name?: string | null;
  source_url?: string | null;
  active: boolean;
};

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
  { valeur: "autre", label: "Autre" },
];

const LABELS_FILIERES = new Map(FILIERES.map((f) => [f.valeur, f.label]));

/** Libellé lisible d'une filière (valeur enum → label, repli : snake_case → texte). */
export function labelFiliere(valeur: string): string {
  return LABELS_FILIERES.get(valeur) ?? valeur.replace(/_/g, " ");
}

/** Enum Ville de l'apps/api. */
export const VILLES: { valeur: string; label: string }[] = [
  { valeur: "nouakchott", label: "Nouakchott" },
  { valeur: "nouadhibou", label: "Nouadhibou" },
  { valeur: "kaedi", label: "Kaédi" },
  { valeur: "rosso", label: "Rosso" },
  { valeur: "aleg", label: "Aleg" },
  { valeur: "autre", label: "Autre" },
];
