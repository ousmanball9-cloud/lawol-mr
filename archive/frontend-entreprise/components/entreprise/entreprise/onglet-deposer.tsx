"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TYPES_OFFRES } from "@/components/offre-detail-modal";
import type { OffreCreateBody } from "./types";

const VILLES = ["nouakchott", "nouadhibou", "kaedi", "rosso", "aleg", "autre"];
const FILIERES = [
  "informatique",
  "genie_civil",
  "electrique",
  "mecanique",
  "gestion",
  "finance",
  "droit",
  "medecine",
  "agronomie",
  "autre",
];

type Props = {
  token: string;
  onDepot: (corps: OffreCreateBody) => Promise<void>;
};

/**
 * Onglet « Déposer une offre » : formulaire de création d'offre.
 * Le token est injecté dans le corps de la requête (contrat API P6-A).
 */
export function OngletDeposer({ token, onDepot }: Props) {
  const [titre, setTitre] = useState("");
  const [ville, setVille] = useState("nouakchott");
  const [typeOffre, setTypeOffre] = useState("stage_pfe");
  const [dateLimite, setDateLimite] = useState("");
  const [description, setDescription] = useState("");
  const [filieres, setFilieres] = useState<string[]>([]);
  const [contactEmail, setContactEmail] = useState("");
  const [contactWhatsapp, setContactWhatsapp] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);

  function basculerFiliere(f: string) {
    setFilieres((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnCours(true);
    setMessage(null);
    try {
      await onDepot({
        titre,
        ville,
        type_offre: typeOffre,
        date_limite: dateLimite,
        description,
        filieres_cibles: filieres,
        contact_email: contactEmail || undefined,
        contact_whatsapp: contactWhatsapp || undefined,
        token,
      });
      setMessage({ ok: true, texte: "Offre soumise à validation ! Elle sera visible après approbation." });
      setTitre("");
      setDescription("");
      setFilieres([]);
      setContactEmail("");
      setContactWhatsapp("");
    } catch {
      setMessage({ ok: false, texte: "Impossible de déposer l'offre. Réessaie." });
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-foreground">
          Déposer une offre
        </h1>
        <p className="text-sm text-muted-foreground">
          Publie une offre de stage, alternance ou emploi. Elle sera validée par notre équipe
          avant mise en ligne.
        </p>
      </div>

      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            message.ok
              ? "border border-green-200 bg-green-50 text-green-800"
              : "border border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.texte}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        data-probe="ent-submit-offre"
        className="space-y-5 rounded-lg border border-border bg-card p-6 shadow-[0_1px_3px_rgba(10,10,10,0.04)]"
      >
        <div>
          <label htmlFor="depot-titre" className="mb-1.5 block text-sm font-semibold text-foreground">
            Titre de l&apos;offre
          </label>
          <input
            id="depot-titre"
            type="text"
            required
            minLength={3}
            maxLength={300}
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            placeholder="Ex : Stage PFE — Développeur Full-Stack"
            className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-foreground transition-colors duration-150 focus:border-signature focus:outline-none focus:ring-2 focus:ring-signature/30"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="depot-ville" className="mb-1.5 block text-sm font-semibold text-foreground">
              Ville
            </label>
            <select
              id="depot-ville"
              value={ville}
              onChange={(e) => setVille(e.target.value)}
              className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-foreground transition-colors duration-150 focus:border-signature focus:outline-none focus:ring-2 focus:ring-signature/30"
            >
              {VILLES.map((v) => (
                <option key={v} value={v}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="depot-type" className="mb-1.5 block text-sm font-semibold text-foreground">
              Type d&apos;offre
            </label>
            <select
              id="depot-type"
              value={typeOffre}
              onChange={(e) => setTypeOffre(e.target.value)}
              className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-foreground transition-colors duration-150 focus:border-signature focus:outline-none focus:ring-2 focus:ring-signature/30"
            >
              {Object.entries(TYPES_OFFRES).map(([valeur, libelle]) => (
                <option key={valeur} value={valeur}>
                  {libelle}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="depot-date" className="mb-1.5 block text-sm font-semibold text-foreground">
            Date limite de candidature
          </label>
          <input
            id="depot-date"
            type="date"
            required
            value={dateLimite}
            onChange={(e) => setDateLimite(e.target.value)}
            className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-foreground transition-colors duration-150 focus:border-signature focus:outline-none focus:ring-2 focus:ring-signature/30"
          />
        </div>

        <div>
          <label htmlFor="depot-desc" className="mb-1.5 block text-sm font-semibold text-foreground">
            Description
          </label>
          <textarea
            id="depot-desc"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Décris le poste, les missions, le profil recherché..."
            className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-foreground transition-colors duration-150 focus:border-signature focus:outline-none focus:ring-2 focus:ring-signature/30"
          />
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-foreground">Filières cibles</legend>
          <div className="flex flex-wrap gap-2">
            {FILIERES.map((f) => (
              <label
                key={f}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors duration-150 hover:border-signature"
              >
                <input
                  type="checkbox"
                  checked={filieres.includes(f)}
                  onChange={() => basculerFiliere(f)}
                  className="h-4 w-4 rounded border-input accent-signature focus:ring-signature/30"
                />
                <span className="capitalize">{f.replace(/_/g, " ")}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="depot-email" className="mb-1.5 block text-sm font-semibold text-foreground">
              Contact e-mail
            </label>
            <input
              id="depot-email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="rh@entreprise.mr"
              className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-foreground transition-colors duration-150 focus:border-signature focus:outline-none focus:ring-2 focus:ring-signature/30"
            />
          </div>
          <div>
            <label htmlFor="depot-whatsapp" className="mb-1.5 block text-sm font-semibold text-foreground">
              Contact WhatsApp
            </label>
            <input
              id="depot-whatsapp"
              type="tel"
              value={contactWhatsapp}
              onChange={(e) => setContactWhatsapp(e.target.value)}
              placeholder="222XXXXXXXX"
              className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-foreground transition-colors duration-150 focus:border-signature focus:outline-none focus:ring-2 focus:ring-signature/30"
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={enCours}
          className="h-11 rounded-lg bg-signature px-6 text-white hover:bg-signature-deep"
        >
          {enCours ? "Envoi en cours..." : "Soumettre l'offre"}
        </Button>
      </form>
    </div>
  );
}
