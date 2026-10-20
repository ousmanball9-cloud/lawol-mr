import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/layout";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const auth = cookieStore.get("lawol_admin");

  // Éviter la boucle de redirection sur la page login elle-même
  // Le cookie n'est plus une constante publique : c'est le hash dérivé du
  // secret serveur (`sha256("lawol-admin|" + ADMIN_PASSWORD_HASH)`), la seule
  // valeur acceptée par la garde FastAPI `_admin_autorise`. Le layout admin ne
  // vérifie donc que la PRÉSENCE du cookie : la sécurité (401/403) est dans
  // l'API, pas dans l'UI.
  if (!auth && !children?.toString().includes("AdminLoginPage")) {
    redirect("/admin-login");
  }

  return <AdminShell>{children}</AdminShell>;
}
