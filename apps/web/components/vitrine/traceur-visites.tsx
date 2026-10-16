"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** Compteur de visites des pages PUBLIQUES de LAWOL.mr.
 *
 * Au montage — et à chaque changement de vue — envoie `POST /api/v1/visites`
 * avec le seul chemin courant. Valeurs transmises : **jour (posé par l'API) et
 * chemin**, rien d'autre — jamais d'IP, de user-agent ni d'identifiant, donc
 * aucun cookie, aucun stockage local.
 *
 * Silencieux par contrat : le comptage est au mieux (« best effort »), une panne
 * réseau ou une API absente ne produit NI message à l'utilisateur NI trace
 * console. Le composant ne rend rien (aucun style à inventer).
 *
 * Exclusions : back-office (`/admin*`), espace profil (`/profil/*`) et routes
 * d'API (`/api*`) — on ne compte que ce qu'un visiteur vient voir.
 */

/** Préfixes jamais comptés (comparés en début de chemin). */
const PREFIXES_EXCLUS = ["/admin", "/profil", "/api"];

/** Vrai si le chemin est une page publique digne d'être comptée. */
export function estPageComptable(chemin: string): boolean {
  return !PREFIXES_EXCLUS.some((prefixe) => chemin.startsWith(prefixe));
}

export function TraceurVisites() {
  const chemin = usePathname();
  // Dernier chemin envoyé : garantit une seule requête par vue, même si l'effet
  // est rejoué (StrictMode en développement, re-rendu du layout).
  const dernierEnvoye = useRef<string | null>(null);

  useEffect(() => {
    if (!chemin || !estPageComptable(chemin)) return;
    if (dernierEnvoye.current === chemin) return;
    dernierEnvoye.current = chemin;

    // `void` + `.catch` : aucune promesse flottante, aucune erreur remontée.
    void fetch("/api/v1/visites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chemin }),
      keepalive: true,
    }).catch(() => {
      // Panne réseau ou API : compter une visite ne doit jamais gêner la page.
    });
  }, [chemin]);

  return null;
}
