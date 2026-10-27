"use client";

import { useCallback, useEffect, useState } from "react";
import { OffreForm } from "@/components/admin/offre-form";

type Offre = {
  id: string;
  titre: string;
  entreprise: string;
  pays_etudes: string | null;
  type_offre: string;
  active: boolean;
  date_limite: string;
};

type ReponseAdmin = {
  total: number;
  offset: number;
  limit: number;
  offres: Offre[];
};

const TAILLE_LOT = 100;
const PLAFOND = 5000;

// Badges « type » façon template Flowbite (pastilles de couleur).
const TYPE_BADGE: Record<string, string> = {
  bourse: "bg-yellow-100 text-yellow-800",
};

function typeLabel(type: string) {
  if (!type) return "—";
  const mot = type.replace(/_/g, " ");
  return mot.charAt(0).toUpperCase() + mot.slice(1);
}

export default function AdminOffresPage() {
  const [offres, setOffres] = useState<Offre[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(false);
  const [formOuvert, setFormOuvert] = useState(false);

  // Chargement de la liste ADMIN complète (paginée).
  //
  // Avant le 27/10/2026, cette page lisait la liste PUBLIQUE
  // (`/api/v1/offres?limit=200`), qui filtre `active = true` + échéance future :
  // l'admin ne voyait que 200 offres sur 298, **aucune offre clôturée** (donc
  // aucun moyen d'en réactiver une), et la colonne « Active » affichait toujours
  // « Oui » par construction. On interroge maintenant `/api/admin/offres`, qui
  // relaie `/api/v1/admin/offres` (gardé admin) et rend l'état réel.
  const chargerOffres = useCallback(async () => {
    setLoading(true);
    setErreur(false);
    const collecte: Offre[] = [];
    let totalAnnonce = 0;
    let echec = false;

    for (let offset = 0; offset < PLAFOND; offset += TAILLE_LOT) {
      try {
        const r = await fetch(`/api/admin/offres?limit=${TAILLE_LOT}&offset=${offset}`, {
          cache: "no-store",
        });
        if (!r.ok) {
          echec = true;
          break;
        }
        const json: ReponseAdmin = await r.json();
        if (!Array.isArray(json.offres)) {
          echec = true;
          break;
        }
        totalAnnonce = typeof json.total === "number" ? json.total : totalAnnonce;
        collecte.push(...json.offres);
        if (json.offres.length === 0) break;
        if (totalAnnonce && collecte.length >= totalAnnonce) break;
      } catch {
        echec = true;
        break;
      }
    }

    setOffres(collecte);
    setTotal(totalAnnonce || collecte.length);
    setErreur(echec && collecte.length === 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    chargerOffres();
  }, [chargerOffres]);

  const cloturees = offres.filter((o) => !o.active).length;

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
                {total > offres.length ? ` / ${total}` : ""}
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm font-normal text-gray-500">
            Toutes les offres de la plateforme, y compris les offres clôturées
            {!loading && cloturees > 0 ? ` (${cloturees} clôturée${cloturees > 1 ? "s" : ""})` : ""}
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

        {!loading && erreur && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">
              Impossible de charger les offres (session admin expirée ou API
              injoignable). Reconnecte-toi puis recharge la page.
            </p>
          </div>
        )}

        {!loading && !erreur && (
          <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg shadow-md">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                <tr>
                  <th scope="col" className="px-4 py-3">Titre</th>
                  <th scope="col" className="px-4 py-3">Entreprise</th>
                  <th scope="col" className="px-4 py-3">Ville</th>
                  <th scope="col" className="px-4 py-3">Type</th>
                  <th scope="col" className="px-4 py-3">Publiée</th>
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
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{offre.pays_etudes ?? "—"}</td>
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
                        {offre.active ? "Oui" : "Clôturée"}
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
