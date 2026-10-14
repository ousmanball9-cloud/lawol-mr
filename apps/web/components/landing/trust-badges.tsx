"use client";

import type { ComponentType } from "react";
import { Shield, CheckCircle, Eye, LogOut } from "lucide-react";

/**
 * 4 badges de confiance horizontaux — icônes lucide-react.
 * data-probe="trust-badges", expect: 4 badges visibles
 * Fond card, bordure border, texte ink
 */

interface TrustBadge {
  /** Icône Lucide (composant). */
  icone: ComponentType<{ className?: string }>;
  /** Titre du badge. */
  titre: string;
  /** Description courte. */
  description: string;
}

/** Configuration par défaut des 4 badges de confiance. */
const BADGES_DEFAUT: TrustBadge[] = [
  {
    icone: Shield,
    titre: "100 % gratuit",
    description: "Aucun frais, aucune commission pour les étudiants",
  },
  {
    icone: CheckCircle,
    titre: "Données protégées",
    description: "RGPD, hébergement UE, chiffrement bout en bout",
  },
  {
    icone: Eye,
    titre: "Sources vérifiées",
    description: "Offres sourcées depuis sites officiels uniquement",
  },
  {
    icone: LogOut,
    titre: "Désinscription 1 clic",
    description: "Suppression compte et données instantanée",
  },
];

interface TrustBadgesProps {
  /** Liste personnalisée de badges (sinon défaut 4). */
  badges?: TrustBadge[];
  /** Titre de la section (optionnel). */
  titre?: string;
  /** Variant visuel : "card" (défaut) ou "minimal". */
  variant?: "card" | "minimal";
}

/**
 * Composant badges de confiance horizontaux.
 * @param badges - Liste des badges (défaut : 4 standards)
 * @param titre - Titre optionnel au-dessus
 * @param variant - Style visuel (card ou minimal)
 */
export default function TrustBadges({
  badges = BADGES_DEFAUT,
  titre,
  variant = "card",
}: TrustBadgesProps) {
  const baseCard = "rounded-xl border border-border bg-card p-6 transition-shadow duration-200 hover:shadow-lg";
  const baseMinimal = "flex flex-col items-center gap-2 text-center p-4";

  return (
    <section
      data-probe="trust-badges"
      aria-labelledby={titre ? "trust-badges-title" : undefined}
      aria-label={!titre ? "Badges de confiance" : undefined}
      className="py-16 lg:py-20 bg-background"
    >
      <div className="container mx-auto px-4">
        {titre && (
          <h2
            id="trust-badges-title"
            className="mb-10 text-center font-display text-2xl font-bold tracking-[-0.02em] text-ink lg:text-3xl"
          >
            {titre}
          </h2>
        )}

        <div
          className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6"
          role="list"
        >
          {badges.map((badge, index) => (
            <article
              key={`${badge.titre}-${index}`}
              role="listitem"
              className={`
                flex flex-col items-center gap-3 min-w-[180px] flex-1
                ${variant === "card" ? baseCard : baseMinimal}
              `}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-signature/10 text-signature"
                aria-hidden="true"
              >
                <badge.icone className="h-5 w-5" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-ink">{badge.titre}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {badge.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}