import Link from "next/link";
import { Building2, MapPin } from "lucide-react";
import type { Entreprise } from "./types";

/**
 * Carte d'entreprise de l'annuaire — nom, secteur, ville, compteur d'offres.
 * Hover : bordure signature + léger soulèvement (cartes match de l'espace profil).
 */
export function CarteEntreprise({ entreprise }: { entreprise: Entreprise }) {
  return (
    <Link
      href={`/entreprises/${entreprise.id}`}
      data-probe="entreprise-carte"
      className="group flex flex-col rounded-lg border border-border bg-card p-4 shadow-[0_1px_3px_rgba(10,10,10,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-signature hover:shadow-[0_1px_3px_rgba(10,10,10,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signature/60"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-snug text-foreground group-hover:text-signature">
          {entreprise.nom}
        </h3>
        {entreprise.secteur && (
          <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {entreprise.secteur}
          </span>
        )}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
        <MapPin className="h-4 w-4" />
        {entreprise.ville}
      </p>
      <p className="mt-3 flex items-center gap-1.5 border-t border-border pt-3 text-sm">
        <Building2 className="h-4 w-4 text-signature" />
        <span className="font-medium text-foreground">{entreprise.nb_offres_actives}</span>
        <span className="text-muted-foreground">
          offre{entreprise.nb_offres_actives > 1 ? "s" : ""} active{entreprise.nb_offres_actives > 1 ? "s" : ""}
        </span>
      </p>
    </Link>
  );
}
