import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const auth = cookieStore.get("lawol_admin");

  // Éviter la boucle de redirection sur la page login elle-même
  if ((!auth || auth.value !== "authenticated") && !children?.toString().includes("AdminLoginPage")) {
    redirect("/admin-login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary">LAWOL.mr — Admin</h1>
        <div className="flex gap-4">
          <a href="/admin" className="text-sm text-gray-600 hover:text-primary">Dashboard</a>
          <a href="/admin/offres" className="text-sm text-gray-600 hover:text-primary">Offres</a>
          <a href="/admin/profils" className="text-sm text-gray-600 hover:text-primary">Profils</a>
          <a href="/admin/logout" className="text-sm text-red-600 hover:text-red-700">Déconnexion</a>
        </div>
      </nav>
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
