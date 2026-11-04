"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

// Page de connexion admin — design « Sign in » du template Flowbite Admin
// (carte centrée, logo, champ mot de passe). Logique inchangée :
// POST /api/admin/login → cookie lawol_admin → redirect /admin.
export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push("/admin");
        router.refresh();
      } else {
        setError("Mot de passe incorrect");
      }
    } catch {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-8 bg-background">
      <Link
        href="/"
        className="flex items-center justify-center mb-8 text-2xl font-semibold text-ink lg:mb-10"
      >
        <span className="mr-3 inline-flex items-center justify-center w-11 h-11 text-lg font-bold text-white bg-nuit-deep rounded-lg">
          L
        </span>
        <span>
          LAWOL.mr <span className="text-signature">Admin</span>
        </span>
      </Link>

      {/* Card */}
      <div className="w-full max-w-md p-6 space-y-6 bg-card border border-border rounded-lg shadow sm:p-8">
        <h2 className="text-2xl font-bold text-ink">Connexion administrateur</h2>
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <label
              htmlFor="password"
              className="block mb-2 text-sm font-medium text-ink"
            >
              Mot de passe
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Lock className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <input
                type="password"
                id="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="block w-full p-2.5 pl-10 text-sm text-ink bg-background border border-border rounded-lg focus:ring-signature/20 focus:border-signature"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-5 py-3 text-base font-medium text-center text-white bg-signature rounded-lg hover:bg-signature-deep focus:ring-4 focus:ring-signature/30 disabled:opacity-50"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>

          <div className="text-sm font-medium text-muted-foreground">
            <Link href="/" className="text-signature hover:underline">
              Retour au site
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
