import { Button } from "@/components/ui/button";
import { EmptyGuidant } from "@/components/empty/EmptyGuidant";

type Props = {
  /** Page demandée (`facettes.page`) — sert au texte et au recul. */
  page: number;
  /** `?page=99` fabriqué : la page demandée n'existe pas. */
  pageHorsCatalogue: boolean;
  /** Catalogue réellement vide (aucun filtre) vs filtres trop étroits. */
  catalogueVide: boolean;
  /** Le sous-ensemble serveur n'est pas vide (mode bassin). */
  aDesOffres: boolean;
  /** Un filtre (ou une frappe) est actif. */
  filtreActif: boolean;
  onAllerPage: (page: number) => void;
  onReinitialiser: () => void;
};

/**
 * État vide du catalogue — déplacé de `app/offres/page.tsx` sans réécriture.
 *
 * Bibliothèque d'états existante (V3-04) : illustration + guidage. Le titre et
 * la description sont passés par la page, parce que trois situations
 * différentes mènent ici : catalogue vide (rien de publié), filtres trop
 * étroits, page fabriquée au-delà de la fin. Un seul texte, donc pas de
 * contradiction entre le composant et sa page.
 *
 * `border-0 bg-transparent` : la carte visuelle est portée par l'enveloppe,
 * pour une seule surface et non deux empilées. Aucun `hrefPreferences` : le
 * catalogue est public, on n'invente pas une route de profil sans téléphone.
 */
export function EtatVideOffres({
  page,
  pageHorsCatalogue,
  catalogueVide,
  aDesOffres,
  filtreActif,
  onAllerPage,
  onReinitialiser,
}: Props) {
  return (
    <section
      data-probe="offres-vide"
      className="rounded-2xl border border-border bg-card px-4 pb-10"
    >
      <EmptyGuidant
        variant="search"
        titre={
          pageHorsCatalogue
            ? `La page ${page} n'existe pas`
            : catalogueVide
              ? "Aucune offre disponible pour le moment"
              : "Aucune offre ne correspond à ces filtres"
        }
        description={
          pageHorsCatalogue
            ? "Aucune offre à cette page : le catalogue s'arrête avant. Reviens à la première page ou recule d'une page."
            : catalogueVide
              ? "Reviens bientôt — de nouvelles offres sont publiées chaque semaine."
              : "Essaie d'élargir ta recherche."
        }
        className="border-0 bg-transparent dark:bg-transparent"
      />
      {pageHorsCatalogue ? (
        <div role="status" className="mx-auto flex max-w-md flex-wrap justify-center gap-3 pb-4">
          <Button
            variant="outline"
            onClick={() => onAllerPage(Math.max(1, page - 1))}
            className="h-11 rounded-lg border-border px-4 transition-colors duration-150 hover:border-signature hover:text-signature"
          >
            Page précédente
          </Button>
          <Button
            variant="outline"
            onClick={() => onAllerPage(1)}
            className="h-11 rounded-lg border-border px-4 transition-colors duration-150 hover:border-signature hover:text-signature"
          >
            Première page
          </Button>
        </div>
      ) : (
        (aDesOffres || filtreActif) && (
          <div role="status" className="mx-auto max-w-md pb-4 text-center">
            <Button
              variant="outline"
              onClick={onReinitialiser}
              className="h-11 rounded-lg border-border px-4 transition-colors duration-150 hover:border-signature hover:text-signature"
            >
              Réinitialiser les filtres
            </Button>
          </div>
        )
      )}
    </section>
  );
}
