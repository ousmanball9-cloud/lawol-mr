"""Preuve mockée de la clôture des offres expirées — zéro réseau.

Incident du 27/10/2026 : 408 lignes `offres` pour 298 actives non expirées.
**110 offres mortes restaient `active = true`**, donc visibles partout où l'on
filtre sur `active` seul (liste des matches avant son correctif, admin, stats).

Contrat prouvé ici (`shared/cycle_vie.py`) :
    1. une offre dont `date_limite` < aujourd'hui est clôturée ;
    2. une offre qui expire AUJOURD'HUI reste ouverte (comparaison stricte) ;
    3. une offre sans date exploitable n'est JAMAIS clôturée (pas de clôture
       sur une donnée manquante) ;
    4. la simulation (`appliquer=False`) n'écrit rien ;
    5. l'écriture se fait par lots bornés (aucune URL PostgREST géante) ;
    6. un lot en échec n'empêche pas les suivants, et l'échec est COMPTÉ ;
    7. idempotence : après application, plus rien à sélectionner.

Usage : python -X utf8 scripts/test-cycle-vie-offres.py
"""
import os
import sys
from datetime import date
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))
os.environ.setdefault("SESSION_SECRET", "session-de-test-bidon-" + "x" * 32)

from apps.api.app.modules.shared import cycle_vie

CHECKS: list[tuple[bool, str]] = []


def check(condition: bool, libelle: str) -> None:
    CHECKS.append((bool(condition), libelle))
    print(f"  [{'OK' if condition else 'KO'}] {libelle}")


class FauxSupabase:
    """Reproduit le sous-ensemble PostgREST utilisé par `cycle_vie`."""

    def __init__(self, lignes: list[dict], lots_en_echec: set[int] | None = None):
        self.lignes = [dict(x) for x in lignes]
        self.lots_en_echec = lots_en_echec or set()
        self.ecritures: list[list[str]] = []
        self.appels_ecriture = 0

    def table(self, nom: str):
        assert nom == "offres", f"table inattendue : {nom}"
        return _Requete(self)


class _Requete:
    def __init__(self, faux: FauxSupabase):
        self._faux = faux
        self._action = "select"
        self._egalites: list[tuple[str, object]] = []
        self._different_null: list[str] = []
        self._inferieur: list[tuple[str, str]] = []
        self._maj: dict = {}
        self._ids: list[str] = []
        self.not_ = self

    # -- filtres -------------------------------------------------------------
    def select(self, *_a, **_k):
        self._action = "select"
        return self

    def eq(self, colonne, valeur):
        self._egalites.append((colonne, valeur))
        return self

    def is_(self, colonne, valeur):
        self._different_null.append(colonne)
        return self

    def lt(self, colonne, valeur):
        self._inferieur.append((colonne, valeur))
        return self

    # -- écriture ------------------------------------------------------------
    def update(self, valeurs):
        self._action = "update"
        self._maj = dict(valeurs)
        return self

    def in_(self, colonne, valeurs):
        assert colonne == "id"
        self._ids = list(valeurs)
        return self

    # -- exécution -----------------------------------------------------------
    def execute(self):
        if self._action == "update":
            self._faux.appels_ecriture += 1
            indice_lot = self._faux.appels_ecriture - 1
            if indice_lot in self._faux.lots_en_echec:
                raise RuntimeError("lot refusé (simulation d'échec)")
            self._faux.ecritures.append(list(self._ids))
            for ligne in self._faux.lignes:
                if ligne["id"] in self._ids:
                    ligne.update(self._maj)
            return _Resultat([])

        resultat = []
        for ligne in self._faux.lignes:
            if any(ligne.get(c) != v for c, v in self._egalites):
                continue
            if any(ligne.get(c) is None for c in self._different_null):
                continue
            if any(str(ligne.get(c) or "") >= v for c, v in self._inferieur):
                continue
            resultat.append(dict(ligne))
        return _Resultat(resultat)


class _Resultat:
    def __init__(self, data):
        self.data = data


