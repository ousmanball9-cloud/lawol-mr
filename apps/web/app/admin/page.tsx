"use client";

import { useEffect, useState } from "react";

type Stats = {
  offres_actives: number;
  offres_total: number;
  profils_actifs: number;
  profils_total: number;
  matches_total: number;
  matches_notifies: number;
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setError("Erreur de chargement"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Chargement...</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!stats) return null;

  const cards = [
    { label: "Offres actives", value: stats.offres_actives, color: "bg-blue-500" },
    { label: "Offres totales", value: stats.offres_total, color: "bg-blue-300" },
    { label: "Profils actifs", value: stats.profils_actifs, color: "bg-green-500" },
    { label: "Profils totaux", value: stats.profils_total, color: "bg-green-300" },
    { label: "Matches totaux", value: stats.matches_total, color: "bg-purple-500" },
    { label: "Matches notifiés", value: stats.matches_notifies, color: "bg-purple-300" },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500 mb-2">{card.label}</p>
            <p className={`text-4xl font-bold text-white ${card.color} rounded-lg w-16 h-16 flex items-center justify-center`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
