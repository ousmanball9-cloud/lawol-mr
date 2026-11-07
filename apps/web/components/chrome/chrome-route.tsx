"use client";

import { createContext, useContext } from "react";
import { usePathname } from "next/navigation";
import { Header } from "@/components/chrome/header";
import { Footer } from "@/components/chrome/footer";

/**
 * Chrome porté par le layout racine, pour les routes de contenu public.
 *
 * Pourquoi ici et pas dans chaque page : les pages publiques rendent leur
 * chrome APRÈS leurs états précoces (chargement, erreur). Tant que le header
 * vivait uniquement dans la page, un état précoce s'affichait plein écran,
 * sans navigation (constat chasse 0 · B2 : `/offres` perd le header pendant
 * le chargement). En montant le chrome au-dessus du segment, tout état —
 * `loading.tsx`, `error.tsx`, retour anticipé d'une page — reste dans la
 * navigation.
 *
 * Liste blanche volontaire : elle ne contient QUE les routes qui rendaient
 * déjà `<Chrome>` (aucun changement visuel sur le rendu nominal). La landing
 * (« / », hero + header dédiés) et les shells applicatifs (`/profil`,
 * `/admin`, `/admin-login`) gardent leur propre chrome.
 */
const ROUTES_CHROME = [
  "/offres",
  "/conseils",
  "/contact",
  "/conditions",
  "/confidentialite",
  "/mentions",
  "/connexion",
  "/inscription",
] as const;

/** `true` quand le layout racine a déjà rendu le chrome pour la route courante. */
const ChromeGlobalContext = createContext(false);

/** À usage interne de `Chrome` : évite un double header/footer. */
export function useChromeGlobal() {
  return useContext(ChromeGlobalContext);
}

export function ChromeRoute({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const avecChrome = ROUTES_CHROME.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  return (
    <ChromeGlobalContext.Provider value={avecChrome}>
      {avecChrome ? (
        // Même enveloppe que `Chrome` : header collant, contenu extensible, footer en bas.
        <div className="flex min-h-screen flex-col bg-background">
          <Header />
          <div className="flex-1">{children}</div>
          <Footer />
        </div>
      ) : (
        children
      )}
    </ChromeGlobalContext.Provider>
  );
}
