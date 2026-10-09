import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/layout";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const auth = cookieStore.get("lawol_admin");

  // Éviter la boucle de redirection sur la page login elle-même
  if ((!auth || auth.value !== "authenticated") && !children?.toString().includes("AdminLoginPage")) {
    redirect("/admin-login");
  }

  return <AdminShell>{children}</AdminShell>;
}
