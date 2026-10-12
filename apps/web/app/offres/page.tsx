"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Briefcase, RefreshCw } from "lucide-react";
import { BarreFiltres } from "@/components/offres/barre-filtres";
import { Chrome } from "@/components/chrome/chrome";
import { CarteOffre } from "@/components/offres/carte-offre";
import { PaginationOffres } from "@/components/offres/pagination-offres";
import { joursRestants, parserDateLimite } from "@/components/offres/date-limite";
import type { Offre, TriOffres } from "@/components/offres/types";

const PAR_PAGE = 12;
/** Supabase plafonne une requête à 1 000 lignes : on charge le bassin par lots de 500. */
const BATCH = 500;
const MAX_OFFSET = 5000;
/** Seuil du filtre « Clôture dans moins de 30 jours ». */
const SEUIL_30_JOURS = 30;

/** Offre enrichie de son échéance : jours restants (null = date illisible). */
type Echeance = { offre: Offre; jours: number | null };

/** Rang du tri « plus urgentes » : 0 = encore ouvert, 1 = expirée, 2 = sans date lisible. */
function rangEcheance(jours: number | null): number {
  if (jours === null) return 2;
  return jours < 0 ? 1 : 0;
}

/** Charge toutes les offres actives (bassin complet, pagination 100 % côté client
 *  pour que la recherche mots-clés porte bien sur l'ensemble du catalogue). */
async function chargerBassin(): Promise<Offre[]> {
  const toutes: Offre[] = [];
  for (let offset = 0; offset < MAX_OFFSET; offset += BATCH) {
    const res = await fetch(`/api/v1/offres?limit=${BATCH}&offset=${offset}`);
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
      <div
        aria-hidden="true"
        className="h-10 w-10 animate-spin rounded-full border-2 border-signature border-t-transparent"
      />
      <p className="text-sm text-muted-foreground">Chargement des offres...</p>
    </div>
  );
}

/**
 * Page publique /offres — recherche + filtres + grille paginée (12/page).
 * useSearchParams lit `?recherche=` poussé par le hero : la barre de filtres
 * est pré-remplie et le filtrage s'applique dès le chargement (Suspense
 * obligatoire autour d'un Client Component qui lit les searchParams).
 */
export default function OffresPage() {
  return (
    <Suspense fallback={<IndicateurChargement />}>
      <OffresContenu />
    </Suspense>
  );
}

