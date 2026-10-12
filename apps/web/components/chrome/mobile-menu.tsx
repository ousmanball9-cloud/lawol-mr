"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

/** Liens de navigation — même source que la nav desktop du header. */
const NAV = [
  { href: "/offres", label: "Bourses & offres" },
  { href: "/entreprises", label: "Entreprises" },
];

const CONNEXION = { href: "/connexion", label: "Connexion" };
const INSCRIPTION = { href: "/inscription", label: "S'inscrire" };

/** Menu mobile (burger) — visible uniquement < md, la nav desktop reste intacte.
 * Fermeture : bouton ✕ (le burger devient ✕), clic hors du panneau, Échap,
 * et changement de route. Zéro dépendance (SVG inline, état React local). */
export function MobileMenu() {
  const [ouvert, setOuvert] = useState(false);
  const pathname = usePathname();
  const zoneRef = useRef<HTMLDivElement>(null);

  // Fermeture à la navigation (changement de route).
  useEffect(() => {
    setOuvert(false);
  }, [pathname]);

  // Clic hors du panneau + Échap.
  useEffect(() => {
    if (!ouvert) return;
    const clicHors = (event: MouseEvent) => {
      if (zoneRef.current && !zoneRef.current.contains(event.target as Node)) {
        setOuvert(false);
      }
    };
    const echap = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOuvert(false);
    };
    document.addEventListener("mousedown", clicHors);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("mousedown", clicHors);
      document.removeEventListener("keydown", echap);
    };
  }, [ouvert]);

  const lienClass = (actif: boolean) =>
    `block rounded-lg px-3 py-2.5 text-base font-medium transition-colors duration-150 ${
      actif ? "bg-signature/10 text-signature" : "text-foreground hover:bg-muted"
    }`;

  return (
    <div ref={zoneRef} className="relative md:hidden">
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-expanded={ouvert}
        aria-controls="menu-mobile"
        aria-label={ouvert ? "Fermer le menu" : "Ouvrir le menu"}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors duration-150 hover:bg-muted"
      >
        {/* Icône 3 lignes → ✕ (animation CSS, aucun déplacement de layout) */}
        <span className="relative block h-4 w-5" aria-hidden="true">
          <span
            className={`absolute left-0 top-0 h-0.5 w-full rounded bg-current transition-transform duration-200 ${
              ouvert ? "translate-y-[7px] rotate-45" : ""
            }`}
          />
          <span
            className={`absolute left-0 top-[7px] h-0.5 w-full rounded bg-current transition-opacity duration-150 ${
              ouvert ? "opacity-0" : "opacity-100"
            }`}
          />
          <span
            className={`absolute left-0 top-[14px] h-0.5 w-full rounded bg-current transition-transform duration-200 ${
              ouvert ? "-translate-y-[7px] -rotate-45" : ""
            }`}
          />
        </span>
      </button>

      {ouvert && (
        <div
          id="menu-mobile"
          className="absolute right-0 top-full mt-2 w-[min(19rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-card p-2 shadow-xl shadow-nuit/10"
        >
          <nav aria-label="Menu mobile" className="flex flex-col gap-0.5">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname.startsWith(item.href) ? "page" : undefined}
                className={lienClass(pathname.startsWith(item.href))}
              >
                {item.label}
              </Link>
            ))}
            <div className="my-1.5 border-t border-border" />
            <Link
              href={CONNEXION.href}
              aria-current={pathname.startsWith(CONNEXION.href) ? "page" : undefined}
              className={lienClass(pathname.startsWith(CONNEXION.href))}
            >
              {CONNEXION.label}
            </Link>
            <Link href={INSCRIPTION.href} className="mt-1 block">
              <Button className="h-11 w-full rounded-lg bg-signature text-white hover:bg-signature-deep">
                {INSCRIPTION.label}
              </Button>
            </Link>
          </nav>
        </div>
      )}
    </div>
  );
}
