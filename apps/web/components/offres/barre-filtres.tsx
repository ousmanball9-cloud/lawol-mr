"use client";

import { useCallback, useRef, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { PanneauFiltres, compterFiltresActifs } from "./panneau-filtres";
import type { PropsFiltres } from "./panneau-filtres";
import {
  CATEGORIES_BOURSE,
  FILIERES,
  PAYS_ETUDES,
  TYPES_FINANCEMENT,
  type TriOffres,
} from "./types";

type Props = PropsFiltres & {
  /** Remet l'URL à nu (facettes par défaut) — aussi utilisé dans le panneau. */
  onReinitialiser: () => void;
};

/* Cibles tactiles ≥ 44 px (constat chasse 5 : 33 éléments sous 44 px sur /offres). */
const SELECT =
  "min-h-11 rounded-lg border border-input bg-white px-3 py-2 text-sm text-foreground transition-colors duration-150 focus:border-signature focus:outline-none focus:ring-2 focus:ring-signature/30";

/** Basculante (filtre/état) : repos bordure fine, active en signature. */
const bascule = (actif: boolean) =>
  `inline-flex min-h-11 items-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signature/60 ${
    actif
      ? "border-signature bg-signature text-white"
      : "border-input bg-white text-foreground hover:border-signature hover:text-signature"
  }`;

/**
 * Barre de recherche (mots-clés) + filtres du catalogue.
 *
 * Deux dispositions, une seule source d'état :
 *  · ≥ 768 px — la barre historique, inchangée : 4 `select` + tri + 2 bascules
 *    visibles d'un coup.
 *  · < 768 px — la recherche reste visible, et un bouton « Filtres · n » (n =
 *    filtres actifs) ouvre `PanneauFiltres` en plein écran. Sans cela, les
 *    `select` empilés repoussaient la première offre sous la ligne de
 *    flottaison (docs/chasse/03-recherche-ia.md, SP-04).
 */
export function BarreFiltres({
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
  onReinitialiser,
}: Props) {
  const [panneauOuvert, setPanneauOuvert] = useState(false);
  const declencheurRef = useRef<HTMLButtonElement>(null);
  // Identités stables : l'effet du panneau (Échap, focus, scroll) ne doit pas
  // se rejouer à chaque rendu de la page.
  const ouvrirPanneau = useCallback(() => setPanneauOuvert(true), []);
  const fermerPanneau = useCallback(() => setPanneauOuvert(false), []);

  const nbActifs = compterFiltresActifs({
    motsCles,
    categorieFiltre,
    filiereFiltre,
    paysFiltre,
    financementFiltre,
    cloture30,
    expireesVisibles,
  });

  const filtres = {
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
  };

  return (
    <div className="mb-6 rounded-lg border border-border bg-card p-4 shadow-card">
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap">
        <div className="relative min-w-[200px] flex-1" data-probe="offres-recherche">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={motsCles}
            onChange={(e) => setMotsCles(e.target.value)}
            placeholder="Rechercher une bourse, un titre, un pays, un mot-clé…"
            aria-label="Rechercher dans les offres"
            className="min-h-11 w-full rounded-lg border border-input bg-white py-2 pl-9 pr-3 text-sm text-foreground transition-colors duration-150 focus:border-signature focus:outline-none focus:ring-2 focus:ring-signature/30"
          />
        </div>
        {/* ≥ 768 px : les 4 selects de la barre historique (probe historique
            conservée, unique : elle existe aussi — masquée — sous 768 px). */}
        <div data-probe="offres-filtres" className="hidden flex-wrap gap-3 md:flex">
          <select
            value={filiereFiltre}
            onChange={(e) => setFiliereFiltre(e.target.value)}
            aria-label="Filtrer par filière"
            className={SELECT}
          >
            <option value="tous">Toutes les filières</option>
            {FILIERES.map((f) => (
              <option key={f.valeur} value={f.valeur}>
                {f.label}
              </option>
            ))}
          </select>
          <select
            value={paysFiltre}
            onChange={(e) => setPaysFiltre(e.target.value)}
            aria-label="Filtrer par pays d'études"
            className={SELECT}
          >
            <option value="tous">Tous les pays</option>
            {PAYS_ETUDES.map((p) => (
              <option key={p.valeur} value={p.valeur}>
                {p.label}
              </option>
            ))}
          </select>
          <select
            value={financementFiltre}
            onChange={(e) => setFinancementFiltre(e.target.value)}
            aria-label="Filtrer par type de financement"
            className={SELECT}
          >
            <option value="tous">Tous financements</option>
            {TYPES_FINANCEMENT.map((f) => (
              <option key={f.valeur} value={f.valeur}>
                {f.label}
              </option>
            ))}
          </select>
          <select
            value={categorieFiltre}
            onChange={(e) => setCategorieFiltre(e.target.value)}
            aria-label="Filtrer par catégorie de bourse"
            data-probe="offres-categorie"
            className={SELECT}
          >
            <option value="toutes">Toutes les catégories</option>
            {CATEGORIES_BOURSE.map((c) => (
              <option key={c.valeur} value={c.valeur}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* < 768 px : un seul bouton, avec le nombre de filtres actifs. */}
        <button
          ref={declencheurRef}
          type="button"
          onClick={ouvrirPanneau}
          aria-expanded={panneauOuvert}
          aria-controls="offres-panneau-filtres"
          aria-label={
            nbActifs > 0
              ? `Filtres, ${nbActifs} actif${nbActifs > 1 ? "s" : ""}`
              : "Filtres"
          }
          data-probe="offres-filtres-mobile"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-input bg-white px-4 py-2 text-sm font-medium text-foreground transition-colors duration-150 hover:border-signature hover:text-signature focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signature/60 md:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filtres
          <span
            data-probe="offres-filtres-actifs"
            aria-hidden="true"
            className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-signature px-1.5 text-xs font-semibold text-white"
          >
            {nbActifs}
          </span>
        </button>
      </div>

      {/* Deadline au centre : tri par urgence + fenêtre 30 j + état des expirées
          (≥ 768 px ; sous 768 px ces contrôles vivent dans le panneau). */}
      <div
        data-probe="offres-echeance"
        className="mt-3 hidden flex-wrap items-center gap-3 border-t border-border pt-3 md:flex"
      >
        <select
          value={tri}
          onChange={(e) => setTri(e.target.value as TriOffres)}
          aria-label="Trier les offres"
          data-probe="offres-tri"
          className={SELECT}
        >
          <option value="urgent">Plus urgentes</option>
          <option value="recentes">Plus récentes</option>
        </select>
        <button
          type="button"
          aria-pressed={cloture30}
          onClick={() => setCloture30(!cloture30)}
          className={bascule(cloture30)}
          data-probe="offres-cloture30"
        >
          Clôture dans moins de 30 jours
        </button>
        <button
          type="button"
          aria-pressed={expireesVisibles}
          onClick={() => setExpireesVisibles(!expireesVisibles)}
          className={bascule(expireesVisibles)}
          data-probe="offres-expirees"
        >
          {expireesVisibles ? "Masquer" : "Afficher"} les expirées ({nbExpirees})
        </button>
      </div>

      {/* Le compteur de résultats n'est plus ici : il vit dans le bandeau
          collant de `page.tsx` (V2-01), visible pendant le scroll. */}

      {panneauOuvert && (
        <PanneauFiltres
          {...filtres}
          onFermer={fermerPanneau}
          onReinitialiser={onReinitialiser}
          declencheurRef={declencheurRef}
        />
      )}
    </div>
  );
}
