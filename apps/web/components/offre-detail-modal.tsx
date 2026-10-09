"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Calendar,
  Clock,
  ExternalLink,
  Mail,
  MapPin,
  MessageCircle,
  X,
} from "lucide-react";

/** Champs de l'offre exposés par GET /api/v1/matches (voir docs/brief-offre-detail.md). */
export type OffreDetail = {
  id: string;
  titre: string;
  entreprise: string;
  ville: string;
  type_offre: string;
  date_limite: string;
  description: string;
  contact_email?: string | null;
  contact_whatsapp?: string | null;
  source_url?: string | null;
  source_name?: string | null;
  filieres_cibles?: string[];
};

export const TYPES_OFFRES: Record<string, string> = {
  stage_pfe: "Stage PFE",
  stage_ete: "Stage été",
  emploi_junior: "Emploi junior",
  alternance: "Alternance",
  bourse: "Bourse d'études",
};

export const BADGES_TYPE: Record<string, string> = {
  stage_pfe: "bg-indigo-100 text-indigo-800",
  emploi_junior: "bg-emerald-100 text-emerald-800",
  bourse: "bg-amber-100 text-amber-900",
  stage_ete: "bg-sky-100 text-sky-800",
  alternance: "bg-violet-100 text-violet-800",
};

const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Parse une date_limite backend : ISO « 2026-11-30 » ou française « 30/11/2026 ». */
function parserDateLimite(valeur: string): Date | null {
  const brut = valeur?.trim() ?? "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(brut);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const fr = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(brut);
  if (fr) return new Date(Number(fr[3]), Number(fr[2]) - 1, Number(fr[1]));
  return null;
}

/** Jours restants jusqu'à la fin du jour de date_limite (négatif = dépassée). */
function joursRestants(date: Date | null): number | null {
  if (!date) return null;
  const finDuJour = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  return Math.ceil((finDuJour.getTime() - Date.now()) / 86_400_000);
}

/** Nettoie un numéro mauritanien pour wa.me : chiffres seulement, préfixe 222 si besoin. */
function lienWhatsApp(brut: string): string {
  let numero = brut.replace(/\D/g, "");
  if (numero.startsWith("00222")) numero = numero.slice(2);
  else if (!numero.startsWith("222")) numero = `222${numero}`;
  return `https://wa.me/${numero}`;
}

/** Garde uniquement les URL http(s) (anti javascript: injecté). */
function lienSecurise(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

type Props = {
  offre: OffreDetail;
  postule: boolean;
  enCours: boolean;
  onPostuler: () => void;
  onFermer: () => void;
};

/**
 * Vue détail d'une offre (modale légère, sans dépendance).
 * Fermeture : bouton ✕ + clic sur le fond + touche Échap.
 */
export function OffreDetailModal({ offre, postule, enCours, onPostuler, onFermer }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onFermer();
    }
    document.addEventListener("keydown", onKey);
    const overflowPrec = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // pas de scroll de la page derrière
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflowPrec;
    };
  }, [onFermer]);

  const date = parserDateLimite(offre.date_limite);
  const jours = joursRestants(date);
  const filieres = offre.filieres_cibles ?? [];
  const email = offre.contact_email?.trim() || null;
  const whatsapp = offre.contact_whatsapp?.trim() || null;
  const lienSource = offre.source_url?.trim() ? lienSecurise(offre.source_url.trim()) : null;
  const aUnCanal = Boolean(email || whatsapp || lienSource);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={onFermer}
      aria-hidden="true"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Détail de l'offre ${offre.titre}`}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl shadow-primary/10"
      >
        <button
          type="button"
          onClick={onFermer}
          aria-label="Fermer le détail de l'offre"
          className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <X className="h-4 w-4" />
        </button>

        {/* 1. Badge type + titre */}
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
            BADGES_TYPE[offre.type_offre] ?? "bg-muted text-muted-foreground"
          }`}
        >
          {TYPES_OFFRES[offre.type_offre] || offre.type_offre}
        </span>
        <h2 className="mt-3 pr-8 text-xl font-bold leading-snug text-foreground">{offre.titre}</h2>

        {/* 2. Entreprise + ville + source */}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Building2 className="h-4 w-4" />
            {offre.entreprise}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4" />
            {offre.ville}
          </span>
          {offre.source_name && <span className="flex items-center gap-1.5">Source : {offre.source_name}</span>}
        </div>

        {/* 3. Date limite en clair + compte à rebours */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {date ? `Avant le ${DATE_FORMAT.format(date)}` : `Date limite : ${offre.date_limite}`}
          </span>
          {jours !== null &&
            (jours < 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                Clôturée
              </span>
            ) : jours === 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
                Dernier jour
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                <Clock className="h-3 w-3" />
                J-{jours}
              </span>
            ))}
        </div>

        {/* 4. Description complète (la carte reste tronquée) */}
        {offre.description && (
          <div className="mt-4">
            <h3 className="mb-1 text-sm font-semibold text-foreground">Description</h3>
            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/80">
              {offre.description}
            </p>
          </div>
        )}

        {/* 5. Filières cibles */}
        {filieres.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-semibold text-foreground">Filières cibles</h3>
            <div className="flex flex-wrap gap-2">
              {filieres.map((filiere) => (
                <span
                  key={filiere}
                  className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-semibold capitalize text-muted-foreground"
                >
                  {filiere.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 6. Comment postuler */}
        <div className="mt-5 rounded-xl bg-muted/40 p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Comment postuler</h3>
          {aUnCanal ? (
            <div className="flex flex-col gap-2">
              {email && (
                <a
                  href={`mailto:${email}?subject=${encodeURIComponent(`Candidature — ${offre.titre}`)}`}
                  className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors duration-150 hover:border-primary/40 hover:text-primary"
                >
                  <Mail className="h-4 w-4 shrink-0 text-primary" />
                  Postuler par e-mail
                </a>
              )}
              {whatsapp && (
                <a
                  href={lienWhatsApp(whatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors duration-150 hover:border-primary/40 hover:text-primary"
                >
                  <MessageCircle className="h-4 w-4 shrink-0 text-primary" />
                  Écrire sur WhatsApp
                </a>
              )}
              {lienSource && (
                <a
                  href={lienSource}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors duration-150 hover:border-primary/40 hover:text-primary"
                >
                  <ExternalLink className="h-4 w-4 shrink-0 text-primary" />
                  Voir l&apos;offre originale
                  {offre.source_name ? ` — ${offre.source_name}` : ""}
                </a>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucun canal de candidature indiqué — cherche l&apos;entreprise sur Google ou LinkedIn.
            </p>
          )}
        </div>

        {/* 7. J'ai postulé */}
        <Button
          onClick={onPostuler}
          disabled={postule || enCours}
          className="mt-5 w-full rounded-xl shadow-md transition-all duration-150 hover:shadow-lg"
        >
          {postule ? "Postulé ✅" : enCours ? "Enregistrement..." : "J'ai postulé"}
        </Button>
      </div>
    </div>
  );
}
