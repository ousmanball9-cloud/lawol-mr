"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { BarreFiltres } from "@/components/offres/barre-filtres";
import { BandeauResultats } from "@/components/offres/bandeau-resultats";
import { Chrome } from "@/components/chrome/chrome";
import { CarteOffre } from "@/components/offres/carte-offre";
import { EtatVideOffres } from "@/components/offres/etat-vide-offres";
import { IndicateurChargement } from "@/components/offres/indicateur-chargement";
import { PaginationOffres } from "@/components/offres/pagination-offres";
import type { Offre } from "@/components/offres/types";
import {
  AUCUN_FILTRE,
  FACETTES_PAR_DEFAUT,
  OFFRES_PAR_PAGE,
  TOUTES_CATEGORIES,
  ecrireFacettes,
  lireFacettes,
  memeParametres,
  urlOffres,
} from "@/lib/offres-url";
import type { FacettesOffres } from "@/lib/offres-url";
import { chargerBassin, chargerPageApi } from "@/lib/offres-chargement";
import type { RequeteCatalogue } from "@/lib/offres-chargement";
import { calculerEcheances, filtrerEtTrier, normaliserRecherche } from "@/lib/offres-filtrage";
import { jalonPremierRenduCartes, observerLcp } from "@/lib/perf-offres";

/** Laisse la frappe se poser avant d'interroger l'API (recherche côté serveur). */
const DELAI_RECHERCHE_MS = 300;
/** Bassin vide d'identité stable : les mémoïsations ne se recalculent pas pour rien. */
const BASSIN_VIDE: Offre[] = [];

/** Ce que la page a réellement en main, et donc ce qu'elle peut afficher. */
type Resultat =
  /** Pagination par l'API : total INCONNU, une page à la fois. */
  | { mode: "api"; page: number; cartes: Offre[]; aSuivante: boolean }
  /** Tout le sous-ensemble serveur : total connu, découpage local. */
  | { mode: "bassin"; bassin: Offre[] };

/**
 * Page publique /offres — recherche + filtres + grille paginée (12/page).
 *
 * L'URL est la SEULE source de vérité des facettes (V2-04) : `lireFacettes` la
 * lit, `ecrire` (unique écrivain) la réécrit. Un lien collé dans WhatsApp
 * (`/offres?pays=france&tri=recentes`) rend donc exactement le même catalogue,
 * et le retour arrière restaure les filtres. `?page=3` fait partie du lien.
 *
 * PAGINATION (05/11/2026) — l'attente venait du FETCH : 271 offres rapatriées
 * pour 12 affichées (1 272 ms des 1 632 ms de LCP, mesure V2-06). La page ne
 * demande plus que ce qu'elle montre : `limit=13` (12 + 1 sonde) et l'`offset`
 * de la page. L'API répond une LISTE SANS TOTAL : la 13ᵉ ligne dit seulement
 * « une page suivante existe », d'où la pagination « Précédent · Page N ·
 * Suivant ». Aucun total n'est inventé — décision assumée, pas un oubli.
 *
 * DEUX MODES, une seule règle : on pagine côté serveur sur les filtres que
 * l'API sait exprimer (recherche, catégorie, filière, pays, tri). `financement`
 * et « clôture < 30 j » n'existent pas côté API : dans ce cas SEULEMENT, le
 * sous-ensemble serveur est chargé en entier (comportement d'avant) pour que la
 * page 2 reste la suite exacte de la page 1. (`expirees` ne change rien au
 * chargement : l'API ne sert déjà que des offres non closes.)
 *
 * Seule la frappe reste locale (`motsCles`) : l'input doit être instantané,
 * l'URL n'est écrite qu'après 300 ms — et par `replace`, pour ne pas empiler
 * une entrée d'historique par lettre.
 *
 * Suspense obligatoire autour d'un Client Component qui lit les searchParams.
 */
export default function OffresPage() {
  return (
    <Suspense fallback={<IndicateurChargement />}>
      <OffresContenu />
    </Suspense>
  );
}

/** « filtre » = entrée d'historique (`push` : le retour arrière restaure les
 *  filtres) ; « frappe » = réécriture silencieuse (`replace` : frappe et
 *  pagination, jamais une entrée d'historique par lettre ni par page). */
type ModeEcriture = "filtre" | "frappe";

