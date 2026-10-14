"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Briefcase, RefreshCw } from "lucide-react";
import { CarteEntreprise } from "@/components/entreprises/carte-entreprise";
import { Chrome } from "@/components/chrome/chrome";
import { FiltresEntreprises } from "@/components/entreprises/filtres-entreprises";
import type { Entreprise } from "@/components/entreprises/types";

/** Page publique /entreprises — annuaire : filtres secteur/ville + grille de cartes. */
export default function EntreprisesPage() {
  const [annuaire, setAnnuaire] = useState<Entreprise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [secteurFiltre, setSecteurFiltre] = useState("tous");
  const [villeFiltre, setVilleFiltre] = useState("tous");

  const charger = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/v1/entreprises");
      if (!res.ok) throw new Error();
      const data: unknown = await res.json();
      if (!Array.isArray(data)) throw new Error();
      setAnnuaire(data as Entreprise[]);
    } catch {
      setError("Impossible de charger les entreprises. Réessaie dans un instant.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const secteurs = useMemo(
    () => Array.from(new Set(annuaire.map((e) => e.secteur).filter(Boolean))).sort() as string[],
    [annuaire]
  );

  const filtrees = useMemo(
    () =>
      annuaire.filter(
        (e) =>
          (secteurFiltre === "tous" || e.secteur === secteurFiltre) &&
          (villeFiltre === "tous" || e.ville === villeFiltre)
      ),
    [annuaire, secteurFiltre, villeFiltre]
  );

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4">
        <div
          aria-hidden="true"
          className="h-10 w-10 animate-spin rounded-full border-2 border-signature border-t-transparent"
        />
        <p className="text-sm text-muted-foreground">Chargement des entreprises...</p>
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
    <Chrome>
    <main className="bg-background px-4 py-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <p className="eyebrow text-signature">Annuaire</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.02em] text-foreground">
            Découvrez les entreprises
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Les entreprises qui recrutent des étudiants et jeunes diplômés en ce moment.
          </p>
        </header>

        <FiltresEntreprises
          secteurFiltre={secteurFiltre}
          setSecteurFiltre={setSecteurFiltre}
          villeFiltre={villeFiltre}
          setVilleFiltre={setVilleFiltre}
          secteurs={secteurs}
          nbResultats={filtrees.length}
          nbTotal={annuaire.length}
        />

        {filtrees.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-background px-4 py-12 text-center">
            <Briefcase className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium text-foreground">
              {annuaire.length === 0
                ? "Aucune entreprise référencée pour le moment"
                : "Aucune entreprise ne correspond à ces filtres"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {annuaire.length === 0
                ? "Reviens bientôt — de nouvelles entreprises rejoignent l'annuaire."
                : "Essaie d'élargir ta recherche."}
            </p>
            {annuaire.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSecteurFiltre("tous");
                  setVilleFiltre("tous");
                }}
                className="mt-4 rounded-lg border-border px-4 transition-colors duration-150 hover:border-signature hover:text-signature"
              >
                Réinitialiser les filtres
              </Button>
            )}
          </div>
        ) : (
          <div
            data-probe="entreprises-grille"
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {filtrees.map((entreprise) => (
              <CarteEntreprise key={entreprise.id} entreprise={entreprise} />
            ))}
          </div>
        )}
      </div>
    </main>
    </Chrome>
  );
}
