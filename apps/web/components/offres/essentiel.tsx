import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  GraduationCap,
  MapPin,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { FINANCEMENTS_CONNUS } from "./financement";
import { labelFinancement, labelPays, type Offre } from "./types";
import { parserDateLimite } from "./date-limite";

/**
 * Bloc « L'essentiel » de la fiche bourse — 5 faits de décision, avant toute prose.
 *
 * Deux patterns concurrents mesurés le 29/10/2026 (docs/chasse/02-carte-fiche.md) :
 *  · C-HS-01 : les faits de décision tiennent en quelques lignes, en tête ;
 *  · C-JT-06 : les critères qui éliminent (date limite, niveau, éligibilité)
 *    arrivaient ~1 600 px plus bas, après la description.
 * Ici les critères éliminants passent en PREMIER, dans le même bloc, et le bloc
 * est monté juste après le titre : la fiche ne commence plus par de la prose.
 *
 * Règle de données (C-JT-07) : seuls les champs réellement servis par l'API sont
 * lus — `date_limite`, `type_financement`, `pays_etudes` (modèle
 * `OffreStagePublic`). Le payload ne porte NI niveau requis, NI nationalité :
 * ces lignes affichent « non communiqué », jamais un vide, jamais une valeur
 * supposée. `inconnu` en financement n'est pas un niveau : il n'est pas affiché.
 */

const NON_COMMUNIQUE = "non communiqué";

const FORMAT_DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

type Fait = {
  cle: string;
  probe: string;
  libelle: string;
  valeur: string;
  icone: LucideIcon;
  absent: boolean;
};

/** Date exacte (« 10 décembre 2026 ») ; valeur brute si non parsable, jamais une estimation. */
function dateExacte(valeur: string | null | undefined): string {
  const brut = (valeur ?? "").trim();
  if (!brut) return NON_COMMUNIQUE;
  const date = parserDateLimite(brut);
  return date ? FORMAT_DATE.format(date) : brut;
}

function LigneFait({ fait }: { fait: Fait }) {
  const Icone = fait.icone;
  return (
    <div className="flex items-start gap-2 rounded-md border border-border bg-card px-3 py-2">
      <Icone className="mt-0.5 h-4 w-4 shrink-0 text-signature" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {fait.libelle}
        </dt>
        <dd
          data-probe={fait.probe}
          className={
            fait.absent
              ? "text-sm text-muted-foreground"
              : "text-sm font-medium text-foreground"
          }
        >
          {fait.valeur}
        </dd>
      </div>
    </div>
  );
}

export function FicheEssentiel({ offre }: { offre: Offre }) {
  const financement = (offre.type_financement ?? "").trim();
  const financementTexte = FINANCEMENTS_CONNUS.has(financement)
    ? labelFinancement(financement)
    : NON_COMMUNIQUE;
  const paysTexte = offre.pays_etudes?.trim()
    ? labelPays(offre.pays_etudes)
    : NON_COMMUNIQUE;
  const dateLimite = dateExacte(offre.date_limite);

  // Ordre volontaire : ce qui peut éliminer la candidature d'abord.
  const eliminants: Fait[] = [
    {
      cle: "date-limite",
      probe: "essentiel-date-limite",
      libelle: "Date limite",
      valeur: dateLimite,
      icone: CalendarDays,
      absent: dateLimite === NON_COMMUNIQUE,
    },
    {
      cle: "niveau",
      probe: "essentiel-niveau",
      libelle: "Niveau requis",
      valeur: NON_COMMUNIQUE,
      icone: GraduationCap,
      absent: true,
    },
    {
      cle: "eligibilite",
      probe: "essentiel-eligibilite",
      libelle: "Éligibilité",
      valeur: NON_COMMUNIQUE,
      icone: ShieldCheck,
      absent: true,
    },
  ];

  // Faits d'information : uniquement des champs servis par l'API.
  const faits: Fait[] = [
    {
      cle: "financement",
      probe: "essentiel-financement",
      libelle: "Financement",
      valeur: financementTexte,
      icone: Wallet,
      absent: financementTexte === NON_COMMUNIQUE,
    },
    {
      cle: "pays",
      probe: "essentiel-pays",
      libelle: "Pays d'études",
      valeur: paysTexte,
      icone: MapPin,
      absent: paysTexte === NON_COMMUNIQUE,
    },
  ];

  return (
    <section
      data-probe="fiche-essentiel"
      aria-labelledby="essentiel-titre"
      className="mt-6 rounded-lg border border-border bg-muted/40 px-4 py-4"
    >
      <h2 id="essentiel-titre" className="eyebrow text-muted-foreground">
        L&apos;essentiel
      </h2>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Vérifie d&apos;abord ces critères : ils peuvent éliminer ta candidature.
      </p>
      <dl data-probe="fiche-criteres-eliminants" className="mt-3 grid gap-2 sm:grid-cols-3">
        {eliminants.map((fait) => (
          <LigneFait key={fait.cle} fait={fait} />
        ))}
      </dl>

      <dl data-probe="fiche-essentiel-faits" className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-3">
        {faits.map((fait) => (
          <LigneFait key={fait.cle} fait={fait} />
        ))}
      </dl>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        «&nbsp;{NON_COMMUNIQUE}&nbsp;» : l&apos;annonce ne donne pas cette information — à
        vérifier dans l&apos;annonce officielle. LAWOL n&apos;invente aucune valeur.
      </p>
    </section>
  );
}
