"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GraduationCap, MessageSquare } from "lucide-react";

const FILIERES = [
  { value: "informatique", label: "Informatique" },
  { value: "genie_civil", label: "Génie Civil" },
  { value: "electrique", label: "Électrique" },
  { value: "mecanique", label: "Mécanique" },
  { value: "gestion", label: "Gestion" },
  { value: "finance", label: "Finance" },
  { value: "droit", label: "Droit" },
  { value: "medecine", label: "Médecine" },
  { value: "agronomie", label: "Agronomie" },
  { value: "autre", label: "Autre" },
];

const NIVEAUX = ["L1", "L2", "L3", "M1", "M2", "Autre"];

const VILLES = [
  { value: "nouakchott", label: "Nouakchott" },
  { value: "nouadhibou", label: "Nouadhibou" },
  { value: "kaedi", label: "Kaédi" },
  { value: "rosso", label: "Rosso" },
  { value: "aleg", label: "Aleg" },
  { value: "autre", label: "Autre" },
];

const TYPES_OFFRES = [
  { value: "stage_pfe", label: "Stage PFE" },
  { value: "stage_ete", label: "Stage été" },
  { value: "emploi_junior", label: "Emploi junior" },
  { value: "alternance", label: "Alternance" },
];

const OPTIN_TEXTE = "J'accepte de recevoir les offres correspondant à mon profil sur WhatsApp";

