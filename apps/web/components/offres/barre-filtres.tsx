import { Search } from "lucide-react";
import {
  CATEGORIES_BOURSE,
  FILIERES,
  PAYS_ETUDES,
  TYPES_FINANCEMENT,
  type TriOffres,
} from "./types";

type Props = {
  motsCles: string;
  setMotsCles: (valeur: string) => void;
  filiereFiltre: string;
  setFiliereFiltre: (valeur: string) => void;
  paysFiltre: string;
  setPaysFiltre: (valeur: string) => void;
  financementFiltre: string;
  setFinancementFiltre: (valeur: string) => void;
  /** Catégorie de bourse : « toutes » ou une valeur de `CATEGORIES_BOURSE`.
   *  Filtré CÔTÉ SERVEUR (`?categorie=`), comme `q` et `tri`. */
  categorieFiltre: string;
  setCategorieFiltre: (valeur: string) => void;
  /** Tri catalogue : « urgent » (défaut) ou « recentes ». */
  tri: TriOffres;
  setTri: (valeur: TriOffres) => void;
  /** Filtre « Clôture dans moins de 30 jours ». */
  cloture30: boolean;
  setCloture30: (valeur: boolean) => void;
  /** État explicite des offres expirées (masquées par défaut, jamais perdues). */
  expireesVisibles: boolean;
  setExpireesVisibles: (valeur: boolean) => void;
  /** Nombre d'offres expirées correspondant aux autres critères. */
  nbExpirees: number;
  nbResultats: number;
  nbTotal: number;
};

const SELECT =
  "rounded-lg border border-input bg-white px-3 py-2 text-sm text-foreground transition-colors duration-150 focus:border-signature focus:outline-none focus:ring-2 focus:ring-signature/30";

/** Basculante (filtre/état) : repos bordure fine, active en signature. */
const bascule = (actif: boolean) =>
  `rounded-lg border px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signature/60 ${
    actif
      ? "border-signature bg-signature text-white"
      : "border-input bg-white text-foreground hover:border-signature hover:text-signature"
  }`;

/** Barre de recherche (mots-clés) + 4 selects (filière, pays, financement, catégorie) + tri & échéance. */
export function BarreFiltres({
  motsCles,
  setMotsCles,
  filiereFiltre,
  setFiliereFiltre,
  paysFiltre,
  setPaysFiltre,
  financementFiltre,
  setFinancementFiltre,
  categorieFiltre,
  setCategorieFiltre,
  tri,
  setTri,
  cloture30,
  setCloture30,
  expireesVisibles,
  setExpireesVisibles,
  nbExpirees,
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
            placeholder="Rechercher une bourse, un titre, un pays, un mot-clé…"
            aria-label="Rechercher dans les offres"
            className="w-full rounded-lg border border-input bg-white py-2 pl-9 pr-3 text-sm text-foreground transition-colors duration-150 focus:border-signature focus:outline-none focus:ring-2 focus:ring-signature/30"
          />
        </div>
        <div data-probe="offres-filtres" className="flex flex-wrap gap-3">
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
          <select
            value={paysFiltre}
            onChange={(e) => setPaysFiltre(e.target.value)}
            aria-label="Filtrer par pays d'études"
            className={SELECT}
          >
            <option value="tous">Tous les pays</option>
            {PAYS_ETUDES.map((p) => (
              <option key={p.valeur} value={p.valeur}>
                {p.label}
              </option>
            ))}
          </select>
          <select
            value={financementFiltre}
            onChange={(e) => setFinancementFiltre(e.target.value)}
            aria-label="Filtrer par type de financement"
            className={SELECT}
          >
            <option value="tous">Tous financements</option>
            {TYPES_FINANCEMENT.map((f) => (
              <option key={f.valeur} value={f.valeur}>
                {f.label}
              </option>
            ))}
          </select>
          <select
            value={categorieFiltre}
            onChange={(e) => setCategorieFiltre(e.target.value)}
            aria-label="Filtrer par catégorie de bourse"
            data-probe="offres-categorie"
            className={SELECT}
          >
            <option value="toutes">Toutes les catégories</option>
            {CATEGORIES_BOURSE.map((c) => (
              <option key={c.valeur} value={c.valeur}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Deadline au centre : tri par urgence + fenêtre 30 j + état des expirées */}
      <div
        data-probe="offres-echeance"
        className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3"
      >
        <select
          value={tri}
          onChange={(e) => setTri(e.target.value as TriOffres)}
          aria-label="Trier les offres"
          data-probe="offres-tri"
          className={SELECT}
        >
          <option value="urgent">Plus urgentes</option>
          <option value="recentes">Plus récentes</option>
        </select>
        <button
          type="button"
          aria-pressed={cloture30}
          onClick={() => setCloture30(!cloture30)}
          className={bascule(cloture30)}
          data-probe="offres-cloture30"
        >
          Clôture dans moins de 30 jours
        </button>
        <button
          type="button"
          aria-pressed={expireesVisibles}
          onClick={() => setExpireesVisibles(!expireesVisibles)}
          className={bascule(expireesVisibles)}
          data-probe="offres-expirees"
        >
          {expireesVisibles ? "Masquer" : "Afficher"} les expirées ({nbExpirees})
        </button>
      </div>

      <p role="status" className="mt-3 text-sm text-muted-foreground">
        <span data-probe="offres-compteur">{nbResultats}</span> offre{nbResultats > 1 ? "s" : ""}{" "}
        affichée{nbResultats > 1 ? "s" : ""}
        {nbResultats !== nbTotal ? ` sur ${nbTotal}` : ""}
        {!expireesVisibles && nbExpirees > 0 && !cloture30
          ? ` · ${nbExpirees} expirée${nbExpirees > 1 ? "s" : ""} masquée${nbExpirees > 1 ? "s" : ""} (affichables ci-dessus)`
          : ""}
        {cloture30 && nbExpirees > 0
          ? " · fenêtre 30 j : offres closes exclues (désactive le filtre pour les afficher)"
          : ""}
      </p>
    </div>
  );
}
