"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MobileMenu } from "@/components/chrome/mobile-menu";
import { NotificationsCloche } from "@/components/chrome/notifications-cloche";

const NAV = [
  { href: "/offres", label: "Bourses & offres" },
  { href: "/conseils", label: "Conseils" },
];

/** Header global — pattern Jobteaser : blanc, logo gauche, nav centre,
 * actions auth droite. Composant client (état actif via usePathname). */
export function Header() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
        <Link href="/" className="shrink-0 text-lg font-bold tracking-[-0.02em] text-foreground">
          LAWOL<span className="text-signature">.mr</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Navigation principale">
          {NAV.map((item) => {
            const actif = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={actif ? "page" : undefined}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                  actif
                    ? "bg-signature/10 text-signature"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/connexion"
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground sm:block"
          >
            Se connecter
          </Link>
          <Link href="/inscription">
            <Button className="h-10 rounded-lg bg-signature px-4 text-white hover:bg-signature-deep">
              S&apos;inscrire
            </Button>
          </Link>
          {/* Cloche notifications : rend null sans session (cookie absent) */}
          <NotificationsCloche />
          {/* Burger : uniquement < md (la nav desktop reste telle quelle) */}
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
