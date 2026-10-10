import { Header } from "@/components/chrome/header";
import { Footer } from "@/components/chrome/footer";

/** Enveloppe chrome globale : header + contenu + footer.
 * À utiliser sur les pages publiques de contenu (offres, entreprises, pages
 * statiques). Ne PAS utiliser sur : landing (hero dédié), profil/admin/
 * espace entreprise (shells applicatives avec leur propre chrome). */
export function Chrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
