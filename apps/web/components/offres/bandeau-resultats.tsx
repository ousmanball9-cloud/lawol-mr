import type { TriOffres } from "@/components/offres/types";

/** Libellés du tri affichés dans le bandeau collant (le contrôle, lui, reste
 *  dans la barre de filtres : un seul `data-probe="offres-tri"`). */
const LIBELLES_TRI: Record<TriOffres, string> = {
  urgent: "Plus urgentes",
  recentes: "Plus récentes",
};

/**
 * Bandeau de résultats collant (V2-01) — le compteur était dans la carte de
 * filtres : dès qu'on faisait défiler la grille, il disparaissait.
 *
 * `top` = hauteur du header sticky (h-16 = 4rem) + sa bordure de 1 px, pour se
 * poser EXACTEMENT sous lui (cf. `components/chrome/header.tsx`). z-30 < z-40 :
 * le header reste au-dessus, et le panneau mobile (z-50) couvre les deux.
 *
 * `total === null` = l'API ne fournit pas de total : on annonce alors la PAGE
 * (« · page 3 ») et la seule chose qu'on sache de la suite (« d'autres
 * suivent », « dernière »). Jamais un « sur 271 » reconstitué.
 */
export function BandeauResultats({
  nbAffichees,
  total,
  page,
  aSuivante,
  nbExpirees,
  expireesVisibles,
  cloture30,
  tri,
}: {
  nbAffichees: number;
  /** Total filtré connu, ou `null` quand l'API ne le communique pas. */
  total: number | null;
  page: number;
  aSuivante: boolean;
  nbExpirees: number;
  expireesVisibles: boolean;
  cloture30: boolean;
  tri: TriOffres;
}) {
  return (
    <div
      data-probe="offres-bandeau"
      className="sticky top-[calc(4rem_+_1px)] z-30 -mx-4 mb-4 border-y border-border bg-background/95 px-4 py-2 backdrop-blur md:mx-0 md:rounded-lg md:border"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p role="status" className="text-sm text-muted-foreground">
          <span data-probe="offres-compteur">{nbAffichees}</span> offre
          {nbAffichees > 1 ? "s" : ""} affichée{nbAffichees > 1 ? "s" : ""}
          {total !== null && nbAffichees !== total ? ` sur ${total}` : ""}
          {total === null && page > 1 ? ` · page ${page}` : ""}
          {total === null && page > 1 && !aSuivante ? " (dernière)" : ""}
          {total === null && page === 1 && aSuivante ? " · d'autres suivent" : ""}
          {!expireesVisibles && nbExpirees > 0 && !cloture30
            ? ` · ${nbExpirees} expirée${nbExpirees > 1 ? "s" : ""} masquée${
                nbExpirees > 1 ? "s" : ""
              } (affichables ci-dessus)`
            : ""}
          {cloture30 && nbExpirees > 0
            ? " · fenêtre 30 j : offres closes exclues (désactive le filtre pour les afficher)"
            : ""}
        </p>
        <p className="shrink-0 text-sm text-muted-foreground">
          Tri :{" "}
          <span className="font-medium text-foreground">{LIBELLES_TRI[tri]}</span>
        </p>
      </div>
    </div>
  );
}
