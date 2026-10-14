"use client";

import { useState, useEffect, useCallback, useRef, KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";

/**
 * Carousel témoignages — 3 slides, auto-rotate 5s, pause hover, clavier.
 * data-probe="temoignages", expect: carousel présent, 3 slides, navigation clavier
 * Fond nuit (fond-nuit-anime), texte blanc, citation surlignée (surlignage)
 * Responsive : 1 slide mobile, 2 tablette, 3 desktop
 */

interface Temoignage {
  /** Texte du témoignage (peut contenir des guillemets). */
  texte: string;
  /** Initiales de l'auteur (ex: "A.M."). */
  initiales: string;
  /** Ville de l'auteur. */
  ville: string;
  /** Filière / formation de l'auteur. */
  filiere: string;
}

/** Témoignages par défaut (3). */
const TEMOIGNAGES_DEFAUT: Temoignage[] = [
  {
    texte:
      "Grâce à LAWOL.mr, j'ai trouvé ma bourse de master en France en 3 semaines. Les alertes m'ont évité de rater les dates limites.",
    initiales: "A.M.",
    ville: "Nouakchott",
    filiere: "Master Droit International",
  },
  {
    texte:
      "La vérification des sources est un vrai plus. Je ne perds plus de temps sur des offres fantômes. Interface claire, zéro pub.",
    initiales: "F.D.",
    ville: "Rosso",
    filiere: "Ingénierie Informatique",
  },
  {
    texte:
      "Désinscription en 1 clic, données protégées : la confiance est là. J'ai recommandé à toute ma promo de l'UNA.",
    initiales: "S.K.",
    ville: "Kaédi",
    filiere: "Licence Économie-Gestion",
  },
];

interface TestimonialCarouselProps {
  /** Liste des témoignages (défaut 3). */
  temoignages?: Temoignage[];
  /** Intervalle auto-rotate en ms (défaut 5000). */
  intervalle?: number;
  /** Afficher les flèches de navigation (défaut true). */
  afficherFleches?: boolean;
  /** Afficher les points de pagination (défaut true). */
  afficherPoints?: boolean;
  /** Titre de la section (optionnel). */
  titre?: string;
  /** Sous-titre (optionnel). */
  sousTitre?: string;
}

/**
 * Composant carousel de témoignages avec auto-rotate, pause hover, navigation clavier.
 * @param temoignages - Liste des témoignages (défaut 3)
 * @param intervalle - Durée entre slides en ms (défaut 5000)
 * @param afficherFleches - Afficher flèches prev/next
 * @param afficherPoints - Afficher pagination points
 * @param titre - Titre optionnel
 * @param sousTitre - Sous-titre optionnel
 */
export default function TestimonialCarousel({
  temoignages = TEMOIGNAGES_DEFAUT,
  intervalle = 5000,
  afficherFleches = true,
  afficherPoints = true,
  titre = "Ils en parlent mieux que nous",
  sousTitre = "Étudiants et lauréats partagent leur expérience LAWOL.mr",
}: TestimonialCarouselProps) {
  const [indexActif, setIndexActif] = useState(0);
  const [estSurvole, setEstSurvole] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [estFocus, setEstFocus] = useState(false);
  const intervalleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nombreSlides = temoignages.length;

  // Nettoyage de l'intervalle
  const arreterAutoRotate = useCallback(() => {
    if (intervalleRef.current) {
      clearInterval(intervalleRef.current);
      intervalleRef.current = null;
    }
  }, []);

  // Détection prefers-reduced-motion pour désactiver l'auto-rotate
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Pause au focus (clavier) sur flèches + pagination
  const handleFocus = useCallback(() => setEstFocus(true), []);
  const handleBlur = useCallback(() => setEstFocus(false), []);

  // Auto-rotate conditionnel selon reduced-motion + hover + focus
  const demarrerAutoRotate = useCallback(() => {
    arreterAutoRotate();
    if (!prefersReducedMotion && !estSurvole && !estFocus && nombreSlides > 1) {
      intervalleRef.current = setInterval(() => {
        setIndexActif((prev) => (prev + 1) % nombreSlides);
      }, intervalle);
    }
  }, [arreterAutoRotate, estSurvole, estFocus, intervalle, nombreSlides, prefersReducedMotion]);

  // Effet principal : auto-rotate + nettoyage
  useEffect(() => {
    demarrerAutoRotate();
    return () => arreterAutoRotate();
  }, [demarrerAutoRotate, arreterAutoRotate]);

  // Pause au hover
  useEffect(() => {
    if (estSurvole) {
      arreterAutoRotate();
    } else {
      demarrerAutoRotate();
    }
  }, [estSurvole, arreterAutoRotate, demarrerAutoRotate]);

  // Pause au focus
  useEffect(() => {
    if (estFocus) {
      arreterAutoRotate();
    } else {
      demarrerAutoRotate();
    }
  }, [estFocus, arreterAutoRotate, demarrerAutoRotate]);

  // Navigation clavier
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIndexActif((prev) => (prev - 1 + nombreSlides) % nombreSlides);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setIndexActif((prev) => (prev + 1) % nombreSlides);
      } else if (e.key === "Home") {
        e.preventDefault();
        setIndexActif(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setIndexActif(nombreSlides - 1);
      }
    },
    [nombreSlides]
  );

  // Navigation par points
  const allerAuSlide = useCallback((index: number) => {
    setIndexActif(index);
  }, []);

  // Navigation flèches
  const slidePrecedent = useCallback(() => {
    setIndexActif((prev) => (prev - 1 + nombreSlides) % nombreSlides);
  }, [nombreSlides]);

  const slideSuivant = useCallback(() => {
    setIndexActif((prev) => (prev + 1) % nombreSlides);
  }, [nombreSlides]);

  // Calcul des slides visibles selon breakpoint (CSS gère l'affichage, ici on gère le groupe)
  // Pour un vrai carousel multi-slide, on affiche un groupe de slides.
  // Ici design simple : 1 slide mobile, mais on garde la structure pour extension.

  return (
    <section
      data-probe="temoignages"
      aria-labelledby="temoignages-title"
      className="relative py-16 lg:py-24 fond-nuit-anime"
      onMouseEnter={() => setEstSurvole(true)}
      onMouseLeave={() => setEstSurvole(false)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-roledescription="carousel"
    >
      {/* Lueur décorative */}
      <div className="absolute inset-0 lueur-nuit pointer-events-none" aria-hidden="true" />

      <div className="relative container mx-auto px-4">
        {/* En-tête */}
        {(titre || sousTitre) && (
          <div className="mb-12 text-center relative z-10">
            {titre && (
              <h2 id="temoignages-title" className="font-display text-2xl font-bold tracking-[-0.02em] text-white lg:text-3xl">
                {titre}
              </h2>
            )}
            {sousTitre && (
              <p className="mt-2 max-w-2xl mx-auto text-white/80">
                {sousTitre}
              </p>
            )}
          </div>
        )}

        {/* Zone carousel */}
        <div className="relative z-10">
          {/* Conteneur des slides - responsive grid */}
          <div
            id="temoignages-list"
            className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
            role="list"
            aria-live="polite"
            aria-atomic="false"
          >
            {temoignages.map((temoignage, index) => (
              <article
                key={`${temoignage.initiales}-${index}`}
                role="listitem"
                className={`
                  relative rounded-2xl border border-white/10 bg-white/5 p-6
                  transition-all duration-300
                  ${index === indexActif ? "opacity-100 scale-100" : "opacity-60 scale-95 md:opacity-100 md:scale-100 lg:opacity-100 lg:scale-100"}
                `}
                aria-hidden={index !== indexActif && typeof window !== "undefined" && window.innerWidth < 768}
              >
                {/* Guillemet décoratif */}
                <div className="absolute top-4 right-4 text-surlignage/20" aria-hidden="true">
                  <Quote className="h-12 w-12" />
                </div>

                {/* Texte du témoignage */}
                <blockquote className="relative mb-6 text-white/90 leading-relaxed">
                  <p className="text-lg">
                    {temoignage.texte.split('"').map((part, i) =>
                      i % 2 === 1 ? (
                        <span key={i} className="text-surlignage font-medium">
                          {"\"" + part + "\""}
                        </span>
                      ) : (
                        part
                      )
                    )}
                  </p>
                </blockquote>

                {/* Auteur */}
                <footer className="flex items-center gap-4">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-signature/20 text-signature font-semibold text-sm"
                    aria-hidden="true"
                  >
                    {temoignage.initiales}
                  </div>
                  <div>
                    <cite className="not-italic font-medium text-white">
                      {temoignage.initiales.replace(/\./g, "").replace(/([A-Z])/g, " $1").trim()}
                    </cite>
                    <p className="text-xs text-white/60">
                      {temoignage.ville} · {temoignage.filiere}
                    </p>
                  </div>
                </footer>
              </article>
            ))}
          </div>

          {/* Flèches navigation (desktop seulement) */}
          {afficherFleches && nombreSlides > 1 && (
            <>
              <button
                type="button"
                onClick={slidePrecedent}
                onMouseEnter={() => setEstSurvole(true)}
                onMouseLeave={() => setEstSurvole(false)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:translate-x-0 hidden md:flex
                           h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white
                           hover:bg-white/20 transition-colors duration-200
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signature"
                aria-label="Témoignage précédent"
                aria-controls="temoignages-list"
              >
                <ChevronLeft className="h-6 w-6" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={slideSuivant}
                onMouseEnter={() => setEstSurvole(true)}
                onMouseLeave={() => setEstSurvole(false)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-0 hidden md:flex
                           h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white
                           hover:bg-white/20 transition-colors duration-200
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signature"
                aria-label="Témoignage suivant"
                aria-controls="temoignages-list"
              >
                <ChevronRight className="h-6 w-6" aria-hidden="true" />
              </button>
            </>
          )}

          {/* Points pagination */}
          {afficherPoints && nombreSlides > 1 && (
            <nav
              className="mt-8 flex items-center justify-center gap-2"
              aria-label="Pagination des témoignages"
              role="tablist"
            >
              {temoignages.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => allerAuSlide(index)}
                  onMouseEnter={() => setEstSurvole(true)}
                  onMouseLeave={() => setEstSurvole(false)}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  className={`
                    h-2 w-2 rounded-full transition-all duration-200
                    ${index === indexActif
                      ? "bg-surlignage w-6"
                      : "bg-white/30 hover:bg-white/50"}
                  `}
                  role="tab"
                  aria-selected={index === indexActif}
                  aria-label={`Aller au témoignage ${index + 1}`}
                  id={`temoignage-tab-${index}`}
                />
              ))}
            </nav>
          )}

          {/* Indication clavier (sr-only) */}
          <p className="sr-only">
            Utilisez les flèches gauche/droite pour naviguer, Home pour le premier, End pour le dernier.
          </p>
        </div>
      </div>
    </section>
  );
}