import Link from "next/link";
import { SearchX } from "lucide-react";
import { Chrome } from "@/components/chrome/chrome";
import { Button } from "@/components/ui/button";

/**
 * 404 globale — rendue DANS le chrome.
 *
 * Sert deux cas : URL inconnue, et `notFound()` appelé par une page (offre
 * retirée du catalogue). Le retour principal pointe vers `/offres` : c'est la
 * sortie utile pour un visiteur qui cherchait une bourse.
 */
export default function NotFound() {
  return (
    <Chrome>
      <main className="flex min-h-[70vh] items-center justify-center bg-background px-4 py-16">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-signature/10">
            <SearchX className="h-6 w-6 text-signature" aria-hidden="true" />
          </div>
          <p className="eyebrow text-signature">Erreur 404</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.02em] text-foreground">
            Cette page n&apos;existe pas
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Le lien est peut-être obsolète, ou l&apos;offre a été retirée du catalogue.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              className="h-11 w-full rounded-lg bg-signature px-6 text-white hover:bg-signature-deep sm:w-auto"
            >
              <Link href="/offres">Voir les offres</Link>
            </Button>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-signature"
            >
              Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </main>
    </Chrome>
  );
}
