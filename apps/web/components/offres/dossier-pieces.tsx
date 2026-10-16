"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, FolderLock } from "lucide-react";
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

/** Bloc « Dossier à préparer » : liste générique + accès au coffre-fort de pièces. */
export function DossierPieces() {
  const [telephone, setTelephone] = useState<string | null>(null);

  // Session lue après montage (le cookie n'existe pas au rendu serveur) :
  // tant qu'elle est inconnue, on propose la connexion — jamais un lien mort.
  useEffect(() => {
    setTelephone(telephoneSession());
  }, []);

  const href = telephone ? `/profil/${telephone}/documents` : "/connexion";

  return (
    <section
      data-probe="detail-dossier"
      className="mt-4 rounded-lg border border-border bg-muted/40 px-4 py-3"
    >
      <h2 className="eyebrow mb-3 text-muted-foreground">Dossier à préparer</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
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
