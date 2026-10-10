"use client";

// Formulaire « Nouvelle offre » (admin LAWOL) — POST /api/v1/offres.
// Entrées gardées en texte brut (React échappe par défaut, aucun dangerouslySetInnerHTML).
// source/source_name sont fixés côté client : saisie manuelle hors scrap.

import { useState, type FormEvent } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://lawol-mr-production.up.railway.app";

const TYPES = [
  { v: "stage_pfe", l: "Stage PFE" },
  { v: "stage_ete", l: "Stage d'été" },
  { v: "emploi_junior", l: "Emploi junior" },
  { v: "alternance", l: "Alternance" },
  { v: "bourse", l: "Bourse" },
];

const VILLES = [
  { v: "nouakchott", l: "Nouakchott" },
  { v: "nouadhibou", l: "Nouadhibou" },
  { v: "kaedi", l: "Kaédi" },
  { v: "rosso", l: "Rosso" },
  { v: "aleg", l: "Aleg" },
  { v: "autre", l: "Autre" },
];

const FILIERES = [
  { v: "informatique", l: "Informatique" },
  { v: "genie_civil", l: "Génie civil" },
  { v: "electrique", l: "Électrique" },
  { v: "mecanique", l: "Mécanique" },
  { v: "gestion", l: "Gestion" },
  { v: "finance", l: "Finance" },
  { v: "droit", l: "Droit" },
  { v: "medecine", l: "Médecine" },
  { v: "agronomie", l: "Agronomie" },
  { v: "autre", l: "Autre" },
];

type FormState = {
  titre: string;
  entreprise: string;
  type_offre: string;
  ville: string;
  date_limite: string;
  description: string;
  filieres: string[];
  contact_email: string;
  contact_whatsapp: string;
  source_url: string;
};

const FORM_VIDE: FormState = {
  titre: "",
  entreprise: "",
  type_offre: "stage_pfe",
  ville: "nouakchott",
  date_limite: "",
  description: "",
  filieres: [],
  contact_email: "",
  contact_whatsapp: "",
  source_url: "",
};

