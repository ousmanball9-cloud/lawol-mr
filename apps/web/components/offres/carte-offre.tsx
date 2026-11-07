import Link from "next/link";
import { ArrowRight, Award, Clock, MapPin } from "lucide-react";
import { TYPES_OFFRES } from "@/components/offre-detail-modal";
import { FINANCEMENTS_CONNUS, labelFinancementHonteux } from "./financement";
import { labelCategorieBourse, labelPays } from "./types";
import { joursRestants, parserDateLimite } from "./date-limite";
import { formaterMontant } from "@/lib/montant";
import type { Offre } from "./types";

/** Seuil « urgent » : sous 7 jours, la pastille passe de l'indigo au surlignage. */
const SEUIL_URGENT_JOURS = 7;

/**
 * Carte d'offre compacte (backlog V3-03) — 3 zones, ≤ 210 px à 390 px de large.
 *
 *   1. IDENTITÉ   : employeur · nature de l'offre, puis le titre (2 lignes max).
 *   2. FAITS      : pays · catégorie, puis le financement (le critère n°1 de
 *                   l'étudiant, visible sans ouvrir la fiche — C-HS-05).
 *   3. ÉCHÉANCE   : une SEULE pastille de confiance (J-n / « Dernier jour » /
 *                   « Clôturée ») + l'affordance « Voir l'offre ».
 *
 * Règle « un badge de confiance par carte » (C-JT-04 / design-system §3.4) :
 * seule l'échéance garde une pastille. Financement, catégorie et nature sont
 * des FAITS en texte (aucune pastille concurrente), la description est réduite
 * à 2 lignes de 12 px pour tenir la hauteur cible.
 *
 * `data-probe` conservés : offre-carte, offre-financement, offre-echeance,
 * offre-categorie (+ la classe historique `badge-offre`, lue par
 * scripts/verify-live-public.mjs — elle ne porte plus de pastille).
 *
 * ÉCHÉANCE (même logique que /offres/[id] → date-limite.ts) :
 *   · J-n        → pastille indigo `bg-nuit`
 *   · J-n ≤ 7    → surlignage (urgent), J-0 → « Dernier jour »
 *   · expirée    → « Clôturée » gris + carte atténuée
 *   · date illisible → la date brute prend la place (aucune donnée masquée).
 * Une offre expirée n'est jamais supprimée ici : c'est /offres qui décide de
 * l'afficher via l'état explicite « Afficher les expirées ».
 */
export function CarteOffre({ offre }: { offre: Offre }) {
  const jours = joursRestants(parserDateLimite(offre.date_limite));
  const expiree = jours !== null && jours < 0;
  // La LISTE ne sert qu'un aperçu (voir types.ts) ; une offre complète (détail,
  // similaires) porte `description`. Les deux cas affichent la même 2-lignes.
  const apercu = offre.description_apercu || offre.description;
  const categorie = labelCategorieBourse(offre.categorie_bourse);
  // Financement : affiché SEULEMENT s'il est réellement renseigné. Sur la carte on
  // n'annonce pas une absence (12 × « non précisé » = bruit) — la fiche, elle, la dit.
  const financementConnu = FINANCEMENTS_CONNUS.has((offre.type_financement ?? "").trim());
  // Montant annoncé (contrat §2.1) : même ligne que le financement pour ne pas
  // ajouter une hauteur de carte (cible ≤ 210 px prouvée par verify-carte-compacte).
  const montantTexte = formaterMontant(offre.montant);

  return (
    <Link
      href={`/offres/${offre.id}`}
      data-probe="offre-carte"
      className={`group flex flex-col rounded-lg border border-border bg-card p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-signature hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signature/60${
        expiree ? " opacity-70" : ""
      }`}
    >
      {/* 1 · IDENTITÉ — qui propose quoi (une seule ligne d'en-tête). */}
      <div
        data-zone="identite"
        className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-xs text-muted-foreground"
      >
        <span className="min-w-0 truncate">{offre.entreprise}</span>
        <span aria-hidden="true" className="shrink-0">
          ·
        </span>
        <span className="badge-offre shrink-0 font-semibold uppercase tracking-[0.08em] text-signature-deep">
          {TYPES_OFFRES[offre.type_offre] || offre.type_offre}
        </span>
      </div>
      <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:text-signature">
        {offre.titre}
      </h3>

      {/* 2 · FAITS DÉCISIFS — lieu, catégorie, financement (texte, pas de pastille). */}
      <div data-zone="faits" className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate">
            {offre.pays_etudes ? labelPays(offre.pays_etudes) : "Non précisé"}
          </span>
          {categorie && (
            <>
              <span aria-hidden="true" className="shrink-0">
                ·
              </span>
              <span
                data-probe="offre-categorie"
                className="min-w-0 truncate font-medium text-signature-deep"
              >
                {categorie}
              </span>
            </>
          )}
        </p>
        {(financementConnu || montantTexte) && (
          <p
            data-probe="offre-financement"
            className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap"
          >
            <Award className="h-3.5 w-3.5 shrink-0 text-signature" aria-hidden="true" />
            {financementConnu && (
              <span className="min-w-0 truncate font-medium text-foreground">
                {labelFinancementHonteux(offre.type_financement)}
              </span>
            )}
            {financementConnu && montantTexte && (
              <span aria-hidden="true" className="shrink-0">
                ·
              </span>
            )}
            {montantTexte && (
              <span
                data-probe="offre-montant"
                className="shrink-0 font-semibold tabular-nums text-signature-deep"
              >
                {montantTexte}
              </span>
            )}
          </p>
        )}
      </div>

      {/* Description : 2 lignes de 12 px max — jamais plus, sinon la carte déborde. */}
      {apercu && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{apercu}</p>}

      {/* 3 · ÉCHÉANCE + CTA — l'unique pastille de confiance de la carte. */}
      <div data-zone="echeance-cta" className="mt-2 flex items-center justify-between gap-2">
        {jours === null ? (
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            Limite : {offre.date_limite}
          </span>
        ) : (
          <span
            data-probe="offre-echeance"
            className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
              expiree
                ? "border border-border bg-muted text-muted-foreground"
                : jours <= SEUIL_URGENT_JOURS
                  ? "border border-surlignage/50 bg-surlignage/15 text-ink"
                  : "bg-nuit text-white"
            }`}
          >
            {expiree ? (
              "Clôturée"
            ) : jours === 0 ? (
              "Dernier jour"
            ) : (
              <>
                <Clock className="h-3 w-3" aria-hidden="true" />
                J-{jours}
              </>
            )}
          </span>
        )}
        <span
          aria-hidden="true"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-signature-deep group-hover:text-signature"
        >
          Voir l&apos;offre
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
