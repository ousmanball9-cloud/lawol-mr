"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Download, FileText, FolderLock, RefreshCw } from "lucide-react";
import { telephoneSession } from "@/lib/session";

/**
 * Pièces USUELLES d'un dossier de candidature — liste GÉNÉRIQUE et indicative.
 *
 * Elle ne décrit AUCUNE exigence de la bourse affichée : les pièces réellement
 * demandées figurent dans l'annonce officielle (section « Source & postuler »).
 * Aucune pièce n'est jamais présentée comme obligatoire pour cette offre.
 */
const PIECES_USUELLES = [
  "CV à jour (1 à 2 pages)",
  "Lettre de motivation adaptée à la bourse",
  "Relevés de notes et dernier diplôme",
  "Passeport ou pièce d'identité valide",
  "Attestation d'inscription ou de situation",
  "Certificat de langue, si l'annonce l'exige",
  "Traductions certifiées si les pièces ne sont pas en français ou en anglais",
];

/** Une pièce disponible dans le coffre-fort (champs tolérants). */
type Piece = { id: string; nom: string };

/** Réponse de POST /api/v1/candidatures/{offre}/dossier. */
type DossierPret = {
  statut: string;
  url: string;
  expire_dans: number;
  pieces: string[];
};

/** Liste `{documents}` de l'API → pièces affichables (shape inattendu → null). */
function lirePieces(brut: unknown): Piece[] | null {
  if (typeof brut !== "object" || brut === null) return null;
  const documents = (brut as { documents?: unknown }).documents;
  if (!Array.isArray(documents)) return null;
  const pieces: Piece[] = [];
  for (const item of documents) {
    if (typeof item !== "object" || item === null) continue;
    const champ = item as Record<string, unknown>;
    if (champ.id === undefined || champ.id === null) continue;
    pieces.push({
      id: String(champ.id),
      nom:
        typeof champ.nom === "string" && champ.nom.trim()
          ? champ.nom.trim()
          : "Pièce sans nom",
    });
  }
  return pieces;
}

/** Réponse de génération → dossier prêt (shape inattendu → null). */
function lireDossier(brut: unknown): DossierPret | null {
  if (typeof brut !== "object" || brut === null) return null;
  const champ = brut as Record<string, unknown>;
  if (champ.statut !== "dossier_pret") return null;
  if (typeof champ.url !== "string" || !champ.url.trim()) return null;
  return {
    statut: "dossier_pret",
    url: champ.url.trim(),
    expire_dans:
      typeof champ.expire_dans === "number" && champ.expire_dans > 0
        ? champ.expire_dans
        : 60,
    pieces: Array.isArray(champ.pieces)
      ? champ.pieces.filter((p): p is string => typeof p === "string")
      : [],
  };
}

/** Message honnête associé à un refus serveur (aucune promesse d'envoi). */
function messageEchec(status: number, detail = ""): string {
  if (status === 401 || status === 403) {
    return "Ta session a expiré — reconnecte-toi pour générer ton dossier.";
  }
  if (status === 404) {
    // `detail: "Not Found"` = la ROUTE n'existe pas (API pas encore déployée).
    // Ne jamais dire « cette offre n'est plus disponible » dans ce cas : c'est
    // faux et l'étudiant croirait que la bourse a disparu (mesuré le 20/10).
    if (/^not found$/i.test(detail.trim())) {
      return "Le service de génération est momentanément indisponible. Réessaie plus tard — aucun email n'a été envoyé.";
    }
    return "Cette offre n'est plus disponible : le dossier ne peut pas être généré.";
  }
  return "Le dossier n'a pas pu être généré. Aucun email n'a été envoyé. Réessaie dans un instant.";
}

