"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FolderLock } from "lucide-react";
import { sessionValidePour } from "@/lib/session";
import { CoffreDocuments } from "@/components/espace/coffre-documents";

/**
 * Coffre-fort de documents de l'espace étudiant : dépôt (contrôle client puis
 * POST FormData) et consultation/suppression des pièces (CV, relevés, lettres,
 * passeport). Garde session côté client + middleware Next (double filet).
 */
export default function CoffreFortPage() {
  const params = useParams();
  const router = useRouter();
  const telephone = params.telephone as string;

  // Garde session : sans token valide pour CE numéro → /connexion
  // (le middleware fait le même contrôle côté serveur : double filet)
  useEffect(() => {
    if (!sessionValidePour(telephone)) {
      router.replace("/connexion");
    }
  }, [telephone, router]);

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div data-probe="coffre-conteneur" className="mx-auto max-w-2xl lg:max-w-4xl">
        {/* En-tête */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-[-0.02em] text-foreground">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-signature">
              <FolderLock className="h-4 w-4" aria-hidden="true" />
            </span>
            Mon coffre-fort
          </h1>
          <Link
            href={`/profil/${telephone}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-signature transition-colors duration-150 hover:text-signature-deep"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Retour à mon espace
          </Link>
        </div>

        <CoffreDocuments telephone={telephone} />
      </div>
    </div>
  );
}
