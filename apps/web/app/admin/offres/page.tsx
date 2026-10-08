"use client";

import { useEffect, useState } from "react";

type Offre = {
  id: string;
  titre: string;
  entreprise: string;
  ville: string;
  type_offre: string;
  active: boolean;
  date_limite: string;
};

export default function AdminOffresPage() {
  const [offres, setOffres] = useState<Offre[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/offres")
      .then((r) => r.json())
      .then(setOffres)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Chargement...</p>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Offres ({offres.length})</h2>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Titre</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Entreprise</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Ville</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Type</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Active</th>
            </tr>
          </thead>
          <tbody>
            {offres.map((offre) => (
              <tr key={offre.id} className="border-t">
                <td className="px-4 py-3 text-sm">{offre.titre}</td>
                <td className="px-4 py-3 text-sm">{offre.entreprise}</td>
                <td className="px-4 py-3 text-sm">{offre.ville}</td>
                <td className="px-4 py-3 text-sm">{offre.type_offre}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-1 rounded text-xs ${offre.active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {offre.active ? "Oui" : "Non"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
