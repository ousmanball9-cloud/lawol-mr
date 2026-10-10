"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Pencil, RefreshCw, UserMinus } from "lucide-react";

/** Infos profil telles que renvoyées par GET /api/v1/profils/{tel}. */
export type ProfilInfo = {
  telephone: string;
  nom: string;
  prenom: string;
  universite: string;
  filiere: string;
  niveau: string;
  ville: string;
};

type Props = {
  profil: ProfilInfo;
  telephone: string;
  onActualiser: () => void;
  actualisation: boolean;
  onDesinscrire: () => void;
  desinscriptionEnCours: boolean;
  desinscrit: boolean;
};

/**
 * Carte identité du profil — onglet « Profil » de l'espace client.
 * N'est JAMAIS rendue sur la page d'entrée (exigence : les infos du profil
 * ne doivent pas être visibles directement en entrant dans le site).
 */
export function CarteProfil({
  profil,
  telephone,
  onActualiser,
  actualisation,
  onDesinscrire,
  desinscriptionEnCours,
  desinscrit,
}: Props) {
  const initiales = `${profil.prenom?.charAt(0) ?? ""}${profil.nom?.charAt(0) ?? ""}`.toUpperCase();

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-[0_1px_3px_rgba(10,10,10,0.04)]">
      <div aria-hidden="true" className="h-1 w-full bg-signature" />
      <div className="px-6 pb-6 pt-6">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <div
            data-profil="avatar"
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-ink text-2xl font-bold text-white ring-4 ring-muted"
          >
            {initiales || "?"}
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-foreground">
              {profil.prenom} {profil.nom}
            </h1>
            <p className="truncate text-muted-foreground">{profil.universite}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-6 py-5 text-sm">
        <div className="rounded-lg bg-muted px-3 py-2">
          <span className="block text-xs text-muted-foreground">Filière</span>
          <span className="font-medium capitalize">{profil.filiere}</span>
        </div>
        <div className="rounded-lg bg-muted px-3 py-2">
          <span className="block text-xs text-muted-foreground">Niveau</span>
          <span className="font-medium">{profil.niveau}</span>
        </div>
        <div className="rounded-lg bg-muted px-3 py-2">
          <span className="block text-xs text-muted-foreground">Ville</span>
          <span className="font-medium capitalize">{profil.ville}</span>
        </div>
        <div className="rounded-lg bg-muted px-3 py-2">
          <span className="block text-xs text-muted-foreground">Téléphone</span>
          <span className="font-medium">{profil.telephone}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border px-6 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onActualiser}
          disabled={actualisation}
          className="rounded-lg border-border transition-colors duration-150 hover:border-signature hover:text-signature"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${actualisation ? "animate-spin" : ""}`} />
          {actualisation ? "Actualisation..." : "Actualiser"}
        </Button>
        <Link href={`/profil/${telephone}/edit`}>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg border-border transition-colors duration-150 hover:border-signature hover:text-signature"
          >
            <Pencil className="h-4 w-4 mr-2" />
            Modifier mon profil
          </Button>
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={onDesinscrire}
          disabled={desinscrit || desinscriptionEnCours}
          className="rounded-lg border-border transition-colors duration-150 hover:border-destructive hover:bg-destructive/5 hover:text-destructive"
        >
          <UserMinus className="h-4 w-4 mr-2" />
          {desinscriptionEnCours ? "Désinscription..." : "Se désinscrire"}
        </Button>
      </div>
    </div>
  );
}
