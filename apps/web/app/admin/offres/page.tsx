"use client";

import { useCallback, useEffect, useState } from "react";
import { OffreForm } from "@/components/admin/offre-form";

type Offre = {
  id: string;
  titre: string;
  entreprise: string;
  ville: string;
  type_offre: string;
  active: boolean;
  date_limite: string;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://lawol-mr-production.up.railway.app";

// Badges « type » façon template Flowbite (pastilles de couleur).
const TYPE_BADGE: Record<string, string> = {
  stage_pfe: "bg-purple-100 text-purple-800",
  emploi_junior: "bg-green-100 text-green-800",
  bourse: "bg-yellow-100 text-yellow-800",
  alternance: "bg-blue-100 text-blue-800",
  stage_ete: "bg-indigo-100 text-indigo-800",
};

function typeLabel(type: string) {
  if (!type) return "—";
  const mot = type.replace(/_/g, " ");
  return mot.charAt(0).toUpperCase() + mot.slice(1);
}

export default function AdminOffresPage() {
  const [offres, setOffres] = useState<Offre[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOuvert, setFormOuvert] = useState(false);

  // Rechargement de la liste (montée initiale + après création d'une offre).
  // Le proxy Next appelle l'API avec le plafond par défaut (50 offres, triées par
  // date_scrape) : une offre fraîchement créée peut donc rester hors fenêtre.
  // On interroge d'abord l'API avec une fenêtre large, et on retombe sur le
  // proxy existant si l'origine du navigateur n'est pas autorisée (CORS).
  const chargerOffres = useCallback(async () => {
    let data: unknown = null;
    try {
      const r = await fetch(`${API_URL}/api/v1/offres?limit=200`);
      if (r.ok) {
        const json = await r.json();
        if (Array.isArray(json)) data = json;
      }
    } catch {
      // CORS ou réseau → repli sur le proxy ci-dessous.
    }
    if (!Array.isArray(data)) {
      try {
        const r = await fetch("/api/admin/offres");
        const json = await r.json();
        if (Array.isArray(json)) data = json;
      } catch {
        // Hors-ligne : liste vide plutôt qu'une page en erreur.
      }
    }
    setOffres(Array.isArray(data) ? (data as Offre[]) : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    chargerOffres();
  }, [chargerOffres]);

  return (
    <div>
      {/* En-tête de page (crud du template) */}
      <div className="p-4 bg-white border-b border-gray-200 sm:flex sm:items-center sm:justify-between lg:mt-1.5">
        <div className="w-full mb-1">
          <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">
            Offres
            {!loading && (
              <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded">
                {offres.length}
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm font-normal text-gray-500">
            Toutes les offres publiées sur la plateforme
          </p>
        </div>
        <div className="mt-3 sm:mt-0">
          <button
            type="button"
            onClick={() => setFormOuvert((v) => !v)}
            aria-expanded={formOuvert}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300"
          >
            {formOuvert ? "Fermer le formulaire" : "Nouvelle offre"}
          </button>
        </div>
      </div>

      <div className="p-4">
        {formOuvert && <OffreForm onCreated={chargerOffres} />}
        {loading && (
          <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm sm:p-6">
            <p className="text-sm text-gray-500">Chargement...</p>
          </div>
        )}

        {!loading && (
          <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg shadow-md">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                <tr>
                  <th scope="col" className="px-4 py-3">Titre</th>
                  <th scope="col" className="px-4 py-3">Entreprise</th>
                  <th scope="col" className="px-4 py-3">Ville</th>
                  <th scope="col" className="px-4 py-3">Type</th>
                  <th scope="col" className="px-4 py-3">Active</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {offres.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                      Aucune offre trouvée.
                    </td>
                  </tr>
                )}
                {offres.map((offre) => (
                  <tr key={offre.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                      {offre.titre}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{offre.entreprise}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{offre.ville}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`text-xs font-medium mr-2 px-2.5 py-0.5 rounded ${
                          TYPE_BADGE[offre.type_offre] ?? "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {typeLabel(offre.type_offre)}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`text-xs font-medium mr-2 px-2.5 py-0.5 rounded ${
                          offre.active
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {offre.active ? "Oui" : "Non"}
                      </span>
                    </td>
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
