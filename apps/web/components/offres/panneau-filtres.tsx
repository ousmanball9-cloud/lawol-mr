"use client";

import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AUCUN_FILTRE, TOUTES_CATEGORIES } from "@/lib/offres-url";
import {
  CATEGORIES_BOURSE,
  FILIERES,
  PAYS_ETUDES,
  TYPES_FINANCEMENT,
  type TriOffres,
} from "./types";

/**
 * Panneau de filtres mobile (V2-05) — visible UNIQUEMENT sous 768 px.
 *
 * Pourquoi il existe : à 375-390 px, les 4 `select` empilés de la barre
 * poussaient la première offre sous la ligne de flottaison (constat
 * docs/chasse/03-recherche-ia.md, SP-04 / CF-04). Ici tous les filtres vivent
 * dans un panneau plein écran, ouvert par le bouton « Filtres · n ».
 *
 * Au-delà de 768 px ce composant n'est jamais monté : la barre historique
 * reste inchangée (les classes `md:hidden` sont une ceinture de sécurité en
 * cas de redimensionnement pendant que le panneau est ouvert).
 *
 * Aucune dépendance : overlay maison, comme `offre-detail-modal.tsx`.
 */

/** Props communes à la barre et au panneau : une seule source de vérité. */
export type PropsFiltres = {
  motsCles: string;
  setMotsCles: (valeur: string) => void;
  filiereFiltre: string;
  setFiliereFiltre: (valeur: string) => void;
  paysFiltre: string;
  setPaysFiltre: (valeur: string) => void;
  financementFiltre: string;
  setFinancementFiltre: (valeur: string) => void;
  /** Catégorie de bourse : « toutes » ou une valeur de `CATEGORIES_BOURSE`. */
  categorieFiltre: string;
  setCategorieFiltre: (valeur: string) => void;
  /** Tri catalogue : « urgent » (défaut) ou « recentes ». */
  tri: TriOffres;
  setTri: (valeur: TriOffres) => void;
  /** Filtre « Clôture dans moins de 30 jours ». */
  cloture30: boolean;
  setCloture30: (valeur: boolean) => void;
  /** État explicite des offres expirées (masquées par défaut, jamais perdues). */
  expireesVisibles: boolean;
  setExpireesVisibles: (valeur: boolean) => void;
  /** Nombre d'offres expirées correspondant aux autres critères. */
  nbExpirees: number;
  nbResultats: number;
};

/** Facettes qui comptent dans la pastille du bouton « Filtres ». */
type FacettesComptables = {
  motsCles: string;
  categorieFiltre: string;
  filiereFiltre: string;
  paysFiltre: string;
  financementFiltre: string;
  cloture30: boolean;
  expireesVisibles: boolean;
};

/**
 * Nombre de filtres actifs — le tri n'en est pas un (il réordonne, il ne
 * restreint rien) : le compter ferait croire à un filtre oublié.
 */
export function compterFiltresActifs(facettes: FacettesComptables): number {
  let total = 0;
  if (facettes.motsCles.trim() !== "") total += 1;
  if (facettes.categorieFiltre !== TOUTES_CATEGORIES) total += 1;
  if (facettes.filiereFiltre !== AUCUN_FILTRE) total += 1;
  if (facettes.paysFiltre !== AUCUN_FILTRE) total += 1;
  if (facettes.financementFiltre !== AUCUN_FILTRE) total += 1;
  if (facettes.cloture30) total += 1;
  if (facettes.expireesVisibles) total += 1;
  return total;
}

/** Cibles tactiles ≥ 44 px (même contrainte que la barre desktop). */
const CHAMP =
  "min-h-11 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-foreground transition-colors duration-150 focus:border-signature focus:outline-none focus:ring-2 focus:ring-signature/30";

const LABEL = "mb-1.5 block text-sm font-medium text-foreground";