def installer(faux: FauxSupabase) -> None:
    cycle_vie.supabase = faux


AUJ = date(2026, 10, 27)


def offre(ident: str, limite: str | None, active: bool = True) -> dict:
    return {
        "id": ident,
        "titre": f"Bourse {ident}",
        "source_name": "test",
        "date_limite": limite,
        "active": active,
    }


def main() -> int:
    print("=== 1. sélection : expirée oui, aujourd'hui non, sans date jamais ===")
    faux = FauxSupabase(
        [
            offre("a", "2026-10-20"),  # expirée
            offre("b", "2026-10-27"),  # expire aujourd'hui -> encore ouverte
            offre("c", None),  # date absente -> jamais clôturée
            offre("d", "2026-12-01"),  # future
            offre("e", "2026-10-01", active=False),  # déjà close
        ]
    )
    installer(faux)
    selection = cycle_vie.offres_expirees(AUJ)
    ids = sorted(o["id"] for o in selection)
    check(ids == ["a"], f"seule l'offre expirée est retenue : {ids}")
    check("b" not in ids, "une offre qui expire aujourd'hui reste ouverte")

    print("=== 2. simulation : aucun écrit ===")
    rapport = cycle_vie.cloturer_offres_expirees(appliquer=False, aujourdhui=AUJ)
    check(rapport["examinees"] == 1 and rapport["cloturees"] == 0, f"rapport simulation : {rapport['examinees']}/{rapport['cloturees']}")
    check(faux.ecritures == [], "aucune écriture en simulation")
    check(faux.lignes[0]["active"] is True, "l'offre reste active après simulation")

    print("=== 3. application : active=false, rien d'autre ===")
    rapport = cycle_vie.cloturer_offres_expirees(appliquer=True, aujourdhui=AUJ)
    check(rapport["cloturees"] == 1 and rapport["echecs"] == 0, f"1 clôturée, 0 échec : {rapport['cloturees']}/{rapport['echecs']}")
    check(faux.lignes[0]["active"] is False, "l'offre expirée est désactivée")
    check(faux.lignes[2]["active"] is True, "l'offre sans date est intacte")

    print("=== 4. idempotence : plus rien à clôturer ===")
    rapport = cycle_vie.cloturer_offres_expirees(appliquer=True, aujourdhui=AUJ)
    check(rapport["examinees"] == 0, f"2e passage : {rapport['examinees']} offre(s) examinée(s)")

    print("=== 5. écriture par lots bornés (250 offres -> 3 lots) ===")
    nombreuses = [offre(f"x{i}", "2026-01-01") for i in range(250)]
    faux = FauxSupabase(nombreuses)
    installer(faux)
    rapport = cycle_vie.cloturer_offres_expirees(appliquer=True, aujourdhui=AUJ)
    tailles = [len(lot) for lot in faux.ecritures]
    check(rapport["cloturees"] == 250, f"250 clôturées : {rapport['cloturees']}")
    check(tailles == [100, 100, 50], f"lots bornés : {tailles}")
    check(all(t <= cycle_vie.TAILLE_LOT for t in tailles), "aucun lot au-delà de la limite")

    print("=== 6. un lot en échec ne bloque pas les suivants ===")
    faux = FauxSupabase(nombreuses, lots_en_echec={0})
    installer(faux)
    rapport = cycle_vie.cloturer_offres_expirees(appliquer=True, aujourdhui=AUJ)
    check(rapport["echecs"] == 100, f"échec compté : {rapport['echecs']}")
    check(rapport["cloturees"] == 150, f"les lots suivants passent : {rapport['cloturees']}")
    check(len(rapport["echecs_detail"]) == 1, "l'échec est tracé, pas silencieux")

    ok = sum(1 for c, _ in CHECKS if c)
    print(f"\n=== BILAN : {ok}/{len(CHECKS)} checks verts ===")
    return 0 if ok == len(CHECKS) else 1


if __name__ == "__main__":
    raise SystemExit(main())
