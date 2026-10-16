"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink, FileText, RefreshCw, Trash2, Upload } from "lucide-react";

/** Limite imposée côté client : 5 Mo (le serveur confirme par 413 au-delà). */
const TAILLE_MAX_OCTETS = 5 * 1024 * 1024;
/** Whitelist d'extensions — mêmes valeurs que l'attribut `accept` du input. */
const EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".webp", ".doc", ".docx"];
const ACCEPT = EXTENSIONS.join(",");
const LISTE_FORMATS = "PDF, JPG, PNG, WEBP, DOC, DOCX";

/** Une pièce du coffre-fort — champs optionnels : toute lacune est tolérée. */
type Piece = {
  id: string;
  nom: string;
  taille: number | null;
  mime: string;
  created_at: string;
};

/** Analyse une réponse `{documents}`. Shape inattendu → null (jamais de crash). */
function lireListe(brut: unknown): Piece[] | null {
  if (typeof brut !== "object" || brut === null) return null;
  const documents = (brut as { documents?: unknown }).documents;
  if (!Array.isArray(documents)) return null;
  const liste: Piece[] = [];
  for (const item of documents) {
    if (typeof item !== "object" || item === null) continue;
    const champ = item as Record<string, unknown>;
    if (champ.id === undefined || champ.id === null) continue;
    liste.push({
      id: String(champ.id),
      nom:
        typeof champ.nom === "string" && champ.nom.trim()
          ? champ.nom.trim()
          : "Document sans nom",
      taille:
        typeof champ.taille === "number" && Number.isFinite(champ.taille) && champ.taille >= 0
          ? champ.taille
          : null,
      mime: typeof champ.mime === "string" ? champ.mime : "",
      created_at: typeof champ.created_at === "string" ? champ.created_at : "",
    });
  }
  return liste;
}

/** URL signée d'une réponse `{url}`. Shape inattendu → null (jamais de crash). */
function lireUrl(brut: unknown): string | null {
  if (typeof brut !== "object" || brut === null) return null;
  const url = (brut as { url?: unknown }).url;
  return typeof url === "string" && url.trim() ? url.trim() : null;
}

