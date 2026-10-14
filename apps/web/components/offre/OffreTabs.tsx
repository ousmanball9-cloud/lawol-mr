"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** Onglet actif du filtre statut. */
export type OngletStatut = "tous" | "postulees" | "encours" | "favorites";

/** Compteurs par onglet pour affichage (ex: "Tous (12)"). */
export type CompteursOnglets = {
  tous: number;
  postulees: number;
  encours: number;
  favorites: number;
};

/** Props du composant OffreTabs. */
export type OffreTabsProps = {
  /** Onglet actuellement actif. */
  activeTab: OngletStatut;
  /** Callback changement d'onglet. */
  onChange: (tab: OngletStatut) => void;
  /** Compteurs à afficher à côté des libellés. */
  counts: CompteursOnglets;
};

/**
 * Barre de 4 tabs horizontaux avec compteurs pour filtrer les offres par statut.
 * - Active : `bg-signature/10 text-signature border-b-2 border-signature`
 * - Inactive : `text-muted-foreground hover:text-foreground`
 * - Navigation clavier (←/→) + focus visible
 * - ARIA : `role="tablist"`, chaque tab `role="tab"` + `aria-selected`
 * - `data-probe="filtre-statut"` pour les tests E2E
 *
 * @param activeTab - Onglet actif ("tous" | "postulees" | "encours" | "favorites")
 * @param onChange - Callback (tab) => void
 * @param counts - { tous, postulees, encours, favorites }
 */
export default function OffreTabs({ activeTab, onChange, counts }: OffreTabsProps) {
  const tabsRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const tabs = useMemo(
    () => [
      { id: "tous" as const, label: "Tous", count: counts.tous },
      { id: "postulees" as const, label: "Postulées", count: counts.postulees },
      { id: "encours" as const, label: "En cours", count: counts.encours },
      { id: "favorites" as const, label: "Favorites", count: counts.favorites },
    ],
    [counts.tous, counts.postulees, counts.encours, counts.favorites]
  );

  // Navigation clavier ←/→ entre tabs
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      let newIndex = index;
      if (e.key === "ArrowRight") {
        newIndex = (index + 1) % tabs.length;
      } else if (e.key === "ArrowLeft") {
        newIndex = (index - 1 + tabs.length) % tabs.length;
      } else if (e.key === "Home") {
        newIndex = 0;
      } else if (e.key === "End") {
        newIndex = tabs.length - 1;
      } else {
        return;
      }
      e.preventDefault();
      setFocusedIndex(newIndex);
      const tabElements = tabsRef.current?.querySelectorAll('[role="tab"]');
      if (tabElements && tabElements[newIndex]) {
        (tabElements[newIndex] as HTMLElement).focus();
      }
    },
    [tabs.length]
  );

  // Synchroniser focusedIndex avec activeTab (si changé de l'extérieur)
  useEffect(() => {
    const idx = tabs.findIndex((t) => t.id === activeTab);
    if (idx !== -1) setFocusedIndex(idx);
  }, [activeTab, tabs]);

  return (
    <div
      ref={tabsRef}
      data-probe="filtre-statut"
      role="tablist"
      aria-label="Filtrer les offres par statut de candidature"
      className="mb-4 flex gap-1 border-b border-border overflow-x-auto"
    >
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`panel-${tab.id}`}
          id={`tab-${tab.id}`}
          tabIndex={activeTab === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onFocus={() => setFocusedIndex(index)}
          data-probe={`tab-${tab.id}`}
          className={`-mb-px px-4 py-2 text-sm font-medium transition-colors duration-150 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signature/60 focus-visible:ring-offset-2 ${
            activeTab === tab.id
              ? "bg-signature/10 text-signature border-b-2 border-signature"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <span className="flex items-center gap-1.5">
            {tab.label}
            <span
              data-probe={`tab-count-${tab.id}`}
              className="inline-flex items-center justify-center min-w-[1.25rem] h-5 rounded-full bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground"
              aria-hidden="true"
            >
              {tab.count}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}