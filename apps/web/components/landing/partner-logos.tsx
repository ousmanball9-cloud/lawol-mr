"use client";

import type { SVGAttributes } from "react";

/**
 * Grille de logos partenaires — 8 max, responsive 2/4/8 colonnes.
 * data-probe="partenaires-logos", expect: count ≥ 4
 * Gris neutre (muted-foreground) → couleur signature au hover
 * Aria-label "Nos partenaires et sources"
 */

/** Props d'un logo partenaire. */
interface PartenaireLogo {
  /** Nom du partenaire (accessible). */
  nom: string;
  /** SVG inline du logo (optimisé, sans dimension fixe). */
  svg: React.ReactElement<SVGAttributes<SVGSVGElement>>;
  /** URL optionnelle du site partenaire. */
  href?: string;
}

/** Configuration par défaut : 8 partenaires types (institutionnels, académiques, privés). */
const PARTENAIRES_DEFAUT: PartenaireLogo[] = [
  {
    nom: "Ministère de l'Enseignement Supérieur",
    svg: (
      <svg viewBox="0 0 200 60" fill="none" aria-hidden="true" focusable="false">
        <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle"
              font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="currentColor">
          MESRS
        </text>
        <rect x="10" y="10" width="180" height="40" rx="4" stroke="currentColor" stroke-width="2" fill="none"/>
      </svg>
    ),
    href: "https://www.mesrs.gov.mr",
  },
  {
    nom: "Université de Nouakchott Al-Aasriya",
    svg: (
      <svg viewBox="0 0 200 60" fill="none" aria-hidden="true" focusable="false">
        <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle"
              font-family="system-ui, sans-serif" font-size="9" font-weight="600" fill="currentColor">
          UNA
        </text>
        <text x="50%" y="65%" dominant-baseline="middle" text-anchor="middle"
              font-family="system-ui, sans-serif" font-size="7" fill="currentColor">
          Nouakchott Al-Aasriya
        </text>
        <circle cx="100" cy="30" r="25" stroke="currentColor" stroke-width="2" fill="none"/>
      </svg>
    ),
    href: "https://www.una.mr",
  },
  {
    nom: "Banque Mondiale - Projet PEJ",
    svg: (
      <svg viewBox="0 0 200 60" fill="none" aria-hidden="true" focusable="false">
        <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle"
              font-family="system-ui, sans-serif" font-size="12" font-weight="700" fill="currentColor">
          BANQUE MONDIALE
        </text>
        <path d="M20 45 Q100 15 180 45" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/>
      </svg>
    ),
    href: "https://www.banquemondiale.org",
  },
  {
    nom: "Agence Nationale de l'Emploi",
    svg: (
      <svg viewBox="0 0 200 60" fill="none" aria-hidden="true" focusable="false">
        <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle"
              font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="currentColor">
          ANE
        </text>
        <rect x="15" y="15" width="170" height="30" rx="3" stroke="currentColor" stroke-width="2" fill="none"/>
        <line x1="50" y1="15" x2="50" y2="45" stroke="currentColor" stroke-width="1.5"/>
        <line x1="100" y1="15" x2="100" y2="45" stroke="currentColor" stroke-width="1.5"/>
        <line x1="150" y1="15" x2="150" y2="45" stroke="currentColor" stroke-width="1.5"/>
      </svg>
    ),
    href: "https://www.ane.mr",
  },
  {
    nom: "Fondation Mauritanie pour l'Éducation",
    svg: (
      <svg viewBox="0 0 200 60" fill="none" aria-hidden="true" focusable="false">
        <path d="M100 10 L190 35 L190 55 L10 55 L10 35 Z" stroke="currentColor" stroke-width="2" fill="none"/>
        <text x="50%" y="60%" dominant-baseline="middle" text-anchor="middle"
              font-family="system-ui, sans-serif" font-size="8" fill="currentColor">
          FME
        </text>
        <circle cx="100" cy="35" r="8" stroke="currentColor" stroke-width="2" fill="none"/>
      </svg>
    ),
    href: "https://www.fme.mr",
  },
  {
    nom: "ONUDD - Programme Jeunesse",
    svg: (
      <svg viewBox="0 0 200 60" fill="none" aria-hidden="true" focusable="false">
        <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle"
              font-family="system-ui, sans-serif" font-size="14" font-weight="700" fill="currentColor">
          ONUDD
        </text>
        <text x="50%" y="65%" dominant-baseline="middle" text-anchor="middle"
              font-family="system-ui, sans-serif" font-size="7" fill="currentColor">
          Programme Jeunesse
        </text>
        <ellipse cx="100" cy="30" rx="45" ry="20" stroke="currentColor" stroke-width="1.5" fill="none"/>
      </svg>
    ),
    href: "https://www.unodc.org",
  },
  {
    nom: "Chambre de Commerce et d'Industrie",
    svg: (
      <svg viewBox="0 0 200 60" fill="none" aria-hidden="true" focusable="false">
        <rect x="20" y="15" width="160" height="30" rx="4" stroke="currentColor" stroke-width="2" fill="none"/>
        <text x="50%" y="48%" dominant-baseline="middle" text-anchor="middle"
              font-family="system-ui, sans-serif" font-size="10" font-weight="600" fill="currentColor">
          CCI MAURITANIE
        </text>
        <path d="M50 30 L75 45 L150 15" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    ),
    href: "https://www.cci.mr",
  },
  {
    nom: "Union des Universités Arabes",
    svg: (
      <svg viewBox="0 0 200 60" fill="none" aria-hidden="true" focusable="false">
        <circle cx="100" cy="30" r="22" stroke="currentColor" stroke-width="2" fill="none"/>
        <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle"
              font-family="system-ui, sans-serif" font-size="12" font-weight="700" fill="currentColor">
          UUA
        </text>
        <path d="M55 30 L145 30" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/>
      </svg>
    ),
    href: "https://www.aaru.edu.jo",
  },
];

