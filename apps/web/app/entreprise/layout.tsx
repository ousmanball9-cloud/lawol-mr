import type { Metadata } from "next";
import type { ReactNode } from "react";

// Pivot 100 % bourses (13/10, masquage doux) : espace entreprise conservé
// mais désindexé (page vivante, hors moteurs). Réversible.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function EntrepriseLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
