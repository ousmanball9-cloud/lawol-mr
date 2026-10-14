"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight, Settings, Bell, Share2 } from "lucide-react";
import { Chrome } from "@/components/chrome/chrome";

export default function ConfirmationPage() {
  const [alerteTestEnvoyee, setAlerteTestEnvoyee] = useState(false);

  const handleAlerteTest = () => {
    setAlerteTestEnvoyee(true);
    setTimeout(() => setAlerteTestEnvoyee(false), 3000);
  };

  const lienParrainage = "https://wa.me/?text=" + encodeURIComponent(
    "Rejoins-moi sur LAWOL.mr ! Je reçois les bourses et stages qui matchent mon profil direct sur WhatsApp. Gratuit, sans stress. 🎓"
  );

  return (
    <Chrome>
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md lg:max-w-4xl">
        {/* Double panneau desktop : prochaines étapes (bg-ink) + message de succès — mobile : carte seule */}
        <div data-probe="carte-conteneur" className="flex overflow-hidden rounded-lg border border-border bg-card shadow-[0_1px_3px_rgba(10,10,10,0.04)]">
          <aside
            data-probe="branding"
            aria-hidden="true"
            className="hidden w-[40%] shrink-0 flex-col justify-center fond-nuit p-10 text-white lg:flex"
          >
            <span className="mb-6 text-lg font-bold tracking-[-0.02em]">LAWOL.mr</span>
            <p className="mb-6 font-display text-3xl font-bold leading-[1.1] tracking-[-0.02em]">
              Et maintenant ?
            </p>
            <ol className="space-y-4 text-sm text-white/80">
              {[
                "Nos robots lancent le matching sur les nouvelles offres.",
                "Tu reçois uniquement les offres qui collent à ton profil.",
                "Tu postules en un clic, directement sur WhatsApp.",
              ].map((etape, i) => (
                <li key={etape} className="flex items-start gap-3">
                  <span className="eyebrow shrink-0 pt-0.5 text-white/50">{`0${i + 1}`}</span>
                  <span>{etape}</span>
                </li>
              ))}
            </ol>
            <div className="mt-8 space-y-3">
              <Link
                href="/profil/2221234567/parametres"
                className="flex items-center gap-3 rounded-lg p-3 bg-white/10 hover:bg-white/20 transition-colors"
              >
                <Settings className="h-5 w-5" />
                <span className="text-sm font-medium">Paramètres & préférences</span>
              </Link>
              <button
                onClick={handleAlerteTest}
                disabled={alerteTestEnvoyee}
                className="flex w-full items-center gap-3 rounded-lg p-3 bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50"
              >
                <Bell className="h-5 w-5" />
                <span className="text-sm font-medium">
                  {alerteTestEnvoyee ? "Alerte test envoyée ✓" : "Recevoir ma première alerte test"}
                </span>
              </button>
              <a
                href={lienParrainage}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg p-3 bg-white/10 hover:bg-white/20 transition-colors"
              >
                <Share2 className="h-5 w-5" />
                <span className="text-sm font-medium">Parrainer un ami (WhatsApp)</span>
              </a>
            </div>
          </aside>
          <div className="min-w-0 flex-1 p-8 text-center sm:p-10">
        <div className="mx-auto mb-6 flex h-20 w-20 animate-in items-center justify-center rounded-lg bg-nuit text-white duration-500 fade-in zoom-in-95">
          <CheckCircle className="h-10 w-10" />
        </div>

        <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-emerald-800">
          Profil enregistré
        </span>

        <h1 className="mb-3 font-display text-2xl font-bold tracking-[-0.02em] text-foreground">Inscription réussie !</h1>
        <p className="mb-8 leading-relaxed text-muted-foreground">
          Tu recevras bientôt les offres correspondant à ton profil sur WhatsApp.
        </p>

        <Link href="/">
          <Button
            size="lg"
            className="h-12 w-full rounded-lg bg-signature text-base text-white hover:bg-signature-deep"
          >
            <span className="flex items-center gap-2">
              Retour à l&apos;accueil
              <ArrowRight className="h-4 w-4" />
            </span>
          </Button>
        </Link>

        <p className="mt-5 text-xs text-muted-foreground">
          Un message de confirmation t&apos;attend sur ton numéro enregistré.
        </p>
          </div>
        </div>
      </div>
    </div>
    </Chrome>
  );
}
