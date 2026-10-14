"use client";

import Link from "next/link";
import { Briefcase, FileText, LayoutDashboard, LogOut, Send } from "lucide-react";

const ONGLETS = [
  { id: "tableau", label: "Tableau de bord", icone: LayoutDashboard },
  { id: "offres", label: "Mes offres", icone: Briefcase },
  { id: "deposer", label: "Déposer une offre", icone: Send },
  { id: "candidatures", label: "Candidatures", icone: FileText },
] as const;

type Onglet = (typeof ONGLETS)[number]["id"];

type Props = {
  onglet: Onglet;
  onLogout: () => void;
  logoutEnCours: boolean;
};

/**
 * Sidebar de navigation de l'espace entreprise — desktop (sticky) et mobile (barre horizontale).
 * Pattern identique à apps/web/components/espace/ : navigation uniquement, déconnexion en bas.
 */
export function Sidebar({ onglet, onLogout, logoutEnCours }: Props) {
  return (
    <>
      {/* Sidebar desktop */}
      <aside className="hidden lg:sticky lg:top-6 lg:block lg:w-[280px] lg:shrink-0">
        <div className="rounded-lg border border-border bg-card p-4 shadow-[0_1px_3px_rgba(10,10,10,0.04)]">
          <div className="mb-4 px-2">
            <span className="font-display text-lg font-bold tracking-[-0.02em] text-foreground">
              LAWOL<span className="text-signature">.mr</span>
            </span>
            <span className="ml-2 text-xs text-muted-foreground">Espace entreprise</span>
          </div>
          <nav className="flex flex-col gap-1" aria-label="Navigation de l'espace entreprise">
            {ONGLETS.map((o) => (
              <Link
                key={o.id}
                href={`/entreprise?onglet=${o.id}`}
                data-probe={`ent-onglet-${o.id}`}
                aria-current={onglet === o.id ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                  onglet === o.id
                    ? "bg-signature/10 text-signature"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <o.icone className="h-4 w-4" />
                {o.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 border-t border-border pt-3">
            <button
              type="button"
              onClick={onLogout}
              disabled={logoutEnCours}
              data-probe="ent-logout"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
              {logoutEnCours ? "Déconnexion..." : "Se déconnecter"}
            </button>
          </div>
        </div>
      </aside>

      {/* Navigation mobile */}
      <nav
        className="mb-4 flex gap-1 rounded-lg border border-border bg-card p-1 shadow-[0_1px_3px_rgba(10,10,10,0.04)] lg:hidden"
        aria-label="Navigation de l'espace entreprise"
      >
        {ONGLETS.map((o) => (
          <Link
            key={o.id}
            href={`/entreprise?onglet=${o.id}`}
            data-probe={`ent-onglet-${o.id}`}
            aria-current={onglet === o.id ? "page" : undefined}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors duration-150 ${
              onglet === o.id
                ? "bg-signature/10 text-signature"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <o.icone className="h-4 w-4" />
            {o.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
