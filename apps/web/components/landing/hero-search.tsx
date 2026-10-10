"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Recherche du hero — pattern Jobteaser : champ proéminent dans le hero,
 * redirige vers /offres avec la requête. Composant client isolé (la landing
 * reste un composant serveur).
 */
export function HeroSearch() {
  const router = useRouter();
  const [valeur, setValeur] = useState("");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = valeur.trim();
    router.push(q ? `/offres?recherche=${encodeURIComponent(q)}` : "/offres");
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-probe="hero-recherche"
      className="mx-auto mb-10 flex w-full max-w-xl items-center gap-2"
      role="search"
    >
      <label htmlFor="hero-recherche" className="sr-only">
        Rechercher une offre
      </label>
      <input
        id="hero-recherche"
        type="search"
        value={valeur}
        onChange={(e) => setValeur(e.target.value)}
        placeholder="Métier, entreprise, ville…"
        className="h-12 w-full rounded-lg border border-white/25 bg-white/10 px-4 text-sm text-white placeholder:text-white/50 transition-colors duration-150 focus:border-white/60 focus:bg-white/15 focus:outline-none"
      />
      <Button
        type="submit"
        size="lg"
        className="h-12 shrink-0 rounded-lg bg-signature px-5 text-white hover:bg-signature-deep"
      >
        <Search className="h-4 w-4" />
        <span className="sr-only sm:not-sr-only">Rechercher</span>
      </Button>
    </form>
  );
}
