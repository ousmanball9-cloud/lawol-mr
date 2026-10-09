"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GraduationCap } from "lucide-react";

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

const inputClass =
  "w-full rounded-lg border border-input bg-white px-4 py-2.5 text-sm text-foreground transition-colors duration-150 placeholder:text-muted-foreground focus:border-signature focus:outline-none focus:ring-2 focus:ring-signature/30";

const selectClass = `${inputClass} bg-background`;

export default function EditProfilPage() {
  const params = useParams();
  const router = useRouter();
  const telephone = params.telephone as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    nom: "",
    prenom: "",
    email: "",
    universite: "",
    filiere: "",
    niveau: "",
    ville: "nouakchott",
    types_recherches: [] as string[],
  });

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/v1/profils/${telephone}`);
        if (!res.ok) throw new Error();
        const p = await res.json();
        setForm({
          nom: p.nom || "",
          prenom: p.prenom || "",
          email: p.email || "",
          universite: p.universite || "",
          filiere: p.filiere || "",
          niveau: p.niveau || "",
          ville: p.ville || "nouakchott",
          types_recherches: p.types_recherches || [],
        });
      } catch {
        setError("Impossible de charger ton profil");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [telephone]);

  function update(field: string, value: string | string[]) {
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

    if (!form.nom.trim() || !form.prenom.trim() || !form.universite.trim()) {
      setError("Veuillez remplir tous les champs obligatoires");
      return;
    }

    if (!form.filiere || !form.niveau) {
      setError("Veuillez sélectionner votre filière et votre niveau");
      return;
    }

    const email = form.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Adresse e-mail invalide");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        universite: form.universite.trim(),
        filiere: form.filiere,
        niveau: form.niveau,
        ville: form.ville,
        types_recherches: form.types_recherches,
      };
      if (email) payload.email = email;

      const res = await fetch(`/api/v1/profils/${telephone}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        router.push(`/profil/${telephone}`);
      } else if (res.status === 404) {
        setError("Profil introuvable");
      } else if (res.status === 422) {
        const data = await res.json().catch(() => null);
        setError(
          typeof data?.detail === "string" ? data.detail : "Données invalides. Vérifiez le formulaire."
        );
      } else {
        setError("Erreur serveur. Veuillez réessayer plus tard.");
      }
    } catch {
      setError("Erreur de connexion. Vérifiez votre internet et réessayez.");
    } finally {
      setSaving(false);
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
            <h1 className="mb-2 font-display text-2xl font-bold tracking-[-0.02em] text-foreground">Modifier mon profil</h1>
            <p className="text-sm text-muted-foreground">
              Mets à jour tes informations pour recevoir des offres plus pertinentes
            </p>
            <p className="mt-3 inline-block rounded-full border border-border bg-muted px-4 py-1.5 text-xs text-muted-foreground">
              Téléphone : <span className="font-semibold text-foreground">{telephone}</span>
            </p>
          </div>

          {loading ? (
            <p className="text-muted-foreground text-center py-8">Chargement de ton profil...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
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

              {/* Email */}
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="Ex : prenom.nom@exemple.com"
                  className={inputClass}
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
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
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
                    <option key={n} value={n}>
                      {n}
                    </option>
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
                    <option key={v.value} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Types recherchés */}
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
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

              {/* Erreur */}
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                disabled={saving}
                className="h-12 w-full rounded-lg bg-signature text-base text-white hover:bg-signature-deep"
                size="lg"
              >
                {saving ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </form>
          )}
        </div>

        <div className="mt-5 text-center">
          <Link href={`/profil/${telephone}`}>
            <Button variant="outline" className="h-11 rounded-lg border-border px-6 transition-colors duration-150 hover:border-signature hover:text-signature">
              Retour à mon profil
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
