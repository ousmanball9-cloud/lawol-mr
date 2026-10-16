import Link from "next/link";
import { Calendar, Clock, MapPin } from "lucide-react";
import { BADGES_TYPE, TYPES_OFFRES } from "@/components/offre-detail-modal";
import { labelPays } from "./types";
import { joursRestants, parserDateLimite } from "./date-limite";
import type { Offre } from "./types";

/** Seuil « urgent » : sous 7 jours, la pastille passe de l'indigo à l'ambre. */
const SEUIL_URGENT_JOURS = 7;

/**
 * Carte d'offre — titre bold, entreprise en petit, lieu · date, badge type.
 * Hover : bordure signature + léger soulèvement (cartes match de l'espace profil).
 *
 * ÉCHÉANCE (toujours lisible, même logique que /offres/[id] → date-limite.ts) :
 *   · J-n        → pastille indigo `bg-nuit`
 *   · J-n ≤ 7    → ambre (urgent = proche), J-0 → « Dernier jour »
 *   · expirée    → « Clôturée »      → gris `bg-muted` + carte atténuée
 *   · date illisible → aucun badge (la date brute reste affichée au-dessus)
 * Une offre expirée n'est jamais supprimée ici : c'est /offres qui décide de
 * l'afficher via l'état explicite « Afficher les expirées ».
 */
export function CarteOffre({ offre }: { offre: Offre }) {
  const jours = joursRestants(parserDateLimite(offre.date_limite));
  const expiree = jours !== null && jours < 0;
  // La LISTE ne sert qu'un aperçu (voir types.ts) ; une offre complète (détail,
  // similaires) porte `description`. Les deux cas affichent la même 2-lignes.
  const apercu = offre.description_apercu || offre.description;

  return (
    <Link
      href={`/offres/${offre.id}`}
      data-probe="offre-carte"
      className={`group flex flex-col rounded-lg border border-border bg-card p-4 shadow-[0_1px_3px_rgba(10,10,10,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-signature hover:shadow-[0_1px_3px_rgba(10,10,10,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signature/60${
        expiree ? " opacity-70" : ""
      }`}
    >
      <span className="text-xs text-muted-foreground">{offre.entreprise}</span>
      <h3 className="mt-1 font-semibold leading-snug text-foreground group-hover:text-signature">
        {offre.titre}
      </h3>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <MapPin className="h-4 w-4" />
          {offre.pays_etudes ? labelPays(offre.pays_etudes) : "Non précisé"}
        </span>
        <span aria-hidden="true">·</span>
        <span className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4" />
          {offre.date_limite}
        </span>
      </p>
      {apercu && (
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{apercu}</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {jours !== null && (
          <span
            data-probe="offre-echeance"
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
              expiree
                ? "border border-border bg-muted text-muted-foreground"
                : jours <= SEUIL_URGENT_JOURS
                  ? "border border-amber-200 bg-amber-50 text-amber-900"
                  : "bg-nuit text-white"
            }`}
          >
            {expiree ? (
              "Clôturée"
            ) : jours === 0 ? (
              "Dernier jour"
            ) : (
              <>
                <Clock className="h-3 w-3" aria-hidden="true" />
                J-{jours}
              </>
            )}
          </span>
        )}
        <span
          className={`badge-offre inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${
            BADGES_TYPE[offre.type_offre] ?? "border border-border bg-muted text-muted-foreground"
          }`}
        >
          {TYPES_OFFRES[offre.type_offre] || offre.type_offre}
        </span>
      </div>
    </Link>
  );
}