/**
 * Bloc « Dossier à préparer » de la fiche bourse.
 *
 * Connecté : cases de sélection des pièces RÉELLEMENT présentes dans le coffre,
 * zone lettre (facultative) et bouton « Générer mon dossier » → un PDF privé
 * est produit côté API puis servi par un lien signé de 60 s. Aucune pièce n'est
 * supprimée, aucun email n'est envoyé (le dépôt officiel reste à faire).
 * Non connecté : liste générique + invitation à se connecter.
 */
export function DossierPieces({ offreId }: { offreId: string }) {
  const [telephone, setTelephone] = useState<string | null>(null);
  const [piecesCoffre, setPiecesCoffre] = useState<Piece[] | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [lettre, setLettre] = useState("");
  const [chargementPieces, setChargementPieces] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [dossier, setDossier] = useState<DossierPret | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);

  // Session lue après montage (le cookie n'existe pas au rendu serveur) :
  // tant qu'elle est inconnue, on propose la connexion — jamais un lien mort.
  useEffect(() => {
    setTelephone(telephoneSession());
  }, []);

  // Coffre-fort du profil connecté : source UNIQUE des cases à cocher.
  useEffect(() => {
    if (!telephone) return;
    let annule = false;
    setChargementPieces(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/v1/profils/${encodeURIComponent(telephone)}/documents`
        );
        if (annule) return;
        if (!res.ok) {
          setPiecesCoffre([]);
          return;
        }
        const liste = lirePieces(await res.json());
        if (annule) return;
        setPiecesCoffre(liste ?? []);
        setSelection((liste ?? []).map((p) => p.id));
      } catch {
        if (!annule) setPiecesCoffre([]);
      } finally {
        if (!annule) setChargementPieces(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [telephone]);

  const basculerPiece = useCallback((id: string) => {
    setSelection((actuelle) =>
      actuelle.includes(id) ? actuelle.filter((p) => p !== id) : [...actuelle, id]
    );
  }, []);

  const generer = useCallback(async () => {
    if (!telephone || enCours) return;
    setEnCours(true);
    setMessage(null);
    try {
      const corps: Record<string, unknown> = { telephone };
      if (lettre.trim()) corps.lettre = lettre.trim();
      // Coffre chargé → la sélection fait foi (même vide) ; coffre indisponible
      // → on omet `pieces` pour laisser le serveur prendre toutes les pièces.
      if (piecesCoffre !== null) corps.pieces = selection;
      const res = await fetch(
        `/api/v1/candidatures/${encodeURIComponent(offreId)}/dossier`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(corps),
        }
      );
      if (!res.ok) {
        let detail = "";
        try {
          const corpsErreur = (await res.json()) as { detail?: unknown };
          detail = typeof corpsErreur?.detail === "string" ? corpsErreur.detail : "";
        } catch {
          // Corps non JSON (proxy Next) : le statut suffit, message générique.
        }
        setMessage({ ok: false, texte: messageEchec(res.status, detail) });
        return;
      }
      const pret = lireDossier(await res.json());
      if (!pret) {
        setMessage({ ok: false, texte: messageEchec(500) });
        return;
      }
      setDossier(pret);
      setMessage({
        ok: true,
        texte: `Dossier prêt (${pret.pieces.length} pièce${
          pret.pieces.length > 1 ? "s" : ""
        }). Télécharge-le maintenant : le lien expire dans ${pret.expire_dans} secondes.`,
      });
    } catch {
      setMessage({ ok: false, texte: messageEchec(0) });
    } finally {
      setEnCours(false);
    }
  }, [telephone, enCours, lettre, piecesCoffre, selection, offreId]);

  const href = telephone ? `/profil/${telephone}/documents` : "/connexion";

  return (
    <section
      data-probe="detail-dossier"
      className="mt-4 rounded-lg border border-border bg-muted/40 px-4 py-3"
    >
      <h2 className="eyebrow mb-3 text-muted-foreground">Dossier à préparer</h2>

      {telephone && (
        <div data-probe="detail-dossier-generateur" className="mb-5">
          <p className="text-sm leading-relaxed text-foreground">
            LAWOL assemble ton dossier en un PDF : page de garde, lettre de motivation
            et pièces de ton coffre-fort. Tu restes seul à déposer la candidature sur
            le site officiel — aucun email n&apos;est envoyé.
          </p>

          <fieldset className="mt-4">
            <legend className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Pièces de mon coffre-fort
            </legend>
            {chargementPieces ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Chargement de ton coffre-fort…
              </p>
            ) : piecesCoffre && piecesCoffre.length > 0 ? (
              <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {piecesCoffre.map((piece) => (
                  <li key={piece.id}>
                    <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        data-probe="detail-dossier-case"
                        checked={selection.includes(piece.id)}
                        onChange={() => basculerPiece(piece.id)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-signature focus:outline-none focus:ring-2 focus:ring-signature/30"
                      />
                      <span className="flex items-start gap-1.5">
                        <FileText
                          className="mt-0.5 h-4 w-4 shrink-0 text-signature"
                          aria-hidden="true"
                        />
                        {piece.nom}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Ton coffre-fort est vide : ajoute d&apos;abord tes pièces, puis reviens
                générer ton dossier.
              </p>
            )}
          </fieldset>

          <div className="mt-4">
            <label
              htmlFor={`lettre-${offreId}`}
              className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
            >
              Lettre de motivation (facultative)
            </label>
            <textarea
              id={`lettre-${offreId}`}
              value={lettre}
              onChange={(e) => setLettre(e.target.value)}
              maxLength={6000}
              rows={4}
              data-probe="detail-dossier-lettre"
              placeholder="Colle ta lettre ici. Sans texte, LAWOL utilise un gabarit honnête, à relire avant envoi."
              className="mt-1.5 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-foreground transition-colors duration-150 placeholder:text-muted-foreground focus:border-signature focus:outline-none focus:ring-2 focus:ring-signature/30"
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={generer}
              disabled={enCours}
              data-probe="detail-dossier-generer"
              className="h-11 rounded-lg bg-signature px-6 text-white hover:bg-signature-deep"
            >
              {dossier ? (
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              ) : (
                <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              {enCours ? "Génération…" : dossier ? "Régénérer mon dossier" : "Générer mon dossier"}
            </Button>

            {dossier && (
              <a
                href={dossier.url}
                target="_blank"
                rel="noopener noreferrer"
                data-probe="detail-dossier-lien"
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-signature/30 bg-signature/5 px-5 text-sm font-semibold text-signature transition-colors duration-150 hover:border-signature hover:text-signature-deep"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Télécharger mon dossier (PDF)
              </a>
            )}
          </div>

          {message && (
            <p
              data-probe="detail-dossier-message"
              role="status"
              className={`mt-3 text-sm font-medium ${
                message.ok ? "text-signature" : "text-destructive"
              }`}
            >
              {message.texte}
            </p>
          )}
        </div>
      )}

      <details className="group">
        <summary className="cursor-pointer text-sm text-muted-foreground">
          Pièces habituellement demandées (liste générique)
        </summary>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Liste générique des pièces habituellement demandées dans un dossier de bourse. Ce
          n&apos;est pas la liste exigée par cette offre : vérifie toujours l&apos;annonce
          officielle.
        </p>
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {PIECES_USUELLES.map((piece) => (
            <li
              key={piece}
              data-probe="detail-piece"
              className="flex items-start gap-2 text-sm text-foreground"
            >
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-signature" aria-hidden="true" />
              {piece}
            </li>
          ))}
        </ul>
      </details>

      <Link
        href={href}
        data-probe="detail-coffre-lien"
        className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-signature transition-colors duration-150 hover:text-signature-deep"
      >
        <FolderLock className="h-4 w-4" aria-hidden="true" />
        {telephone ? "Ouvrir mon coffre-fort de pièces" : "Coffre-fort de pièces (connexion requise)"}
      </Link>
    </section>
  );
}
