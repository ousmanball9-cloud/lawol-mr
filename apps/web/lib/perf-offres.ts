/**
 * Instrumentation de performance de `/offres` (V2-06) — MESURE, PAS OPTIMISATION.
 *
 * Question posée : « où partent les ~3 s de LCP de `/offres` ? » Trois candidats,
 * et on ne sait pas les départager à l'œil :
 *   1. le JS (151 Ko) et l'hydratation, avant même la première requête ;
 *   2. le fetch du bassin `/api/v1/offres` (lots de 500, `type_offre=bourse`) ;
 *   3. le rendu des 12 cartes une fois les données arrivées.
 *
 * Ce module ne fait QUE poser des jalons. Il ne change aucun rendu, aucun
 * comportement, et n'envoie AUCUNE requête par défaut :
 *   - `performance.mark` / `performance.measure` toujours posés → visibles dans
 *     les DevTools (panneau Performance, piste « Timings ») et lisibles par
 *     `scripts/mesure-lcp-offres.mjs` via `performance.getEntriesByType("mark")` ;
 *   - envoi réseau UNIQUEMENT si `NEXT_PUBLIC_PERF_OFFRES === "1"` (opt-in
 *     explicite au build). Sans cette variable : zéro `fetch`, zéro beacon,
 *     zéro console — seules les marques existent.
 *
 * Jalons (horodatages en ms depuis le début de la navigation) :
 *   `offres:fetch-debut`         premier octet demandé au proxy `/api/v1/offres`
 *   `offres:fetch-fin`           dernier lot reçu (même en cas d'erreur)
 *   `offres:premier-rendu-cartes` premier passage où des cartes sont à l'écran
 *   `offres:lcp`                 dernier candidat LCP observé (`PerformanceObserver`)
 *
 * Le LCP est observé avec `buffered: true` : l'observateur est monté par un
 * `useEffect`, donc après le début de la navigation — sans `buffered` on
 * manquerait les candidats peints avant l'hydratation.
 *
 * Module volontairement sans import React/Next : testable et utilisable hors
 * composant. Toutes les fonctions sont sûres en SSR et en jsdom (pas de
 * `window` → no-op silencieux).
 */

/** Préfixe commun : permet de retrouver nos marques sans liste en dur. */
export const PREFIXE_JALON = "offres:";

export const JALONS = {
  fetchDebut: `${PREFIXE_JALON}fetch-debut`,
  fetchFin: `${PREFIXE_JALON}fetch-fin`,
  cartes: `${PREFIXE_JALON}premier-rendu-cartes`,
  lcp: `${PREFIXE_JALON}lcp`,
} as const;

export type NomJalon = (typeof JALONS)[keyof typeof JALONS];

/** Horodatages des marques présentes (une marque absente n'est pas dans l'objet). */
export type Jalons = Partial<Record<NomJalon, number>>;

export type RapportPerfOffres = {
  /** Dernier LCP observé (ms), `null` si le navigateur ne l'a pas encore signalé. */
  lcp: number | null;
  /** Balise de l'élément LCP (ex. `div`, `h1`) — dit QUOI est peint en dernier. */
  elementLcp: string | null;
  /** Horodatages des jalons posés par la page. */
  jalons: Jalons;
  /** Durée totale du fetch du bassin (`fetch-fin` − `fetch-debut`), `null` sinon. */
  dureeFetch: number | null;
  /** Temps jusqu'au premier rendu de cartes, `null` si aucune carte rendue. */
  premierRenduCartes: number | null;
};

/** Vrai si l'on peut mesurer (navigateur). Faux en SSR : tout devient no-op. */
function mesureDisponible(): boolean {
  return typeof window !== "undefined" && typeof performance !== "undefined";
}

/** Pose une marque. Best-effort : une mesure ne doit jamais casser la page. */
export function marquer(nom: NomJalon): void {
  if (!mesureDisponible()) return;
  try {
    performance.mark(nom);
  } catch {
    /* mesure best-effort : ignorée si l'API est absente ou saturée */
  }
}

/** Début du fetch du bassin (avant le premier lot). */
export function jalonFetchDebut(): void {
  marquer(JALONS.fetchDebut);
}

/** Fin du fetch du bassin — à appeler aussi en cas d'erreur (`finally`). */
export function jalonFetchFin(): void {
  marquer(JALONS.fetchFin);
}

/** Premier rendu de cartes (une seule fois par chargement de page). */
export function jalonPremierRenduCartes(): void {
  marquer(JALONS.cartes);
}

/** Entrée LCP : le type DOM ne déclare pas `element`, il est pourtant présent. */
type EntreeLcp = PerformanceEntry & { element?: Element | null };

let observateur: PerformanceObserver | null = null;
let dernierLcp: { valeur: number; element: string | null } | null = null;

