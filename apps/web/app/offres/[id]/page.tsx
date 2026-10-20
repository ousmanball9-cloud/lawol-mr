"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Building2,
  Calendar,
  MapPin,
  RefreshCw,
  SearchX,
} from "lucide-react";
import { BADGES_TYPE, TYPES_OFFRES } from "@/components/offre-detail-modal";
import { Chrome } from "@/components/chrome/chrome";
import { BlocDescription } from "@/components/offres/bloc-description";
import { BadgeEcheance } from "@/components/offres/badge-echeance";
import { CtaCandidater } from "@/components/offres/cta-candidater";
import { BlocFinancement } from "@/components/offres/financement";
import { DossierPieces } from "@/components/offres/dossier-pieces";
import { SuiviCandidature } from "@/components/offres/suivi-candidature";
import { CarteOffre } from "@/components/offres/carte-offre";
import { labelPays } from "@/components/offres/types";
import {
  joursRestants,
  labelAvantLe,
  parserDateLimite,
  texteJoursRestants,
} from "@/components/offres/date-limite";
import { labelFiliere, labelCategorieBourse, type Offre } from "@/components/offres/types";

type Etat = "chargement" | "charge" | "erreur" | "introuvable";

/** Page publique /offres/[id] — détail d'une offre + CTA candidater + similaires. */
export default function OffreDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [offre, setOffre] = useState<Offre | null>(null);
  const [similaires, setSimilaires] = useState<Offre[]>([]);
  const [etat, setEtat] = useState<Etat>("chargement");

  const charger = useCallback(async () => {
    setEtat("chargement");
    try {
      const res = await fetch(`/api/v1/offres/${encodeURIComponent(id)}`);
      if (res.status === 404) {
        setEtat("introuvable");
        return;
      }
      if (!res.ok) throw new Error();
      const data: Offre = await res.json();
      setOffre(data);
      setEtat("charge");
      // Similaires : même type_offre, hors id courant, max 3.
      // Échec = section masquée silencieusement, la fiche reste complète.
      try {
        const resSim = await fetch(
          `/api/v1/offres?type_offre=${encodeURIComponent(data.type_offre)}&limit=50`
        );
        if (resSim.ok) {
          const liste = (await resSim.json()) as Offre[];
          setSimilaires(liste.filter((o) => o.id !== data.id).slice(0, 3));
        }
      } catch {
        /* similaires indisponibles : on continue sans eux */
      }
    } catch {
      setEtat("erreur");
    }
  }, [id]);

  useEffect(() => {
    charger();
  }, [charger]);

  if (etat === "chargement") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4">
        <div
          aria-hidden="true"
          className="h-10 w-10 animate-spin rounded-full border-2 border-signature border-t-transparent"
        />
        <p className="text-sm text-muted-foreground">Chargement de l&apos;offre...</p>
      </div>
    );
  }

  if (etat === "introuvable") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-[0_1px_3px_rgba(10,10,10,0.04)]">
          <SearchX className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
          <h1 className="font-display text-xl font-bold text-foreground">Offre introuvable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cette offre n&apos;existe pas ou n&apos;est plus disponible.
          </p>
          <Link href="/offres" className="mt-6 inline-block">
            <Button className="h-11 rounded-lg bg-signature px-6 text-white hover:bg-signature-deep">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voir toutes les offres
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (etat === "erreur" || !offre) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-[0_1px_3px_rgba(10,10,10,0.04)]">
          <p className="mb-4 font-medium text-destructive">
            Impossible de charger cette offre. Réessaie dans un instant.
          </p>
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

  const date = parserDateLimite(offre.date_limite);
  const jours = joursRestants(date);
  const filieres = offre.filieres_cibles ?? [];
  const typeLabel = TYPES_OFFRES[offre.type_offre] || offre.type_offre;
  const typeBadge =
    BADGES_TYPE[offre.type_offre] ?? "border border-border bg-muted text-muted-foreground";
  const categorie = labelCategorieBourse(offre.categorie_bourse);
  const resumeJours = texteJoursRestants(jours);

  return (
    <Chrome>
    <main className="bg-background px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/offres"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-signature"
        >
          <ArrowLeft className="h-4 w-4" />
          Toutes les offres
        </Link>

        <article className="rounded-lg border border-border bg-card p-6 shadow-[0_1px_3px_rgba(10,10,10,0.04)]">
          {/* 1 · EN-TÊTE — titre, entreprise, ville, badges type + échéance */}
          <header data-probe="detail-en-tete">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`badge-offre inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${typeBadge}`}
              >
                {typeLabel}
              </span>
              <BadgeEcheance jours={jours} />
              {categorie && (
                <span
                  data-probe="detail-categorie"
                  className="inline-flex items-center rounded-full border border-signature/25 bg-signature/5 px-2.5 py-1 text-[11px] font-semibold text-signature-deep"
                >
                  {categorie}
                </span>
              )}
            </div>

            <h1
              data-probe="detail-titre"
              className="mt-3 font-display text-2xl font-bold leading-snug tracking-[-0.01em] text-foreground"
            >
              {offre.titre}
            </h1>

            <div
              data-probe="detail-entreprise"
              className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground"
            >
              <span className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4" aria-hidden="true" />
                {offre.entreprise}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                {offre.pays_etudes ? labelPays(offre.pays_etudes) : "Non précisé"}
              </span>
            </div>
          </header>

          {/* 2 · ÉLIGIBILITÉ — filières cibles + type d'offre */}
          <section
            data-probe="detail-eligibilite"
            className="mt-6 rounded-lg border border-border bg-muted/40 px-4 py-3"
          >
            <h2 className="eyebrow mb-3 text-muted-foreground">Éligibilité</h2>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-8">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Filières cibles
                </p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {filieres.length > 0 ? (
                    filieres.map((filiere) => (
                      <span
                        key={filiere}
                        data-probe="detail-filiere"
                        className="inline-flex items-center rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground"
                      >
                        {labelFiliere(filiere)}
                      </span>
                    ))
                  ) : (
                    <span
                      data-probe="detail-filiere"
                      className="inline-flex items-center rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground"
                    >
                      Toutes filières
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Type d&apos;offre
                </p>
                <div className="mt-1.5">
                  <span
                    className={`badge-offre inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${typeBadge}`}
                  >
                    {typeLabel}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* 3 · FINANCEMENT — label honnête, jamais de montant ni de taux inventé */}
          <BlocFinancement typeFinancement={offre.type_financement} />

          {/* 4 · ÉCHÉANCE — date_limite + jours restants, au-dessus de la description */}
          <section
            data-probe="detail-echeance"
            className="mt-4 rounded-lg border border-border bg-muted/40 px-4 py-3"
          >
            <h2 className="eyebrow mb-3 text-muted-foreground">Échéance</h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Calendar className="h-4 w-4 text-signature" aria-hidden="true" />
                {labelAvantLe(date, offre.date_limite)}
              </span>
            </div>
            {resumeJours && (
              <p className="mt-2 text-sm text-muted-foreground">{resumeJours}</p>
            )}
          </section>

          {/* 5 · DESCRIPTION — texte brut découpé en blocs lisibles */}
          <section className="mt-6">
            <h2 className="eyebrow mb-3 text-muted-foreground">Description</h2>
            <div data-probe="detail-description">
              {offre.description ? (
                <BlocDescription description={offre.description} />
              ) : (
                <p className="text-sm leading-relaxed text-foreground/80">
                  Aucune description fournie pour cette offre.
                </p>
              )}
            </div>
          </section>

          {/* 6 · DOSSIER — pièces usuelles génériques + coffre-fort, puis suivi
              de candidature (statut / « J'ai postulé ») si un match existe */}
          <DossierPieces offreId={offre.id} />
          <SuiviCandidature offreId={offre.id} />

          {/* 7 · SOURCE & POSTULER — source_name + CTA « Voir l'offre originale » */}
          <section data-probe="detail-source" className="mt-6">
            <h2 className="eyebrow mb-3 text-muted-foreground">Source &amp; postuler</h2>
            {offre.source_name && (
              <p className="mb-3 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                Source :
                <span className="font-medium text-foreground">{offre.source_name}</span>
              </p>
            )}
            <CtaCandidater offre={offre} />
          </section>
        </article>

        {similaires.length > 0 && (
          <section data-probe="detail-similaires" className="mt-10">
            <h2 className="mb-4 font-display text-xl font-bold tracking-[-0.01em] text-foreground">
              Offres similaires
            </h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {similaires.map((o) => (
                <CarteOffre key={o.id} offre={o} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
    </Chrome>
  );
}
