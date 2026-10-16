"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { STATUTS } from "@/components/offre-detail-modal";
import { telephoneSession } from "@/lib/session";

/** Match du profil rattaché à l'offre affichée (forme réduite de l'API matches). */
type MatchSuivi = {
  id: string;
  postule: boolean;
  statut_candidature: string | null;
};

type EtatSuivi = "verif" | "anonyme" | "sans_match" | "connecte";

/** Id de l'offre d'un match, que `offre` soit un objet ou un tableau (Supabase). */
function idOffreDuMatch(match: unknown): string | null {
  if (typeof match !== "object" || match === null) return null;
  const offre = (match as { offre?: unknown }).offre;
  const premier = Array.isArray(offre) ? offre[0] : offre;
  if (typeof premier !== "object" || premier === null) return null;
  const id = (premier as { id?: unknown }).id;
  return typeof id === "string" && id ? id : null;
}

/** Match de cette offre dans la réponse de /profils/{tel}/historique, sinon null. */
function lireMatch(brut: unknown, offreId: string): MatchSuivi | null {
  if (!Array.isArray(brut)) return null;
  for (const ligne of brut) {
    if (idOffreDuMatch(ligne) !== offreId) continue;
    if (typeof ligne !== "object" || ligne === null) continue;
    const champs = ligne as Record<string, unknown>;
    const id = champs.id;
    if (typeof id !== "string" || !id) continue;
    return {
      id,
      postule: champs.postule === true,
      statut_candidature:
        typeof champs.statut_candidature === "string" && champs.statut_candidature
          ? champs.statut_candidature
          : null,
    };
  }
  return null;
}

/**
 * Libellé du statut courant. Match sans statut renseigné : « À préparer » tant
 * que la candidature n'est pas déposée, « Postulé » ensuite (pipeline backend).
 */
export function libelleStatut(match: MatchSuivi): string {
  const cle = match.statut_candidature;
  if (cle && STATUTS[cle]) return STATUTS[cle];
  return match.postule ? "Postulé" : "À préparer";
}

/**
 * Suivi de candidature de la fiche bourse.
 *
 * Connecté avec un match sur cette offre → statut courant + « J'ai postulé »
 * + changement de statut, via les proxys EXISTANTS
 * (`/api/v1/matches/{id}/postule`, `/api/v1/matches/{id}/statut`) — les mêmes
 * que l'espace profil, aucune logique dupliquée côté API.
 * Sinon → invitation à se connecter ; connecté sans match → renvoi vers l'espace.
 */
