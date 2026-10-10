import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  page: number;
  totalPages: number;
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

/** Pagination 12/page : boutons Précédent/Suivant + numéros de pages. */
export function PaginationOffres({ page, totalPages, onPage }: Props) {
  if (totalPages <= 1) return null;
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
        className="rounded-lg border-border px-3 transition-colors duration-150 hover:border-signature hover:text-signature"
      >
        <ChevronLeft className="h-4 w-4" />
        Précédent
      </Button>
      {numerosPages(page, totalPages).map((n, i) =>
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
            className={`h-9 min-w-9 rounded-lg border px-3 text-sm font-medium transition-colors duration-150 ${
              n === page
                ? "border-signature bg-signature text-white"
                : "border-border bg-background text-foreground hover:border-signature hover:text-signature"
            }`}
          >
            {n}
          </button>
        )
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages}
        aria-label="Page suivante"
        className="rounded-lg border-border px-3 transition-colors duration-150 hover:border-signature hover:text-signature"
      >
        Suivant
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}
