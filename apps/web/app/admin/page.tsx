"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Briefcase,
  CheckCircle2,
  FileText,
  RefreshCw,
  Star,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";

// Contrat RÉEL de `GET /api/v1/admin/stats` (`StatsResponse`). Les clés
// `offres_total` / `profils_actifs` / `profils_total` utilisées avant le
// 27/10/2026 n'ont JAMAIS existé côté API : trois cartes sur six affichaient
// donc un vide silencieux (constaté sur capture, pas en lisant le code).
type Stats = {
  offres_actives: number;
  offres_en_attente: number;
  etudiants_actifs: number;
  matches_total: number;
  matches_notifies: number;
  matches_postules: number;
  taux_notification: number;
};

// Réponse de `GET /api/v1/admin/sante-collecte` (modules/scraper/sante.py).
type SanteCollecte = {
  statut: "ok" | "degrade" | "retard" | "jamais";
  message: string;
  derniere_collecte: string | null;
  age_heures: number | null;
  seuil_heures: number;
  sources: number;
  sources_en_erreur: number;
  offres_traitees: number;
  offres_actives: number;
  prochaine_collecte: string;
  rattrapage: {
    actif: boolean;
    en_cours: boolean;
    seuil_heures: number;
    intervalle_minutes: number;
    executions: number;
    derniere_execution: string | null;
    derniere_raison: string | null;
  };
};

// Cartes de statistiques — widgets du template Flowbite Admin
// (carte blanche bordée + icône en pastille de couleur + grand chiffre).
const CARDS = [
  { label: "Offres actives", key: "offres_actives", icon: Briefcase, iconBg: "bg-blue-100", iconColor: "text-blue-600" },
  { label: "Offres en attente", key: "offres_en_attente", icon: FileText, iconBg: "bg-indigo-100", iconColor: "text-indigo-600" },
  { label: "Étudiants actifs", key: "etudiants_actifs", icon: Users, iconBg: "bg-green-100", iconColor: "text-green-600" },
  { label: "Matches totaux", key: "matches_total", icon: Star, iconBg: "bg-purple-100", iconColor: "text-purple-600" },
  { label: "Matches notifiés", key: "matches_notifies", icon: Bell, iconBg: "bg-amber-100", iconColor: "text-amber-600" },
  { label: "Matches postulés", key: "matches_postules", icon: UserCheck, iconBg: "bg-teal-100", iconColor: "text-teal-600" },
] as const;

// Apparence par statut : vert = collecte fraîche, ambre = partielle,
// rouge = en retard ou jamais exécutée. Une panne doit SAUTER aux yeux.
const SANTE_STYLE = {
  ok: {
    icone: CheckCircle2,
    cadre: "bg-green-50 border-green-200 text-green-800",
    pastille: "bg-green-100 text-green-600",
    titre: "Collecte automatique à jour",
  },
  degrade: {
    icone: AlertTriangle,
    cadre: "bg-amber-50 border-amber-200 text-amber-800",
    pastille: "bg-amber-100 text-amber-600",
    titre: "Collecte partielle",
  },
  retard: {
    icone: XCircle,
    cadre: "bg-red-50 border-red-200 text-red-800",
    pastille: "bg-red-100 text-red-600",
    titre: "Collecte en retard",
  },
  jamais: {
    icone: XCircle,
    cadre: "bg-red-50 border-red-200 text-red-800",
    pastille: "bg-red-100 text-red-600",
    titre: "Aucune collecte enregistrée",
  },
} as const;

/** Heure UTC -> « 18:17 » (la Mauritanie est à UTC+0, aucun décalage). */
function heure(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().slice(11, 16);
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [sante, setSante] = useState<SanteCollecte | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const charger = () => {
      setLoading(true);
      setError("");
      Promise.all([
        fetch("/api/admin/stats", { cache: "no-store" }).then(async (r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.json();
        }),
        fetch("/api/v1/admin/sante-collecte", { cache: "no-store" }).then(async (r) => {
          // Le diagnostic est INDÉPENDANT des compteurs : s'il tombe, on
          // l'affiche comme inconnu au lieu de casser tout le dashboard.
          if (!r.ok) return null;
          return r.json();
        }),
      ])
        .then(([donneesStats, donneesSante]) => {
          setStats(donneesStats);
          setSante(donneesSante);
        })
        .catch((e) => setError(e?.message === "401" ? "Session admin expirée" : "Erreur de chargement"))
        .finally(() => setLoading(false));
    };
    charger();
  }, []);

  const style = sante ? SANTE_STYLE[sante.statut] ?? SANTE_STYLE.retard : null;

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

        {/* Santé de la collecte — la fraîcheur du catalogue doit être visible
            DANS le produit, pas seulement dans l'onglet Actions de GitHub
            (7 jours de collecte muette passés inaperçus les 20-26/10/2026). */}
        {sante && style && (
          <div className={`p-4 mb-4 border rounded-lg ${style.cadre}`} role="status">
            <div className="sm:flex sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className={`inline-flex items-center justify-center flex-shrink-0 w-10 h-10 rounded-lg ${style.pastille}`}>
                  <style.icone className="w-5 h-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{style.titre}</p>
                  <p className="mt-0.5 text-sm">{sante.message}</p>
                  <p className="mt-1 text-xs opacity-80">
                    Exécution : {heure(sante.derniere_collecte)} UTC ·{" "}
                    {sante.offres_traitees} offre{sante.offres_traitees > 1 ? "s" : ""} traitée
                    {sante.offres_traitees > 1 ? "s" : ""} (upserts, mises à jour comprises) ·
                    prochaine à {heure(sante.prochaine_collecte)} UTC
                  </p>
                  <p className="mt-1 text-xs opacity-70">
                    Filet interne :{" "}
                    {sante.rattrapage?.actif
                      ? `armé (seuil ${sante.rattrapage.seuil_heures} h, vérifié toutes les ${sante.rattrapage.intervalle_minutes} min)`
                      : "désactivé"}{" "}
                    ·{" "}
                    {sante.rattrapage?.executions
                      ? `${sante.rattrapage.executions} rattrapage(s), dernier à ${heure(sante.rattrapage.derniere_execution)} UTC`
                      : "aucun rattrapage déclenché"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 mt-3 text-xs font-medium underline sm:mt-0"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                Actualiser
              </button>
            </div>
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

        {stats && !loading && (
          <p className="mt-3 text-xs text-gray-500">
            Taux de notification des matches : {stats.taux_notification} %
          </p>
        )}
      </div>
    </div>
  );
}
