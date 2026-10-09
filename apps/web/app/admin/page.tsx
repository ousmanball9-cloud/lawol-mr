"use client";

import { useEffect, useState } from "react";
import { Bell, Briefcase, FileText, Star, UserCheck, Users } from "lucide-react";

type Stats = {
  offres_actives: number;
  offres_total: number;
  profils_actifs: number;
  profils_total: number;
  matches_total: number;
  matches_notifies: number;
};

// Cartes de statistiques — widgets du template Flowbite Admin
// (carte blanche bordée + icône en pastille de couleur + grand chiffre).
const CARDS = [
  { label: "Offres actives", key: "offres_actives", icon: Briefcase, iconBg: "bg-blue-100", iconColor: "text-blue-600" },
  { label: "Offres totales", key: "offres_total", icon: FileText, iconBg: "bg-indigo-100", iconColor: "text-indigo-600" },
  { label: "Profils actifs", key: "profils_actifs", icon: Users, iconBg: "bg-green-100", iconColor: "text-green-600" },
  { label: "Profils totaux", key: "profils_total", icon: UserCheck, iconBg: "bg-teal-100", iconColor: "text-teal-600" },
  { label: "Matches totaux", key: "matches_total", icon: Star, iconBg: "bg-purple-100", iconColor: "text-purple-600" },
  { label: "Matches notifiés", key: "matches_notifies", icon: Bell, iconBg: "bg-amber-100", iconColor: "text-amber-600" },
] as const;

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

  return (
    <div>
      {/* En-tête de page (crud du template) */}
      <div className="p-4 bg-white border-b border-gray-200 sm:flex sm:items-center sm:justify-between lg:mt-1.5">
        <div className="w-full mb-1">
          <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">Dashboard</h1>
          <p className="mt-1 text-sm font-normal text-gray-500">
            Vue d&apos;ensemble de la plateforme LAWOL.mr
          </p>
        </div>
      </div>

      <div className="p-4">
        {loading && (
          <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm sm:p-6">
            <p className="text-sm text-gray-500">Chargement...</p>
          </div>
        )}

        {error && (
          <div
            className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg border border-red-200"
            role="alert"
          >
            {error}
          </div>
        )}

        {stats && !loading && (
          <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {CARDS.map((card) => (
              <div
                key={card.label}
                className="items-center justify-between p-4 bg-white border border-gray-200 rounded-lg shadow-sm sm:flex sm:p-6"
              >
                <div className="w-full">
                  <h3 className="mb-1 text-base font-normal text-gray-500">{card.label}</h3>
                  <span className="text-2xl font-bold leading-none text-gray-900 sm:text-3xl">
                    {stats[card.key]}
                  </span>
                </div>
                <div
                  className={`inline-flex items-center justify-center flex-shrink-0 w-12 h-12 mb-4 rounded-lg sm:mb-0 ${card.iconBg} ${card.iconColor}`}
                >
                  <card.icon className="w-6 h-6" aria-hidden="true" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