function OffresContenu() {
  const searchParams = useSearchParams();
  const rechercheUrl = searchParams.get("recherche") ?? "";
  const [bassin, setBassin] = useState<Offre[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [motsCles, setMotsCles] = useState(rechercheUrl);
  const [typeFiltre, setTypeFiltre] = useState("tous");
  const [villeFiltre, setVilleFiltre] = useState("tous");
  const [filiereFiltre, setFiliereFiltre] = useState("tous");
  const [tri, setTri] = useState<TriOffres>("urgent");
  const [cloture30, setCloture30] = useState(false);
  // Les offres expirées sont masquées par défaut — mais jamais invisibles :
  // l'état « Afficher les expirées » de la barre de filtres les révèle.
  const [expireesVisibles, setExpireesVisibles] = useState(false);
  const [page, setPage] = useState(1);

  // ?recherche= changé pendant la session (retour arrière, nouveau lien hero) → resynchronise
  useEffect(() => {
    setMotsCles(rechercheUrl);
  }, [rechercheUrl]);

  const charger = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setBassin(await chargerBassin());
    } catch {
      setError("Impossible de charger les offres. Réessaie dans un instant.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  // Tout changement de critère (dont tri et échéance) ramène à la première page
  useEffect(() => {
    setPage(1);
  }, [motsCles, typeFiltre, villeFiltre, filiereFiltre, tri, cloture30, expireesVisibles]);

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
    const q = motsCles.trim().toLowerCase();
    const correspond = (offre: Offre) => {
      if (typeFiltre !== "tous" && offre.type_offre !== typeFiltre) return false;
      if (villeFiltre !== "tous" && offre.ville !== villeFiltre) return false;
      if (filiereFiltre !== "tous" && !(offre.filieres_cibles ?? []).includes(filiereFiltre))
        return false;
      if (
        q &&
        !`${offre.titre} ${offre.entreprise} ${offre.description} ${offre.ville}`
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
      if (cloture30) {
        // « Clôture dans moins de 30 jours » = fenêtre À VENIR : ni offre déjà
        // close, ni date illisible, ni échéance ≥ 30 j. Le motif est rappelé par
        // le compteur de la barre de filtres (« fenêtre 30 j : offres closes
        // exclues »).
        if (expiree || e.jours === null || e.jours >= SEUIL_30_JOURS) continue;
      } else if (expiree && !expireesVisibles) {
        continue; // masquées par défaut, jamais supprimées : bascule explicite
      }
      retenues.push(e);
    }

    if (tri === "urgent") {
      // Échéance proche d'abord ; sans date lisible au dernier rang ; expirées
      // (si affichées) en toute fin, la plus récemment close en tête.
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
    typeFiltre,
    villeFiltre,
    filiereFiltre,
    cloture30,
    expireesVisibles,
    tri,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtrees.length / PAR_PAGE));
  const pageNum = Math.min(page, totalPages);
  const pageCourante = filtrees
    .slice((pageNum - 1) * PAR_PAGE, pageNum * PAR_PAGE)
    .map((e) => e.offre);

  const reinitialiserFiltres = useCallback(() => {
    setMotsCles("");
    setTypeFiltre("tous");
    setVilleFiltre("tous");
    setFiliereFiltre("tous");
    setTri("urgent");
    setCloture30(false);
    setExpireesVisibles(false);
  }, []);

  if (loading) {
    return <IndicateurChargement />;
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-[0_1px_3px_rgba(10,10,10,0.04)]">
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

  return (
    <Chrome>
    <main className="bg-background px-4 py-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <p className="eyebrow text-signature">Bourses · Stages · Emplois</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.02em] text-foreground">
            Bourses et offres pour ton profil
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Les bourses d&apos;études, stages PFE, emplois juniors et alternances actuellement
            ouverts aux candidatures.
          </p>
        </header>

        <BarreFiltres
          motsCles={motsCles}
          setMotsCles={setMotsCles}
          typeFiltre={typeFiltre}
          setTypeFiltre={setTypeFiltre}
          villeFiltre={villeFiltre}
          setVilleFiltre={setVilleFiltre}
          filiereFiltre={filiereFiltre}
          setFiliereFiltre={setFiliereFiltre}
          tri={tri}
          setTri={setTri}
          cloture30={cloture30}
          setCloture30={setCloture30}
          expireesVisibles={expireesVisibles}
          setExpireesVisibles={setExpireesVisibles}
          nbExpirees={nbExpirees}
          nbResultats={filtrees.length}
          nbTotal={bassin.length}
        />

        {pageCourante.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-background px-4 py-12 text-center">
            <Briefcase className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium text-foreground">
              {bassin.length === 0
                ? "Aucune offre disponible pour le moment"
                : "Aucune offre ne correspond à ces filtres"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {bassin.length === 0
                ? "Reviens bientôt — de nouvelles offres sont publiées chaque semaine."
                : "Essaie d'élargir ta recherche."}
            </p>
            {bassin.length > 0 && (
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
            <div data-probe="offres-grille" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {pageCourante.map((offre) => (
                <CarteOffre key={offre.id} offre={offre} />
              ))}
            </div>
            <PaginationOffres page={pageNum} totalPages={totalPages} onPage={setPage} />
          </>
        )}

        <div className="mt-10 text-center">
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-signature"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </main>
    </Chrome>
  );
}
