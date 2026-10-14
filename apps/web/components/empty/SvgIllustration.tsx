"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "search" | "candidature" | "favori";

interface SvgIllustrationProps {
  variant: Variant;
  className?: string;
  animate?: boolean;
}

/**
 * Illustration SVG inline pour les états vides.
 * - variant "search" : loupe stylisée + particules indigo/ambre
 * - variant "candidature" : document + flèche + encoche
 * - variant "favori" : étoile contour + éclat ambre
 * Fond : fond-nuit-anime + lueur-nuit (overlay absolu, classes globals.css)
 * Respecte prefers-reduced-motion via prop animate
 */
export function SvgIllustration({
  variant,
  className,
  animate = true,
}: SvgIllustrationProps) {
  // Détection prefers-reduced-motion côté client
  const [shouldAnimate, setShouldAnimate] = React.useState(animate);

  React.useEffect(() => {
    if (!animate) {
      setShouldAnimate(false);
      return;
    }
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (e: MediaQueryListEvent) => setShouldAnimate(!e.matches);
    setShouldAnimate(!mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [animate]);

  const baseClass = cn(
    "w-full aspect-square max-w-md mx-auto",
    "fond-nuit-anime rounded-2xl",
    "flex items-center justify-center",
    "relative overflow-hidden",
    className
  );

  // SVG inline selon la variante
  const renderIllustration = () => {
    switch (variant) {
      case "search":
        return (
          <svg
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            className="w-3/4 h-3/4 text-white/70"
          >
            {/* Particules ambre/indigo animées */}
            <defs>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {/* Particules flottantes */}
            <g className={shouldAnimate ? "animate-float-particles" : ""}>
              <circle cx="20" cy="20" r="3" fill="#F59E0B" opacity="0.8">
                <animate
                  attributeName="cy"
                  values="20;15;20"
                  dur="4s"
                  repeatCount="indefinite"
                  begin="0s"
                />
              </circle>
              <circle cx="100" cy="30" r="2" fill="#818CF8" opacity="0.7">
                <animate
                  attributeName="cx"
                  values="100;105;100"
                  dur="3.5s"
                  repeatCount="indefinite"
                  begin="0.5s"
                />
              </circle>
              <circle cx="15" cy="95" r="2.5" fill="#F59E0B" opacity="0.6">
                <animate
                  attributeName="cy"
                  values="95;90;95"
                  dur="4.5s"
                  repeatCount="indefinite"
                  begin="1s"
                />
              </circle>
              <circle cx="105" cy="90" r="2" fill="#818CF8" opacity="0.7">
                <animate
                  attributeName="cx"
                  values="105;100;105"
                  dur="3.8s"
                  repeatCount="indefinite"
                  begin="1.5s"
                />
              </circle>
            </g>
            {/* Loupe stylisée */}
            <g filter="url(#glow)">
              {/* Anneau de la loupe */}
              <circle
                cx="50"
                cy="50"
                r="28"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                fill="none"
                className={shouldAnimate ? "animate-pulse-ring" : ""}
              />
              {/* Manche de la loupe */}
              <path
                d="M72 72 L95 95"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                fill="none"
              />
              {/* Reflet sur le verre */}
              <path
                d="M30 30 Q40 35 50 30"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
                opacity="0.5"
              />
            </g>
          </svg>
        );
      case "candidature":
        return (
          <svg
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            className="w-3/4 h-3/4 text-white/70"
          >
            <defs>
              <filter id="glow-check" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {/* Document */}
            <g className={shouldAnimate ? "animate-slide-up" : ""}>
              {/* Corps du document */}
              <rect
                x="25"
                y="20"
                width="70"
                height="85"
                rx="8"
                fill="currentColor"
                fillOpacity="0.15"
                stroke="currentColor"
                strokeWidth="2"
              />
              {/* En-tête du document */}
              <rect
                x="25"
                y="20"
                width="70"
                height="28"
                rx="8"
                fill="currentColor"
                fillOpacity="0.25"
              />
              <rect
                x="35"
                y="28"
                width="40"
                height="4"
                rx="2"
                fill="currentColor"
                fillOpacity="0.4"
              />
              {/* Lignes de texte */}
              <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6">
                <line x1="38" y1="55" x2="82" y2="55" />
                <line x1="38" y1="68" x2="75" y2="68" />
                <line x1="38" y1="81" x2="68" y2="81" />
              </g>
              {/* Flèche vers le document */}
              <path
                d="M60 10 L60 18"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
                opacity="0.7"
              />
              <path
                d="M52 18 L60 10 L68 18"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                opacity="0.7"
              />
              {/* Encoche de validation (check) - animée */}
              <g filter="url(#glow-check)" className={shouldAnimate ? "animate-check-draw" : ""}>
                <path
                  d="M48 68 L56 76 L72 56"
                  stroke="#F59E0B"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  strokeDasharray="32"
                  strokeDashoffset={shouldAnimate ? "32" : "0"}
                >
                  {shouldAnimate && (
                    <animate
                      attributeName="strokeDashoffset"
                      from="32"
                      to="0"
                      dur="0.6s"
                      begin="0.4s"
                      fill="freeze"
                      calcMode="spline"
                      keySplines="0.22 0.61 0.36 1"
                    />
                  )}
                </path>
              </g>
            </g>
          </svg>
        );
      case "favori":
        return (
          <svg
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            className="w-3/4 h-3/4"
          >
            <defs>
              <filter id="star-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {/* Éclats ambre autour */}
            <g className={shouldAnimate ? "animate-star-burst" : ""}>
              <g stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" opacity="0.7">
                <line x1="60" y1="15" x2="60" y2="8" />
                <line x1="60" y1="105" x2="60" y2="112" />
                <line x1="15" y1="60" x2="8" y2="60" />
                <line x1="105" y1="60" x2="112" y2="60" />
                <line x1="28" y1="28" x2="20" y2="20" />
                <line x1="92" y1="92" x2="100" y2="100" />
                <line x1="28" y1="92" x2="20" y2="100" />
                <line x1="92" y1="28" x2="100" y2="20" />
              </g>
              {/* Particules scintillantes */}
              <g fill="#F59E0B" opacity="0.8">
                <circle cx="30" cy="30" r="2">
                  <animate
                    attributeName="opacity"
                    values="0.8;0.2;0.8"
                    dur="2s"
                    repeatCount="indefinite"
                    begin="0s"
                  />
                </circle>
                <circle cx="90" cy="30" r="1.5">
                  <animate
                    attributeName="opacity"
                    values="0.6;0.1;0.6"
                    dur="1.8s"
                    repeatCount="indefinite"
                    begin="0.3s"
                  />
                </circle>
                <circle cx="30" cy="90" r="1.5">
                  <animate
                    attributeName="opacity"
                    values="0.7;0.2;0.7"
                    dur="2.2s"
                    repeatCount="indefinite"
                    begin="0.6s"
                  />
                </circle>
                <circle cx="90" cy="90" r="2">
                  <animate
                    attributeName="opacity"
                    values="0.5;0.1;0.5"
                    dur="2s"
                    repeatCount="indefinite"
                    begin="0.9s"
                  />
                </circle>
              </g>
            </g>
            {/* Étoile contour */}
            <path
              d="M60 18 L67 42 L92 44 L72 62 L75 87 L60 75 L45 87 L48 62 L28 44 L53 42 Z"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="currentColor"
              fillOpacity="0.1"
              filter="url(#star-glow)"
              className={shouldAnimate ? "animate-star-pulse" : ""}
            />
            {/* Éclat central ambre */}
            <circle
              cx="60"
              cy="55"
              r="8"
              fill="#F59E0B"
              fillOpacity="0.2"
              filter="url(#star-glow)"
              className={shouldAnimate ? "animate-glow-pulse" : ""}
            />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div
      data-probe="svg-illustration"
      data-variant={variant}
      className={baseClass}
      aria-hidden="true"
    >
      {/* Lueur radiale overlay - séparée pour ne pas casser le fond animé */}
      <div
        className={cn(
          "absolute inset-0 lueur-nuit pointer-events-none rounded-2xl",
          shouldAnimate ? "animate-respire-lueur" : ""
        )}
        aria-hidden="true"
      />
      <style>{`
        @keyframes float-particles {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes pulse-ring {
          0%, 100% { stroke-width: 3.5; opacity: 0.8; }
          50% { stroke-width: 4.5; opacity: 1; }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes check-draw {
          from { stroke-dashoffset: 32; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes star-burst {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes star-pulse {
          0%, 100% { stroke-width: 3; }
          50% { stroke-width: 4; }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.2); }
        }
        .animate-float-particles { animation: float-particles 4s ease-in-out infinite; }
        .animate-pulse-ring { animation: pulse-ring 3s ease-in-out infinite; }
        .animate-slide-up { animation: slide-up 0.6s cubic-bezier(0.22, 0.61, 0.36, 1) both; }
        .animate-check-draw path { animation: check-draw 0.6s cubic-bezier(0.22, 0.61, 0.36, 1) 0.4s both; }
        .animate-star-burst { animation: star-burst 3s ease-in-out infinite; }
        .animate-star-pulse { animation: star-pulse 2.5s ease-in-out infinite; }
        .animate-glow-pulse { animation: glow-pulse 2s ease-in-out infinite; }
        .animate-respire-lueur { animation: respire-lueur 11s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .animate-float-particles,
          .animate-pulse-ring,
          .animate-slide-up,
          .animate-check-draw path,
          .animate-star-burst,
          .animate-star-pulse,
          .animate-glow-pulse,
          .animate-respire-lueur {
            animation: none !important;
          }
          .animate-check-draw path { stroke-dashoffset: 0 !important; }
        }
      `}</style>
      {renderIllustration()}
    </div>
  );
}

export default SvgIllustration;