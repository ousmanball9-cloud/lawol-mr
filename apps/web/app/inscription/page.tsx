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
  { value: "bourse", label: "Bourse d'études" },
];

const OPTIN_TEXTE = "J'accepte de recevoir les offres correspondant à mon profil sur WhatsApp";

const inputClass =
  "w-full rounded-lg border border-input bg-white px-4 py-2.5 text-sm text-foreground transition-colors duration-150 placeholder:text-muted-foreground focus:border-signature focus:outline-none focus:ring-2 focus:ring-signature/30";

const selectClass = `${inputClass} bg-background`;

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
        // Redirection directe vers le profil avec les offres matchées
        router.push(`/profil/${telephoneClean}`);
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-lg">
        <div className="rounded-lg border border-border bg-card p-8 shadow-[0_1px_3px_rgba(10,10,10,0.04)] sm:p-10">
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-lg bg-ink text-white">
              <GraduationCap className="h-7 w-7" />
            </div>
            <h1 className="mb-2 font-display text-2xl font-bold tracking-[-0.02em] text-foreground">Inscription LAWOL.mr</h1>
            <p className="text-sm text-muted-foreground">
              Reçois les offres de stage, PFE et emploi qui matchent ton profil sur WhatsApp
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Téléphone */}
            <div>
              <label htmlFor="telephone" className="mb-1.5 block text-sm font-medium text-foreground">
                Téléphone <span className="text-destructive">*</span>
              </label>
              <input
                id="telephone"
                type="tel"
                value={form.telephone}
                onChange={(e) => update("telephone", e.target.value)}
                placeholder="+222 XXXXXXXXX"
                className={inputClass}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">Format : +222 suivi de 8 chiffres</p>
            </div>

            {/* Nom */}
            <div>
              <label htmlFor="nom" className="mb-1.5 block text-sm font-medium text-foreground">
                Nom <span className="text-destructive">*</span>
              </label>
              <input
                id="nom"
                type="text"
                value={form.nom}
                onChange={(e) => update("nom", e.target.value)}
                placeholder="Ton nom"
                className={inputClass}
                required
              />
            </div>

            {/* Prénom */}
            <div>
              <label htmlFor="prenom" className="mb-1.5 block text-sm font-medium text-foreground">
                Prénom <span className="text-destructive">*</span>
              </label>
              <input
                id="prenom"
                type="text"
                value={form.prenom}
                onChange={(e) => update("prenom", e.target.value)}
                placeholder="Ton prénom"
                className={inputClass}
                required
              />
            </div>

            {/* Université */}
            <div>
              <label htmlFor="universite" className="mb-1.5 block text-sm font-medium text-foreground">
                Université <span className="text-destructive">*</span>
              </label>
              <input
                id="universite"
                type="text"
                value={form.universite}
                onChange={(e) => update("universite", e.target.value)}
                placeholder="Ex: Université de Nouakchott"
                className={inputClass}
                required
              />
            </div>

            {/* Filière */}
            <div>
              <label htmlFor="filiere" className="mb-1.5 block text-sm font-medium text-foreground">
                Filière <span className="text-destructive">*</span>
              </label>
              <select
                id="filiere"
                value={form.filiere}
                onChange={(e) => update("filiere", e.target.value)}
                className={selectClass}
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
              <label htmlFor="niveau" className="mb-1.5 block text-sm font-medium text-foreground">
                Niveau <span className="text-destructive">*</span>
              </label>
              <select
                id="niveau"
                value={form.niveau}
                onChange={(e) => update("niveau", e.target.value)}
                className={selectClass}
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
              <label htmlFor="ville" className="mb-1.5 block text-sm font-medium text-foreground">
                Ville
              </label>
              <select
                id="ville"
                value={form.ville}
                onChange={(e) => update("ville", e.target.value)}
                className={selectClass}
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
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-input bg-white px-3 py-2.5 text-sm transition-colors duration-150 hover:border-signature hover:bg-signature/5"
                  >
                    <input
                      type="checkbox"
                      checked={form.types_recherches.includes(t.value)}
                      onChange={() => toggleTypeOffre(t.value)}
                      className="rounded border-gray-300 text-signature focus:ring-signature"
                    />
                    <span className="text-sm">{t.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Opt-in */}
            <div className="rounded-lg border border-input bg-muted p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={form.optin}
                  onChange={(e) => update("optin", e.target.checked)}
                  className="mt-1 rounded border-gray-300 text-signature focus:ring-signature"
                  required
                />
                <span className="text-sm text-foreground">
                  <MessageSquare className="inline h-4 w-4 mr-1 text-signature" />
                  {OPTIN_TEXTE} <span className="text-destructive">*</span>
                </span>
              </label>
            </div>

            {/* Erreur */}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-lg bg-signature text-base text-white hover:bg-signature-deep"
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
