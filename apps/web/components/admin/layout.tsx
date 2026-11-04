"use client";

// Shell admin LAWOL — design du template Flowbite Admin Dashboard
// (topbar fixe + sidebar + drawer mobile), logique inchangée.
// Référence : flowbite-admin/layouts/partials/{navbar-dashboard,sidebar}.html

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  BarChart3,
  Briefcase,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
  X,
} from "lucide-react";
import { Sidebar, SidebarItem, SidebarItemGroup, SidebarItems } from "flowbite-react";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/offres", label: "Offres", icon: Briefcase },
  { href: "/admin/profils", label: "Profils", icon: Users },
  { href: "/admin/statistiques", label: "Statistiques", icon: BarChart3 },
  { href: "/admin/parametres", label: "Paramètres", icon: Settings },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Déconnexion : appelle la route existante POST /api/admin/logout
  // (cookie lawol_admin purgé côté serveur), puis renvoie vers la page login.
  async function handleLogout() {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } finally {
      setMobileOpen(false);
      router.push("/admin-login");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen pt-16 overflow-hidden bg-background">
      {/* Topbar fixe */}
      <nav className="fixed top-0 left-0 z-30 w-full bg-card border-b border-border">
        <div className="px-3 py-3 lg:px-5 lg:pl-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center justify-start">
              <button
                type="button"
                onClick={() => setMobileOpen((v) => !v)}
                aria-expanded={mobileOpen}
                aria-controls="sidebar"
                className="p-2 text-muted-foreground rounded cursor-pointer lg:hidden hover:text-ink hover:bg-muted focus:outline-none focus:ring-2 focus:ring-signature/30"
              >
                <span className="sr-only">Ouvrir la navigation</span>
                {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
              <Link href="/" className="flex ml-2 md:mr-24">
                <span className="self-center text-xl font-semibold whitespace-nowrap text-ink">
                  LAWOL.mr <span className="text-primary">Admin</span>
                </span>
              </Link>
            </div>
            <div className="flex items-center">
              <Link
                href="/"
                className="items-center hidden px-3 py-2 text-sm font-medium text-ink bg-card border border-border rounded-lg sm:inline-flex hover:bg-muted focus:ring-4 focus:ring-signature/20"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Voir le site
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Fond du drawer mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-10 bg-nuit-deep/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        id="sidebar"
        className={`fixed top-0 left-0 z-20 flex-col flex-shrink-0 hidden w-64 h-full pt-16 transition-all lg:flex ${
          mobileOpen ? "!flex" : ""
        }`}
      >
        <Sidebar
          as="div"
          className="h-full border-0 rounded-none"
          theme={{
            root: {
              inner: "h-full overflow-y-auto overflow-x-hidden bg-card px-3 py-4 border-r border-border rounded-none",
            },
          }}
        >
          <SidebarItems>
            <SidebarItemGroup>
              {NAV_ITEMS.map((item) => (
                <SidebarItem
                  key={item.href}
                  as={Link}
                  href={item.href}
                  icon={item.icon}
                  active={pathname === item.href}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </SidebarItem>
              ))}
            </SidebarItemGroup>
          </SidebarItems>

          {/* Pied de sidebar : voir le site + déconnexion */}
          <div className="pt-2 mt-2 space-y-2 border-t border-border">
            <Link
              href="/"
              onClick={() => setMobileOpen(false)}
              className="flex items-center p-2 text-base text-ink transition duration-75 rounded-lg group hover:bg-muted"
            >
              <ExternalLink className="w-6 h-6 text-muted-foreground transition duration-75 group-hover:text-ink" />
              <span className="ml-3">Voir le site</span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center w-full p-2 text-base text-destructive transition duration-75 rounded-lg group hover:bg-destructive/10"
            >
              <LogOut className="w-6 h-6 text-destructive transition duration-75 group-hover:text-destructive" />
              <span className="ml-3">Déconnexion</span>
            </button>
          </div>
        </Sidebar>
      </aside>

      {/* Contenu principal */}
      <div className="relative w-full h-full overflow-y-auto bg-background lg:ml-64">
        <main>{children}</main>
      </div>
    </div>
  );
}
