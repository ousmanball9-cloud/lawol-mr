"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { Chrome } from "@/components/chrome/chrome";
import { Button } from "@/components/ui/button";

/**
 * Frontière d'erreur des routes — rendue DANS le chrome.
 *
 * Client Component obligatoire (React exige une frontière cliente) : le
 * bouton « Réessayer » appelle `reset()`, qui re-rend le segment fautif sans
 * recharger la page ni perdre la navigation. Le message reste générique : le
 * détail technique part en console, jamais à l'écran (pas de fuite de stack).
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Chrome>
      <main className="flex min-h-[70vh] items-center justify-center bg-background px-4 py-16">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-signature/10">
            <TriangleAlert className="h-6 w-6 text-signature" aria-hidden="true" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-foreground">
            Une erreur est survenue
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Le contenu n&apos;a pas pu être chargé. Vérifie ta connexion, puis réessaie.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              type="button"
              onClick={reset}
              className="h-11 w-full rounded-lg bg-signature px-6 text-white hover:bg-signature-deep sm:w-auto"
            >
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Réessayer
            </Button>
            <Link
              href="/offres"
              className="inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-signature"
            >
              Retour aux offres
            </Link>
          </div>
          {error.digest && (
            <p className="mt-6 text-xs text-muted-foreground">Référence : {error.digest}</p>
          )}
        </div>
      </main>
    </Chrome>
  );
}
