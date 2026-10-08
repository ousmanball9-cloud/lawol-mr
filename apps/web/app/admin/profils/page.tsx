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

export default function AdminProfilsPage() {
  const [profils, setProfils] = useState<Profil[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/profils")
      .then((r) => r.json())
      .then(setProfils)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Chargement...</p>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Profils ({profils.length})</h2>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Nom</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Téléphone</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Filière</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Niveau</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Ville</th>
            </tr>
          </thead>
          <tbody>
            {profils.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-3 text-sm">{p.prenom} {p.nom}</td>
                <td className="px-4 py-3 text-sm">{p.telephone}</td>
                <td className="px-4 py-3 text-sm">{p.filiere}</td>
                <td className="px-4 py-3 text-sm">{p.niveau}</td>
                <td className="px-4 py-3 text-sm">{p.ville}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
