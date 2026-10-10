"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Briefcase, RefreshCw } from "lucide-react";
import { BarreFiltres } from "@/components/offres/barre-filtres";
import { CarteOffre } from "@/components/offres/carte-offre";
import { PaginationOffres } from "@/components/offres/pagination-offres";
import type { Offre } from "@/components/offres/types";

const PAR_PAGE = 12;
/** Supabase plafonne une requête à 1 000 lignes : on charge le bassin par lots de 500. */
const BATCH = 500;
const MAX_OFFSET = 5000;

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

/** Page publique /offres — recherche + filtres + grille paginée (12/page). */
export default function OffresPage() {
  const [bassin, setBassin] = useState<Offre[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [motsCles, setMotsCles] = useState("");
  const [typeFiltre, setTypeFiltre] = useState("tous");
  const [villeFiltre, setVilleFiltre] = useState("tous");
  const [filiereFiltre, setFiliereFiltre] = useState("tous");
  const [page, setPage] = useState(1);

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

  // Tout changement de critère ramène à la première page
  useEffect(() => {
    setPage(1);
  }, [motsCles, typeFiltre, villeFiltre, filiereFiltre]);

  const filtrees = useMemo(() => {
    const q = motsCles.trim().toLowerCase();
    return bassin.filter((o) => {
      if (typeFiltre !== "tous" && o.type_offre !== typeFiltre) return false;
      if (villeFiltre !== "tous" && o.ville !== villeFiltre) return false;
      if (filiereFiltre !== "tous" && !(o.filieres_cibles ?? []).includes(filiereFiltre))
        return false;
      if (
        q &&
        !`${o.titre} ${o.entreprise} ${o.description} ${o.ville}`.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [bassin, motsCles, typeFiltre, villeFiltre, filiereFiltre]);

  const totalPages = Math.max(1, Math.ceil(filtrees.length / PAR_PAGE));
  const pageNum = Math.min(page, totalPages);
  const pageCourante = filtrees.slice((pageNum - 1) * PAR_PAGE, pageNum * PAR_PAGE);

  const reinitialiserFiltres = useCallback(() => {
    setMotsCles("");
    setTypeFiltre("tous");
    setVilleFiltre("tous");
    setFiliereFiltre("tous");
  }, []);

  if (loading) {
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
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <p className="eyebrow text-signature">Stages · Emplois · Bourses</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.02em] text-foreground">
            Toutes les offres
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Les offres de stage PFE, d&apos;emploi junior, d&apos;alternance et de bourse
            actuellement ouvertes aux candidatures.
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
  );
}
