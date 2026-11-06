"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Settings, RefreshCw, Loader2 } from "lucide-react";
import { SvgIllustration } from "./SvgIllustration";

type Variant = "search" | "candidature" | "favori";

interface EmptyGuidantProps {
  variant: Variant;
  /** Remplace le titre figé du variant (le contexte de la page est plus juste). */
  titre?: string;
  /** Remplace la description figée du variant. */
  description?: string;
  /**
   * Cible du lien « Affiner mes préférences ». OMIS = pas de lien du tout :
   * aucune route n'est inventée (l'ancienne valeur `/profil/[telephone]/parametres`
   * était un gabarit littéral, donc un lien mort sur toute page publique).
   */
  hrefPreferences?: string;
  onActualiser?: () => void;
  actualisation?: boolean;
  className?: string;
}

/**
 * État vide guidant avec illustration, message contextuel et CTA.
 * - variant "search" : "Aucune offre ne correspond" + lien préférences + bouton actualiser
 * - variant "candidature" : "Aucune candidature pour l'instant" + lien préférences
 * - variant "favori" : "Aucun favori enregistré" + lien préférences
 */
export function EmptyGuidant({
  variant,
  titre,
  description,
  hrefPreferences,
  onActualiser,
  actualisation = false,
  className,
}: EmptyGuidantProps) {
  const idTitre = React.useId();
  const messages: Record<Variant, { title: string; description: string }> = {
    search: {
      title: "Aucune offre ne correspond",
      description:
        "Essayez d'élargir vos critères de recherche ou d'affiner vos préférences pour découvrir plus d'opportunités.",
    },
    candidature: {
      title: "Aucune candidature pour l'instant",
      description:
        "Les offres auxquelles vous postulez apparaîtront ici. Commencez par explorer les offres disponibles.",
    },
    favori: {
      title: "Aucun favori enregistré",
      description:
        "Ajoutez des offres à vos favoris en cliquant sur l'étoile pour les retrouver facilement plus tard.",
    },
  };

  const message = messages[variant];
  const titreAffiche = titre ?? message.title;
  const descriptionAffichee = description ?? message.description;

  return (
    <section
      data-probe="empty-guidant"
      data-variant={variant}
      className={cn(
        "flex flex-col items-center text-center py-16 px-4",
        "bg-card",
        "rounded-2xl border border-border",
        className
      )}
      aria-labelledby={idTitre}
    >
      <div className="w-full max-w-[220px]">
        <SvgIllustration variant={variant} animate={true} />
      </div>

      <div className="mt-8 max-w-sm">
        <h2
          id={idTitre}
          className={cn(
            "text-xl font-semibold",
            "text-ink",
            "mb-2"
          )}
        >
          {titreAffiche}
        </h2>
        <p className={cn("text-base", "text-muted-foreground")}>
          {descriptionAffichee}
        </p>
      </div>

      <div className="mt-8 w-full max-w-sm flex flex-col sm:flex-row items-center justify-center gap-3">
        {hrefPreferences && (
          <Link
            href={hrefPreferences}
            className={cn(
              "inline-flex items-center justify-center gap-2",
              "px-4 py-2.5 rounded-lg",
              "bg-muted",
              "text-ink",
              "font-medium text-sm",
              "hover:bg-muted-foreground/10",
              "transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signature",
              "w-full sm:w-auto"
            )}
            aria-label="Affiner mes préférences"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            <span>Affiner mes préférences</span>
          </Link>
        )}

        {onActualiser && (
          <button
            type="button"
            onClick={onActualiser}
            disabled={actualisation}
            className={cn(
              "inline-flex items-center justify-center gap-2",
              "px-4 py-2.5 rounded-lg",
              "bg-signature text-white",
              "font-medium text-sm",
              "hover:bg-signature/90",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signature focus-visible:ring-offset-2",
              "w-full sm:w-auto"
            )}
            aria-label={actualisation ? "Actualisation en cours" : "Actualiser les offres"}
          >
            {actualisation ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Actualisation…</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                <span>Actualiser les offres</span>
              </>
            )}
          </button>
        )}
      </div>
    </section>
  );
}

export default EmptyGuidant;