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
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-8 bg-gray-50">
      <Link
        href="/"
        className="flex items-center justify-center mb-8 text-2xl font-semibold text-gray-900 lg:mb-10"
      >
        <span className="mr-3 inline-flex items-center justify-center w-11 h-11 text-lg font-bold text-white bg-gray-900 rounded-lg">
          L
        </span>
        <span>
          LAWOL.mr <span className="text-primary-700">Admin</span>
        </span>
      </Link>

      {/* Card */}
      <div className="w-full max-w-md p-6 space-y-6 bg-white border border-gray-200 rounded-lg shadow sm:p-8">
        <h2 className="text-2xl font-bold text-gray-900">Connexion administrateur</h2>
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <label
              htmlFor="password"
              className="block mb-2 text-sm font-medium text-gray-900"
            >
              Mot de passe
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Lock className="w-5 h-5 text-gray-500" aria-hidden="true" />
              </div>
              <input
                type="password"
                id="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="block w-full p-2.5 pl-10 text-sm text-gray-900 bg-gray-50 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm font-medium text-red-600" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-5 py-3 text-base font-medium text-center text-white bg-primary-700 rounded-lg hover:bg-primary-800 focus:ring-4 focus:ring-primary-300 disabled:opacity-50"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>

          <div className="text-sm font-medium text-gray-500">
            <Link href="/" className="text-primary-700 hover:underline">
              Retour au site
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