interface PartnerLogosProps {
  /** Liste personnalisée de partenaires (sinon défaut 8). */
  partenaires?: PartenaireLogo[];
  /** Titre de la section (optionnel). */
  titre?: string;
  /** Sous-titre (optionnel). */
  sousTitre?: string;
  /** Nombre max de logos à afficher (défaut 8, max 8). */
  max?: number;
}

/**
 * Composant grille de logos partenaires.
 * @param partenaires - Liste des partenaires (défaut : 8 institutionnels)
 * @param titre - Titre optionnel
 * @param sousTitre - Sous-titre optionnel
 * @param max - Nombre max à afficher (1-8)
 */
export default function PartnerLogos({
  partenaires = PARTENAIRES_DEFAUT,
  titre = "Ils nous font confiance",
  sousTitre = "Institutions, universités et partenaires qui référencent leurs offres sur LAWOL.mr",
  max = 8,
}: PartnerLogosProps) {
  const affichage = partenaires.slice(0, Math.min(max, 8));

  return (
    <section
      data-probe="partenaires-logos"
      aria-label="Nos partenaires et sources"
      className="py-16 lg:py-24 bg-background"
    >
      <div className="container mx-auto px-4">
        {(titre || sousTitre) && (
          <div className="mb-12 text-center">
            {titre && (
              <h2 className="font-display text-2xl font-bold tracking-[-0.02em] text-ink lg:text-3xl">
                {titre}
              </h2>
            )}
            {sousTitre && (
              <p className="mt-2 max-w-2xl mx-auto text-muted-foreground">
                {sousTitre}
              </p>
            )}
          </div>
        )}

        <div
          className="grid grid-cols-2 gap-6 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-8
                     items-center justify-items-center"
          role="list"
        >
          {affichage.map((partenaire, index) => (
            <div
              key={`${partenaire.nom}-${index}`}
              role="listitem"
              className="flex h-16 w-full max-w-xs items-center justify-center
                         text-muted-foreground transition-colors duration-200
                         hover:text-signature
                         focus-visible:outline-none focus-visible:ring-2
                         focus-visible:ring-signature focus-visible:ring-offset-2
                         focus-visible:ring-offset-background"
            >
              {partenaire.href ? (
                <a
                  href={partenaire.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Site de ${partenaire.nom}`}
                  className="w-full h-full flex items-center justify-center"
                >
                  <span className="w-full h-full flex items-center justify-center" aria-hidden="true">
                    {partenaire.svg}
                  </span>
                </a>
              ) : (
                <span className="w-full h-full flex items-center justify-center" aria-hidden="true">
                  {partenaire.svg}
                </span>
              )}
              <span className="sr-only">{partenaire.nom}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}