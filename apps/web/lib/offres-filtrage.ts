/**
 * Filtrage local du catalogue `/offres` — pur, hors React (05/11/2026).
 *
 * Déplacé de `app/offres/page.tsx` sans réécriture : mêmes exclusions, même tri
 * stable. La page ne garde que l'état et le rendu ; échéances, raffinement et
 * tri se lisent ici, en un seul endroit.
 *
 * `financement` et la fenêtre « clôture < 30 j » sont désormais servis par
 * l'API : le serveur en est l'autorité, aucun raffinement local ne les rejoue.
 */
import { joursRestants, parserDateLimite } from "@/components/offres/date-limite";
import type { Offre, TriOffres } from "@/components/offres/types";

/** Offre enrichie de son échéance : jours restants (null = date illisible). */
export type Echeance = { offre: Offre; jours: number | null };

/** Facettes raffinées en mémoire sur les cartes de la page. */
export type FiltresLocaux = {
  filiere: string;
  pays: string;
  expirees: boolean;
  tri: TriOffres;
};

/** Rang du tri « plus urgentes » : 0 = encore ouvert, 1 = expirée, 2 = sans date lisible. */
export function rangEcheance(jours: number | null): number {
  if (jours === null) return 2;
  return jours < 0 ? 1 : 0;
}

/**
 * Même nettoyage que `_motif_recherche` côté API : les caractères retirés par le
 * serveur (syntaxe du filtre PostgREST) ne doivent pas créer d'écart entre le
 * sous-ensemble renvoyé par l'API et le filtre local qui le raffine.
 */
export function normaliserRecherche(q: string): string {
  return q
    .replace(/[^A-Za-z0-9_\s\-'À-ÖØ-öø-ÿ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/** Échéance recalculée une seule fois par offre (parse + jours restants). */
export function calculerEcheances(offres: Offre[]): Echeance[] {
  return offres.map((offre) => ({
    offre,
    jours: joursRestants(parserDateLimite(offre.date_limite)),
  }));
}

/**
 * Raffine le sous-ensemble serveur, compte les expirées (même masquées) et
 * applique le tri local. Retourne la liste retenue et le nombre d'expirées.
 */
export function filtrerEtTrier(
  echeances: Echeance[],
  motsCles: string,
  facettes: FiltresLocaux
): { liste: Echeance[]; nbExpirees: number } {
  const q = normaliserRecherche(motsCles).toLowerCase();
  const correspond = (offre: Offre) => {
    if (facettes.filiere !== "tous" && !(offre.filieres_cibles ?? []).includes(facettes.filiere))
      return false;
    if (facettes.pays !== "tous" && offre.pays_etudes !== facettes.pays) return false;
    // q : le SERVEUR est l'autorité (il cherche dans titre, entreprise ET
    // description intégrale). Le raffinement local ne regarde donc PAS la
    // description : la liste ne porte qu'un aperçu (`description_apercu`),
    // s'y fier exclurait à tort une offre dont le mot-clé tombe plus loin.
    if (
      q &&
      !`${offre.titre} ${offre.entreprise} ${offre.pays_etudes ?? ""}`
        .toLowerCase()
        .includes(q)
    )
      return false;
    return true;
  };

  const retenues: Echeance[] = [];
  let expirees = 0;
  for (const e of echeances) {
    if (!correspond(e.offre)) continue;
    const expiree = e.jours !== null && e.jours < 0;
    // Comptées même masquées : l'état « Afficher les expirées » les révèle.
    if (expiree) expirees += 1;
    if (expiree && !facettes.expirees) {
      continue; // masquées par défaut, jamais supprimées : bascule explicite
    }
    retenues.push(e);
  }

  if (facettes.tri === "urgent") {
    // L'API renvoie déjà `date_limite` croissante (`tri=urgent`) : ce tri local
    // est un garde-fou (dates illisibles en dernier rang, expirées en fin de
    // liste). Échéance proche d'abord ; sans date lisible au dernier rang ;
    // expirées (si affichées) en toute fin, la plus récemment close en tête.
    // Sort stable : à rang égal, l'ordre renvoyé par l'API est conservé.
    retenues.sort((a, b) => {
      const rang = rangEcheance(a.jours) - rangEcheance(b.jours);
      if (rang !== 0) return rang;
      if (a.jours !== null && a.jours < 0) return (b.jours ?? 0) - (a.jours ?? 0);
      return (a.jours ?? 0) - (b.jours ?? 0);
    });
  }
  // tri « recentes » : aucun réordonnancement — l'API renvoie déjà
  // `date_scrape DESC` (offres les plus fraîches en tête).
  return { liste: retenues, nbExpirees: expirees };
}
