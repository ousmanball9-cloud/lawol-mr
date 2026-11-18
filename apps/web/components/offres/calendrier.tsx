import { CalendarRange } from "lucide-react";
import {
  calendrierAffichable,
  formaterDateEtape,
  libelleEtape,
} from "@/lib/calendrier";

/**
 * Bloc « Calendrier de sélection » de la fiche bourse — contrat §2.3 (V4-E).
 *
 * Rendu UNIQUEMENT si `calendrierAffichable` trouve au moins 2 étapes datées,
 * conformes et chronologiques. Sinon la fonction renvoie `null` : aucune
 * section, aucune sonde, aucun « non communiqué ». Une échéance seule est déjà
 * affichée par le bloc Échéance — la répéter ne ferait pas un parcours.
 *
 * Aucune valeur n'est calculée ici : l'API sert la valeur stockée telle quelle.
 */
export function BlocCalendrier({ calendrier }: { calendrier: unknown }) {
  const etapes = calendrierAffichable(calendrier);
  if (!etapes) return null;

  return (
    <section
      data-probe="detail-calendrier"
      aria-labelledby="calendrier-titre"
      className="mt-4 rounded-lg border border-border bg-muted/40 px-4 py-4"
    >
      <h2 id="calendrier-titre" className="eyebrow text-muted-foreground">
        Calendrier de sélection
      </h2>
      <ol className="mt-3 flex flex-col gap-3">
        {etapes.map((etape) => (
          <li
            key={etape.etape}
            data-probe="calendrier-etape"
            className="flex items-start gap-3"
          >
            <span
              aria-hidden="true"
              className="mt-1.5 inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-signature"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {libelleEtape(etape.etape)}
              </p>
              <time
                dateTime={etape.date}
                className="text-sm text-muted-foreground"
              >
                {formaterDateEtape(etape.date)}
              </time>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
        <CalendarRange
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signature"
          aria-hidden="true"
        />
        Dates annoncées par la source — à confirmer dans l&apos;annonce
        officielle. LAWOL n&apos;ajoute aucun jalon.
      </p>
    </section>
  );
}
