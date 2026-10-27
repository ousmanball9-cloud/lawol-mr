"""Preuve mockée de la liste ADMIN des offres — zéro réseau.

Défaut mesuré le 27/10/2026 : la page admin lisait la liste PUBLIQUE
(`/api/v1/offres`), qui n'expose que les offres `active = true` à échéance
future et plafonne par défaut à 50. Conséquences :

  · **200 offres visibles sur 298** (le reste introuvable) ;
  · **110 offres clôturées invisibles** — donc non réactivables ;
  · colonne « Active » toujours « Oui » par construction (aucune info).

Contrat prouvé ici (`GET /api/v1/admin/offres`) :
    1. les offres clôturées sont INCLUSES par défaut (aucune n'est cachée) ;
    2. `inclure_inactives=false` les exclut (vue « publiées ») ;
    3. pagination : `limit`/`offset` rendent des pages disjointes et `total`
       annonce le nombre réel, pas la taille de page ;
    4. `limit` est borné (jamais d'URL PostgREST géante ni de dump complet) ;
    5. tri par `date_scrape` décroissant (la plus fraîche d'abord) ;
    6. garde admin : l'endpoint appelle `_admin_autorise` (une route non gardée
       exposerait l'état de publication de toutes les offres).

Usage : python -X utf8 scripts/test-admin-offres.py
"""
import asyncio
import os
import sys
import types
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RACINE))
os.environ.setdefault("SESSION_SECRET", "session-de-test-bidon-" + "x" * 32)

CHECKS: list[tuple[bool, str]] = []


def check(condition: bool, libelle: str) -> None:
    CHECKS.append((bool(condition), libelle))
    print(f"  [{'OK' if condition else 'KO'}] {libelle}")


class _Resultat:
    def __init__(self, data, count=None):
        self.data = data
        self.count = count


class _Table:
    def __init__(self, base):
        self._base = base
        self._egalites: list[tuple[str, object]] = []
        self._range = None
        self._ordre = None
        self._avec_total = False

    def select(self, *_a, **kwargs):
        self._avec_total = kwargs.get("count") == "exact"
        return self

    def eq(self, colonne, valeur):
        self._egalites.append((colonne, valeur))
        return self

    def order(self, colonne, desc=False):
        self._ordre = (colonne, desc)
        return self

    def range(self, debut, fin):
        self._range = (debut, fin)
        return self

    def execute(self):
        lignes = [dict(x) for x in self._base.lignes]
        for colonne, valeur in self._egalites:
            lignes = [x for x in lignes if x.get(colonne) == valeur]
        total = len(lignes)
        if self._ordre:
            colonne, desc = self._ordre
            lignes.sort(key=lambda x: str(x.get(colonne) or ""), reverse=desc)
        if self._range:
            debut, fin = self._range
            self._base.ranges.append((debut, fin))
            lignes = lignes[debut : fin + 1]
        return _Resultat(lignes, total if self._avec_total else None)


class FauxSupabase:
    def __init__(self, lignes):
        self.lignes = lignes
        self.ranges: list[tuple[int, int]] = []

    def table(self, nom):
        assert nom == "offres", f"table inattendue : {nom}"
        return _Table(self)


def offre(ident, active, scrape):
    return {
        "id": ident,
        "titre": f"Offre {ident}",
        "entreprise": "Organisme",
        "type_offre": "bourse",
        "date_limite": "2026-12-31",
        "date_scrape": scrape,
        "active": active,
        "source_name": "test",
        "ville": "Nouakchott",
        "pays_etudes": "france",
    }


def main() -> int:
    lignes = [
        offre("a", True, "2026-10-25"),
        offre("b", True, "2026-10-26"),
        offre("c", False, "2026-09-01"),
        offre("d", False, "2026-08-01"),
        offre("e", True, "2026-10-01"),
    ]
    faux = FauxSupabase(lignes)

    _module = types.ModuleType("supabase")
    _module.Client = object
    _module.create_client = lambda url, key=None, **kw: faux
    sys.modules["supabase"] = _module  # AVANT l'import de l'app

    import apps.api.app.main as api

    appels_garde = {"n": 0}

    def garde_factice(_request):
        appels_garde["n"] += 1

    api._admin_autorise = garde_factice  # l'endpoint doit l'appeler

    async def appeler(**kwargs):
        return await api.lister_offres_admin(request=None, **kwargs)

    print("=== 1. toutes les offres, clôturées INCLUSES ===")
    rep = asyncio.run(appeler())
    ids = [o["id"] for o in rep["offres"]]
    check(sorted(ids) == ["a", "b", "c", "d", "e"], f"5 offres rendues : {ids}")
    check(rep["total"] == 5, f"total réel annoncé : {rep['total']}")
    check(sum(1 for o in rep["offres"] if not o["active"]) == 2, "les 2 offres clôturées sont visibles")
    check(appels_garde["n"] >= 1, "garde admin appelée (endpoint protégé)")

    print("=== 2. tri : la plus fraîche d'abord ===")
    check(
        [o["id"] for o in rep["offres"]][:2] == ["b", "a"],
        f"ordre par date_scrape desc : {[o['id'] for o in rep['offres']]}",
    )

    print("=== 3. inclure_inactives=false → vue « publiées » ===")
    rep = asyncio.run(appeler(inclure_inactives=False))
    check(
        all(o["active"] for o in rep["offres"]) and len(rep["offres"]) == 3,
        f"3 offres actives seulement : {[o['id'] for o in rep['offres']]}",
    )
    check(rep["total"] == 3, f"total de la vue filtrée : {rep['total']}")

    print("=== 4. pagination : pages disjointes, total stable ===")
    p1 = asyncio.run(appeler(limit=2, offset=0))
    p2 = asyncio.run(appeler(limit=2, offset=2))
    p3 = asyncio.run(appeler(limit=2, offset=4))
    vus = [o["id"] for o in p1["offres"] + p2["offres"] + p3["offres"]]
    check(len(vus) == 5 and len(set(vus)) == 5, f"5 offres distinctes sur 3 pages : {vus}")
    check(
        p1["total"] == p2["total"] == p3["total"] == 5,
        f"total constant entre les pages : {p1['total']}/{p2['total']}/{p3['total']}",
    )
    check(
        (p1["offset"], p2["offset"], p3["offset"]) == (0, 2, 4),
        "l'offset est bien transmis (pas de page répétée)",
    )

    print("=== 5. limit borné (jamais de dump géant) ===")
    faux.ranges.clear()
    rep = asyncio.run(appeler(limit=99999))
    debut, fin = faux.ranges[-1]
    check(fin - debut + 1 == 500, f"plafond appliqué : {fin - debut + 1} lignes demandées (max 500)")
    check(rep["offres"], "la réponse reste exploitable")

    ok = sum(1 for c, _ in CHECKS if c)
    print(f"\n=== BILAN : {ok}/{len(CHECKS)} checks verts ===")
    return 0 if ok == len(CHECKS) else 1


if __name__ == "__main__":
    raise SystemExit(main())
