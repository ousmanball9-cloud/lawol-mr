import Link from "next/link";
import { Calendar, MapPin, Users } from "lucide-react";
import { TYPES_OFFRES } from "@/components/offre-detail-modal";
import type { OffreEntreprise } from "./types";

/**
 * Carte d'offre dans la fiche entreprise — cliquable vers /offres/[id],
 * avec compteurs nb_matches / nb_postules.
 */
export function CarteOffreEntreprise({ offre }: { offre: OffreEntreprise }) {
  return (
    <Link
      href={`/offres/${offre.id}`}
      data-probe="fiche-offre"
      className="group flex flex-col rounded-lg border border-border bg-card p-4 shadow-[0_1px_3px_rgba(10,10,10,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-signature hover:shadow-[0_1px_3px_rgba(10,10,10,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signature/60"
    >
      <h3 className="font-semibold leading-snug text-foreground group-hover:text-signature">
        {offre.titre}
      </h3>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <MapPin className="h-4 w-4" />
          {offre.ville}
        </span>
        <span className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4" />
          {offre.date_limite}
        </span>
      </p>
      <p className="mt-3 flex items-center gap-1.5 border-t border-border pt-3 text-sm text-muted-foreground">
        <Users className="h-4 w-4 text-signature" />
        <span>
          <span className="font-medium text-foreground">{offre.nb_matches}</span> candidature
          {offre.nb_matches > 1 ? "s" : ""} ·{" "}
          <span className="font-medium text-foreground">{offre.nb_postules}</span> postulée
          {offre.nb_postules > 1 ? "s" : ""}
        </span>
      </p>
      <span className="mt-3 inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {TYPES_OFFRES[offre.type_offre] || offre.type_offre}
      </span>
    </Link>
  );
}
