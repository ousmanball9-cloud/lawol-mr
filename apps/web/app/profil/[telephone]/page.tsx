"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
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

const BADGES_TYPE: Record<string, string> = {
  stage_pfe: "bg-indigo-100 text-indigo-800",
  emploi_junior: "bg-emerald-100 text-emerald-800",
  bourse: "bg-amber-100 text-amber-900",
  stage_ete: "bg-sky-100 text-sky-800",
  alternance: "bg-violet-100 text-violet-800",
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-muted/40 px-4">
        <div
          aria-hidden="true"
          className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent"
        />
        <p className="text-sm text-muted-foreground">Chargement de ton profil...</p>
      </div>
    );
  }

  if (error || !profil) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-xl shadow-primary/5">
          <p className="mb-4 font-medium text-destructive">{error || "Profil non trouvé"}</p>
          <Link href="/">
            <Button className="rounded-xl shadow-lg shadow-primary/20">Retour à l&apos;accueil</Button>
          </Link>
        </div>
      </div>
    );
  }

  const initiales = `${profil.prenom?.charAt(0) ?? ""}${profil.nom?.charAt(0) ?? ""}`.toUpperCase();

  return (
    <div className="min-h-screen bg-muted/40 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* En-tête profil */}
        <div className="mb-6 overflow-hidden rounded-2xl border bg-card shadow-xl shadow-primary/5">
          <div className="bg-gradient-to-br from-primary/10 via-violet-500/5 to-transparent px-6 pb-6 pt-6">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-violet-500 text-2xl font-bold text-white shadow-lg shadow-primary/25 ring-4 ring-background">
                {initiales || "?"}
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-foreground">
                  {profil.prenom} {profil.nom}
                </h1>
                <p className="truncate text-muted-foreground">{profil.universite}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 px-6 py-5 text-sm">
            <div className="rounded-xl bg-muted px-3 py-2">
              <span className="block text-xs text-foreground/70">Filière</span>
              <span className="font-medium capitalize">{profil.filiere}</span>
            </div>
            <div className="rounded-xl bg-muted px-3 py-2">
              <span className="block text-xs text-foreground/70">Niveau</span>
              <span className="font-medium">{profil.niveau}</span>
            </div>
            <div className="rounded-xl bg-muted px-3 py-2">
              <span className="block text-xs text-foreground/70">Ville</span>
              <span className="font-medium capitalize">{profil.ville}</span>
            </div>
            <div className="rounded-xl bg-muted px-3 py-2">
              <span className="block text-xs text-foreground/70">Téléphone</span>
              <span className="font-medium">{profil.telephone}</span>
            </div>
          </div>

          {/* Actions profil */}
          <div className="flex flex-wrap gap-2 border-t px-6 py-4">
            <Button variant="outline" size="sm" onClick={handleActualiser} disabled={actualisation} className="rounded-xl transition-all duration-150 hover:border-primary/40 hover:text-primary">
              <RefreshCw className={`h-4 w-4 mr-2 ${actualisation ? "animate-spin" : ""}`} />
              {actualisation ? "Actualisation..." : "Actualiser"}
            </Button>
            <Link href={`/profil/${telephone}/edit`}>
              <Button variant="outline" size="sm" className="rounded-xl transition-all duration-150 hover:border-primary/40 hover:text-primary">
                <Pencil className="h-4 w-4 mr-2" />
                Modifier mon profil
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDesinscrire}
              disabled={desinscrit || desinscriptionEnCours}
              className="rounded-xl transition-all duration-150 hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
            >
              <UserMinus className="h-4 w-4 mr-2" />
              {desinscriptionEnCours ? "Désinscription..." : "Se désinscrire"}
            </Button>
          </div>

          {message && (
            <div
              className={`mx-6 mb-4 rounded-xl px-4 py-3 text-sm font-medium ${
                message.ok
                  ? "border border-green-200 bg-green-50 text-green-800"
                  : "border border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {message.texte}
            </div>
          )}
        </div>

        {/* Offres matchées */}
        <div className="rounded-2xl border bg-card p-6 shadow-xl shadow-primary/5">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-foreground">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Briefcase className="h-4 w-4" />
            </span>
            Offres qui matchent ton profil ({offresFiltrees.length})
          </h2>

          {/* Filtres type / ville */}
          {matches.length > 0 && (
            <div className="mb-5 flex flex-wrap gap-3 border-b pb-4">
              <select
                value={typeFiltre}
                onChange={(e) => setTypeFiltre(e.target.value)}
                aria-label="Filtrer par type d'offre"
                className="rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors duration-150 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/40"
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
                className="rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors duration-150 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/40"
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
            <div className="rounded-xl border border-dashed bg-muted/40 px-4 py-10 text-center">
              <p className="text-muted-foreground">
                {matches.length === 0
                  ? "Aucune offre matchée pour le moment. Reviens bientôt !"
                  : "Aucune offre ne correspond à ces filtres."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {offresFiltrees.map((match) => (
                <div
                  key={match.id}
                  className="group rounded-xl border bg-background p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <h3 className="font-semibold leading-snug text-foreground group-hover:text-primary">
                      {match.offre.titre}
                    </h3>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                        BADGES_TYPE[match.offre.type_offre] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {TYPES_OFFRES[match.offre.type_offre] || match.offre.type_offre}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="h-4 w-4" />
                      {match.offre.entreprise}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      {match.offre.ville}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      {match.offre.date_limite}
                    </span>
                  </div>
                  {match.offre.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {match.offre.description}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
                    <Button
                      size="sm"
                      onClick={() => handlePostule(match.id)}
                      disabled={match.postule || postulEnCours === match.id}
                      className="rounded-xl shadow-sm transition-all duration-150 hover:shadow-md"
                    >
                      {match.postule
                        ? "Postulé ✅"
                        : postulEnCours === match.id
                          ? "Enregistrement..."
                          : "J'ai postulé"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePartager(match.offre)}
                      className="rounded-xl transition-all duration-150 hover:border-primary/40 hover:text-primary"
                    >
                      <Share2 className="mr-2 h-4 w-4" />
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
            <Button variant="outline" className="rounded-xl transition-all duration-150 hover:border-primary/40 hover:text-primary">
              Retour à l&apos;accueil
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
