"use client";

import { useEffect, useState } from "react";

type Profil = {
  id: string;
  prenom: string;
  nom: string;
  telephone: string;
  filiere: string;
  niveau: string;
  ville: string;
  actif: boolean;
};

// Badges « niveau » façon template Flowbite (pastilles de couleur).
const NIVEAU_BADGE: Record<string, string> = {
  M1: "bg-signature/10 text-signature-deep",
  M2: "bg-nuit/10 text-nuit",
  L3: "bg-nuit-lift/10 text-nuit-lift",
  licence: "bg-nuit-lift/10 text-nuit-lift",
  master: "bg-nuit/10 text-nuit",
};

function initiales(prenom: string, nom: string) {
  return `${prenom?.charAt(0) ?? ""}${nom?.charAt(0) ?? ""}`.toUpperCase() || "?";
}

export default function AdminProfilsPage() {
  const [profils, setProfils] = useState<Profil[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [relance, setRelance] = useState(0);

  useEffect(() => {
    let annule = false;
    setLoading(true);
    setErreur(null);
    fetch("/api/admin/profils")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((liste) => {
        if (!annule) setProfils(Array.isArray(liste) ? liste : []);
      })
      .catch(() => {
        // Sans ce catch, un échec réseau laissait le spinner permanent (constat chasse 0 · B3).
        if (!annule) setErreur("Impossible de charger les profils. Vérifie la connexion puis réessaie.");
      })
      .finally(() => {
        if (!annule) setLoading(false);
      });
    return () => {
      annule = true;
    };
  }, [relance]);

  return (
    <div>
      {/* En-tête de page (crud du template) */}
      <div className="p-4 bg-card border-b border-border sm:flex sm:items-center sm:justify-between lg:mt-1.5">
        <div className="w-full mb-1">
          <h1 className="text-xl font-semibold text-ink sm:text-2xl">
            Profils
            {!loading && (
              <span className="ml-2 bg-signature/10 text-signature-deep text-xs font-medium mr-2 px-2.5 py-0.5 rounded">
                {profils.length}
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm font-normal text-muted-foreground">
            Tous les profils inscrits sur la plateforme
          </p>
        </div>
      </div>

      <div className="p-4">
        {loading && (
          <div className="p-4 bg-card border border-border rounded-lg shadow-sm sm:p-6">
            <p className="text-sm text-muted-foreground">Chargement...</p>
          </div>
        )}

        {!loading && erreur && (
          <div role="alert" className="p-4 bg-card border border-destructive/40 rounded-lg shadow-sm sm:p-6">
            <p className="text-sm font-medium text-destructive">{erreur}</p>
            <button
              type="button"
              onClick={() => setRelance((n) => n + 1)}
              className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-medium text-ink hover:bg-muted"
            >
              Réessayer
            </button>
          </div>
        )}

        {!loading && !erreur && (
          <div className="overflow-x-auto bg-card border border-border rounded-lg shadow-md">
            <table className="w-full text-sm text-left text-muted-foreground">
              <thead className="text-xs text-muted-foreground uppercase bg-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">Nom</th>
                  <th scope="col" className="px-4 py-3">Téléphone</th>
                  <th scope="col" className="px-4 py-3">Filière</th>
                  <th scope="col" className="px-4 py-3">Niveau</th>
                  <th scope="col" className="px-4 py-3">Ville</th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {profils.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                      Aucun profil trouvé.
                    </td>
                  </tr>
                )}
                {profils.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="inline-flex items-center justify-center w-10 h-10 mr-3 text-sm font-semibold text-signature-deep bg-signature/10 rounded-full">
                          {initiales(p.prenom, p.nom)}
                        </div>
                        <div className="text-sm">
                          <div className="font-semibold text-ink">
                            {p.prenom} {p.nom}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground whitespace-nowrap">
                      {p.telephone}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{p.filiere}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`text-xs font-medium mr-2 px-2.5 py-0.5 rounded ${
                          NIVEAU_BADGE[p.niveau] ?? "bg-muted text-ink"
                        }`}
                      >
                        {p.niveau || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{p.ville}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
