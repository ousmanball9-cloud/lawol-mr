import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  page: number;
  /**
   * Vrai si la sonde `limit = 12 + 1` a ramené une 13ᵉ ligne : une page
   * suivante existe. C'est la seule information de « reste-t-il quelque
   * chose ? » que l'API fournisse — elle ne dit jamais COMBIEN.
   */
  aSuivante: boolean;
  onPage: (page: number) => void;
};

const BOUTON =
  "min-h-11 rounded-lg border-border px-3 transition-colors duration-150 hover:border-signature hover:text-signature";

/**
 * Pagination 12/page — « Précédent · Page N · Suivant ».
 *
 * L'API publique renvoie une liste nue, sans total : afficher « page N sur M »
 * exigerait d'inventer M. On avance donc au fil de l'eau, une page à la fois,
 * et on le DIT (texte sr-only ci-dessous) — décision assumée, pas un oubli.
 * (Le rendu « numéros de pages » a disparu avec le mode « bassin », seul cas où
 * un total était connu — décision V5-A du 09/11/2026.)
 */
export function PaginationOffres({ page, aSuivante, onPage }: Props) {
  // Rien à paginer tant qu'on est en page 1 sans suite.
  if (page <= 1 && !aSuivante) return null;

  return (
    <nav
      data-probe="offres-pagination"
      aria-label="Pagination des offres"
      className="mt-8 flex flex-wrap items-center justify-center gap-2"
    >
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        aria-label="Page précédente"
        className={BOUTON}
      >
        <ChevronLeft className="h-4 w-4" />
        Précédent
      </Button>
      <span
        aria-current="page"
        className="inline-flex min-h-11 items-center rounded-lg border border-signature bg-signature px-3 text-sm font-medium text-white"
      >
        Page {page}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPage(page + 1)}
        disabled={!aSuivante}
        aria-label="Page suivante"
        className={BOUTON}
      >
        Suivant
        <ChevronRight className="h-4 w-4" />
      </Button>
      <p className="sr-only">
        Le catalogue ne communique pas de nombre total de pages : la navigation se fait page par
        page.
      </p>
    </nav>
  );
}
