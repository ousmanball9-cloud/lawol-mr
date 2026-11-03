import { Chrome } from "@/components/chrome/chrome";
import { Skeleton } from "@/components/ui/skeleton";

/** Carte de squelette : même gabarit qu'une carte d'offre (logo, titre, méta,
 *  résumé, badges) pour que l'arrivée des données ne déplace rien. */
function CarteSquelette() {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-card">
      <div className="flex items-start gap-3">
        <Skeleton variant="circular" className="h-10 w-10 shrink-0" />
        <div className="min-w-0 flex-1">
          <Skeleton variant="text" width="75%" className="h-4" />
          <Skeleton variant="text" width="45%" className="mt-2 h-3" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton variant="text" />
        <Skeleton variant="text" width="85%" />
      </div>
      <div className="mt-4 flex gap-2">
        <Skeleton variant="rectangular" width={96} height={28} className="rounded-full" />
        <Skeleton variant="rectangular" width={72} height={28} className="rounded-full" />
      </div>
    </div>
  );
}

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

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <CarteSquelette key={i} />
            ))}
          </div>
        </div>
      </main>
    </Chrome>
  );
}
