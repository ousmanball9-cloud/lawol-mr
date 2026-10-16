"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Save, Settings } from "lucide-react";

/**
 * Page admin « Paramètres » — édition des 4 réglages PUBLICS du site.
 *
 * Contrat consommé (figé) :
 *   · GET /api/v1/parametres        → objet plat {cle: valeur} (clés publiques),
 *   · PUT /api/v1/admin/parametres  → {cle, valeur} → {cle, valeur, modifie_le}.
 *
 * Les proxys Next correspondants vivent dans app/api/v1/ (le PUT admin est
 * gardé : le proxy relaie le cookie `lawol_admin` vers l'API).
 */

type Reglages = {
  support_whatsapp: string;
  email_contact: string;
  reseaux: string;
  mode_maintenance: boolean;
};

const DEFAUT: Reglages = {
  support_whatsapp: "",
  email_contact: "",
  reseaux: "",
  mode_maintenance: false,
};

/** Valeur JSON quelconque → texte affichable (jamais « [object Object] »). */
function texte(valeur: unknown): string {
  if (typeof valeur === "string") return valeur;
  if (valeur == null) return "";
  if (typeof valeur === "number" || typeof valeur === "boolean") return String(valeur);
  return JSON.stringify(valeur);
}

/** Valeur JSON quelconque → texte multi-lignes (tableau de réseaux → 1 par ligne). */
function texteLignes(valeur: unknown): string {
  if (Array.isArray(valeur)) return valeur.map((v) => texte(v)).join("\n");
  return texte(valeur);
}

/** Valeur JSON quelconque → booléen (tolère "true"/"1" venus d'un jsonb texte). */
function booleen(valeur: unknown): boolean {
  if (typeof valeur === "boolean") return valeur;
  if (typeof valeur === "string") return valeur === "true" || valeur === "1";
  return false;
}

function depuisReponse(data: Record<string, unknown> | null): Reglages {
  if (!data) return DEFAUT;
  return {
    support_whatsapp: texte(data.support_whatsapp),
    email_contact: texte(data.email_contact),
    reseaux: texteLignes(data.reseaux),
    mode_maintenance: booleen(data.mode_maintenance),
  };
}

/** Forme stockée (jsonb) d'un réglage : réseaux = tableau de lignes non vides. */
function valeurAEnregistrer(reglages: Reglages, cle: keyof Reglages): unknown {
  if (cle === "mode_maintenance") return reglages.mode_maintenance;
  if (cle === "reseaux") {
    return reglages.reseaux
      .split("\n")
      .map((ligne) => ligne.trim())
      .filter(Boolean);
  }
  return reglages[cle].trim();
}

const CHAMP =
  "block w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-ink placeholder:text-muted-foreground focus:border-signature focus:outline-none focus:ring-4 focus:ring-signature/20";
const LABEL = "mb-1.5 block text-sm font-medium text-ink";

