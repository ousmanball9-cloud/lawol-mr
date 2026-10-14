"use client";

import { Calendar, Clock, MapPin, Share2, Star, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BADGES_TYPE, STATUTS, TYPES_OFFRES, type OffreDetail } from "@/components/offre-detail-modal";
import { joursRestants, parserDateLimite } from "@/components/offres/date-limite";

const SEUIL_URGENT_JOURS = 7;
const BADGE_OFFRE_NEUTRE = "border border-border bg-muted text-muted-foreground";

/**
 * Carte d'offre compacte pour l'accordéon entreprise.
 * Reprend le design de `CarteOffre` mais avec :
 * - Badge statut visible en permanence (pas seulement dans la modale)
 * - Boutons Postuler / Favori / Partager intégrés
 * - Mode compact pour s'insérer dans une grille responsive
 *
 * @param offre - Détail complet de l'offre (GET /api/v1/matches)
 * @param postule - Si l'utilisateur a déjà postulé
 * @param statut - Statut de candidature courant (null = non renseigné)
 * @param favori - Si l'offre est en favori
 * @param onPostuler - Callback clic "J'ai postulé"
 * @param onFavori - Callback toggle favori
 * @param onStatut - Callback changement statut (depuis le select)
 * @param onPartager - Callback partage WhatsApp
 * @param compact - Mode compact (réduit padding/hauteur)
 */
export default function OffreCard({
  offre,
  postule,
  statut = null,
  favori = false,
  onPostuler,
  onFavori,
  onStatut,
  onPartager,
  compact = false,
}: {
  offre: OffreDetail;
  postule: boolean;
  statut?: string | null;
  favori?: boolean;
  onPostuler: (id: string) => void;
  onFavori: (id: string, favori: boolean) => void;
  onStatut: (id: string, statut: string | null) => void;
  onPartager: (offre: OffreDetail) => void;
  compact?: boolean;
}) {
  const date = parserDateLimite(offre.date_limite);
  const jours = joursRestants(date);
  const expiree = jours !== null && jours < 0;

  const badgeClasse = expiree
    ? "border border-border bg-muted text-muted-foreground"
    : jours !== null && jours <= SEUIL_URGENT_JOURS
      ? "border border-amber-200 bg-amber-50 text-amber-900"
      : jours !== null
        ? "bg-nuit text-white"
        : "border border-border bg-muted text-muted-foreground";

  const badgeTexte = expiree
    ? "Clôturée"
    : jours === 0
      ? "Dernier jour"
      : jours !== null
        ? (
          <>
            <Clock className="h-3 w-3" aria-hidden="true" />
            J-{jours}
          </>
        )
        : offre.date_limite;

  return (
    <article
      data-probe="offre-card"
      data-statut={statut ?? "none"}
      className={`group relative rounded-lg border border-border bg-card p-4 shadow-[0_1px_3px_rgba(10,10,10,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-signature hover:shadow-[0_1px_3px_rgba(10,10,10,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signature/60 ${expiree ? "opacity-70" : ""} ${compact ? "p-3" : ""}`}
    >
      {/* Ligne 1 : Titre + Badge type */}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-semibold leading-snug text-foreground group-hover:text-signature pr-8">
          {offre.titre}
        </h3>
        <span
          className={`badge-offre inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${
            BADGES_TYPE[offre.type_offre] ?? BADGE_OFFRE_NEUTRE
          }`}
        >
          {TYPES_OFFRES[offre.type_offre] || offre.type_offre}
        </span>
      </div>

      {/* Ligne 2 : Entreprise + Ville + Date limite */}
      <div className="mb-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Building2 className="h-4 w-4" />
          {offre.entreprise}
        </span>
        <span className="flex items-center gap-1.5">
          <MapPin className="h-4 w-4" />
          {offre.ville}
        </span>
        <span className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4" />
          {offre.date_limite}
        </span>
      </div>

      {/* Ligne 3 : Badge échéance + Badge statut candidature (si postulé) */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {jours !== null && (
          <span
            data-probe="offre-echeance"
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClasse}`}
          >
            {badgeTexte}
          </span>
        )}
        {postule && (
          <span
            data-probe="statut-badge"
            className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground"
          >
            {STATUTS[statut ?? "postule"] ?? "Postulé"}
          </span>
        )}
      </div>

      {/* Description (optionnelle, tronquée) */}
      {offre.description && !compact && (
        <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{offre.description}</p>
      )}

      {/* Barre d'actions : Favori | Postuler | Partager | Statut (select si postulé) */}
      <div className="relative z-10 mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onFavori(offre.id, !favori)}
          aria-pressed={favori}
          aria-label={favori ? `Retirer "${offre.titre}" des favoris` : `Ajouter "${offre.titre}" aux favoris`}
          data-probe="favori"
          data-actif={favori ? "true" : "false"}
          className={`rounded-lg border-border px-3 transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-signature/60 ${
            favori ? "border-surlignage text-surlignage" : "hover:border-surlignage hover:text-surlignage"
          }`}
        >
          <Star className={`h-4 w-4 ${favori ? "fill-current" : ""}`} />
        </Button>

        <Button
          type="button"
          size="sm"
          onClick={() => onPostuler(offre.id)}
          disabled={postule}
          className="rounded-lg bg-signature px-4 text-white hover:bg-signature-deep focus-visible:ring-2 focus-visible:ring-signature/60"
          aria-label={`Postuler à "${offre.titre}"`}
        >
          {postule ? "Postulé ✅" : "J'ai postulé"}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onPartager(offre)}
          className="rounded-lg border-border transition-colors duration-150 hover:border-signature hover:text-signature focus-visible:ring-2 focus-visible:ring-signature/60"
          aria-label={`Partager "${offre.titre}"`}
        >
          <Share2 className="mr-2 h-4 w-4" />
          Partager
        </Button>

        {/* Select statut (visible seulement si postulé) */}
        {postule && (
          <select
            value={statut ?? "postule"}
            onChange={(e) => onStatut(offre.id, e.target.value || null)}
            aria-label={`Statut de candidature pour "${offre.titre}"`}
            data-probe="statut"
            className="ml-auto rounded-lg border border-input bg-white px-3 py-1.5 text-sm text-foreground transition-colors duration-150 focus:border-signature focus:outline-none focus:ring-2 focus:ring-signature/30"
          >
            {Object.entries(STATUTS).map(([valeur, libelle]) => (
              <option key={valeur} value={valeur}>
                {libelle}
              </option>
            ))}
          </select>
        )}
      </div>
    </article>
  );
}