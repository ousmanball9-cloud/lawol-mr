"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sidebar } from "@/components/entreprise/sidebar";
import { OngletTableau } from "@/components/entreprise/onglet-tableau";
import { OngletOffres } from "@/components/entreprise/onglet-offres";
import { OngletDeposer } from "@/components/entreprise/onglet-deposer";
import { OngletCandidatures } from "@/components/entreprise/onglet-candidatures";
import {
  apiCandidatures,
  apiCreerOffre,
  apiLogout,
  apiOffres,
} from "@/components/entreprise/api";
import type { CandidatureEntreprise, OffreCreateBody, OffreEntreprise } from "@/components/entreprise/types";

const ONGLETS = ["tableau", "offres", "deposer", "candidatures"] as const;
type Onglet = (typeof ONGLETS)[number];

const CLE_TOKEN = "ent_token";

function EntrepriseContenu() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ongletParam = searchParams.get("onglet");
  const onglet: Onglet = ONGLETS.includes(ongletParam as Onglet) ? (ongletParam as Onglet) : "tableau";

  const [token, setToken] = useState<string | null>(null);
  const [offres, setOffres] = useState<OffreEntreprise[]>([]);
  const [candidatures, setCandidatures] = useState<CandidatureEntreprise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [logoutEnCours, setLogoutEnCours] = useState(false);

  // Récupération du token depuis sessionStorage
  useEffect(() => {
    const t = sessionStorage.getItem(CLE_TOKEN);
    if (!t) {
      router.replace("/entreprise/login");
      return;
    }
    setToken(t);
  }, [router]);

  // Chargement des offres et candidatures
  const charger = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [offresData, candidaturesData] = await Promise.all([
        apiOffres(token),
        apiCandidatures(token),
      ]);
      setOffres(offresData);
      setCandidatures(candidaturesData);
    } catch {
      setError("Erreur de chargement des données. Réessaie.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) charger();
  }, [token, charger]);

  async function handleLogout() {
    if (!token) return;
    setLogoutEnCours(true);
    try {
      await apiLogout(token);
    } catch {
      // Déconnexion locale même si l'API échoue
    } finally {
      sessionStorage.clear();
      router.replace("/entreprise/login");
    }
  }

  async function handleDepot(corps: OffreCreateBody) {
    await apiCreerOffre(corps);
    await charger();
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-signature border-t-transparent" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-signature border-t-transparent" />
        <p className="text-sm text-muted-foreground">Chargement de ton espace...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-[0_1px_3px_rgba(10,10,10,0.04)]">
          <p className="mb-4 font-medium text-destructive">{error}</p>
          <button
            type="button"
            onClick={charger}
            className="rounded-lg bg-signature px-6 py-2.5 text-sm font-medium text-white hover:bg-signature-deep"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div
        data-probe="ent-dashboard"
        className="mx-auto flex max-w-2xl flex-col lg:max-w-7xl lg:flex-row lg:items-start lg:gap-8"
      >
        <Sidebar onglet={onglet} onLogout={handleLogout} logoutEnCours={logoutEnCours} />

        <div className="min-w-0 flex-1">
          {onglet === "tableau" && <OngletTableau offres={offres} candidatures={candidatures} />}
          {onglet === "offres" && <OngletOffres offres={offres} />}
          {onglet === "deposer" && <OngletDeposer token={token} onDepot={handleDepot} />}
          {onglet === "candidatures" && <OngletCandidatures candidatures={candidatures} />}
        </div>
      </div>
    </div>
  );
}

/**
 * Page principale de l'espace entreprise — shell avec sidebar + contenu par onglet.
 * Token absent → redirection /entreprise/login.
 */
export default function EntreprisePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-signature border-t-transparent" />
        </div>
      }
    >
      <EntrepriseContenu />
    </Suspense>
  );
}
