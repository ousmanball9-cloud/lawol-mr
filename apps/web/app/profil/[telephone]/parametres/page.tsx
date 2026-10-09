"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TYPES_OFFRES } from "@/components/offre-detail-modal";
import { ArrowLeft, Check, Copy, MessageCircle, Settings, UserMinus } from "lucide-react";

/** Enum Ville du backend (ordre SQL), même liste que le schéma. */
const VILLES = ["nouakchott", "nouadhibou", "kaedi", "rosso", "aleg", "autre"];

/** Lien WhatsApp du site (texte existant de la landing, réutilisé tel quel). */
const WHATSAPP_PARRAINAGE =
  "https://wa.me/222XXXXXXXX?text=Bonjour%20LAWOL%2C%20je%20veux%20recevoir%20les%20offres%20qui%20matchent%20mon%20profil.";

type Prefs = {
  villes_exclues: string[];
  types_masques: string[];
  seuil_pertinence: number;
};

type ProfilAvecPrefs = {
  telephone: string;
  nom: string;
  prenom: string;
  // Champ non exposé par l'API actuelle : préchargement « si présent »
  metadata?: { prefs_avancees?: Partial<Prefs> } | null;
};

const PREFS_DEFAUT: Prefs = { villes_exclues: [], types_masques: [], seuil_pertinence: 0 };

