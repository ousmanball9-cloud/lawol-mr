"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Briefcase, RefreshCw } from "lucide-react";
import { BarreFiltres } from "@/components/offres/barre-filtres";
import { Chrome } from "@/components/chrome/chrome";
import { CarteOffre } from "@/components/offres/carte-offre";
import { PaginationOffres } from "@/components/offres/pagination-offres";
import { joursRestants, parserDateLimite } from "@/components/offres/date-limite";
import type { Offre, TriOffres } from "@/components/offres/types";
import {
  FACETTES_PAR_DEFAUT,
  TOUTES_CATEGORIES,
  ecrireFacettes,
  lireFacettes,
  memeParametres,
  urlOffres,
} from "@/lib/offres-url";
import type { FacettesOffres } from "@/lib/offres-url";

const PAR_PAGE = 12;
/** Supabase plafonne une requête à 1 000 lignes : on charge le bassin par lots de 500. */
const BATCH = 500;
const MAX_OFFSET = 5000;
/** Seuil du filtre « Clôture dans moins de 30 jours ». */
const SEUIL_30_JOURS = 30;
/** Laisse la frappe se poser avant d'interroger l'API (recherche côté serveur). */
const DELAI_RECHERCHE_MS = 300;

/** Offre enrichie de son échéance : jours restants (null = date illisible). */
type Echeance = { offre: Offre; jours: number | null };

/** Rang du tri « plus urgentes » : 0 = encore ouvert, 1 = expirée, 2 = sans date lisible. */
function rangEcheance(jours: number | null): number {
  if (jours === null) return 2;
  return jours < 0 ? 1 : 0;
}

/**
 * Même nettoyage que `_motif_recherche` côté API : les caractères retirés par le
 * serveur (syntaxe du filtre PostgREST) ne doivent pas créer d'écart entre le
 * sous-ensemble renvoyé par l'API et le filtre local qui le raffine.
 */
