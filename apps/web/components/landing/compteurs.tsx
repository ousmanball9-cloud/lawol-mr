"use client";

import { useEffect, useState } from "react";
import { Award, Briefcase } from "lucide-react";

/**
 * Vrais compteurs de la landing — plus aucun chiffre codé en dur.
 *
 * Un seul aller-retour partagé `GET /api/v1/offres` (même chemin relatif que
 * le catalogue /offres → proxy Next vers l'API publique) alimente à la fois
 * les pastilles du hero (`Compteurs`) et la grille « qui publie des offres »
 * (`Organisations`). Réponse lue en lots de 500 comme le catalogue, parce que
 * Supabase plafonne une requête à 1 000 lignes.
 *
 * Grâce totale — dans TOUS ces cas le composant rend `null` (ni faux chiffre,
 * ni message d'erreur, ni requête qui casse la page) :
 *   · échec HTTP ou réseau, JSON illisible, réponse non-tableau ;
 *   · délai dépassé (AbortController) ;
 *   · bassin vide (0 offre active) ;
 *   · plafond de lots atteint → total tronqué, donc non fiable.
 *
 * La promesse est mise en cache au niveau module : deux composants = un seul
 * réseau, et un échec n'est jamais rejoué en boucle.
 */

/** Taille de lot — arbitrage identique à `app/offres/page.tsx`. */
const LOT = 500;
/** 4 lots = 2 000 offres. Au-delà, le total serait un plancher → on n'affiche rien. */
const MAX_LOTS = 4;
/** Délai maximal de relevé : au-delà, abandon silencieux. */
const DELAI_MS = 8000;

/** Ligne de la réponse `GET /api/v1/offres` — seulement ce qu'on lit. */
type LigneApi = { active?: boolean; type_offre?: string; entreprise?: string };

type Bassin = {
  /** Offres actives renvoyées par l'API (déjà filtrées active + non expirées). */
  offres: number;
  /** Sous-ensemble `type_offre === "bourse"`. */
  bourses: number;
  /** Top organisations par nombre d'offres, décroissant. */
  publications: { nom: string; offres: number }[];
} | null;

/** Pluriel français : 1 → singulier, 0 et ≥ 2 → pluriel. */
const pluriel = (n: number) => (n === 1 ? "" : "s");

let bassinPromis: Promise<Bassin> | null = null;

/** Réseau unique partagé par les deux composants (échec = `null`, jamais rejoué). */
function chargerBassin(): Promise<Bassin> {
  bassinPromis ??= calculer();
  return bassinPromis;
}

async function calculer(): Promise<Bassin> {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), DELAI_MS);
  try {
    let offres = 0;
    let bourses = 0;
    const parOrganisation = new Map<string, number>();

    for (let lot = 0; lot < MAX_LOTS; lot += 1) {
      const res = await fetch(`/api/v1/offres?limit=${LOT}&offset=${lot * LOT}`, {
        signal: controleur.signal,
      });
      if (!res.ok) return null;
      const data: unknown = await res.json();
      if (!Array.isArray(data)) return null;

      for (const brut of data) {
        if (!brut || typeof brut !== "object") continue;
        const ligne = brut as LigneApi;
        // L'API ne renvoie que des offres actives : on garde quand même la garde.
        if (ligne.active === false) continue;
        offres += 1;
        if (ligne.type_offre === "bourse") bourses += 1;
        const nom = typeof ligne.entreprise === "string" ? ligne.entreprise.trim() : "";
        if (nom) parOrganisation.set(nom, (parOrganisation.get(nom) ?? 0) + 1);
      }

      if (data.length < LOT) break;
      // Dernier lot plein : total tronqué, donc non fiable → rien plutôt qu'un plancher.
      if (lot === MAX_LOTS - 1) return null;
    }

    if (offres === 0) return null;

    const publications = [...parOrganisation]
      .map(([nom, nombre]) => ({ nom, offres: nombre }))
      .sort((a, b) => b.offres - a.offres || a.nom.localeCompare(b.nom, "fr"))
      .slice(0, 12);

    return { offres, bourses, publications };
  } catch {
    // Timeout (abort), réseau coupé ou JSON illisible : silencieux, pas de faux chiffre.
    return null;
  } finally {
    clearTimeout(minuteur);
  }
}

/** État partagé : le même bassin pour les deux points de montage. */
function useBassin(): Bassin {
  const [bassin, setBassin] = useState<Bassin>(null);
  useEffect(() => {
    let actif = true;
    chargerBassin().then((r) => {
      if (actif) setBassin(r);
    });
    return () => {
      actif = false;
    };
  }, []);
  return bassin;
}

/**
 * Pastilles honnêtes du hero : « X bourses actives » / « Y offres publiées »,
 * calculées à la volée. Rend un fragment de deux pastilles (mêmes classes que
 * les badges de confiance déjà présents) — `null` si le relevé a échoué.
 */
export function Compteurs() {
  const bassin = useBassin();
  if (!bassin) return null;
  const { bourses, offres } = bassin;

  return (
    <>
      <span
        data-probe="hero-compteurs"
        className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2"
      >
        <Award className="h-4 w-4 text-white/60" aria-hidden="true" />
        <span>
          <strong className="font-semibold text-white">{bourses}</strong>{" "}
          bourse{pluriel(bourses)} active{pluriel(bourses)}
        </span>
      </span>
      <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
        <Briefcase className="h-4 w-4 text-white/60" aria-hidden="true" />
        <span>
          <strong className="font-semibold text-white">{offres}</strong>{" "}
          offre{pluriel(offres)} publiée{pluriel(offres)}
        </span>
      </span>
    </>
  );
}

/**
 * Section « qui publie des offres » — remplace la grille de logos codée en dur
 * (allégation non prouvée : « ces entreprises recrutent via LAWOL.mr ») par un
 * classement réel : les organisations les plus présentes dans les offres
 * actuellement publiées, avec leur nombre d'offres. Section entière rendue
 * `null` si le relevé a échoué → pas de section vide, pas de faux logo.
 */
export function Organisations() {
  const bassin = useBassin();
  if (!bassin || bassin.publications.length === 0) return null;
  const { publications } = bassin;

  return (
    <section id="organisations" className="bg-background py-24 lg:py-32">
      <div className="container mx-auto px-4">
        <div className="mb-12 text-center">
          <p className="eyebrow mb-4 text-signature">Qui publie des offres</p>
          <h2 className="mb-4 font-display text-3xl font-bold tracking-[-0.02em] text-ink lg:text-4xl">
            Les organisations les plus <span className="text-signature">présentes</span>
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Classement calculé à la volée parmi les offres actuellement publiées
            sur LAWOL.mr.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 md:grid-cols-3 lg:max-w-6xl lg:grid-cols-4">
          {publications.map((org) => (
            <div
              key={org.nom}
              data-probe="entreprise-logo"
              className="flex flex-col items-center justify-center rounded-lg border border-border bg-card px-4 py-6 text-center transition-colors duration-200 hover:border-signature"
            >
              <span className="text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">
                {org.nom}
              </span>
              <span className="mt-1 text-xs font-semibold text-signature">
                {org.offres} offre{pluriel(org.offres)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
