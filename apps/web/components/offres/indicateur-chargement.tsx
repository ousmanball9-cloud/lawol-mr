import { Chrome } from "@/components/chrome/chrome";
import { SkeletonCard } from "@/components/ui/skeleton";

/**
 * État de chargement du catalogue (V3-04 · B7) — squelette plutôt qu'un texte.
 *
 * Déplacé de `app/offres/page.tsx` sans réécriture : même grille que le résultat
 * réel (`md:grid-cols-2 xl:grid-cols-3`, 6 cartes = une demi-page d'avance) et
 * même gabarit de carte (`SkeletonCard`), donc l'arrivée des données ne déplace
 * rien. Rendu DANS le chrome, comme `app/offres/loading.tsx` : la navigation
 * reste visible pendant l'attente.
 *
 * Les blocs sont décoratifs (`aria-hidden` posé par `Skeleton`), une seule
 * annonce `role="status"` porte l'information pour les lecteurs d'écran.
 */
export function IndicateurChargement() {
  return (
    <Chrome>
      <main className="bg-background px-4 py-10" aria-busy="true">
        <div className="mx-auto max-w-7xl">
          <div
            data-probe="offres-squelette"
            role="status"
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            <p className="sr-only">Chargement des offres…</p>
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