function normaliserRecherche(q: string): string {
  return q
    .replace(/[^A-Za-z0-9_\s\-'À-ÖØ-öø-ÿ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/** Charge les offres actives retenues par l'API : tri (`tri`), recherche
 *  texte (`q`) et catégorie de bourse (`categorie`) sont calculés CÔTÉ SERVEUR
 *  sur tout le catalogue, pas sur la page affichée. Chargement par lots de 500
 *  (plafond Supabase = 1 000 lignes).
 *  `type_offre=bourse` : le catalogue public ne sert QUE des bourses — les
 *  offres d'emploi/stage collectées restent en base (matching, admin) mais ne
 *  sont jamais publiées ici (décision produit du 16/10). */
async function chargerBassin(tri: TriOffres, q: string, categorie: string): Promise<Offre[]> {
  const toutes: Offre[] = [];
  const parametres = new URLSearchParams({ tri, type_offre: "bourse" });
  if (q) parametres.set("q", q);
  if (categorie && categorie !== "toutes") parametres.set("categorie", categorie);
  for (let offset = 0; offset < MAX_OFFSET; offset += BATCH) {
    parametres.set("limit", String(BATCH));
    parametres.set("offset", String(offset));
    const res = await fetch(`/api/v1/offres?${parametres.toString()}`);
    if (!res.ok) throw new Error();
    const data: unknown = await res.json();
    if (!Array.isArray(data)) throw new Error();
    toutes.push(...(data as Offre[]));
    if (data.length < BATCH) break;
  }
  return toutes;
}

function IndicateurChargement() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4">
      <Spinner className="h-10 w-10" />
      <p className="text-sm text-muted-foreground">Chargement des offres...</p>
    </div>
  );
}

/**
 * Page publique /offres — recherche + filtres + grille paginée (12/page).
 *
 * L'URL est la SEULE source de vérité des facettes (V2-04) : `lireFacettes` la
 * lit, `ecrire` (unique écrivain) la réécrit. Un lien collé dans WhatsApp
 * (`/offres?pays=france&tri=recentes`) rend donc exactement le même catalogue,
 * et le retour arrière restaure les filtres.
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

  const [bassin, setBassin] = useState<Offre[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Seule exception locale : la frappe. L'input reste instantané, l'URL suit
  // après le délai — puis se resynchronise ici (retour arrière, lien partagé,
  // « Réinitialiser »).
  const [motsCles, setMotsCles] = useState(facettes.recherche);
  // Valeur de recherche que NOUS venons d'écrire : l'écho de notre propre
  // écriture ne doit pas écraser une frappe plus récente (course URL → input).
  const rechercheEcrite = useRef<string | null>(null);

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

  const charger = useCallback(async (triCourant: TriOffres, recherche: string, categorie: string) => {
    setLoading(true);
    setError("");
    try {
      setBassin(await chargerBassin(triCourant, recherche.trim(), categorie));
    } catch {
      setError("Impossible de charger les offres. Réessaie dans un instant.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Tri, recherche ET catégorie vivent dans l'API : tout changement rechargé depuis le serveur.
  useEffect(() => {
    charger(facettes.tri, facettes.recherche, facettes.categorie);
  }, [charger, facettes.tri, facettes.recherche, facettes.categorie]);

  /** Échéance recalculée une seule fois par offre (parse + jours restants). */
  const echeances = useMemo<Echeance[]>(
    () =>
      bassin.map((offre) => ({
        offre,
        jours: joursRestants(parserDateLimite(offre.date_limite)),
      })),
    [bassin],
  );

  const { liste: filtrees, nbExpirees } = useMemo(() => {
    const q = normaliserRecherche(motsCles).toLowerCase();
    const correspond = (offre: Offre) => {
      if (facettes.filiere !== "tous" && !(offre.filieres_cibles ?? []).includes(facettes.filiere))
        return false;
      if (facettes.pays !== "tous" && offre.pays_etudes !== facettes.pays) return false;
      if (facettes.financement !== "tous" && offre.type_financement !== facettes.financement)
        return false;
      // q : le SERVEUR est l'autorité (il cherche dans titre, entreprise ET
      // description intégrale). Le raffinement local ne regarde donc PAS la
      // description : la liste ne porte qu'un aperçu (`description_apercu`),
      // s'y fier exclurait à tort une offre dont le mot-clé tombe plus loin.
      if (
        q &&
        !`${offre.titre} ${offre.entreprise} ${offre.pays_etudes ?? ""}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    };

    const retenues: Echeance[] = [];
    let expirees = 0;
    for (const e of echeances) {
      if (!correspond(e.offre)) continue;
      const expiree = e.jours !== null && e.jours < 0;
      // Comptées même masquées : l'état « Afficher les expirées » les révèle.
      if (expiree) expirees += 1;
      if (facettes.cloture30) {
        // « Clôture dans moins de 30 jours » = fenêtre À VENIR : ni offre déjà
        // close, ni date illisible, ni échéance ≥ 30 j. Le motif est rappelé par
        // le compteur de la barre de filtres (« fenêtre 30 j : offres closes
        // exclues »).
        if (expiree || e.jours === null || e.jours >= SEUIL_30_JOURS) continue;
      } else if (expiree && !facettes.expirees) {
        continue; // masquées par défaut, jamais supprimées : bascule explicite
      }
      retenues.push(e);
    }

    if (facettes.tri === "urgent") {
      // L'API renvoie déjà `date_limite` croissante (`tri=urgent`) : ce tri local
      // est un garde-fou (dates illisibles en dernier rang, expirées en fin de
      // liste). Échéance proche d'abord ; sans date lisible au dernier rang ;
      // expirées (si affichées) en toute fin, la plus récemment close en tête.
      // Sort stable : à rang égal, l'ordre du bassin (API) est conservé.
      retenues.sort((a, b) => {
        const rang = rangEcheance(a.jours) - rangEcheance(b.jours);
        if (rang !== 0) return rang;
        if (a.jours !== null && a.jours < 0) return (b.jours ?? 0) - (a.jours ?? 0);
        return (a.jours ?? 0) - (b.jours ?? 0);
      });
    }
    // tri « recentes » : aucun réordonnancement — l'API renvoie déjà
    // `date_scrape DESC` (offres les plus fraîches en tête).
    return { liste: retenues, nbExpirees: expirees };
  }, [
    echeances,
    motsCles,
    facettes.filiere,
    facettes.pays,
    facettes.financement,
    facettes.cloture30,
    facettes.expirees,
    facettes.tri,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtrees.length / PAR_PAGE));
  // La page vient de l'URL, bornée à ce qui existe vraiment (une URL bricolée
  // `?page=99` affiche la dernière page sans réécrire l'URL).
  const pageNum = Math.min(facettes.page, totalPages);
  const pageCourante = filtrees
    .slice((pageNum - 1) * PAR_PAGE, pageNum * PAR_PAGE)
    .map((e) => e.offre);

  // Un filtre calculé par le SERVEUR (catégorie, recherche) qui ne renvoie rien :
  // le message « aucune offre publiée » serait faux — on propose d'élargir.
  const filtreServeurActif =
    facettes.categorie !== TOUTES_CATEGORIES || facettes.recherche !== "";

  const reinitialiserFiltres = useCallback(() => {
    // L'URL redevient nue (aucun défaut écrit) ; l'input local suit.
    setMotsCles("");
    ecrire(FACETTES_PAR_DEFAUT, "filtre");
  }, [ecrire]);

  // Le premier chargement occupe l'écran ; les rechargements (tri, recherche)
  // gardent la liste en place — pas de clignotement pendant la frappe.
  if (loading && bassin.length === 0) {
    return <IndicateurChargement />;
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-card">
          <p className="mb-4 font-medium text-destructive">{error}</p>
          <Button
            onClick={() => charger(facettes.tri, facettes.recherche, facettes.categorie)}
            className="h-11 rounded-lg bg-signature px-6 text-white hover:bg-signature-deep"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

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
          nbResultats={filtrees.length}
          nbTotal={bassin.length}
        />

        {pageCourante.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-background px-4 py-12 text-center">
            <Briefcase className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium text-foreground">
              {bassin.length === 0 && !filtreServeurActif
                ? "Aucune offre disponible pour le moment"
                : "Aucune offre ne correspond à ces filtres"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {bassin.length === 0 && !filtreServeurActif
                ? "Reviens bientôt — de nouvelles offres sont publiées chaque semaine."
                : "Essaie d'élargir ta recherche."}
            </p>
            {(bassin.length > 0 || filtreServeurActif) && (
              <Button
                variant="outline"
                size="sm"
                onClick={reinitialiserFiltres}
                className="mt-4 rounded-lg border-border px-4 transition-colors duration-150 hover:border-signature hover:text-signature"
              >
                Réinitialiser les filtres
              </Button>
            )}
          </div>
        ) : (
          <>
            <div
              data-probe="offres-grille"
              aria-busy={loading}
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            >
              {pageCourante.map((offre) => (
                <CarteOffre key={offre.id} offre={offre} />
              ))}
            </div>
            {/* Pagination = réécriture silencieuse : pas d'entrée d'historique
                par page (même contrat que la frappe, cf. cleFiltres). */}
            <PaginationOffres
              page={pageNum}
              totalPages={totalPages}
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