const basculePanneau = (actif: boolean) =>
  `inline-flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signature/60 ${
    actif
      ? "border-signature bg-signature text-white"
      : "border-input bg-white text-foreground hover:border-signature hover:text-signature"
  }`;

type Props = PropsFiltres & {
  onFermer: () => void;
  onReinitialiser: () => void;
  /** Le bouton « Filtres » : il reprend le focus à la fermeture. */
  declencheurRef: RefObject<HTMLButtonElement | null>;
};

const SELECTEURS_FOCUS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Panneau plein écran des filtres, monté seulement quand il est ouvert.
 * Fermeture : bouton ✕, bouton « Voir les offres », clic sur le fond, Échap.
 * Le focus revient TOUJOURS au déclencheur (démontage → nettoyage).
 */
export function PanneauFiltres({
  onFermer,
  onReinitialiser,
  declencheurRef,
  motsCles,
  setMotsCles,
  filiereFiltre,
  setFiliereFiltre,
  paysFiltre,
  setPaysFiltre,
  financementFiltre,
  setFinancementFiltre,
  categorieFiltre,
  setCategorieFiltre,
  tri,
  setTri,
  cloture30,
  setCloture30,
  expireesVisibles,
  setExpireesVisibles,
  nbExpirees,
  nbResultats,
}: Props) {
  const panneauRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const focusPrecedent = document.activeElement as HTMLElement | null;
    // Capturé au montage : le bouton déclencheur est déjà rendu (le panneau
    // s'ouvre sur son clic), et la valeur du ref au démontage serait tardive.
    const declencheur = declencheurRef.current;
    const overflowPrecedent = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // pas de scroll de la page derrière
    panneauRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onFermer();
        return;
      }
      // Piège de focus : aria-modal implique de ne pas sortir du panneau.
      if (e.key !== "Tab") return;
      const zone = panneauRef.current;
      if (!zone) return;
      const cibles = [...zone.querySelectorAll<HTMLElement>(SELECTEURS_FOCUS)];
      if (cibles.length === 0) return;
      const premier = cibles[0];
      const dernier = cibles[cibles.length - 1];
      if (e.shiftKey && document.activeElement === premier) {
        e.preventDefault();
        dernier.focus();
      } else if (!e.shiftKey && document.activeElement === dernier) {
        e.preventDefault();
        premier.focus();
      }
    }

    // Un redimensionnement vers ≥ 768 px rend le panneau inutile (et bloquerait
    // le scroll) : on le referme pour rendre la barre desktop.
    const media =
      typeof window.matchMedia === "function" ? window.matchMedia("(min-width: 768px)") : null;
    const onMedia = (e: MediaQueryListEvent) => {
      if (e.matches) onFermer();
    };
    media?.addEventListener("change", onMedia);

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      media?.removeEventListener("change", onMedia);
      document.body.style.overflow = overflowPrecedent;
      // Focus rendu au déclencheur (jamais perdu dans le body).
      (declencheur ?? focusPrecedent)?.focus();
    };
  }, [onFermer, declencheurRef]);

  const fermer = useCallback(() => onFermer(), [onFermer]);

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Fond : clic = fermeture (jamais noir : nuit indigo de la charte). */}
      <div
        className="absolute inset-0 bg-nuit-deep/60"
        onClick={fermer}
        aria-hidden="true"
      />
      <div
        ref={panneauRef}
        id="offres-panneau-filtres"
        role="dialog"
        aria-modal="true"
        aria-labelledby="offres-panneau-titre"
        tabIndex={-1}
        data-probe="offres-panneau"
        className="absolute inset-0 flex flex-col bg-background focus:outline-none"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
          <h2
            id="offres-panneau-titre"
            className="font-display text-lg font-bold tracking-[-0.01em] text-foreground"
          >
            Filtres
          </h2>
          <button
            type="button"
            onClick={fermer}
            aria-label="Fermer les filtres"
            data-probe="offres-panneau-fermer"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-input bg-white text-foreground transition-colors duration-150 hover:border-signature hover:text-signature focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signature/60"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="panneau-recherche" className={LABEL}>
                Recherche
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  id="panneau-recherche"
                  type="search"
                  value={motsCles}
                  onChange={(e) => setMotsCles(e.target.value)}
                  placeholder="Bourse, titre, pays, mot-clé…"
                  data-probe="offres-recherche-panneau"
                  className={`${CHAMP} pl-9 pr-3`}
                />
              </div>
            </div>

            <div>
              <label htmlFor="panneau-filiere" className={LABEL}>
                Filière
              </label>
              <select
                id="panneau-filiere"
                value={filiereFiltre}
                onChange={(e) => setFiliereFiltre(e.target.value)}
                className={CHAMP}
              >
                <option value="tous">Toutes les filières</option>
                {FILIERES.map((f) => (
                  <option key={f.valeur} value={f.valeur}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="panneau-pays" className={LABEL}>
                Pays d&apos;études
              </label>
              <select
                id="panneau-pays"
                value={paysFiltre}
                onChange={(e) => setPaysFiltre(e.target.value)}
                className={CHAMP}
              >
                <option value="tous">Tous les pays</option>
                {PAYS_ETUDES.map((p) => (
                  <option key={p.valeur} value={p.valeur}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="panneau-financement" className={LABEL}>
                Financement
              </label>
              <select
                id="panneau-financement"
                value={financementFiltre}
                onChange={(e) => setFinancementFiltre(e.target.value)}
                className={CHAMP}
              >
                <option value="tous">Tous financements</option>
                {TYPES_FINANCEMENT.map((f) => (
                  <option key={f.valeur} value={f.valeur}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="panneau-categorie" className={LABEL}>
                Catégorie de bourse
              </label>
              <select
                id="panneau-categorie"
                value={categorieFiltre}
                onChange={(e) => setCategorieFiltre(e.target.value)}
                className={CHAMP}
              >
                <option value="toutes">Toutes les catégories</option>
                {CATEGORIES_BOURSE.map((c) => (
                  <option key={c.valeur} value={c.valeur}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="panneau-tri" className={LABEL}>
                Trier par
              </label>
              <select
                id="panneau-tri"
                value={tri}
                onChange={(e) => setTri(e.target.value as TriOffres)}
                className={CHAMP}
              >
                <option value="urgent">Plus urgentes</option>
                <option value="recentes">Plus récentes</option>
              </select>
            </div>

            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <button
                type="button"
                aria-pressed={cloture30}
                onClick={() => setCloture30(!cloture30)}
                className={basculePanneau(cloture30)}
                data-probe="offres-cloture30-panneau"
              >
                <span>Clôture dans moins de 30 jours</span>
                <span aria-hidden="true">{cloture30 ? "Activé" : "Désactivé"}</span>
              </button>
              <button
                type="button"
                aria-pressed={expireesVisibles}
                onClick={() => setExpireesVisibles(!expireesVisibles)}
                className={basculePanneau(expireesVisibles)}
                data-probe="offres-expirees-panneau"
              >
                <span>
                  {expireesVisibles ? "Masquer" : "Afficher"} les expirées ({nbExpirees})
                </span>
                <span aria-hidden="true">{expireesVisibles ? "Activé" : "Désactivé"}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onReinitialiser}
              data-probe="offres-panneau-reinitialiser"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors duration-150 hover:border-signature hover:text-signature focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signature/60"
            >
              Réinitialiser les filtres
            </button>
          </div>
        </div>

        <div className="border-t border-border bg-card px-4 py-3">
          <Button
            onClick={fermer}
            data-probe="offres-panneau-voir"
            className="h-11 w-full rounded-lg bg-signature px-4 text-white hover:bg-signature-deep"
          >
            Voir les {nbResultats} offre{nbResultats > 1 ? "s" : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}
