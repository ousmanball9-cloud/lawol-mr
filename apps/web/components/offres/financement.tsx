import { Award } from "lucide-react";
import { labelFinancement } from "./types";

/** Types de financement réellement renseignés côté données (enum TypeFinancement).
 *  Tout le reste — `inconnu` compris — est présenté « non précisé » : on
 *  n'attribue jamais un niveau de financement que la source n'énonce pas. */
const FINANCEMENTS_CONNUS = new Set(["fully_funded", "partiel", "auto_finance"]);

/**
 * Libellé HONNÊTE du financement : reprend le libellé de l'enum pour les valeurs
 * renseignées, « Financement non précisé » dans tous les autres cas.
 * Jamais de montant, jamais de taux : ils ne sont pas dans nos données.
 */
export function labelFinancementHonteux(valeur: string | null | undefined): string {
  const cle = (valeur ?? "").trim();
  return FINANCEMENTS_CONNUS.has(cle) ? labelFinancement(cle) : "Financement non précisé";
}

/** Bloc « Financement » de la fiche bourse — information seule, sans estimation. */
export function BlocFinancement({
  typeFinancement,
}: {
  typeFinancement: string | null | undefined;
}) {
  const cle = (typeFinancement ?? "").trim();
  const precise = FINANCEMENTS_CONNUS.has(cle);

  return (
    <section
      data-probe="detail-financement"
      className="mt-4 rounded-lg border border-border bg-muted/40 px-4 py-3"
    >
      <h2 className="eyebrow mb-3 text-muted-foreground">Financement</h2>
      <p className="flex items-start gap-1.5 text-sm font-medium text-foreground">
        <Award className="mt-0.5 h-4 w-4 shrink-0 text-signature" aria-hidden="true" />
        <span data-probe="detail-financement-valeur">{labelFinancementHonteux(cle)}</span>
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {precise
          ? "Montant et frais réellement couverts : à vérifier dans l'annonce officielle — LAWOL n'affiche ni montant ni taux, faute de source."
          : "L'annonce ne précise pas le financement. LAWOL n'invente ni montant ni taux : vérifie le détail dans l'annonce officielle."}
      </p>
    </section>
  );
}
