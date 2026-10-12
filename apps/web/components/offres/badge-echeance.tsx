import { Clock } from "lucide-react";

/**
 * Pastille d'échéance — même échelle que la carte du catalogue
 * (components/offres/carte-offre.tsx, seuil SEUIL_URGENT_JOURS = 7) :
 *   · J-n > 7   → pastille indigo `bg-nuit`
 *   · J-n ≤ 7   → ambre (urgent), J-0 → « Dernier jour »
 *   · expirée   → « Clôturée »
 *   · date non parsable (`jours = null`) → rien : la date brute reste
 *     affichée à côté, aucun badge inventé.
 * Aucune couleur nouvelle : classes déjà utilisées par la fiche et la carte.
 */
export function BadgeEcheance({ jours }: { jours: number | null }) {
  if (jours === null) return null;

  if (jours < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
        Clôturée
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
        jours <= 7 ? "border border-amber-200 bg-amber-50 text-amber-900" : "bg-nuit text-white"
      }`}
    >
      {jours === 0 ? (
        "Dernier jour"
      ) : (
        <>
          <Clock className="h-3 w-3" aria-hidden="true" />
          J-{jours}
        </>
      )}
    </span>
  );
}
