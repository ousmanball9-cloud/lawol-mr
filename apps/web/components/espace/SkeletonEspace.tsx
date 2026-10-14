"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Skeleton, SkeletonText, SkeletonCard } from "@/components/ui/skeleton";

interface SkeletonEspaceProps {
  className?: string;
}

/**
 * Skeleton pour l'espace client (profil + bandeau + grille offres).
 * Composition :
 * - Skeleton Profil : avatar circulaire + 4 chips
 * - Skeleton Bandeau : 3 cartes rectangulares
 * - Skeleton Grille offres : 4 cartes complètes (image + 3 lignes text + 2 boutons)
 * Grille responsive : grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4
 */
export function SkeletonEspace({ className }: SkeletonEspaceProps) {
  return (
    <div
      data-probe="skeleton-espace"
      className={cn("space-y-8", className)}
      aria-hidden="true"
      aria-label="Chargement de l'espace client"
    >
      {/* Skeleton Profil : avatar + 4 chips */}
      <section className="space-y-4" aria-labelledby="skeleton-profil-title">
        <h2 id="skeleton-profil-title" className="sr-only">
          Profil utilisateur
        </h2>
        <div className="flex items-center gap-4">
          <Skeleton variant="circular" className="h-16 w-16" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" width="w-48" />
            <div className="flex flex-wrap gap-2">
              <Skeleton variant="text" width="w-24" height="h-6" />
              <Skeleton variant="text" width="w-24" height="h-6" />
              <Skeleton variant="text" width="w-24" height="h-6" />
              <Skeleton variant="text" width="w-24" height="h-6" />
            </div>
          </div>
        </div>
      </section>

      {/* Skeleton Bandeau : 3 cartes */}
      <section className="space-y-4" aria-labelledby="skeleton-bandeau-title">
        <h2 id="skeleton-bandeau-title" className="sr-only">
          Bandeau d&apos;informations
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton variant="rectangular" className="h-20" />
          <Skeleton variant="rectangular" className="h-20" />
          <Skeleton variant="rectangular" className="h-20" />
        </div>
      </section>

      {/* Skeleton Grille offres : 4 cartes complètes */}
      <section aria-labelledby="skeleton-offres-title">
        <h2 id="skeleton-offres-title" className="sr-only">
          Offres
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} className="h-full" />
          ))}
        </div>
      </section>
    </div>
  );
}

export default SkeletonEspace;