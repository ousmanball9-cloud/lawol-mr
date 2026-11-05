import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  page: number;
  /**
   * Nombre de pages — fourni UNIQUEMENT quand le total est connu (mode
   * « bassin » : un filtre non exprimable par l'API force le chargement complet
   * du sous-ensemble, cf. `app/offres/page.tsx`). Absent = total inconnu.
   */
  totalPages?: number;
  /**
   * Vrai si la sonde `limit = 12 + 1` a ramené une 13ᵉ ligne : une page
   * suivante existe. C'est la seule information de « reste-t-il quelque
   * chose ? » que l'API fournisse — elle ne dit jamais COMBIEN.
   */
  aSuivante: boolean;
  onPage: (page: number) => void;
};

/** Fenêtre de numéros : toutes si ≤ 7 pages, sinon 1 … fenêtre de 5 … N. */
function numerosPages(page: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const debut = Math.max(2, Math.min(page - 2, totalPages - 4));
  const fin = Math.min(totalPages - 1, debut + 4);
  const nums: (number | "…")[] = [1];
  if (debut > 2) nums.push("…");
  for (let i = debut; i <= fin; i++) nums.push(i);
  if (fin < totalPages - 1) nums.push("…");
  nums.push(totalPages);
  return nums;
}

const BOUTON =
  "min-h-11 rounded-lg border-border px-3 transition-colors duration-150 hover:border-signature hover:text-signature";

/**
 * Pagination 12/page.
 *
 * DEUX RENDUS, selon ce que l'on sait du catalogue :
 *  · total connu (`totalPages`) → boutons Précédent/Suivant + numéros de pages,
 *    comportement historique ;
 *  · total inconnu → « Précédent · Page N · Suivant ». L'API publique renvoie
 *    une liste nue, sans total : afficher « page N sur M » exigerait d'inventer
 *    M. On avance donc au fil de l'eau, une page à la fois, et on le DIT
 *    (texte sr-only ci-dessous) — décision assumée, pas un oubli.
 */
export function PaginationOffres({ page, totalPages, aSuivante, onPage }: Props) {
  // Sans total, il n'y a rien à paginer tant qu'on est en page 1 sans suite.
  if (totalPages === undefined) {
    if (page <= 1 && !aSuivante) return null;
  } else if (totalPages <= 1) {
    return null;
  }

  const derniere = totalPages === undefined ? !aSuivante : page >= totalPages;

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
      {totalPages === undefined ? (
        <span
          aria-current="page"
          className="inline-flex min-h-11 items-center rounded-lg border border-signature bg-signature px-3 text-sm font-medium text-white"
        >
          Page {page}
        </span>
      ) : (
        numerosPages(page, totalPages).map((n, i) =>
          n === "…" ? (
            <span key={`sep-${i}`} aria-hidden="true" className="px-1 text-muted-foreground">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              onClick={() => onPage(n)}
              aria-current={n === page ? "page" : undefined}
              className={`min-h-11 min-w-11 rounded-lg border px-3 text-sm font-medium transition-colors duration-150 ${
                n === page
                  ? "border-signature bg-signature text-white"
                  : "border-border bg-background text-foreground hover:border-signature hover:text-signature"
              }`}
            >
              {n}
            </button>
          )
        )
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPage(page + 1)}
        disabled={derniere}
        aria-label="Page suivante"
        className={BOUTON}
      >
        Suivant
        <ChevronRight className="h-4 w-4" />
      </Button>
      {totalPages === undefined && (
        <p className="sr-only">
          Le catalogue ne communique pas de nombre total de pages : la navigation se fait page par
          page.
        </p>
      )}
    </nav>
  );
}