export function SuiviCandidature({ offreId }: { offreId: string }) {
  const [etat, setEtat] = useState<EtatSuivi>("verif");
  const [telephone, setTelephone] = useState<string | null>(null);
  const [match, setMatch] = useState<MatchSuivi | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);

  useEffect(() => {
    let annule = false;
    const tel = telephoneSession();
    if (!tel) {
      setEtat("anonyme");
      return;
    }
    setTelephone(tel);

    (async () => {
      try {
        const res = await fetch(`/api/v1/profils/${encodeURIComponent(tel)}/historique`);
        if (annule) return;
        // Session refusée côté API → on retombe sur l'invitation à se connecter.
        if (res.status === 401 || res.status === 403 || res.status === 404) {
          setEtat("anonyme");
          return;
        }
        if (!res.ok) throw new Error();
        const trouve = lireMatch(await res.json(), offreId);
        if (annule) return;
        setMatch(trouve);
        setEtat(trouve ? "connecte" : "sans_match");
      } catch {
        if (!annule) setEtat("anonyme");
      }
    })();

    return () => {
      annule = true;
    };
  }, [offreId]);

  // POST /api/v1/matches/{id}/postule (proxy existant) — même transition que l'API
  const postuler = useCallback(async () => {
    if (!match || enCours) return;
    setEnCours(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/matches/${match.id}/postule`, { method: "POST" });
      if (!res.ok) throw new Error();
      setMatch((m) =>
        m
          ? {
              ...m,
              postule: true,
              statut_candidature:
                m.statut_candidature === "a_preparer" ? "postule" : m.statut_candidature,
            }
          : m
      );
      setMessage({ ok: true, texte: "Candidature enregistrée, bonne chance !" });
    } catch {
      setMessage({ ok: false, texte: "Impossible d'enregistrer ta candidature. Réessaie." });
    } finally {
      setEnCours(false);
    }
  }, [match, enCours]);

  // PATCH /api/v1/matches/{id}/statut (proxy existant) — retour arrière si échec
  const changerStatut = useCallback(
    async (statut: string) => {
      if (!match || enCours) return;
      const avant = match.statut_candidature;
      const valeur = statut || null;
      setEnCours(true);
      setMessage(null);
      setMatch((m) => (m ? { ...m, statut_candidature: valeur } : m));
      try {
        const res = await fetch(`/api/v1/matches/${match.id}/statut`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ statut: valeur }),
        });
        if (!res.ok) throw new Error();
      } catch {
        setMatch((m) => (m ? { ...m, statut_candidature: avant } : m));
        setMessage({ ok: false, texte: "Statut en cours d'activation — réessaie plus tard." });
      } finally {
        setEnCours(false);
      }
    },
    [match, enCours]
  );

  return (
    <section
      data-probe="detail-suivi"
      className="mt-4 rounded-lg border border-border bg-card px-4 py-4 shadow-[0_1px_3px_rgba(10,10,10,0.04)]"
    >
      <h2 className="eyebrow mb-3 text-muted-foreground">Ma candidature</h2>

      {etat === "verif" && (
        <p className="text-sm text-muted-foreground">Vérification de ton suivi…</p>
      )}

      {etat === "anonyme" && (
        <div data-probe="detail-suivi-anonyme">
          <p className="text-sm leading-relaxed text-foreground">
            Connecte-toi pour suivre cette candidature : « J&apos;ai postulé », entretien,
            réponse…
          </p>
          <Link
            href="/connexion"
            className="mt-3 inline-flex h-11 items-center rounded-lg bg-signature px-6 text-sm font-semibold text-white transition-colors duration-150 hover:bg-signature-deep"
          >
            Se connecter
          </Link>
        </div>
      )}

      {etat === "sans_match" && (
        <div data-probe="detail-suivi-sans-match">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Cette offre n&apos;est pas (encore) dans tes matchs. Complète ton profil pour la
            recevoir dans ton espace.
          </p>
          {telephone && (
            <Link
              href={`/profil/${telephone}`}
              className="mt-3 inline-flex h-11 items-center rounded-lg border border-border bg-background px-6 text-sm font-medium text-foreground transition-colors duration-150 hover:border-signature hover:text-signature"
            >
              Mon espace
            </Link>
          )}
        </div>
      )}

      {etat === "connecte" && match && (
        <div className="flex flex-col gap-3">
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            Statut :
            <span
              data-probe="detail-suivi-statut"
              className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-foreground"
            >
              {libelleStatut(match)}
            </span>
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={postuler}
              disabled={match.postule || enCours}
              data-probe="detail-suivi-postule"
              data-actif={match.postule ? "true" : "false"}
              className="h-11 rounded-lg bg-signature px-6 text-white hover:bg-signature-deep"
            >
              <CheckCircle className="mr-2 h-4 w-4" aria-hidden="true" />
              {match.postule ? "Postulé" : "J'ai postulé"}
            </Button>

            {match.postule && (
              <select
                value={match.statut_candidature ?? "postule"}
                onChange={(e) => changerStatut(e.target.value)}
                disabled={enCours}
                aria-label="Statut de candidature"
                data-probe="detail-suivi-select"
                className="rounded-lg border border-input bg-white px-3 py-2 text-sm text-foreground transition-colors duration-150 focus:border-signature focus:outline-none focus:ring-2 focus:ring-signature/30"
              >
                {Object.entries(STATUTS).map(([valeur, libelle]) => (
                  <option key={valeur} value={valeur}>
                    {libelle}
                  </option>
                ))}
              </select>
            )}
          </div>

          {message && (
            <p
              data-probe="detail-suivi-message"
              role="status"
              className={`text-sm font-medium ${message.ok ? "text-signature" : "text-destructive"}`}
            >
              {message.texte}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
