"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogIn, CheckCircle } from "lucide-react";

const inputClass =
  "w-full rounded-lg border border-input bg-white px-4 py-2.5 text-sm text-foreground transition-colors duration-150 placeholder:text-muted-foreground focus:border-signature focus:outline-none focus:ring-2 focus:ring-signature/30";

export default function ConnexionPage() {
  const router = useRouter();
  const [digits, setDigits] = useState("");
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState("");
  // Numéro complet (222XXXXXXXX) quand le profil est introuvable → lien de création
  const [introuvable, setIntrouvable] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    setIntrouvable("");

    // Le « +222 » est un préfixe visuel : on ne saisit que les 8 chiffres
    // (une saisie collée en numéro complet reste acceptée).
    const brut = digits.replace(/\D/g, "");
    const tel = brut.length === 8 ? `222${brut}` : brut;
    if (!/^222\d{8}$/.test(tel)) {
      setErreur("Numéro de téléphone invalide. Saisis les 8 chiffres après +222.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/v1/profils/${tel}`);
      if (res.ok) {
        router.push(`/profil/${tel}`);
      } else if (res.status === 404) {
        setIntrouvable(tel);
      } else {
        setErreur("Erreur serveur. Veuillez réessayer plus tard.");
      }
    } catch {
      setErreur("Erreur de connexion. Vérifiez votre internet et réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-lg lg:max-w-5xl">
        {/* Double panneau desktop : branding (bg-ink) + formulaire — mobile : formulaire seul */}
        <div data-probe="carte-conteneur" className="flex overflow-hidden rounded-lg border border-border bg-card shadow-[0_1px_3px_rgba(10,10,10,0.04)]">
          <aside
            data-probe="branding"
            aria-hidden="true"
            className="hidden w-[42%] shrink-0 flex-col justify-center bg-ink p-10 text-white lg:flex"
          >
            <span className="mb-6 text-lg font-bold tracking-[-0.02em]">LAWOL.mr</span>
            <p className="mb-4 font-display text-3xl font-bold leading-[1.1] tracking-[-0.02em]">
              Ton prochain stage t&apos;attend déjà sur WhatsApp.
            </p>
            <p className="mb-8 text-sm leading-relaxed text-white/70">
              Retrouve ton espace en 10 secondes : pas de mot de passe, pas d&apos;application
              à installer — juste ton numéro.
            </p>
            <ul className="space-y-3 text-sm text-white/80">
              {[
                "Les offres qui matchent ton profil, en direct",
                "Ton score de profil et tes candidatures au même endroit",
                "Opt-out en un clic, ton numéro reste privé",
              ].map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-white/50" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </aside>
          <div className="min-w-0 flex-1 p-8 sm:p-10">
          {/* Volet A — Étudiant */}
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-lg bg-ink text-white">
              <LogIn className="h-7 w-7" />
            </div>
            <h1 className="mb-2 font-display text-2xl font-bold tracking-[-0.02em] text-foreground">
              Connexion
            </h1>
            <p className="text-sm text-muted-foreground">
              Accède à ton profil LAWOL.mr avec ton numéro de téléphone
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Téléphone */}
            <div>
              <label htmlFor="telephone" className="mb-1.5 block text-sm font-medium text-foreground">
                Téléphone <span className="text-destructive">*</span>
              </label>
              <div className="flex items-stretch overflow-hidden rounded-lg border border-input bg-white transition-colors duration-150 focus-within:border-signature focus-within:ring-2 focus-within:ring-signature/30">
                <span
                  aria-hidden="true"
                  className="flex items-center border-r border-input bg-muted px-3 text-sm font-semibold text-muted-foreground"
                >
                  +222
                </span>
                <input
                  id="telephone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={digits}
                  onChange={(e) => setDigits(e.target.value)}
                  placeholder="8 chiffres"
                  maxLength={14}
                  className="w-full border-0 bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Format : +222 suivi de 8 chiffres</p>
            </div>

            {/* Erreur */}
            {erreur && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {erreur}
              </div>
            )}

            {/* Aucun profil → création */}
            {introuvable && (
              <div className="rounded-lg border border-border bg-muted px-4 py-3 text-sm text-foreground">
                Aucun profil avec ce numéro.{" "}
                <Link
                  href={`/inscription?tel=${introuvable}`}
                  className="font-semibold text-signature underline underline-offset-4 hover:text-signature-deep"
                >
                  Créer mon profil
                </Link>
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-lg bg-signature text-base text-white hover:bg-signature-deep"
              size="lg"
            >
              {loading ? "Vérification..." : "Accéder à mon profil"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            Pas encore inscrit ?{" "}
            <Link href="/inscription" className="font-medium text-signature hover:underline">
              Inscris-toi ici
            </Link>
          </p>

          {/* Volet B — Espace gérant (secondaire) */}
          <div className="mt-8 border-t border-border pt-6">
            <div className="rounded-lg border border-border bg-background p-5">
              <p className="eyebrow mb-2 text-muted-foreground">Espace gérant</p>
              <p className="mb-4 text-sm text-muted-foreground">
                Réservé à l&apos;équipe LAWOL — tableau de bord, offres et profils.
              </p>
              <Link href="/admin-login">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-lg border-border bg-card px-4 text-sm text-foreground hover:border-signature hover:bg-card hover:text-signature"
                >
                  Accéder à l&apos;espace gérant
                </Button>
              </Link>
            </div>
          </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Ton numéro reste privé. Consulte notre{" "}
          <Link href="/confidentialite" className="underline underline-offset-4 hover:text-signature">
            politique de confidentialité
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
