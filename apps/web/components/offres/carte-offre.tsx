import Link from "next/link";
import { Calendar, MapPin } from "lucide-react";
import { BADGES_TYPE, TYPES_OFFRES } from "@/components/offre-detail-modal";
import type { Offre } from "./types";

/**
 * Carte d'offre — titre bold, entreprise en petit, lieu · date, badge type.
 * Hover : bordure signature + léger soulèvement (cartes match de l'espace profil).
 */
export function CarteOffre({ offre }: { offre: Offre }) {
  return (
    <Link
      href={`/offres/${offre.id}`}
      data-probe="offre-carte"
      className="group flex flex-col rounded-lg border border-border bg-card p-4 shadow-[0_1px_3px_rgba(10,10,10,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-signature hover:shadow-[0_1px_3px_rgba(10,10,10,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signature/60"
    >
      <span className="text-xs text-muted-foreground">{offre.entreprise}</span>
      <h3 className="mt-1 font-semibold leading-snug text-foreground group-hover:text-signature">
        {offre.titre}
      </h3>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <MapPin className="h-4 w-4" />
          {offre.ville}
        </span>
        <span aria-hidden="true">·</span>
        <span className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4" />
          {offre.date_limite}
        </span>
      </p>
      {offre.description && (
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{offre.description}</p>
      )}
      <span
        className={`badge-offre mt-3 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${
          BADGES_TYPE[offre.type_offre] ?? "border border-border bg-muted text-muted-foreground"
        }`}
      >
        {TYPES_OFFRES[offre.type_offre] || offre.type_offre}
      </span>
    </Link>
  );
}
