"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiLogin } from "@/components/entreprise/api";

/**
 * Page de connexion entreprise — POST /api/v1/entreprises/login.
 * Token stocké en sessionStorage (vidé à la fermeture de l'onglet).
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnCours(true);
    setErreur("");
    try {
      const res = await apiLogin(email, password);
      sessionStorage.setItem("ent_token", res.token);
      sessionStorage.setItem("ent_id", res.entreprise_id);
      router.push("/entreprise");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur de connexion";
      setErreur(msg.includes("401") || msg.toLowerCase().includes("invalid") ? "Identifiants invalides" : msg);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-[0_1px_3px_rgba(10,10,10,0.04)]">
        <div className="mb-6 text-center">
          <span className="font-display text-2xl font-bold tracking-[-0.02em] text-foreground">
            LAWOL<span className="text-signature">.mr</span>
          </span>
          <p className="mt-1 text-sm text-muted-foreground">Espace entreprise</p>
        </div>

        {erreur && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {erreur}
          </div>
        )}

        <form onSubmit={handleSubmit} data-probe="login-form" className="space-y-4">
          <div>
            <label htmlFor="login-email" className="mb-1.5 block text-sm font-semibold text-foreground">
              Adresse e-mail
            </label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rh@entreprise.mr"
              autoComplete="email"
              className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-foreground transition-colors duration-150 focus:border-signature focus:outline-none focus:ring-2 focus:ring-signature/30"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="mb-1.5 block text-sm font-semibold text-foreground">
              Mot de passe
            </label>
            <input
              id="login-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ton mot de passe"
              autoComplete="current-password"
              className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-foreground transition-colors duration-150 focus:border-signature focus:outline-none focus:ring-2 focus:ring-signature/30"
            />
          </div>

          <Button
            type="submit"
            disabled={enCours}
            data-probe="login-submit"
            className="h-11 w-full rounded-lg bg-signature text-white hover:bg-signature-deep"
          >
            {enCours ? "Connexion..." : "Se connecter"}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Pas encore de compte ? Contacte-nous pour créer ton accès entreprise.
        </p>
      </div>
    </div>
  );
}
