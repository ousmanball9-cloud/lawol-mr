"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  SearchX,
} from "lucide-react";
import { CarteOffreEntreprise } from "@/components/entreprises/carte-offre-entreprise";
import { Chrome } from "@/components/chrome/chrome";
import type { FicheEntreprise } from "@/components/entreprises/types";

type Etat = "chargement" | "charge" | "erreur" | "introuvable";

/** Garde uniquement les URL http(s) (anti javascript: injecté). */
function lienSecurise(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

/** Page publique /entreprises/[id] — fiche entreprise + offres actives. */
export default function EntrepriseDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [fiche, setFiche] = useState<FicheEntreprise | null>(null);
  const [etat, setEtat] = useState<Etat>("chargement");

  const charger = useCallback(async () => {
    setEtat("chargement");
    try {
      const res = await fetch(`/api/v1/entreprises/${encodeURIComponent(id)}`);
      if (res.status === 404) {
        setEtat("introuvable");
        return;
      }
      if (!res.ok) throw new Error();
      const data: FicheEntreprise = await res.json();
      setFiche(data);
      setEtat("charge");
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
        <p className="text-sm text-muted-foreground">Chargement de la fiche...</p>
      </div>
    );
  }

  if (etat === "introuvable") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-[0_1px_3px_rgba(10,10,10,0.04)]">
          <SearchX className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
          <h1 className="font-display text-xl font-bold text-foreground">Entreprise introuvable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cette entreprise n&apos;existe pas ou n&apos;est plus référencée.
          </p>
          <Link href="/entreprises" className="mt-6 inline-block">
            <Button className="h-11 rounded-lg bg-signature px-6 text-white hover:bg-signature-deep">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voir l&apos;annuaire
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (etat === "erreur" || !fiche) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-[0_1px_3px_rgba(10,10,10,0.04)]">
          <p className="mb-4 font-medium text-destructive">
            Impossible de charger cette fiche. Réessaie dans un instant.
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

  const initiales = fiche.nom
    .split(/\s+/)
    .slice(0, 2)
    .map((m) => m.charAt(0))
    .join("")
    .toUpperCase();
  const site = fiche.site_url?.trim() ? lienSecurise(fiche.site_url.trim()) : null;
  const email = fiche.email_contact?.trim() || null;
  const telephone = fiche.telephone?.trim() || null;

  return (
    <Chrome>
    <main className="bg-background px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/entreprises"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-signature"
        >
          <ArrowLeft className="h-4 w-4" />
          Toutes les entreprises
        </Link>

        <article className="rounded-lg border border-border bg-card p-6 shadow-[0_1px_3px_rgba(10,10,10,0.04)]">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            <div
              aria-hidden="true"
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-nuit text-2xl font-bold text-white ring-4 ring-muted"
            >
              {initiales || "?"}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h1
                  data-probe="fiche-nom"
                  className="font-display text-2xl font-bold tracking-[-0.02em] text-foreground"
                >
                  {fiche.nom}
                </h1>
                {fiche.verifiee && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-800">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Vérifiée
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-muted-foreground sm:justify-start">
                {fiche.secteur && (
                  <span
                    data-probe="fiche-secteur"
                    className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                  >
                    {fiche.secteur}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {fiche.ville}
                </span>
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-4 w-4" />
                  {fiche.nb_offres_actives} offre{fiche.nb_offres_actives > 1 ? "s" : ""} active
                  {fiche.nb_offres_actives > 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>

          {fiche.description && (
            <div className="mt-5">
              <h2 className="mb-2 text-sm font-semibold text-foreground">À propos</h2>
              <p data-probe="fiche-description" className="text-sm leading-relaxed text-foreground/80">
                {fiche.description}
              </p>
            </div>
          )}

          {(site || telephone || email) && (
            <div className="mt-5 rounded-lg border border-border bg-muted/50 p-4">
              <h2 className="mb-3 text-sm font-semibold text-foreground">Contact</h2>
              <div className="flex flex-col gap-2">
                {site && (
                  <a
                    href={site}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-foreground transition-colors duration-150 hover:border-signature hover:text-signature"
                  >
                    <ExternalLink className="h-4 w-4 shrink-0 text-signature" />
                    <span className="truncate">{site}</span>
                  </a>
                )}
                {telephone && (
                  <a
                    href={`tel:${telephone.replace(/\s/g, "")}`}
                    className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-foreground transition-colors duration-150 hover:border-signature hover:text-signature"
                  >
                    <Phone className="h-4 w-4 shrink-0 text-signature" />
                    {telephone}
                  </a>
                )}
                {email && (
                  <a
                    href={`mailto:${email}`}
                    className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-foreground transition-colors duration-150 hover:border-signature hover:text-signature"
                  >
                    <Mail className="h-4 w-4 shrink-0 text-signature" />
                    <span className="truncate">{email}</span>
                  </a>
                )}
              </div>
            </div>
          )}
        </article>

        <section className="mt-10">
          <h2 className="mb-4 font-display text-xl font-bold tracking-[-0.01em] text-foreground">
            Offres actives ({fiche.offres.length})
          </h2>
          {fiche.offres.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-background px-4 py-10 text-center">
              <p className="text-muted-foreground">
                Aucune offre active pour le moment — reviens bientôt.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {fiche.offres.map((offre) => (
                <CarteOffreEntreprise key={offre.id} offre={offre} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
    </Chrome>
  );
}
