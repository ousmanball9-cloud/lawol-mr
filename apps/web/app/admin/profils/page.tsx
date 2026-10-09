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
  M1: "bg-blue-100 text-blue-800",
  M2: "bg-indigo-100 text-indigo-800",
  L3: "bg-green-100 text-green-800",
  licence: "bg-green-100 text-green-800",
  master: "bg-indigo-100 text-indigo-800",
};

function initiales(prenom: string, nom: string) {
  return `${prenom?.charAt(0) ?? ""}${nom?.charAt(0) ?? ""}`.toUpperCase() || "?";
}

export default function AdminProfilsPage() {
  const [profils, setProfils] = useState<Profil[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/profils")
      .then((r) => r.json())
      .then(setProfils)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {/* En-tête de page (crud du template) */}
      <div className="p-4 bg-white border-b border-gray-200 sm:flex sm:items-center sm:justify-between lg:mt-1.5">
        <div className="w-full mb-1">
          <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">
            Profils
            {!loading && (
              <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded">
                {profils.length}
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm font-normal text-gray-500">
            Tous les profils inscrits sur la plateforme
          </p>
        </div>
      </div>

      <div className="p-4">
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
                  <th scope="col" className="px-4 py-3">Nom</th>
                  <th scope="col" className="px-4 py-3">Téléphone</th>
                  <th scope="col" className="px-4 py-3">Filière</th>
                  <th scope="col" className="px-4 py-3">Niveau</th>
                  <th scope="col" className="px-4 py-3">Ville</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {profils.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                      Aucun profil trouvé.
                    </td>
                  </tr>
                )}
                {profils.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="inline-flex items-center justify-center w-10 h-10 mr-3 text-sm font-semibold text-blue-800 bg-blue-100 rounded-full">
                          {initiales(p.prenom, p.nom)}
                        </div>
                        <div className="text-sm">
                          <div className="font-semibold text-gray-900">
                            {p.prenom} {p.nom}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-500 whitespace-nowrap">
                      {p.telephone}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{p.filiere}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`text-xs font-medium mr-2 px-2.5 py-0.5 rounded ${
                          NIVEAU_BADGE[p.niveau] ?? "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {p.niveau || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{p.ville}</td>
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
