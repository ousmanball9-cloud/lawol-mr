import { Chrome } from "@/components/chrome/chrome";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

/**
 * État de chargement du CATALOGUE (`/offres`) — rendu DANS le chrome.
 *
 * Placé ici et pas à la racine : le squelette a la forme des cartes d'offres,
 * il n'a donc de sens que sur le catalogue (à la racine il s'afficherait aussi
 * sur la landing et les pages de contenu).
 *
 * Avant : aucun `loading.tsx`, chaque écran réimplémentait son état et
 * `/offres` affichait un spinner plein écran sans header (constat chasse 0 ·
 * B2). Ici le squelette occupe la place du contenu, la navigation reste
 * visible et cliquable.
 *
 * V3-04 · B7 : la grille utilise `SkeletonCard` — le MÊME composant que l'état
 * de chargement client (`IndicateurChargement` dans `page.tsx`), donc les deux
 * chemins (navigation serveur / attente du fetch) peignent la même chose.
 *
 * Purement décoratif pour les lecteurs d'écran (les blocs sont `aria-hidden`),
 * une seule annonce `role="status"` porte l'information.
 */
export default function Loading() {
  return (
    <Chrome>
      <main className="bg-background px-4 py-10" aria-busy="true">
        <div className="mx-auto max-w-7xl">
          <p role="status" className="sr-only">
            Chargement de la page…
          </p>

          <header className="mb-8">
            <Skeleton variant="text" width={120} className="h-3" />
            <Skeleton variant="text" width="min(420px, 70%)" className="mt-3 h-8" />
            <Skeleton variant="text" width="min(560px, 90%)" className="mt-3 h-4" />
          </header>

          {/* Barre de filtres : une ligne de champs sur desktop, empilés sur mobile. */}
          <div className="mb-6 rounded-lg border border-border bg-card p-4 shadow-card">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Skeleton variant="rectangular" className="h-11 flex-1" />
              <Skeleton variant="rectangular" className="h-11 flex-1" />
              <Skeleton variant="rectangular" className="h-11 flex-1" />
              <Skeleton variant="rectangular" width={120} height={44} />
            </div>
          </div>

          <div data-probe="offres-squelette" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard
                key={i}
                className="rounded-lg border border-border bg-card p-5 shadow-card"
              />
            ))}
          </div>
        </div>
      </main>
    </Chrome>
  );
}
