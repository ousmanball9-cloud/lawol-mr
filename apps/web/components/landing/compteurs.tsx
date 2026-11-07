"use client";

import { useEffect, useState } from "react";
import { Award, Briefcase } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Vrais compteurs de la landing — plus aucun chiffre codé en dur.
 *
 * Un seul aller-retour partagé `GET /api/v1/offres` (même chemin relatif que
 * le catalogue /offres → proxy Next vers l'API publique) alimente à la fois
 * les pastilles du hero (`Compteurs`) et la grille « qui publie des offres »
 * (`Organisations`). Réponse lue en lots de 500 comme le catalogue, parce que
 * Supabase plafonne une requête à 1 000 lignes.
 *
 * V3-06 — plus aucune section ne s'évapore. Le relevé expose un ÉTAT explicite
 * (`chargement` / `pret` / `indisponible`) au lieu d'un `null` qui effaçait des
 * nœuds du DOM :
 *   · `chargement` → le gabarit final est déjà là (2 pastilles + section + 4
 *     tuiles de squelette) : le premier paint réserve la place, donc pas de saut ;
 *   · `indisponible` (échec HTTP/réseau, JSON illisible, délai dépassé, bassin
 *     vide, plafond de lots atteint) → texte neutre « non communiqué » dans les
 *     pastilles et bloc de repli dans la section, jamais un 0 trompeur ni un
 *     chiffre inventé.
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
};

/**
 * État du relevé partagé. Aucun `null` : chaque branche a un rendu défini, donc
 * une même page garde le même squelette de blocs avant et après la réponse.
 */
type Releve =
  | { statut: "chargement" }
  | { statut: "pret"; bassin: Bassin }
  | { statut: "indisponible" };

/** Texte de repli — neutre, jamais un chiffre. Court : à 375 px la pastille
 * doit tenir sur UNE ligne, sinon elle passe de 38 à 58 px et crée le saut
 * qu'on veut supprimer (mesuré). */
const REPLI = "non communiqué";

/** Pluriel français : 1 → singulier, 0 et ≥ 2 → pluriel. */
const pluriel = (n: number) => (n === 1 ? "" : "s");

let bassinPromis: Promise<Bassin | null> | null = null;

/** Réseau unique partagé par les deux composants (échec = `null`, jamais rejoué). */
function chargerBassin(): Promise<Bassin | null> {
  bassinPromis ??= calculer();
  return bassinPromis;
}

async function calculer(): Promise<Bassin | null> {
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

/** État partagé : le même relevé pour les deux points de montage. */
function useReleve(): Releve {
  const [releve, setReleve] = useState<Releve>({ statut: "chargement" });
  useEffect(() => {
    let actif = true;
    chargerBassin().then((bassin) => {
      if (!actif) return;
      setReleve(bassin ? { statut: "pret", bassin } : { statut: "indisponible" });
    });
    return () => {
      actif = false;
    };
  }, []);
  return releve;
}

/** Gabarit commun des pastilles du hero (inchangé : bordure + fond translucides). */
const PASTILLE =
  "flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2";

/**
 * Pastilles du hero : « X bourses actives » / « Y offres publiées ».
 *
 * Deux pastilles dans TOUS les cas — c'est la règle V3-06 : le relevé manquant
 * affiche « chiffre en cours de mise à jour » à la place du nombre (même
 * pastille, même hauteur, même icône), au lieu de faire disparaître les badges.
 * `data-etat` permet à un harnais de distinguer chiffre réel et repli.
 */
export function Compteurs() {
  const releve = useReleve();
  const bassin = releve.statut === "pret" ? releve.bassin : null;
  const etat = bassin ? "pret" : "repli";

  return (
    <>
      <span data-probe="hero-compteurs" data-etat={etat} className={PASTILLE}>
        <Award className="h-4 w-4 shrink-0 text-white/60" aria-hidden="true" />
        <span>
          {bassin ? (
            <>
              <strong className="font-semibold text-white">{bassin.bourses}</strong>{" "}
              bourse{pluriel(bassin.bourses)} active{pluriel(bassin.bourses)}
            </>
          ) : (
            <>
              Bourses actives :{" "}
              <span className="text-white/70">{REPLI}</span>
            </>
          )}
        </span>
      </span>
      <span data-probe="hero-compteurs-offres" data-etat={etat} className={PASTILLE}>
        <Briefcase className="h-4 w-4 shrink-0 text-white/60" aria-hidden="true" />
        <span>
          {bassin ? (
            <>
              <strong className="font-semibold text-white">{bassin.offres}</strong>{" "}
              offre{pluriel(bassin.offres)} publiée{pluriel(bassin.offres)}
            </>
          ) : (
            <>
              Offres publiées :{" "}
              <span className="text-white/70">{REPLI}</span>
            </>
          )}
        </span>
      </span>
    </>
  );
}

/** Tuile de squelette calquée sur une carte d'organisation (même hauteur). */
function TuileSquelette({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`flex flex-col items-center justify-center rounded-lg border border-border bg-card px-4 py-6 ${className}`}
    >
      <Skeleton variant="text" width="62%" height={20} />
      <Skeleton variant="text" width="34%" height={16} className="mt-1" />
    </div>
  );
}

/**
 * Section « qui publie des offres » — remplace la grille de logos codée en dur
 * (allégation non prouvée : « ces entreprises recrutent via LAWOL.mr ») par un
 * classement réel : les organisations les plus présentes dans les offres
 * actuellement publiées, avec leur nombre d'offres.
 *
 * V3-06 — la section est TOUJOURS rendue : en attente, elle montre 4 tuiles de
 * squelette (2 sur mobile, 2 lignes) qui réservent la hauteur du bloc de repli ;
 * si le relevé échoue (ou si le bassin est vide), ce bloc de repli honnête prend
 * la même place. La page ne se réorganise donc plus autour d'un bloc qui
 * apparaît/disparaît.
 */
export function Organisations() {
  const releve = useReleve();
  const publications =
    releve.statut === "pret" && releve.bassin.publications.length > 0
      ? releve.bassin.publications
      : null;
  const etat = publications ? "pret" : releve.statut === "chargement" ? "chargement" : "repli";

  return (
    <section
      id="organisations"
      data-probe="organisations"
      data-etat={etat}
      className="bg-background py-24 lg:py-32"
    >
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

        {publications ? (
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
        ) : releve.statut === "chargement" ? (
          <div
            aria-busy="true"
            className="mx-auto grid min-h-[11rem] max-w-5xl gap-4 sm:grid-cols-2 md:grid-cols-3 lg:max-w-6xl lg:grid-cols-4"
          >
            <p className="sr-only">Classement des organisations en cours de chargement</p>
            {Array.from({ length: 4 }).map((_, i) => (
              // 2 tuiles en mobile (2 rangées ≈ 192 px), 4 dès sm : la hauteur
              // réservée reste celle du bloc de repli (176 px) à toutes les largeurs.
              <TuileSquelette key={i} className={i >= 2 ? "hidden sm:flex" : ""} />
            ))}
          </div>
        ) : (
          <div
            data-probe="organisations-repli"
            className="mx-auto flex min-h-[11rem] max-w-5xl flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-8 text-center"
          >
            <p className="mb-2 text-lg font-semibold text-ink">
              Classement en cours de mise à jour
            </p>
            <p className="max-w-md text-sm text-muted-foreground">
              Aucun chiffre n&apos;est affiché tant qu&apos;il n&apos;est pas vérifié.
              Ce classement se remplit dès que le relevé des offres aboutit.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
