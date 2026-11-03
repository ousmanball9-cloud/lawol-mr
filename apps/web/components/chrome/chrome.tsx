"use client";

import { Header } from "@/components/chrome/header";
import { Footer } from "@/components/chrome/footer";
import { useChromeGlobal } from "@/components/chrome/chrome-route";

/** Enveloppe chrome globale : header + contenu + footer.
 * À utiliser sur les pages publiques de contenu (offres, entreprises, pages
 * statiques). Ne PAS utiliser sur : landing (hero dédié), profil/admin/
 * espace entreprise (shells applicatives avec leur propre chrome).
 *
 * Depuis la vague 2, le layout racine rend le chrome des routes publiques
 * (`ChromeRoute`) : sur ces routes `<Chrome>` ne fait que passer les enfants,
 * pour ne jamais afficher deux headers. Hors de ces routes (ou dans un test
 * isolé), il rend le chrome complet comme avant. */
export function Chrome({ children }: { children: React.ReactNode }) {
  const chromeDejaRendu = useChromeGlobal();

  if (chromeDejaRendu) return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
