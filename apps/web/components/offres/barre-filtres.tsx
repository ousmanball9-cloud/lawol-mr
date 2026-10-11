import { Search } from "lucide-react";
import { TYPES_OFFRES } from "@/components/offre-detail-modal";
import { FILIERES, VILLES, TYPE_EN_TETE } from "./types";

type Props = {
  motsCles: string;
  setMotsCles: (valeur: string) => void;
  typeFiltre: string;
  setTypeFiltre: (valeur: string) => void;
  villeFiltre: string;
  setVilleFiltre: (valeur: string) => void;
  filiereFiltre: string;
  setFiliereFiltre: (valeur: string) => void;
  nbResultats: number;
  nbTotal: number;
};

const SELECT =
  "rounded-lg border border-input bg-white px-3 py-2 text-sm text-foreground transition-colors duration-150 focus:border-signature focus:outline-none focus:ring-2 focus:ring-signature/30";

/** Types classés : la « Bourse » en vedette en tête, le reste dans l'ordre du dict. */
const TYPES_TRIES = Object.entries(TYPES_OFFRES).sort(([a], [b]) => {
  if (a === TYPE_EN_TETE) return -1;
  if (b === TYPE_EN_TETE) return 1;
  return 0;
});

/** Barre de recherche (mots-clés) + 3 selects (type, ville, filière) + compteur. */
export function BarreFiltres({
  motsCles,
  setMotsCles,
  typeFiltre,
  setTypeFiltre,
  villeFiltre,
  setVilleFiltre,
  filiereFiltre,
  setFiliereFiltre,
  nbResultats,
  nbTotal,
}: Props) {
  return (
    <div className="mb-6 rounded-lg border border-border bg-card p-4 shadow-[0_1px_3px_rgba(10,10,10,0.04)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap">
        <div className="relative min-w-[200px] flex-1" data-probe="offres-recherche">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={motsCles}
            onChange={(e) => setMotsCles(e.target.value)}
            placeholder="Rechercher une bourse, un titre, une entreprise, un mot-clé…"
            aria-label="Rechercher dans les offres"
            className="w-full rounded-lg border border-input bg-white py-2 pl-9 pr-3 text-sm text-foreground transition-colors duration-150 focus:border-signature focus:outline-none focus:ring-2 focus:ring-signature/30"
          />
        </div>
        <div data-probe="offres-filtres" className="flex flex-wrap gap-3">
          <select
            value={typeFiltre}
            onChange={(e) => setTypeFiltre(e.target.value)}
            aria-label="Filtrer par type d'offre"
            className={SELECT}
          >
            <option value="tous">Tous les types</option>
            {TYPES_TRIES.map(([valeur, label]) => (
              <option key={valeur} value={valeur}>
                {label}
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
          <select
            value={filiereFiltre}
            onChange={(e) => setFiliereFiltre(e.target.value)}
            aria-label="Filtrer par filière"
            className={SELECT}
          >
            <option value="tous">Toutes les filières</option>
            {FILIERES.map((f) => (
              <option key={f.valeur} value={f.valeur}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p role="status" className="mt-3 text-sm text-muted-foreground">
        <span data-probe="offres-compteur">{nbResultats}</span> offre{nbResultats > 1 ? "s" : ""}{" "}
        affichée{nbResultats > 1 ? "s" : ""}
        {nbResultats !== nbTotal ? ` sur ${nbTotal}` : ""}
      </p>
    </div>
  );
}