export default function AdminParametresPage() {
  const [reglages, setReglages] = useState<Reglages>(DEFAUT);
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const [dernierEnregistrement, setDernierEnregistrement] = useState("");

  const charger = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/parametres", { cache: "no-store" });
      if (!res.ok) throw new Error("lecture impossible");
      const data = (await res.json()) as Record<string, unknown>;
      setReglages(depuisReponse(data));
    } catch {
      // Dégradation douce : le formulaire reste éditable avec ses valeurs par
      // défaut ; l'API renverra `{}` tant que la table est vide.
      setReglages(DEFAUT);
      setErreur("Réglages indisponibles : affichage des valeurs par défaut.");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setEnregistrement(true);
    setMessage("");
    setErreur("");

    const cles: (keyof Reglages)[] = [
      "support_whatsapp",
      "email_contact",
      "reseaux",
      "mode_maintenance",
    ];

    try {
      for (const cle of cles) {
        const res = await fetch("/api/v1/admin/parametres", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cle, valeur: valeurAEnregistrer(reglages, cle) }),
        });
        if (!res.ok) {
          throw new Error(
            res.status === 401 || res.status === 403
              ? "Session administrateur expirée — reconnecte-toi."
              : `Enregistrement refusé pour « ${cle} » (${res.status}).`
          );
        }
      }
      setMessage("Réglages enregistrés.");
      setDernierEnregistrement(new Date().toLocaleTimeString("fr-FR"));
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <div>
      {/* En-tête de page (même gabarit que les autres écrans admin) */}
      <div className="p-4 bg-white border-b border-gray-200 sm:flex sm:items-center sm:justify-between lg:mt-1.5">
        <div className="w-full mb-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-ink sm:text-2xl">
            <Settings className="h-6 w-6 text-signature" aria-hidden="true" />
            Paramètres
          </h1>
          <p className="mt-1 text-sm font-normal text-muted-foreground">
            Réglages publics du site (contact, réseaux, maintenance)
          </p>
        </div>
      </div>

      <div className="p-4">
        {chargement && (
          <div
            data-probe="param-chargement"
            className="flex items-center gap-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground shadow-sm sm:p-6"
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Chargement des réglages…
          </div>
        )}

        {!chargement && (
          <form
            data-probe="admin-parametres-form"
            onSubmit={enregistrer}
            className="max-w-2xl space-y-5 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6"
          >
            <div>
              <label htmlFor="param-support-whatsapp" className={LABEL}>
                Numéro WhatsApp du support
              </label>
              <input
                id="param-support-whatsapp"
                data-probe="param-support_whatsapp"
                type="text"
                inputMode="tel"
                value={reglages.support_whatsapp}
                onChange={(e) =>
                  setReglages((r) => ({ ...r, support_whatsapp: e.target.value }))
                }
                placeholder="222XXXXXXXX"
                className={CHAMP}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Chiffres uniquement, indicatif compris. Laissé vide, le CTA WhatsApp
                se replie sur <code className="text-ink">lib/contact.ts</code> (source
                unique de secours) — aucun numéro n&apos;est inventé.
              </p>
            </div>

            <div>
              <label htmlFor="param-email-contact" className={LABEL}>
                E-mail de contact
              </label>
              <input
                id="param-email-contact"
                data-probe="param-email_contact"
                type="email"
                value={reglages.email_contact}
                onChange={(e) =>
                  setReglages((r) => ({ ...r, email_contact: e.target.value }))
                }
                placeholder="contact@exemple.mr"
                className={CHAMP}
              />
            </div>

            <div>
              <label htmlFor="param-reseaux" className={LABEL}>
                Réseaux sociaux
              </label>
              <textarea
                id="param-reseaux"
                data-probe="param-reseaux"
                rows={4}
                value={reglages.reseaux}
                onChange={(e) => setReglages((r) => ({ ...r, reseaux: e.target.value }))}
                placeholder={"https://facebook.com/…\nhttps://instagram.com/…"}
                className={CHAMP}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Une adresse par ligne.
              </p>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
              <input
                id="param-mode-maintenance"
                data-probe="param-mode_maintenance"
                type="checkbox"
                checked={reglages.mode_maintenance}
                onChange={(e) =>
                  setReglages((r) => ({ ...r, mode_maintenance: e.target.checked }))
                }
                className="mt-0.5 h-4 w-4 rounded border-border text-signature focus:ring-4 focus:ring-signature/20"
              />
              <div>
                <label htmlFor="param-mode-maintenance" className="text-sm font-medium text-ink">
                  Mode maintenance
                </label>
                <p className="text-xs text-muted-foreground">
                  Signale le site comme en maintenance pour les écrans qui consultent
                  ce réglage.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <button
                type="submit"
                data-probe="param-enregistrer"
                disabled={enregistrement}
                className="inline-flex items-center gap-2 rounded-lg bg-signature px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-signature-deep focus:outline-none focus:ring-4 focus:ring-signature/20 disabled:opacity-50"
              >
                {enregistrement ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="h-4 w-4" aria-hidden="true" />
                )}
                {enregistrement ? "Enregistrement…" : "Enregistrer"}
              </button>

              {dernierEnregistrement && !message && (
                <span className="text-xs text-muted-foreground">
                  Dernier enregistrement : {dernierEnregistrement}
                </span>
              )}
            </div>

            {/* Retour d'état — clairement annoncé aux lecteurs d'écran */}
            {message && (
              <p
                data-probe="param-statut"
                role="status"
                className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                {message}
                {dernierEnregistrement && ` (à ${dernierEnregistrement})`}
              </p>
            )}
            {erreur && (
              <p
                data-probe="param-erreur"
                role="alert"
                className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600"
              >
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                {erreur}
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