export default function ParametresPage() {
  const params = useParams();
  const router = useRouter();
  const telephone = params.telephone as string;
  const [profil, setProfil] = useState<ProfilAvecPrefs | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [prefs, setPrefs] = useState<Prefs>(PREFS_DEFAUT);
  const [sauvegarde, setSauvegarde] = useState<"repos" | "pending" | "ok" | "erreur">("repos");
  const [copie, setCopie] = useState(false);
  const [desinscriptionEnCours, setDesinscriptionEnCours] = useState(false);

  useEffect(() => {
    let actif = true;
    (async () => {
      try {
        const res = await fetch(`/api/v1/profils/${telephone}`);
        if (!res.ok) throw new Error();
        const p: ProfilAvecPrefs = await res.json();
        if (!actif) return;
        setProfil(p);
        // Préchargement depuis profils.metadata['prefs_avancees'] si présent
        const sauvees = p.metadata?.prefs_avancees;
        if (sauvees) {
          setPrefs({
            villes_exclues: sauvees.villes_exclues ?? PREFS_DEFAUT.villes_exclues,
            types_masques: sauvees.types_masques ?? PREFS_DEFAUT.types_masques,
            seuil_pertinence: sauvees.seuil_pertinence ?? PREFS_DEFAUT.seuil_pertinence,
          });
        }
      } catch {
        if (actif) setErreur("Erreur de chargement du profil");
      } finally {
        if (actif) setChargement(false);
      }
    })();
    return () => {
      actif = false;
    };
  }, [telephone]);

  function basculer(cle: "villes_exclues" | "types_masques", valeur: string) {
    setSauvegarde("repos");
    setPrefs((prev) => ({
      ...prev,
      [cle]: prev[cle].includes(valeur)
        ? prev[cle].filter((v) => v !== valeur)
        : [...prev[cle], valeur],
    }));
  }

  async function handleSauver(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSauvegarde("pending");
    try {
      const res = await fetch(`/api/v1/profils/${telephone}/preferences`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          villes_exclues: prefs.villes_exclues,
          types_masques: prefs.types_masques,
          seuil_pertinence: prefs.seuil_pertinence,
        }),
      });
      if (!res.ok) throw new Error();
      setSauvegarde("ok");
    } catch {
      setSauvegarde("erreur");
    }
  }

  async function handleCopierLien() {
    const lien = `${window.location.origin}/profil/${telephone}`;
    try {
      await navigator.clipboard.writeText(lien);
      setCopie(true);
      setTimeout(() => setCopie(false), 3000);
    } catch {
      window.prompt("Copie le lien de ton profil :", lien);
    }
  }

  async function handleDesinscrire() {
    const confirme = window.confirm(
      "Vraiment te désinscrire ? Tu ne recevras plus aucune offre sur WhatsApp."
    );
    if (!confirme) return;
    setDesinscriptionEnCours(true);
    try {
      const res = await fetch(`/api/v1/profils/${telephone}/desinscription`, { method: "POST" });
      if (!res.ok) throw new Error();
      router.push("/");
    } catch {
      setDesinscriptionEnCours(false);
      setSauvegarde("erreur");
    }
  }

  if (chargement) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4">
        <div
          aria-hidden="true"
          className="h-10 w-10 animate-spin rounded-full border-2 border-signature border-t-transparent"
        />
        <p className="text-sm text-muted-foreground">Chargement des paramètres...</p>
      </div>
    );
  }

  if (erreur || !profil) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-[0_1px_3px_rgba(10,10,10,0.04)]">
          <p className="mb-4 font-medium text-destructive">{erreur || "Profil non trouvé"}</p>
          <Link href="/">
            <Button className="h-11 rounded-lg bg-signature px-6 text-white hover:bg-signature-deep">
              Retour à l&apos;accueil
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* En-tête */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-[-0.02em] text-foreground">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-signature">
              <Settings className="h-4 w-4" />
            </span>
            Paramètres
          </h1>
          <Link
            href={`/profil/${telephone}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-signature transition-colors duration-150 hover:text-signature-deep"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à mon espace
          </Link>
        </div>

        {/* 1. Profil */}
        <section className="mb-4 rounded-lg border border-border bg-card p-6 shadow-[0_1px_3px_rgba(10,10,10,0.04)]">
          <h2 className="mb-1 font-display text-lg font-bold tracking-[-0.01em] text-foreground">
            Profil
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            {profil.prenom} {profil.nom} — mets à jour tes informations quand tu veux.
          </p>
          <Link href={`/profil/${telephone}/edit`}>
            <Button variant="outline" size="sm" className="rounded-lg border-border transition-colors duration-150 hover:border-signature hover:text-signature">
              Modifier mon profil
            </Button>
          </Link>
        </section>

        {/* 2. Préférences avancées */}
        <section className="mb-4 rounded-lg border border-border bg-card p-6 shadow-[0_1px_3px_rgba(10,10,10,0.04)]">
          <h2 className="mb-1 font-display text-lg font-bold tracking-[-0.01em] text-foreground">
            Préférences avancées
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Affine le matching : moins de bruit, que des offres qui te concernent.
          </p>

          <form onSubmit={handleSauver} data-probe="prefs-form" className="space-y-5">
            {/* Villes exclues */}
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-foreground">Villes exclues</legend>
              <div className="flex flex-wrap gap-2">
                {VILLES.map((ville) => (
                  <label
                    key={ville}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors duration-150 hover:border-signature"
                  >
                    <input
                      type="checkbox"
                      checked={prefs.villes_exclues.includes(ville)}
                      onChange={() => basculer("villes_exclues", ville)}
                      data-probe="pref-ville"
                      data-cle={ville}
                      className="h-4 w-4 rounded border-input accent-signature focus:ring-signature/30"
                    />
                    <span className="capitalize">{ville.replace(/_/g, " ")}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Types d'offres à masquer */}
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-foreground">
                Types d&apos;offres à masquer
              </legend>
              <div className="flex flex-wrap gap-2">
                {Object.entries(TYPES_OFFRES).map(([valeur, libelle]) => (
                  <label
                    key={valeur}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors duration-150 hover:border-signature"
                  >
                    <input
                      type="checkbox"
                      checked={prefs.types_masques.includes(valeur)}
                      onChange={() => basculer("types_masques", valeur)}
                      data-probe="pref-type"
                      data-cle={valeur}
                      className="h-4 w-4 rounded border-input accent-signature focus:ring-signature/30"
                    />
                    <span>{libelle}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Seuil de pertinence */}
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <label htmlFor="seuil-pertinence" className="font-semibold text-foreground">
                  Seuil de pertinence minimal
                </label>
                <span className="font-medium text-muted-foreground">{prefs.seuil_pertinence} %</span>
              </div>
              <input
                id="seuil-pertinence"
                type="range"
                min={0}
                max={100}
                step={10}
                value={prefs.seuil_pertinence}
                onChange={(e) => {
                  setSauvegarde("repos");
                  setPrefs((prev) => ({ ...prev, seuil_pertinence: Number(e.target.value) }));
                }}
                data-probe="pref-seuil"
                className="h-2 w-full cursor-pointer accent-signature"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                N&apos;enverra que les offres à partir de ce score de matching.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                disabled={sauvegarde === "pending"}
                className="rounded-lg bg-signature px-5 text-white hover:bg-signature-deep"
              >
                {sauvegarde === "pending" ? "Enregistrement..." : "Enregistrer mes préférences"}
              </Button>
              {sauvegarde === "ok" && (
                <span role="status" className="text-sm font-medium text-green-800">
                  Préférences enregistrées ✅
                </span>
              )}
              {sauvegarde === "erreur" && (
                <span role="status" className="text-sm font-medium text-red-700">
                  Enregistrement impossible — réessaie.
                </span>
              )}
            </div>
          </form>
        </section>

        {/* 3. Parrainage */}
        <section className="mb-4 rounded-lg border border-border bg-card p-6 shadow-[0_1px_3px_rgba(10,10,10,0.04)]">
          <h2 className="mb-1 font-display text-lg font-bold tracking-[-0.01em] text-foreground">
            Parrainage
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Tu connais un camarade qui cherche un stage, une alternance ou un emploi ?
            Invitation sur WhatsApp et partage de ton lien.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={WHATSAPP_PARRAINAGE}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-signature px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-signature-deep"
            >
              <MessageCircle className="h-4 w-4" />
              Recommander à un camarade
            </a>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopierLien}
              data-probe="copier-lien"
              className="rounded-lg border-border transition-colors duration-150 hover:border-signature hover:text-signature"
            >
              {copie ? (
                <>
                  <Check className="mr-2 h-4 w-4 text-signature" />
                  Lien copié !
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copier le lien de mon profil
                </>
              )}
            </Button>
          </div>
        </section>

        {/* 4. Liens utiles */}
        <section className="mb-4 rounded-lg border border-border bg-card p-6 shadow-[0_1px_3px_rgba(10,10,10,0.04)]">
          <h2 className="mb-3 font-display text-lg font-bold tracking-[-0.01em] text-foreground">
            À propos
          </h2>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <li>
              <Link href="/conditions" className="font-medium text-signature transition-colors duration-150 hover:text-signature-deep">
                Conditions d&apos;utilisation
              </Link>
            </li>
            <li>
              <Link href="/confidentialite" className="font-medium text-signature transition-colors duration-150 hover:text-signature-deep">
                Confidentialité
              </Link>
            </li>
            <li>
              <Link href="/mentions" className="font-medium text-signature transition-colors duration-150 hover:text-signature-deep">
                Mentions légales
              </Link>
            </li>
            <li>
              <Link href="/contact" className="font-medium text-signature transition-colors duration-150 hover:text-signature-deep">
                Contact
              </Link>
            </li>
          </ul>
        </section>

        {/* 5. Désinscription (discrète, bouton rouge) */}
        <section className="rounded-lg border border-border bg-card p-6 shadow-[0_1px_3px_rgba(10,10,10,0.04)]">
          <h2 className="mb-1 font-display text-lg font-bold tracking-[-0.01em] text-foreground">
            Désinscription
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Désactive ton profil : tu ne recevras plus aucune offre sur WhatsApp.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDesinscrire}
            disabled={desinscriptionEnCours}
            data-probe="desinscription"
            className="rounded-lg border-destructive/40 text-destructive transition-colors duration-150 hover:border-destructive hover:bg-destructive/5 hover:text-destructive"
          >
            <UserMinus className="mr-2 h-4 w-4" />
            {desinscriptionEnCours ? "Désinscription..." : "Se désinscrire définitivement"}
          </Button>
        </section>
      </div>
    </div>
  );
}
