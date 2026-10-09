"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  GraduationCap,
  MapPin,
  Calendar,
  Building2,
  Briefcase,
  RefreshCw,
  Pencil,
  UserMinus,
  Share2,
} from "lucide-react";

type Profil = {
  telephone: string;
  nom: string;
  prenom: string;
  universite: string;
  filiere: string;
  niveau: string;
  ville: string;
  types_recherches: string[];
};

type Offre = {
  id: string;
  titre: string;
  entreprise: string;
  ville: string;
  type_offre: string;
  date_limite: string;
  description: string;
};

type Match = {
  id: string;
  postule: boolean;
  offre: Offre;
};

const TYPES_OFFRES: Record<string, string> = {
  stage_pfe: "Stage PFE",
  stage_ete: "Stage été",
  emploi_junior: "Emploi junior",
  alternance: "Alternance",
  bourse: "Bourse d'études",
};

export default function ProfilPage() {
  const params = useParams();
  const telephone = params.telephone as string;
  const [profil, setProfil] = useState<Profil | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [typeFiltre, setTypeFiltre] = useState("tous");
  const [villeFiltre, setVilleFiltre] = useState("tous");
  const [postulEnCours, setPostulEnCours] = useState<string | null>(null);
  const [actualisation, setActualisation] = useState(false);
  const [desinscriptionEnCours, setDesinscriptionEnCours] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [desinscrit, setDesinscrit] = useState(false);

  const charger = useCallback(async () => {
    try {
      // Charger le profil
      const resProfil = await fetch(`/api/v1/profils/${telephone}`);
      if (!resProfil.ok) throw new Error("Profil non trouvé");
      const p = await resProfil.json();
      setProfil(p);

      // Charger les offres matchées
      const resOffres = await fetch(`/api/v1/matches?profil_id=${p.id}`);
      if (resOffres.ok) {
        const data = await resOffres.json();
        const liste: Match[] = data
          .filter((m: { offre?: Offre }) => m.offre)
          .map((m: { id: string; postule?: boolean; offre: Offre }) => ({
            id: m.id,
            postule: !!m.postule,
            offre: m.offre,
          }));
        setMatches(liste);
      }
    } catch {
      setError("Erreur de chargement du profil");
    } finally {
      setLoading(false);
    }
  }, [telephone]);

  useEffect(() => {
    charger();
  }, [charger]);

  const villesDisponibles = useMemo(() => {
    const villes = new Set(matches.map((m) => m.offre.ville));
    return Array.from(villes).sort();
  }, [matches]);

  const offresFiltrees = useMemo(
    () =>
      matches.filter(
        (m) =>
          (typeFiltre === "tous" || m.offre.type_offre === typeFiltre) &&
          (villeFiltre === "tous" || m.offre.ville === villeFiltre)
      ),
    [matches, typeFiltre, villeFiltre]
  );

  async function handlePostule(matchId: string) {
    setPostulEnCours(matchId);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/matches/${matchId}/postule`, { method: "POST" });
      if (!res.ok) throw new Error();
      setMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, postule: true } : m)));
      setMessage({ ok: true, texte: "Candidature enregistrée, bonne chance !" });
    } catch {
      setMessage({ ok: false, texte: "Impossible d'enregistrer ta candidature. Réessaie." });
    } finally {
      setPostulEnCours(null);
    }
  }

  function handlePartager(offre: Offre) {
    const texte = `Offre repérée sur LAWOL.mr : ${offre.titre} — ${offre.entreprise} (${offre.ville}), candidature avant le ${offre.date_limite}.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texte)}`, "_blank", "noopener,noreferrer");
  }

  async function handleActualiser() {
    setActualisation(true);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/matching/run", { method: "POST" });
      if (!res.ok) throw new Error();
      await charger();
      setMessage({ ok: true, texte: "Offres actualisées !" });
    } catch {
      setMessage({ ok: false, texte: "Erreur lors de l'actualisation. Réessaie." });
    } finally {
      setActualisation(false);
    }
  }

  async function handleDesinscrire() {
    const confirme = window.confirm(
      "Vraiment te désinscrire ? Tu ne recevras plus aucune offre sur WhatsApp."
    );
    if (!confirme) return;

    setDesinscriptionEnCours(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/profils/${telephone}/desinscription`, { method: "POST" });
      if (!res.ok) throw new Error();
      setDesinscrit(true);
      setMessage({ ok: true, texte: "Profil désactivé : tu ne recevras plus d'offres. À bientôt !" });
    } catch {
      setMessage({ ok: false, texte: "Erreur lors de la désinscription. Réessaie." });
    } finally {
      setDesinscriptionEnCours(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Chargement de ton profil...</p>
      </div>
    );
  }

  if (error || !profil) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || "Profil non trouvé"}</p>
          <Link href="/">
            <Button>Retour à l&apos;accueil</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* En-tête profil */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <GraduationCap className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {profil.prenom} {profil.nom}
              </h1>
              <p className="text-muted-foreground">{profil.universite}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Filière :</span>{" "}
              <span className="font-medium">{profil.filiere}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Niveau :</span>{" "}
              <span className="font-medium">{profil.niveau}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Ville :</span>{" "}
              <span className="font-medium">{profil.ville}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Téléphone :</span>{" "}
              <span className="font-medium">{profil.telephone}</span>
            </div>
          </div>

          {/* Actions profil */}
          <div className="flex flex-wrap gap-2 mt-5">
            <Button variant="outline" size="sm" onClick={handleActualiser} disabled={actualisation}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {actualisation ? "Actualisation..." : "Actualiser"}
            </Button>
            <Link href={`/profil/${telephone}/edit`}>
              <Button variant="outline" size="sm">
                <Pencil className="h-4 w-4 mr-2" />
                Modifier mon profil
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDesinscrire}
              disabled={desinscrit || desinscriptionEnCours}
            >
              <UserMinus className="h-4 w-4 mr-2" />
              {desinscriptionEnCours ? "Désinscription..." : "Se désinscrire"}
            </Button>
          </div>

          {message && (
            <div
              className={`mt-4 rounded px-4 py-3 text-sm ${
                message.ok
                  ? "bg-green-50 border border-green-200 text-green-700"
                  : "bg-red-50 border border-red-200 text-red-700"
              }`}
            >
              {message.texte}
            </div>
          )}
        </div>

        {/* Offres matchées */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            Offres qui matchent ton profil ({offresFiltrees.length})
          </h2>

          {/* Filtres type / ville */}
          {matches.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-4">
              <select
                value={typeFiltre}
                onChange={(e) => setTypeFiltre(e.target.value)}
                aria-label="Filtrer par type d'offre"
                className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
              >
                <option value="tous">Tous les types</option>
                {Object.entries(TYPES_OFFRES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={villeFiltre}
                onChange={(e) => setVilleFiltre(e.target.value)}
                aria-label="Filtrer par ville"
                className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
              >
                <option value="tous">Toutes les villes</option>
                {villesDisponibles.map((ville) => (
                  <option key={ville} value={ville}>
                    {ville}
                  </option>
                ))}
              </select>
            </div>
          )}

          {offresFiltrees.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {matches.length === 0
                ? "Aucune offre matchée pour le moment. Reviens bientôt !"
                : "Aucune offre ne correspond à ces filtres."}
            </p>
          ) : (
            <div className="space-y-4">
              {offresFiltrees.map((match) => (
                <div
                  key={match.id}
                  className="border rounded-lg p-4 hover:border-primary transition-colors"
                >
                  <h3 className="font-semibold text-foreground mb-2">{match.offre.titre}</h3>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      {match.offre.entreprise}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {match.offre.ville}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {match.offre.date_limite}
                    </span>
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-4 w-4" />
                      {TYPES_OFFRES[match.offre.type_offre] || match.offre.type_offre}
                    </span>
                  </div>
                  {match.offre.description && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {match.offre.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button
                      size="sm"
                      onClick={() => handlePostule(match.id)}
                      disabled={match.postule || postulEnCours === match.id}
                    >
                      {match.postule
                        ? "Postulé ✅"
                        : postulEnCours === match.id
                          ? "Enregistrement..."
                          : "J'ai postulé"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handlePartager(match.offre)}>
                      <Share2 className="h-4 w-4 mr-2" />
                      Partager
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 text-center">
          <Link href="/">
            <Button variant="outline">Retour à l&apos;accueil</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
