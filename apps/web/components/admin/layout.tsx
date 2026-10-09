"use client";

// Shell admin LAWOL — design du template Flowbite Admin Dashboard
// (topbar fixe + sidebar + drawer mobile), logique inchangée.
// Référence : flowbite-admin/layouts/partials/{navbar-dashboard,sidebar}.html

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Briefcase,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  Users,
  X,
} from "lucide-react";
import { Sidebar, SidebarItem, SidebarItemGroup, SidebarItems } from "flowbite-react";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/offres", label: "Offres", icon: Briefcase },
  { href: "/admin/profils", label: "Profils", icon: Users },
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
    <div className="flex min-h-screen pt-16 overflow-hidden bg-gray-50">
      {/* Topbar fixe */}
      <nav className="fixed top-0 left-0 z-30 w-full bg-white border-b border-gray-200">
        <div className="px-3 py-3 lg:px-5 lg:pl-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center justify-start">
              <button
                type="button"
                onClick={() => setMobileOpen((v) => !v)}
                aria-expanded={mobileOpen}
                aria-controls="sidebar"
                className="p-2 text-gray-600 rounded cursor-pointer lg:hidden hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-100"
              >
                <span className="sr-only">Ouvrir la navigation</span>
                {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
              <Link href="/" className="flex ml-2 md:mr-24">
                <span className="self-center text-xl font-semibold whitespace-nowrap text-gray-900">
                  LAWOL.mr <span className="text-primary">Admin</span>
                </span>
              </Link>
            </div>
            <div className="flex items-center">
              <Link
                href="/"
                className="items-center hidden px-3 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-lg sm:inline-flex hover:bg-gray-100 focus:ring-4 focus:ring-gray-100"
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
          className="fixed inset-0 z-10 bg-gray-900/50 lg:hidden"
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
              inner: "h-full overflow-y-auto overflow-x-hidden bg-white px-3 py-4 border-r border-gray-200 rounded-none",
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
          <div className="pt-2 mt-2 space-y-2 border-t border-gray-200">
            <Link
              href="/"
              onClick={() => setMobileOpen(false)}
              className="flex items-center p-2 text-base text-gray-900 transition duration-75 rounded-lg group hover:bg-gray-100"
            >
              <ExternalLink className="w-6 h-6 text-gray-500 transition duration-75 group-hover:text-gray-900" />
              <span className="ml-3">Voir le site</span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center w-full p-2 text-base text-red-600 transition duration-75 rounded-lg group hover:bg-red-50"
            >
              <LogOut className="w-6 h-6 text-red-500 transition duration-75 group-hover:text-red-600" />
              <span className="ml-3">Déconnexion</span>
            </button>
          </div>
        </Sidebar>
      </aside>

      {/* Contenu principal */}
      <div className="relative w-full h-full overflow-y-auto bg-gray-50 lg:ml-64">
        <main>{children}</main>
      </div>
    </div>
  );
}
