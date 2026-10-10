import { VILLES } from "./types";

type Props = {
  secteurFiltre: string;
  setSecteurFiltre: (valeur: string) => void;
  villeFiltre: string;
  setVilleFiltre: (valeur: string) => void;
  secteurs: string[];
  nbResultats: number;
  nbTotal: number;
};

const SELECT =
  "rounded-lg border border-input bg-white px-3 py-2 text-sm text-foreground transition-colors duration-150 focus:border-signature focus:outline-none focus:ring-2 focus:ring-signature/30";

/** Barre de filtres de l'annuaire : 2 selects (secteur, ville) + compteur. */
export function FiltresEntreprises({
  secteurFiltre,
  setSecteurFiltre,
  villeFiltre,
  setVilleFiltre,
  secteurs,
  nbResultats,
  nbTotal,
}: Props) {
  return (
    <div className="mb-6 rounded-lg border border-border bg-card p-4 shadow-[0_1px_3px_rgba(10,10,10,0.04)]">
      <div data-probe="entreprises-filtres" className="flex flex-wrap gap-3">
        <select
          value={secteurFiltre}
          onChange={(e) => setSecteurFiltre(e.target.value)}
          aria-label="Filtrer par secteur"
          className={SELECT}
        >
          <option value="tous">Tous les secteurs</option>
          {secteurs.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={villeFiltre}
          onChange={(e) => setVilleFiltre(e.target.value)}
          aria-label="Filtrer par ville"
          className={SELECT}
        >
          <option value="tous">Toutes les villes</option>
          {VILLES.map((v) => (
            <option key={v.valeur} value={v.valeur}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      <p role="status" className="mt-3 text-sm text-muted-foreground">
        <span data-probe="entreprises-compteur">{nbResultats}</span> entreprise{nbResultats > 1 ? "s" : ""}
        {nbResultats !== nbTotal ? ` sur ${nbTotal}` : ""}
      </p>
    </div>
  );
}