/** Décrit l'élément LCP sans dépendre de `className` (string sur HTML, objet sur SVG). */
function decrireElement(element: Element | null | undefined): string | null {
  if (!element || !element.tagName) return null;
  const balise = element.tagName.toLowerCase();
  const classes =
    typeof element.className === "string"
      ? element.className.trim().split(/\s+/).slice(0, 2).join(".")
      : "";
  return classes ? `${balise}.${classes}` : balise;
}

/** Pose la marque + la mesure du LCP (durée = LCP depuis le début de la navigation). */
function enregistrerLcp(valeur: number): void {
  try {
    // Une seule mesure par nom : les candidats successifs remplacent le précédent.
    performance.clearMarks(JALONS.lcp);
    performance.clearMeasures(JALONS.lcp);
    performance.mark(JALONS.lcp, { startTime: valeur });
    performance.measure(JALONS.lcp, { start: 0, end: valeur });
  } catch {
    /* mesure best-effort */
  }
}

/**
 * Active l'observation du LCP. À monter une fois (effet de la page).
 * Retourne la fonction de nettoyage ; sans `PerformanceObserver` (jsdom,
 * vieux navigateur) c'est un no-op qui ne lève pas.
 */
export function observerLcp(): () => void {
  if (!mesureDisponible() || typeof PerformanceObserver === "undefined" || observateur) {
    return () => {};
  }
  try {
    observateur = new PerformanceObserver((liste) => {
      for (const entree of liste.getEntries()) {
        const lcp = entree as EntreeLcp;
        // `startTime` = moment du rendu ; 0 ou NaN = candidat non exploitable.
        if (!Number.isFinite(lcp.startTime) || lcp.startTime <= 0) continue;
        dernierLcp = { valeur: lcp.startTime, element: decrireElement(lcp.element) };
        enregistrerLcp(lcp.startTime);
        envoyerRapportSiActif();
      }
    });
    observateur.observe({ type: "largest-contentful-paint", buffered: true });
  } catch {
    observateur = null;
  }
  return () => {
    observateur?.disconnect();
    observateur = null;
  };
}

/** Lit les marques `offres:*` posées jusqu'ici (ms, arrondies). */
export function lireJalons(): Jalons {
  const jalons: Jalons = {};
  if (!mesureDisponible()) return jalons;
  try {
    for (const entree of performance.getEntriesByType("mark")) {
      if (!entree.name.startsWith(PREFIXE_JALON)) continue;
      jalons[entree.name as NomJalon] = Math.round(entree.startTime);
    }
  } catch {
    /* mesure best-effort */
  }
  return jalons;
}

/** Photographie des jalons + LCP, telle qu'envoyée (ou lue par le harnais CDP). */
export function lireRapport(): RapportPerfOffres {
  const jalons = lireJalons();
  const debut = jalons[JALONS.fetchDebut];
  const fin = jalons[JALONS.fetchFin];
  return {
    lcp: dernierLcp ? Math.round(dernierLcp.valeur) : (jalons[JALONS.lcp] ?? null),
    elementLcp: dernierLcp?.element ?? null,
    jalons,
    dureeFetch: debut !== undefined && fin !== undefined ? fin - debut : null,
    premierRenduCartes: jalons[JALONS.cartes] ?? null,
  };
}

/**
 * Opt-in d'envoi : `NEXT_PUBLIC_PERF_OFFRES=1` au build. Sinon (défaut, prod
 * comprise) aucun appel réseau n'est ajouté par ce module.
 */
const ENVOI_ACTIF = process.env.NEXT_PUBLIC_PERF_OFFRES === "1";
/** Destination optionnelle du beacon ; vide → trace DevTools seulement. */
const URL_ENVOI = process.env.NEXT_PUBLIC_PERF_OFFRES_URL ?? "";

/** Vrai si l'envoi a été demandé explicitement au build (utile aux tests/harnais). */
export function instrumentationActive(): boolean {
  return ENVOI_ACTIF;
}

/**
 * Envoi silencieux du rapport — UNIQUEMENT si `NEXT_PUBLIC_PERF_OFFRES=1`.
 * `sendBeacon` ne bloque pas le déchargement et n'attend pas de réponse ; sans
 * URL configurée, on se contente d'une trace console (zéro réseau). Toute
 * erreur est avalée : la mesure ne doit jamais être visible pour l'utilisateur.
 */
function envoyerRapportSiActif(): void {
  if (!ENVOI_ACTIF) return;
  try {
    const rapport = lireRapport();
    if (URL_ENVOI && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(URL_ENVOI, JSON.stringify(rapport));
      return;
    }
    if (typeof console !== "undefined") {
      console.info("[perf-offres]", rapport);
    }
  } catch {
    /* silencieux par contrat */
  }
}