/** Poids lisible en français (o / Ko / Mo), virgule décimale. */
function lirePoids(octets: number | null): string {
  if (octets === null || !Number.isFinite(octets) || octets < 0) return "Poids inconnu";
  if (octets < 1024) return `${Math.round(octets)} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

/** Date de dépôt (fr-FR). Chaîne absente ou invalide → "" (champ simplement omis). */
function lireDate(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(
    date
  );
}

/** Extension basse casse ("" si pas de point). */
function extension(nom: string): string {
  const point = nom.lastIndexOf(".");
  return point > 0 ? nom.slice(point).toLowerCase() : "";
}

/** Messages français associés aux codes d'erreur du contrat API. */
function messageServeur(status: number): string | null {
  if (status === 401 || status === 403) {
    return "Session expirée — reconnecte-toi pour accéder à ton coffre-fort.";
  }
  if (status === 413) {
    return "Fichier trop volumineux ou quota de stockage atteint — choisis un fichier plus léger ou supprime un document.";
  }
  if (status === 415) {
    return `Type de fichier refusé par le serveur — formats acceptés : ${LISTE_FORMATS}.`;
  }
  return null;
}

/**
 * Coffre-fort de documents de l'espace étudiant.
 *
 * Contrat : GET/POST `/api/v1/profils/{tel}/documents` (FormData `fichier`),
 * DELETE `.../{id}` et GET `.../{id}/url` (URL signée 60 s) — le middleware Next
 * injecte déjà le Bearer (cookie de session), on n'attache rien nous-mêmes.
 * Après chaque mutation, la liste est reprise dans la réponse `{documents}`
 * (repli : re-GET si shape inattendue).
 */
export function CoffreDocuments({ telephone }: { telephone: string }) {
  const [documents, setDocuments] = useState<Piece[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [fichierChoisi, setFichierChoisi] = useState<File | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [aSupprimer, setASupprimer] = useState<string | null>(null);
  const [suppression, setSuppression] = useState<string | null>(null);
  const [ouverture, setOuverture] = useState<string | null>(null);
  const ignore = useRef(false);

  // Drapeau anti-appel en retard après navigation (réinitialisé à chaque montée :
  // React StrictMode monte/démonte en dev, l'état ne doit pas rester bloqué).
  useEffect(() => {
    ignore.current = false;
    return () => {
      ignore.current = true;
    };
  }, []);

  /** GET la liste. Échec réseau / JSON / shape → état d'erreur + Réessayer. */
  const charger = useCallback(async () => {
    setChargement(true);
    setErreur("");
    try {
      const res = await fetch(`/api/v1/profils/${telephone}/documents`);
      if (!res.ok) {
        setErreur(
          messageServeur(res.status) ?? "Impossible de charger tes documents. Réessaie plus tard."
        );
        return;
      }
      const liste = lireListe(await res.json());
      if (!liste) throw new Error("reponse inattendue");
      if (ignore.current) return;
      setDocuments(liste);
    } catch {
      if (ignore.current) return;
      setErreur("Impossible de charger tes documents — vérifie ta connexion.");
    } finally {
      if (!ignore.current) setChargement(false);
    }
  }, [telephone]);

  useEffect(() => {
    charger();
  }, [charger]);

  /** Prend la liste d'une réponse 200 ; false = corps illisible/shape inattendu
   * → l'appelant se replie sur un re-GET (aucune exception propagée). */
  async function appliquerReponse(res: Response): Promise<boolean> {
    try {
      const liste = lireListe(await res.json());
      if (!liste) return false;
      setDocuments(liste);
      setErreur("");
      return true;
    } catch {
      return false;
    }
  }

  /** Étape 1 — le fichier est choisi : contrôle poids + extension, AUCUN envoi. */
  function handleChoisir(e: ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0] ?? null;
    e.target.value = ""; // on peut re-sélectionner le même fichier après un refus
    setFichierChoisi(null);
    setMessage(null);
    if (!fichier) return;

    const ext = extension(fichier.name);
    if (!EXTENSIONS.includes(ext)) {
      setMessage({
        ok: false,
        texte: `Format « ${ext || "inconnu"} » refusé — formats acceptés : ${LISTE_FORMATS}.`,
      });
      return;
    }
    if (fichier.size > TAILLE_MAX_OCTETS) {
      setMessage({
        ok: false,
        texte: `« ${fichier.name} » pèse ${lirePoids(fichier.size)} — la limite est de 5 Mo.`,
      });
      return;
    }
    setFichierChoisi(fichier);
  }

  /** Étape 2 — POST FormData `fichier`, puis liste reprise de la réponse. */
  async function handleDeposer() {
    const fichier = fichierChoisi;
    if (!fichier || envoi) return;
    setEnvoi(true);
    setMessage(null);
    try {
      const corps = new FormData();
      corps.append("fichier", fichier);
      const res = await fetch(`/api/v1/profils/${telephone}/documents`, {
        method: "POST",
        body: corps,
      });
      if (!res.ok) {
        setMessage({
          ok: false,
          texte:
            messageServeur(res.status) ??
            "Envoi impossible — vérifie ta connexion et réessaie.",
        });
        return;
      }
      if (!(await appliquerReponse(res))) await charger();
      setFichierChoisi(null);
      setMessage({ ok: true, texte: `« ${fichier.name} » déposé dans ton coffre-fort ✅` });
    } catch {
      setMessage({ ok: false, texte: "Envoi impossible — vérifie ta connexion et réessaie." });
    } finally {
      setEnvoi(false);
    }
  }

  /** Suppression optimiste : retrait immédiat, retour arrière si le serveur refuse. */
  async function handleSupprimer(piece: Piece) {
    if (suppression) return;
    const avant = documents;
    setASupprimer(null);
    setSuppression(piece.id);
    setDocuments((prev) => prev.filter((d) => d.id !== piece.id));
    setMessage(null);
    try {
      const res = await fetch(
        `/api/v1/profils/${telephone}/documents/${encodeURIComponent(piece.id)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        setDocuments(avant); // retour arrière
        setMessage({
          ok: false,
          texte:
            messageServeur(res.status) ??
            "Suppression impossible — réessaie.",
        });
        return;
      }
      // Liste reprise de la réponse ; shape inattendue → re-GET de resynchronisation
      if (!(await appliquerReponse(res))) await charger();
      setMessage({ ok: true, texte: `« ${piece.nom} » supprimé.` });
    } catch {
      setDocuments(avant); // retour arrière
      setMessage({ ok: false, texte: "Suppression impossible — vérifie ta connexion." });
    } finally {
      setSuppression(null);
    }
  }

  /**
   * Demande une URL SIGNÉE (60 s) au serveur, puis l'ouvre dans un nouvel onglet.
   * La fenêtre est créée DANS le geste utilisateur (sinon le bloqueur de pop-up
   * l'empêche) ; elle est refermée si le serveur refuse. Le chemin Storage
   * n'est jamais exposé : on ne manipule que l'URL signée renvoyée.
   */
  async function handleOuvrir(piece: Piece) {
    if (ouverture) return;
    setOuverture(piece.id);
    setMessage(null);
    const fenetre = typeof window !== "undefined" ? window.open("", "_blank") : null;
    try {
      const res = await fetch(
        `/api/v1/profils/${telephone}/documents/${encodeURIComponent(piece.id)}/url`
      );
      const url = res.ok ? lireUrl(await res.json()) : null;
      if (!url) {
        fenetre?.close();
        setMessage({
          ok: false,
          texte:
            messageServeur(res.status) ??
            "Impossible d'ouvrir ce document — réessaie dans un instant.",
        });
        return;
      }
      if (fenetre) {
        fenetre.opener = null; // pas de lien retour vers l'app
        fenetre.location.href = url;
      } else {
        // Pop-up refusée : repli sur un lien cliqué (même comportement visible).
        const lien = document.createElement("a");
        lien.href = url;
        lien.target = "_blank";
        lien.rel = "noopener noreferrer";
        lien.click();
      }
    } catch {
      fenetre?.close();
      setMessage({ ok: false, texte: "Impossible d'ouvrir ce document — vérifie ta connexion." });
    } finally {
      setOuverture(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Dépôt : input file + contrôles client AVANT tout envoi */}
      <section
        data-probe="coffre-depot"
        className="rounded-lg border border-border bg-card p-6 shadow-[0_1px_3px_rgba(10,10,10,0.04)]"
      >
        <h2 className="mb-1 font-display text-lg font-bold tracking-[-0.01em] text-foreground">
          Déposer un document
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          CV, relevé de notes, lettre de motivation, passeport… {LISTE_FORMATS} — 5 Mo maximum.
        </p>

        {message && (
          <div
            role="status"
            data-probe="coffre-message"
            className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${
              message.ok
                ? "border border-green-200 bg-green-50 text-green-800"
                : "border border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {message.texte}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <input
            id="coffre-fichier"
            type="file"
            accept={ACCEPT}
            onChange={handleChoisir}
            disabled={envoi}
            data-probe="coffre-input"
            aria-label="Choisir un document à déposer dans mon coffre-fort"
            aria-describedby="coffre-aide"
            className="peer sr-only"
          />
          <label
            htmlFor="coffre-fichier"
            className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg bg-signature px-5 text-sm font-medium text-white transition-colors duration-150 hover:bg-signature-deep peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-signature/60 peer-disabled:cursor-not-allowed peer-disabled:opacity-60"
          >
            <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
            Choisir un fichier
          </label>

          {fichierChoisi && (
            <span className="min-w-0 truncate text-sm text-foreground">
              {fichierChoisi.name}
              <span className="text-muted-foreground"> ({lirePoids(fichierChoisi.size)})</span>
            </span>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={handleDeposer}
            disabled={!fichierChoisi || envoi}
            data-probe="coffre-deposer"
            className="h-10 rounded-lg border-border px-5 transition-colors duration-150 hover:border-signature hover:text-signature"
          >
            {envoi ? "Dépôt en cours..." : "Déposer ce document"}
          </Button>
        </div>
        <p id="coffre-aide" className="mt-2 text-xs text-muted-foreground">
          Poids et format vérifiés avant l&apos;envoi : rien ne part si le fichier ne convient pas.
        </p>
      </section>

      {/* Liste des documents */}
      <section
        data-probe="coffre-liste"
        className="rounded-lg border border-border bg-card p-6 shadow-[0_1px_3px_rgba(10,10,10,0.04)]"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold tracking-[-0.01em] text-foreground">
            Mes documents{documents.length > 0 ? ` (${documents.length})` : ""}
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={charger}
            disabled={chargement}
            aria-label="Rafraîchir la liste de mes documents"
            className="rounded-lg border-border transition-colors duration-150 hover:border-signature hover:text-signature"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${chargement ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            Actualiser
          </Button>
        </div>

        {/* État 1 — erreur réseau : message + Réessayer */}
        {erreur ? (
          <div className="rounded-lg border border-dashed border-border bg-background px-4 py-10 text-center">
            <p className="mb-3 text-sm font-medium text-destructive">{erreur}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={charger}
              data-probe="coffre-reessayer"
              className="rounded-lg border-border transition-colors duration-150 hover:border-signature hover:text-signature"
            >
              Réessayer
            </Button>
          </div>
        ) : chargement && documents.length === 0 ? (
          /* État 2 — chargement : spinner de charte */
          <div className="flex flex-col items-center gap-4 py-10" role="status">
            <div
              aria-hidden="true"
              className="h-10 w-10 animate-spin rounded-full border-2 border-signature border-t-transparent"
            />
            <p className="text-sm text-muted-foreground">Chargement de tes documents...</p>
          </div>
        ) : documents.length === 0 ? (
          /* État 3 — vide */
          <div
            data-probe="coffre-vide"
            className="rounded-lg border border-dashed border-border bg-background px-4 py-10 text-center"
          >
            <p className="text-muted-foreground">
              Aucun document — dépose ton CV, tes relevés de notes ou une lettre de motivation pour
              candidater plus vite.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {documents.map((piece) => {
              const date = lireDate(piece.created_at);
              return (
                <li
                  key={piece.id}
                  data-probe="coffre-doc"
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-signature"
                    >
                      <FileText className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground" title={piece.nom}>
                        {piece.nom}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {lirePoids(piece.taille)}
                        {date ? ` · Déposé le ${date}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {aSupprimer === piece.id ? (
                      /* Confirmation inline : « Supprimer ce document ? Oui / Annuler » */
                      <span
                        className="flex flex-wrap items-center gap-2 text-sm"
                        role="group"
                        aria-label={`Confirmer la suppression de ${piece.nom}`}
                      >
                        <span className="text-foreground">Supprimer ce document ?</span>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleSupprimer(piece)}
                          disabled={suppression === piece.id}
                          data-probe="coffre-confirmer"
                          className="rounded-lg bg-destructive px-4 text-white transition-opacity duration-150 hover:opacity-90"
                        >
                          {suppression === piece.id ? "Suppression..." : "Oui"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setASupprimer(null)}
                          className="rounded-lg border-border transition-colors duration-150 hover:border-signature hover:text-signature"
                        >
                          Annuler
                        </Button>
                      </span>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleOuvrir(piece)}
                          disabled={ouverture === piece.id}
                          aria-label={`Ouvrir le document ${piece.nom}`}
                          data-probe="coffre-ouvrir"
                          className="rounded-lg border-border transition-colors duration-150 hover:border-signature hover:text-signature"
                        >
                          <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
                          {ouverture === piece.id ? "Ouverture..." : "Ouvrir"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setASupprimer(piece.id)}
                          aria-label={`Supprimer le document ${piece.nom}`}
                          data-probe="coffre-supprimer"
                          className="rounded-lg border-destructive/40 text-destructive transition-colors duration-150 hover:border-destructive hover:bg-destructive/5 hover:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                          Supprimer
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
