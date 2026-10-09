"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GraduationCap, MapPin, Calendar, Building2, Briefcase } from "lucide-react";

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

export default function ProfilPage() {
  const params = useParams();
  const telephone = params.telephone as string;
  const [profil, setProfil] = useState<Profil | null>(null);
  const [offres, setOffres] = useState<Offre[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        // Charger le profil
        const resProfil = await fetch(`/api/v1/profils/${telephone}`);
        if (!resProfil.ok) throw new Error("Profil non trouvé");
        const p = await resProfil.json();
        setProfil(p);

        // Charger les offres matchées
        const resOffres = await fetch(`/api/v1/matches?profil_id=${p.id}`);
        if (resOffres.ok) {
          const matches = await resOffres.json();
          const offresList = matches.map((m: any) => m.offre).filter(Boolean);
          setOffres(offresList);
        }
      } catch (e) {
        setError("Erreur de chargement du profil");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [telephone]);

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
          <a href="/">
            <Button>Retour à l'accueil</Button>
          </a>
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
        </div>

        {/* Offres matchées */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            Offres qui matchent ton profil ({offres.length})
          </h2>

          {offres.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Aucune offre matchée pour le moment. Reviens bientôt !
            </p>
          ) : (
            <div className="space-y-4">
              {offres.map((offre) => (
                <div
                  key={offre.id}
                  className="border rounded-lg p-4 hover:border-primary transition-colors"
                >
                  <h3 className="font-semibold text-foreground mb-2">{offre.titre}</h3>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      {offre.entreprise}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {offre.ville}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {offre.date_limite}
                    </span>
                  </div>
                  {offre.description && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {offre.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 text-center">
          <a href="/">
            <Button variant="outline">Retour à l'accueil</Button>
          </a>
        </div>
      </div>
    </div>
  );
}
