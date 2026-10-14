"use client";

/**
 * Props du composant PostesBarres.
 * @interface PostesBarresProps
 * @property {{ poste: string; count: number }[]} data - Données des postes avec leur compte.
 * @property {number} [maxCount] - Valeur maximale pour normaliser les barres (calculée si absente).
 * @property {string} [className] - Classes Tailwind additionnelles.
 */
export interface PostesBarresProps {
  data: { poste: string; count: number }[];
  maxCount?: number;
  className?: string;
}

/**
 * PostesBarres — Barres horizontales pour répartition par poste.
 * - Barres : conteneur bg-signature/10 + enfant bg-signature width = (count/maxCount)*100%
 * - Tooltip au hover via group/absolute avec count + poste
 * - Data-probe pour tests automatisés
 * - Dark mode : dark:bg-signature/20 / dark:bg-signature
 * - Accessible : structure sémantique, texte lisible
 */
export default function PostesBarres({ data, maxCount, className }: PostesBarresProps) {
  const computedMax = maxCount ?? Math.max(...data.map((d) => d.count), 1);

  return (
    <div data-probe="postes-barres" data-testid="postes-barres" className={`space-y-3 ${className ?? ""}`} role="list" aria-label="Répartition des candidatures par poste">
      {data.map(({ poste, count }, index) => {
        const percentage = computedMax > 0 ? (count / computedMax) * 100 : 0;

        return (
          <div key={`${poste}-${index}`} className="group" role="listitem">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-sm font-medium text-ink truncate pr-2">{poste}</span>
              <span className="text-sm font-semibold text-signature shrink-0">{count}</span>
            </div>
            <div className="relative h-6 overflow-hidden rounded-full bg-signature/10 dark:bg-signature/20">
              <div
                className="h-full rounded-full bg-signature dark:bg-signature transition-all duration-500 ease-out"
                style={{ width: `${percentage}%` }}
                role="img"
                aria-label={`${poste} : ${count} candidatures`}
              />
              {/* Tooltip au hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-nuit rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none whitespace-nowrap z-10">
                {count} — {poste}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}