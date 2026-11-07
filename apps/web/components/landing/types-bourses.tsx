"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award, Clock, GraduationCap, Globe } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Types de bourses de la landing.
 *
 * La carte « Bourse gouvernementale » est rendue QUE si le comptage réel de
 * `GET /api/v1/offres/categories` est > 0 — zéro mensonge : échec HTTP/réseau,
 * JSON illisible, valeur absente ou nulle → jamais un chiffre inventé.
 *
 * V3-06 — le 4e emplacement est désormais TOUJOURS réservé :
 *   · `chargement`   → une carte-squelette de la bibliothèque (même gabarit) ;
 *   · `connu` > 0    → la vraie carte « Bourse gouvernementale » ;
 *   · `connu` = 0    → une carte neutre « aucune bourse d'État en ligne » ;
 *   · `indisponible` → une carte neutre « chiffre en cours de mise à jour ».
 * La grille ne passe donc plus de 3 à 4 cartes (et de 3 à 4 rangées en mobile)
 * après la réponse : aucun saut de mise en page, aucune carte qui s'évapore.
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

/** Délai maximal du relevé : au-delà, abandon silencieux (carte neutre). */
const DELAI_MS = 8000;

/** Comptage réel des bourses gouvernementales (null = inconnu, jamais 0 par défaut). */
async function compterGouvernementales(): Promise<number | null> {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), DELAI_MS);
  try {
    const res = await fetch("/api/v1/offres/categories", { signal: controleur.signal });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (!data || typeof data !== "object") return null;
    const nombre = (data as Record<string, unknown>).gouvernementale;
    // Catégorie absente ou valeur non numérique = on ne sait pas (≠ 0 vérifié).
    if (typeof nombre !== "number" || !Number.isFinite(nombre)) return null;
    return Math.max(0, Math.floor(nombre));
  } catch {
    // Timeout, réseau coupé, JSON illisible : inconnu, aucune carte inventée.
    return null;
  } finally {
    clearTimeout(minuteur);
  }
}

/** État du comptage : un `null` de rendu n'existe plus (V3-06). */
type EtatComptage =
  | { statut: "chargement" }
  | { statut: "connu"; nombre: number }
  | { statut: "indisponible" };

function useGouvernementales(): EtatComptage {
  const [etat, setEtat] = useState<EtatComptage>({ statut: "chargement" });
  useEffect(() => {
    let actif = true;
    compterGouvernementales().then((nombre) => {
      if (!actif) return;
      setEtat(nombre === null ? { statut: "indisponible" } : { statut: "connu", nombre });
    });
    return () => {
      actif = false;
    };
  }, []);
  return etat;
}

/** Classes communes d'une carte de la grille (mêmes marges, même hauteur). */
const CARTE_CLASSES =
  "rounded-lg border border-border bg-card p-6 transition-colors duration-200 hover:border-signature";

/** Badge d'icône commun (44 px, comme les cartes réelles). */
const BADGE_CLASSES = "mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg";

/**
 * Hauteur verrouillée du 4e emplacement (208 px = carte « Bourse
 * gouvernementale » telle qu'elle se rend : titre sur 2 lignes + description
 * sur 2 lignes). Le squelette, la carte neutre et la vraie carte font donc
 * TOUJOURS la même hauteur : la grille ne bouge plus quand la réponse arrive
 * (mesuré : 0 px de déplacement de la section suivante, 375 et 1280 px).
 */
const HAUTEUR_4E = "min-h-[13rem]";

/** Carte-squelette : exactement le gabarit d'une carte, hauteur verrouillée. */
function CarteSquelette() {
  return (
    <div aria-hidden="true" className={`${CARTE_CLASSES} ${HAUTEUR_4E}`}>
      <Skeleton variant="rectangular" width={44} height={44} className="mb-4" />
      <Skeleton variant="text" width="68%" height={28} className="mb-1" />
      <Skeleton variant="text" width="92%" height={20} />
    </div>
  );
}

/**
 * Carte neutre du 4e emplacement : ni lien, ni chiffre, ni titre de niveau 3
 * (ce n'est pas un type de bourse, seulement l'état de son relevé).
 */
function CarteNeutre({ titre, detail }: { titre: string; detail: string }) {
  return (
    <div data-probe="type-bourse-repli" className={`${CARTE_CLASSES} ${HAUTEUR_4E} border-dashed`}>
      <div className={`${BADGE_CLASSES} border border-border bg-background text-muted-foreground`}>
        <Globe className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="mb-1 text-lg font-semibold text-ink">{titre}</p>
      <p className="text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

/** Grille « Que des bourses, pour ton profil » (section de la landing). */
export function TypesBourses() {
  const comptage = useGouvernementales();
  const gouvernementales =
    comptage.statut === "connu" && comptage.nombre > 0 ? comptage.nombre : null;

  return (
    <div
      data-probe="types-bourses"
      data-etat={comptage.statut === "chargement" ? "chargement" : gouvernementales ? "pret" : "repli"}
      className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 md:grid-cols-3 lg:max-w-6xl lg:grid-cols-4"
    >
      {TYPES_BOURSES.map((item) => (
        <div key={item.label} className={CARTE_CLASSES}>
          <div className={`${BADGE_CLASSES} bg-nuit text-white`}>
            <item.icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <h3 className="mb-1 text-lg font-semibold text-ink">{item.label}</h3>
          <p className="text-sm text-muted-foreground">{item.desc}</p>
        </div>
      ))}

      {/* 4e emplacement : réservé dès le premier paint (V3-06). */}
      {comptage.statut === "chargement" ? (
        <CarteSquelette />
      ) : gouvernementales ? (
        <Link
          href={CARTE_GOUVERNEMENTALE.href ?? "/offres"}
          data-probe="type-bourse-gouvernementale"
          className={`${CARTE_CLASSES} ${HAUTEUR_4E} block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signature/60`}
        >
          <div className={`${BADGE_CLASSES} bg-nuit text-white`}>
            <Globe className="h-5 w-5" aria-hidden="true" />
          </div>
          <h3 className="mb-1 text-lg font-semibold text-ink">{CARTE_GOUVERNEMENTALE.label}</h3>
          <p className="text-sm text-muted-foreground">{CARTE_GOUVERNEMENTALE.desc}</p>
        </Link>
      ) : comptage.statut === "connu" ? (
        <CarteNeutre
          titre="Aucune bourse d'État"
          detail="Elle apparaîtra dès sa publication."
        />
      ) : (
        <CarteNeutre
          titre="Non communiqué"
          detail="Le comptage des bourses d'État sera rétabli dès que possible."
        />
      )}
    </div>
  );
}