export default function InscriptionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    telephone: "",
    nom: "",
    prenom: "",
    universite: "",
    filiere: "",
    niveau: "",
    ville: "nouakchott",
    types_recherches: [] as string[],
    optin: false,
  });

  function update(field: string, value: string | boolean | string[]) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function toggleTypeOffre(value: string) {
    setForm((f) => ({
      ...f,
      types_recherches: f.types_recherches.includes(value)
        ? f.types_recherches.filter((t) => t !== value)
        : [...f.types_recherches, value],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Nettoyer le téléphone (supprimer +, espaces, tirets, points)
    const telephoneClean = form.telephone.replace(/[\s+\-\.]/g, "");

    // Validation téléphone (format mauritanien : 222 + 8 chiffres)
    if (!/^222\d{8}$/.test(telephoneClean)) {
      setError("Numéro de téléphone invalide. Format attendu : +222 suivi de 8 chiffres");
      return;
    }

    // Validation champs requis
    if (!form.nom.trim() || !form.prenom.trim() || !form.universite.trim()) {
      setError("Veuillez remplir tous les champs obligatoires");
      return;
    }

    if (!form.filiere || !form.niveau) {
      setError("Veuillez sélectionner votre filière et votre niveau");
      return;
    }

    // Validation opt-in
    if (!form.optin) {
      setError("Vous devez accepter de recevoir les offres sur WhatsApp pour continuer");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/profils", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telephone: telephoneClean,
          nom: form.nom.trim(),
          prenom: form.prenom.trim(),
          universite: form.universite.trim(),
          filiere: form.filiere,
          niveau: form.niveau,
          ville: form.ville,
          types_recherches: form.types_recherches,
          optin_at: new Date().toISOString(),
          optin_texte: OPTIN_TEXTE,
        }),
      });

      if (res.ok) {
        router.push("/inscription/confirmation");
      } else if (res.status === 409) {
        setError("Ce numéro de téléphone est déjà inscrit");
      } else if (res.status === 422) {
        const data = await res.json().catch(() => null);
        setError(data?.detail || "Données invalides. Vérifiez le formulaire.");
      } else {
        setError("Erreur serveur. Veuillez réessayer plus tard.");
      }
    } catch {
      setError("Erreur de connexion. Vérifiez votre internet et réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
              <GraduationCap className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Inscription LAWOL.mr</h1>
            <p className="text-muted-foreground text-sm">
              Reçois les offres de stage, PFE et emploi qui matchent ton profil sur WhatsApp
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Téléphone */}
            <div>
              <label htmlFor="telephone" className="block text-sm font-medium text-foreground mb-1">
                Téléphone <span className="text-red-500">*</span>
              </label>
              <input
                id="telephone"
                type="tel"
                value={form.telephone}
                onChange={(e) => update("telephone", e.target.value)}
                placeholder="+222 XXXXXXXXX"
                className="w-full border rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">Format : +222 suivi de 8 chiffres</p>
            </div>

            {/* Nom */}
            <div>
              <label htmlFor="nom" className="block text-sm font-medium text-foreground mb-1">
                Nom <span className="text-red-500">*</span>
              </label>
              <input
                id="nom"
                type="text"
                value={form.nom}
                onChange={(e) => update("nom", e.target.value)}
                placeholder="Ton nom"
                className="w-full border rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            {/* Prénom */}
            <div>
              <label htmlFor="prenom" className="block text-sm font-medium text-foreground mb-1">
                Prénom <span className="text-red-500">*</span>
              </label>
              <input
                id="prenom"
                type="text"
                value={form.prenom}
                onChange={(e) => update("prenom", e.target.value)}
                placeholder="Ton prénom"
                className="w-full border rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            {/* Université */}
            <div>
              <label htmlFor="universite" className="block text-sm font-medium text-foreground mb-1">
                Université <span className="text-red-500">*</span>
              </label>
              <input
                id="universite"
                type="text"
                value={form.universite}
                onChange={(e) => update("universite", e.target.value)}
                placeholder="Ex: Université de Nouakchott"
                className="w-full border rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            {/* Filière */}
            <div>
              <label htmlFor="filiere" className="block text-sm font-medium text-foreground mb-1">
                Filière <span className="text-red-500">*</span>
              </label>
              <select
                id="filiere"
                value={form.filiere}
                onChange={(e) => update("filiere", e.target.value)}
                className="w-full border rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                required
              >
                <option value="">-- Sélectionne ta filière --</option>
                {FILIERES.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>

            {/* Niveau */}
            <div>
              <label htmlFor="niveau" className="block text-sm font-medium text-foreground mb-1">
                Niveau <span className="text-red-500">*</span>
              </label>
              <select
                id="niveau"
                value={form.niveau}
                onChange={(e) => update("niveau", e.target.value)}
                className="w-full border rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                required
              >
                <option value="">-- Sélectionne ton niveau --</option>
                {NIVEAUX.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            {/* Ville */}
            <div>
              <label htmlFor="ville" className="block text-sm font-medium text-foreground mb-1">
                Ville
              </label>
              <select
                id="ville"
                value={form.ville}
                onChange={(e) => update("ville", e.target.value)}
                className="w-full border rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary bg-white"
              >
                {VILLES.map((v) => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </select>
            </div>

            {/* Types recherchés */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Types d&apos;offres recherchés
              </label>
              <div className="grid grid-cols-2 gap-2">
                {TYPES_OFFRES.map((t) => (
                  <label
                    key={t.value}
                    className="flex items-center gap-2 border rounded px-3 py-2 cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={form.types_recherches.includes(t.value)}
                      onChange={() => toggleTypeOffre(t.value)}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm">{t.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Opt-in */}
            <div className="border rounded p-4 bg-primary/5">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.optin}
                  onChange={(e) => update("optin", e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary mt-0.5"
                  required
                />
                <span className="text-sm text-foreground">
                  <MessageSquare className="inline h-4 w-4 mr-1 text-primary" />
                  {OPTIN_TEXTE} <span className="text-red-500">*</span>
                </span>
              </label>
            </div>

            {/* Erreur */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded px-4 py-3 text-sm">
                {error}
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? "Inscription en cours..." : "S'inscrire"}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          En t&apos;inscrivant, tu acceptes notre politique de confidentialité.
        </p>
      </div>
    </div>
  );
}
