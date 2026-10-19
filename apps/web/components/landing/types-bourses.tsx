"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award, Clock, GraduationCap, Globe } from "lucide-react";

/**
 * Types de bourses de la landing — la carte « Bourse gouvernementale » n'est
 * rendue QUE si le comptage réel de `GET /api/v1/offres/categories` est > 0.
 *
 * Zéro mensonge : échec HTTP/réseau, JSON illisible, valeur absente ou nulle
 * → la carte n'est jamais rendue (ni chiffre inventé, ni carte vide).
 */

type Carte = {
  icon: typeof Award;
  label: string;
  desc: string;
  /** Présent = la carte est un lien (seule la carte gouvernementale en a un). */
  href?: string;
};

// Badges d'icônes monochromes : zéro rainbow, la couleur signature reste rare.
// 100 % bourses : chaque entrée décrit un type de bourse financée.
export const TYPES_BOURSES: Carte[] = [
  { icon: Award, label: "Bourse d'études", desc: "Masters, PhD et séjours financés" },
  { icon: GraduationCap, label: "Bourse de master", desc: "Financement complet, 1 à 2 ans" },
  { icon: Clock, label: "Bourse d'échange", desc: "Séjours courts, 2 à 12 semaines" },
];

/** Ajoutée à la grille seulement si l'API compte au moins une bourse d'État. */
export const CARTE_GOUVERNEMENTALE: Carte = {
  icon: Globe,
  label: "Bourse gouvernementale",
  desc: "Offertes par des gouvernements étrangers",
  href: "/offres?categorie=gouvernementale",
};

/** Délai maximal du relevé : au-delà, abandon silencieux (pas de carte). */
const DELAI_MS = 8000;

/** Comptage réel des bourses gouvernementales (null = inconnu → aucune carte). */
async function compterGouvernementales(): Promise<number | null> {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), DELAI_MS);
  try {
    const res = await fetch("/api/v1/offres/categories", { signal: controleur.signal });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (!data || typeof data !== "object") return null;
    const nombre = (data as Record<string, unknown>).gouvernementale;
    return typeof nombre === "number" && Number.isFinite(nombre) && nombre > 0
      ? Math.floor(nombre)
      : 0;
  } catch {
    // Timeout, réseau coupé, JSON illisible : silencieux, aucune carte.
    return null;
  } finally {
    clearTimeout(minuteur);
  }
}

/** Nombre de bourses gouvernementales publiées (null tant que non connu). */
function useGouvernementales(): number | null {
  const [nombre, setNombre] = useState<number | null>(null);
  useEffect(() => {
    let actif = true;
    compterGouvernementales().then((n) => {
      if (actif) setNombre(n);
    });
    return () => {
      actif = false;
    };
  }, []);
  return nombre;
}

/** Grille « Que des bourses, pour ton profil » (section de la landing). */
export function TypesBourses() {
  const nombre = useGouvernementales();
  const cartes: Carte[] =
    nombre !== null && nombre > 0 ? [...TYPES_BOURSES, CARTE_GOUVERNEMENTALE] : TYPES_BOURSES;
  // 3 cartes → 3 colonnes ; 4 cartes → 4 colonnes (jamais une carte orpheline).
  const colonnes = cartes.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3";

  return (
    <div
      className={`mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 md:grid-cols-3 ${colonnes} ${cartes.length >= 4 ? "" : "lg:max-w-6xl"}`}
    >
      {cartes.map((item) => {
        const contenu = (
          <>
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-nuit text-white">
              <item.icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 className="mb-1 text-lg font-semibold text-ink">{item.label}</h3>
            <p className="text-sm text-muted-foreground">{item.desc}</p>
          </>
        );
        const classes =
          "rounded-lg border border-border bg-card p-6 transition-colors duration-200 hover:border-signature";

        return item.href ? (
          <Link
            key={item.label}
            href={item.href}
            data-probe="type-bourse-gouvernementale"
            className={`${classes} block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signature/60`}
          >
            {contenu}
          </Link>
        ) : (
          <div key={item.label} className={classes}>
            {contenu}
          </div>
        );
      })}
    </div>
  );
}