function OffresContenu() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Source de vérité unique : aucune facette n'est recopiée dans un useState.
  const facettes = useMemo(() => lireFacettes(searchParams), [searchParams]);

  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Seule exception locale : la frappe. L'input reste instantané, l'URL suit
  // après le délai — puis se resynchronise ici (retour arrière, lien partagé,
  // « Réinitialiser »).
  const [motsCles, setMotsCles] = useState(facettes.recherche);
  // Valeur de recherche que NOUS venons d'écrire : l'écho de notre propre
  // écriture ne doit pas écraser une frappe plus récente (course URL → input).
  const rechercheEcrite = useRef<string | null>(null);
  // V2-06 : une seule marque « premier rendu de cartes » par chargement de page
  // (un changement de filtre re-rend la grille, ce n'est pas le premier LCP).
  const cartesMarquees = useRef(false);
  // Numéro de la requête en cours : une réponse lente ne doit jamais écraser une
  // plus récente (changement de page rapide, frappe, retour arrière).
  const numeroRequete = useRef(0);

  // V2-06 : LCP réel de la page. `buffered: true` rattrape les candidats peints
  // avant ce montage (hydratation tardive) ; le nettoyage coupe l'observateur.
  // Aucun effet visible : seulement des `performance.mark`/`measure`.
  useEffect(() => observerLcp(), []);

  useEffect(() => {
    // Resynchronise sur un vrai changement d'URL (retour arrière, lien partagé,
    // « Réinitialiser ») ; ignore l'écho de notre écriture.
    if (facettes.recherche === rechercheEcrite.current) return;
    rechercheEcrite.current = null;
    setMotsCles(facettes.recherche);
  }, [facettes.recherche]);

  /**
   * UN SEUL écrivain de l'URL. Calcule la cible et ne navigue que si elle
   * diffère vraiment (comparaison indépendante de l'ordre des paramètres) :
   * c'est ce qui interdit la boucle URL → rendu → URL.
   * Tout patch autre que `page` ramène à la première page.
   */
  const ecrire = useCallback(
    (patch: Partial<FacettesOffres>, mode: ModeEcriture = "filtre") => {
      const actuelles = new URLSearchParams(searchParams.toString());
      const suivantes: FacettesOffres = { ...facettes, ...patch, page: patch.page ?? 1 };
      const cible = ecrireFacettes(suivantes, actuelles);
      if (memeParametres(cible, actuelles)) return;
      // Marque notre écriture : la frappe locale ne sera pas écrasée par l'écho.
      if (patch.recherche !== undefined) rechercheEcrite.current = cible.get("recherche") ?? "";
      const url = urlOffres(suivantes, actuelles);
      if (mode === "frappe") router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [facettes, router, searchParams]
  );

  // Frappe : on laisse le mot se poser avant d'écrire dans l'URL (donc avant
  // d'interroger l'API). Un texte vide n'est jamais écrit : l'URL reste propre.
  useEffect(() => {
    if (motsCles.trim() === facettes.recherche) return;
    const id = setTimeout(() => ecrire({ recherche: motsCles }, "frappe"), DELAI_RECHERCHE_MS);
    return () => clearTimeout(id);
  }, [motsCles, facettes.recherche, ecrire]);

  /**
   * Filtres que l'API ne sait PAS exprimer → il faut tout le sous-ensemble
   * serveur pour paginer sur le résultat filtré. Sinon on reste en pagination
   * serveur (une requête de 13 lignes par page).
   */
  const modeBassin = facettes.financement !== AUCUN_FILTRE || facettes.cloture30;

  const requete = useMemo<RequeteCatalogue>(
    () => ({
      tri: facettes.tri,
      q: facettes.recherche.trim(),
      categorie: facettes.categorie,
      filiere: facettes.filiere,
      pays: facettes.pays,
    }),
    [facettes.tri, facettes.recherche, facettes.categorie, facettes.filiere, facettes.pays]
  );

  // En mode bassin, tout arrive d'un coup : changer de page ne requête rien.
  const pageDemandee = modeBassin ? 1 : facettes.page;

  const charger = useCallback(async () => {
    const numero = ++numeroRequete.current;
    setLoading(true);
    setError("");
    try {
      if (modeBassin) {
        const bassin = await chargerBassin(requete);
        if (numero === numeroRequete.current) setResultat({ mode: "bassin", bassin });
      } else {
        const page = await chargerPageApi(requete, pageDemandee);
        if (numero === numeroRequete.current) {
          setResultat({ mode: "api", page: pageDemandee, ...page });
        }
      }
    } catch {
      if (numero === numeroRequete.current) {
        setError("Impossible de charger les offres. Réessaie dans un instant.");
      }
    } finally {
      if (numero === numeroRequete.current) setLoading(false);
    }
  }, [modeBassin, pageDemandee, requete]);

  // Tri, recherche, catégorie, filière, pays, page : tout changement de la
  // requête serveur rechargé. Le nettoyage invalide la requête en vol (montage
  // StrictMode, démontage) : sa réponse ne peut plus écrire dans l'état.
  useEffect(() => {
    charger();
    return () => {
      numeroRequete.current += 1;
    };
  }, [charger]);

  const bassin = resultat?.mode === "bassin" ? resultat.bassin : BASSIN_VIDE;

  /** Échéance recalculée une seule fois par offre (parse + jours restants). */
  const echeances = useMemo(() => calculerEcheances(bassin), [bassin]);

  const { liste: filtrees, nbExpirees } = useMemo(
    () =>
      filtrerEtTrier(echeances, motsCles, {
        filiere: facettes.filiere,
        pays: facettes.pays,
        financement: facettes.financement,
        cloture30: facettes.cloture30,
        expirees: facettes.expirees,
        tri: facettes.tri,
      }),
    [
      echeances,
      motsCles,
      facettes.filiere,
      facettes.pays,
      facettes.financement,
      facettes.cloture30,
      facettes.expirees,
      facettes.tri,
    ]
  );

  /** Résultat paginé par l'API (null en mode bassin). */
  const pageApi = resultat?.mode === "api" ? resultat : null;

  // Mode bassin : total connu, découpage local (comportement historique).
  const totalPages = Math.max(1, Math.ceil(filtrees.length / OFFRES_PAR_PAGE));
  const pageLocale = Math.min(facettes.page, totalPages);
  const cartesLocales = filtrees
    .slice((pageLocale - 1) * OFFRES_PAR_PAGE, pageLocale * OFFRES_PAR_PAGE)
    .map((e) => e.offre);

  /**
   * Recherche en cours de frappe (l'URL n'a pas encore suivi, 300 ms) : on
   * raffine la page DÉJÀ à l'écran pour un retour immédiat. Dès que l'URL a
   * suivi, c'est le serveur qui fait foi — raffiner encore retirerait des
   * offres qu'il a légitimement trouvées dans leur description (que la liste ne
   * transporte pas) et trouerait la page.
   */
  const qFrappe = useMemo(() => {
    if (motsCles.trim() === facettes.recherche) return "";
    return normaliserRecherche(motsCles).toLowerCase();
  }, [motsCles, facettes.recherche]);

  const cartesApi = useMemo(() => {
    if (!pageApi) return [];
    if (!qFrappe) return pageApi.cartes;
    return pageApi.cartes.filter((offre) =>
      `${offre.titre} ${offre.entreprise} ${offre.pays_etudes ?? ""}`
        .toLowerCase()
        .includes(qFrappe)
    );
  }, [pageApi, qFrappe]);

  // Vue unique : mêmes noms pour les deux modes, le rendu ne sait pas d'où ça vient.
  const cartes = pageApi ? cartesApi : cartesLocales;
  const pageAffichee = pageApi ? facettes.page : pageLocale;
  const aSuivante = pageApi ? pageApi.aSuivante : pageLocale < totalPages;
  /** `null` = total inconnu (l'API ne le fournit pas) — jamais reconstitué. */
  const totalConnu = pageApi ? null : filtrees.length;

  // Les données en main sont-elles celles de la page demandée ? Un changement de
  // PAGE montre le squelette (pas de cartes d'une autre page sous une URL qui
  // dit « page 2 ») ; un changement de FILTRE garde la liste en place — même
  // page, pas de clignotement pendant la frappe.
  const pretPourLaPage =
    resultat !== null && (resultat.mode === "bassin" || resultat.page === facettes.page);

  // V2-06 : jalon « première carte à l'écran ». L'effet tourne après le commit
  // (donc après la peinture des cartes) ; le `ref` garantit une marque unique.
  useEffect(() => {
    if (cartesMarquees.current || cartes.length === 0) return;
    cartesMarquees.current = true;
    jalonPremierRenduCartes();
  }, [cartes.length]);

  // Un filtre actif (catégorie, recherche, filière, pays — tous côté serveur —
  // ou une recherche en cours de frappe) qui ne renvoie rien : le message
  // « aucune offre publiée » serait faux — on propose d'élargir. La frappe
  // compte : pendant les 300 ms de debounce, elle raffine déjà la page.
  const filtreActif =
    facettes.categorie !== TOUTES_CATEGORIES ||
    facettes.recherche !== "" ||
    facettes.filiere !== AUCUN_FILTRE ||
    facettes.pays !== AUCUN_FILTRE ||
    qFrappe !== "";

  const reinitialiserFiltres = useCallback(() => {
    // L'URL redevient nue (aucun défaut écrit) ; l'input local suit.
    setMotsCles("");
    ecrire(FACETTES_PAR_DEFAUT, "filtre");
  }, [ecrire]);

  // Le premier chargement (et un changement de PAGE) occupe l'écran.
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-card">
          <p className="mb-4 font-medium text-destructive">{error}</p>
          <Button
            onClick={charger}
            className="h-11 rounded-lg bg-signature px-6 text-white hover:bg-signature-deep"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  if (!pretPourLaPage) return <IndicateurChargement />;

  // Page demandée au-delà de la fin du catalogue (`?page=99` fabriqué) : l'API
  // renvoie une liste vide et la sonde est muette — la page n'existe pas. On le
  // dit et on propose de reculer, sans réécrire l'URL dans le dos de l'élève.
  // On teste la page SERVEUR (`pageApi.cartes`), pas les cartes raffinées par la
  // frappe : une recherche en cours peut vider l'affichage sans que la page
  // n'existe pas.
  const pageHorsCatalogue = pageApi !== null && pageApi.cartes.length === 0 && facettes.page > 1;

  // Catalogue réellement vide (aucun filtre) vs filtres trop étroits.
  const catalogueVide = !filtreActif && (pageApi !== null || bassin.length === 0);

  return (
    <Chrome>
    <main className="bg-background px-4 py-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <p className="eyebrow text-signature">Bourses d&apos;études</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.02em] text-foreground">
            Bourses pour ton profil
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Les bourses d&apos;études actuellement
            ouvertes aux candidatures.
          </p>
        </header>

        <BarreFiltres
          motsCles={motsCles}
          setMotsCles={setMotsCles}
          filiereFiltre={facettes.filiere}
          setFiliereFiltre={(valeur) => ecrire({ filiere: valeur })}
          paysFiltre={facettes.pays}
          setPaysFiltre={(valeur) => ecrire({ pays: valeur })}
          financementFiltre={facettes.financement}
          setFinancementFiltre={(valeur) => ecrire({ financement: valeur })}
          categorieFiltre={facettes.categorie}
          setCategorieFiltre={(valeur) => ecrire({ categorie: valeur })}
          tri={facettes.tri}
          setTri={(valeur) => ecrire({ tri: valeur })}
          cloture30={facettes.cloture30}
          setCloture30={(valeur) => ecrire({ cloture30: valeur })}
          expireesVisibles={facettes.expirees}
          setExpireesVisibles={(valeur) => ecrire({ expirees: valeur })}
          nbExpirees={nbExpirees}
          nbResultats={cartes.length}
          onReinitialiser={reinitialiserFiltres}
        />

        <BandeauResultats
          nbAffichees={cartes.length}
          total={totalConnu}
          page={pageAffichee}
          aSuivante={aSuivante}
          nbExpirees={nbExpirees}
          expireesVisibles={facettes.expirees}
          cloture30={facettes.cloture30}
          tri={facettes.tri}
        />

        {cartes.length === 0 ? (
          <EtatVideOffres
            page={facettes.page}
            pageHorsCatalogue={pageHorsCatalogue}
            catalogueVide={catalogueVide}
            aDesOffres={bassin.length > 0}
            filtreActif={filtreActif}
            onAllerPage={(p) => ecrire({ page: p }, "frappe")}
            onReinitialiser={reinitialiserFiltres}
          />
        ) : (
          <>
            <div
              data-probe="offres-grille"
              aria-busy={loading}
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            >
              {cartes.map((offre) => (
                <CarteOffre key={offre.id} offre={offre} />
              ))}
            </div>
            {/* Pagination = réécriture silencieuse : pas d'entrée d'historique
                par page (même contrat que la frappe, cf. cleFiltres).
                `totalPages` n'est fourni QUE si le total est connu : sinon le
                composant affiche « Précédent · Page N · Suivant ». */}
            <PaginationOffres
              page={pageAffichee}
              totalPages={pageApi ? undefined : totalPages}
              aSuivante={aSuivante}
              onPage={(p) => ecrire({ page: p }, "frappe")}
            />
          </>
        )}

        <div className="mt-10 text-center">
          <Link
            href="/"
            className="-mx-2 inline-flex min-h-11 items-center px-2 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-signature"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </main>
    </Chrome>
  );
}
