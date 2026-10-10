/** Types partagés de l'espace entreprise — miroir du contrat API P6-A. */

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

export type CandidatureEntreprise = {
  match_id: string;
  date_match: string;
  score: number;
  notifie: boolean;
  postule: boolean;
  favori: boolean;
  statut_candidature: string | null;
  profil: {
    id: string;
    nom: string;
    prenom: string;
    telephone: string;
    universite: string;
    filiere: string;
    niveau: string;
    ville: string;
  };
  offre: {
    id: string;
    titre: string;
    entreprise: string;
    ville: string;
    type_offre: string;
    date_limite: string;
  };
};

export type OffreCreateBody = {
  titre: string;
  ville: string;
  type_offre: string;
  date_limite: string;
  description: string;
  filieres_cibles: string[];
  contact_email?: string;
  contact_whatsapp?: string;
  token?: string;
};

export type LoginReponse = {
  token: string;
  entreprise_id: string;
  expires_in_jours: number;
};