// Date locale (pas toISOString → décalage UTC possible la nuit).
function dateLocale(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const j = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${j}`;
}

function valider(f: FormState): Record<string, string> {
  const e: Record<string, string> = {};
  const titre = f.titre.trim();
  if (!titre) e.titre = "Le titre est obligatoire.";
  else if (titre.length < 3) e.titre = "Le titre doit faire au moins 3 caractères.";
  else if (titre.length > 300) e.titre = "300 caractères maximum.";

  const entreprise = f.entreprise.trim();
  if (!entreprise) e.entreprise = "L'entreprise est obligatoire.";
  else if (entreprise.length < 2) e.entreprise = "Au moins 2 caractères.";
  else if (entreprise.length > 200) e.entreprise = "200 caractères maximum.";

  if (!f.type_offre) e.type_offre = "Choisir un type d'offre.";
  if (!f.ville) e.ville = "Choisir une ville.";

  const aujourdhui = dateLocale();
  if (!f.date_limite) e.date_limite = "La date limite est obligatoire.";
  else if (f.date_limite < aujourdhui)
    e.date_limite = "La date limite doit être aujourd'hui ou ultérieure.";

  if (f.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.contact_email.trim()))
    e.contact_email = "Adresse e-mail invalide.";

  if (f.source_url && !/^https?:\/\/\S+$/i.test(f.source_url.trim()))
    e.source_url = "URL invalide : elle doit commencer par http:// ou https://";

  return e;
}

const INPUT =
  "bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg " +
  "focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5";
const LABEL = "block mb-1 text-sm font-medium text-gray-900";
const ERREUR = "mt-1 text-xs font-medium text-red-600";

export function OffreForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState<FormState>(FORM_VIDE);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState(false);
  const [succes, setSucces] = useState("");
  const [erreur, setErreur] = useState("");

  function maj<K extends keyof FormState>(cle: K, valeur: FormState[K]) {
    setForm((f) => ({ ...f, [cle]: valeur }));
    setSucces("");
  }

  function basculerFiliere(v: string) {
    setForm((f) => ({
      ...f,
      filieres: f.filieres.includes(v)
        ? f.filieres.filter((x) => x !== v)
        : [...f.filieres, v],
    }));
    setSucces("");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSucces("");
    setErreur("");

    const errs = valider(form);
    setErreurs(errs);
    if (Object.keys(errs).length > 0) return;

    const payload = {
      source: "autre",
      source_name: "Saisie manuelle (admin)",
      // source_url est NOT NULL UNIQUE en base : clé d'unicité, faute d'origine web.
      source_url:
        form.source_url.trim() ||
        `https://lawol.mr/admin/offres?saisie=${Date.now()}`,
      titre: form.titre.trim(),
      entreprise: form.entreprise.trim(),
      ville: form.ville,
      type_offre: form.type_offre,
      filieres_cibles: form.filieres,
      description: form.description.trim(),
      date_limite: form.date_limite,
      contact_email: form.contact_email.trim() || null,
      contact_whatsapp: form.contact_whatsapp.trim() || null,
    };

    setEnvoi(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/offres`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const detail = Array.isArray(data?.detail)
          ? data.detail
              .map((d: { loc?: unknown[]; msg?: string }) =>
                d.msg ? `${d.msg} (${(d.loc ?? []).slice(1).join(".")})` : "",
              )
              .filter(Boolean)
              .join(" — ")
          : typeof data?.detail === "string"
            ? data.detail
            : `Erreur ${res.status}`;
        setErreur(`Création refusée : ${detail}`);
        return;
      }

      setSucces(`Offre « ${payload.titre} » créée (201) — la liste est à jour.`);
      setForm(FORM_VIDE);
      setErreurs({});
      onCreated();
    } catch {
      setErreur("API injoignable : vérifier que le serveur local est lancé.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="p-4 mb-4 bg-white border border-gray-200 rounded-lg shadow-sm sm:p-6"
    >
      <h2 className="mb-1 text-base font-semibold text-gray-900">Nouvelle offre</h2>
      <p className="mb-4 text-sm text-gray-500">
        Saisie manuelle (hors scrap) : ex. une bourse découverte hors ligne.
      </p>

      {succes && (
        <div
          role="alert"
          className="flex items-center justify-between p-3 mb-4 text-sm font-medium text-green-800 bg-green-50 border border-green-200 rounded-lg"
        >
          <span>{succes}</span>
          <button
            type="button"
            onClick={() => setSucces("")}
            className="ml-3 font-bold text-green-700 hover:text-green-900"
            aria-label="Fermer le message"
          >
            ×
          </button>
        </div>
      )}
      {erreur && (
        <div
          role="alert"
          className="p-3 mb-4 text-sm font-medium text-red-800 bg-red-50 border border-red-200 rounded-lg"
        >
          {erreur}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-1">
          <label htmlFor="offre-titre" className={LABEL}>
            Titre *
          </label>
          <input
            id="offre-titre"
            type="text"
            maxLength={300}
            className={INPUT}
            placeholder="Bourse d'études Master 2027"
            value={form.titre}
            onChange={(e) => maj("titre", e.target.value)}
          />
          {erreurs.titre && <p className={ERREUR}>{erreurs.titre}</p>}
        </div>

        <div>
          <label htmlFor="offre-entreprise" className={LABEL}>
            Entreprise / organisme *
          </label>
          <input
            id="offre-entreprise"
            type="text"
            maxLength={200}
            className={INPUT}
            placeholder="Mauritel"
            value={form.entreprise}
            onChange={(e) => maj("entreprise", e.target.value)}
          />
          {erreurs.entreprise && <p className={ERREUR}>{erreurs.entreprise}</p>}
        </div>

        <div>
          <label htmlFor="offre-type" className={LABEL}>
            Type d&apos;offre *
          </label>
          <select
            id="offre-type"
            className={INPUT}
            value={form.type_offre}
            onChange={(e) => maj("type_offre", e.target.value)}
          >
            {TYPES.map((t) => (
              <option key={t.v} value={t.v}>
                {t.l}
              </option>
            ))}
          </select>
          {erreurs.type_offre && <p className={ERREUR}>{erreurs.type_offre}</p>}
        </div>

        <div>
          <label htmlFor="offre-ville" className={LABEL}>
            Ville *
          </label>
          <select
            id="offre-ville"
            className={INPUT}
            value={form.ville}
            onChange={(e) => maj("ville", e.target.value)}
          >
            {VILLES.map((v) => (
              <option key={v.v} value={v.v}>
                {v.l}
              </option>
            ))}
          </select>
          {erreurs.ville && <p className={ERREUR}>{erreurs.ville}</p>}
        </div>

        <div>
          <label htmlFor="offre-date" className={LABEL}>
            Date limite *
          </label>
          <input
            id="offre-date"
            type="date"
            min={dateLocale()}
            className={INPUT}
            value={form.date_limite}
            onChange={(e) => maj("date_limite", e.target.value)}
          />
          {erreurs.date_limite && <p className={ERREUR}>{erreurs.date_limite}</p>}
        </div>

        <div>
          <label htmlFor="offre-source" className={LABEL}>
            Lien source (URL, optionnel)
          </label>
          <input
            id="offre-source"
            type="url"
            maxLength={500}
            className={INPUT}
            placeholder="https://…"
            value={form.source_url}
            onChange={(e) => maj("source_url", e.target.value)}
          />
          {erreurs.source_url && <p className={ERREUR}>{erreurs.source_url}</p>}
        </div>

        <div className="sm:col-span-2 lg:col-span-3">
          <label htmlFor="offre-description" className={LABEL}>
            Description
          </label>
          <textarea
            id="offre-description"
            rows={3}
            className={INPUT}
            placeholder="Mission, critères, pièces à fournir…"
            value={form.description}
            onChange={(e) => maj("description", e.target.value)}
          />
        </div>

        <fieldset className="sm:col-span-2 lg:col-span-3">
          <legend className={LABEL}>Filières cibles (aucune = toutes)</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {FILIERES.map((f) => (
              <label
                key={f.v}
                className="flex items-center gap-2 p-2 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100"
              >
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  checked={form.filieres.includes(f.v)}
                  onChange={() => basculerFiliere(f.v)}
                />
                {f.l}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="offre-email" className={LABEL}>
            E-mail de contact
          </label>
          <input
            id="offre-email"
            type="email"
            className={INPUT}
            placeholder="contact@exemple.mr"
            value={form.contact_email}
            onChange={(e) => maj("contact_email", e.target.value)}
          />
          {erreurs.contact_email && <p className={ERREUR}>{erreurs.contact_email}</p>}
        </div>

        <div>
          <label htmlFor="offre-whatsapp" className={LABEL}>
            WhatsApp de contact
          </label>
          <input
            id="offre-whatsapp"
            type="tel"
            maxLength={30}
            className={INPUT}
            placeholder="2220000000"
            value={form.contact_whatsapp}
            onChange={(e) => maj("contact_whatsapp", e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-5">
        <button
          type="submit"
          disabled={envoi}
          className="px-5 py-2.5 text-sm font-medium text-white bg-blue-700 rounded-lg focus:ring-4 focus:outline-none focus:ring-blue-300 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {envoi ? "Création…" : "Créer l'offre"}
        </button>
        <button
          type="button"
          onClick={() => {
            setForm(FORM_VIDE);
            setErreurs({});
            setErreur("");
            setSucces("");
          }}
          className="px-5 py-2.5 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 focus:ring-4 focus:ring-gray-100"
        >
          Réinitialiser
        </button>
        <span className="text-xs text-gray-500">* champs obligatoires</span>
      </div>
    </form>
  );
}
