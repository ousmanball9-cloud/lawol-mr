"""Preuve MOCKÉE de l'élasticité d'enum sur `offres.filieres_cibles` — zéro réseau.

Incident 26/10/2026 : `models.Filiere` (35 valeurs) et l'enum PostgreSQL
`filiere` ont divergé — la base refuse `genie_procedes`. Résultat mesuré en
collecte réelle : des dizaines d'offres échouaient en `22P02` et étaient
PERDUES (une seule filière fautive faisait sauter l'offre entière).
Conséquence produit : catalogue affamé, filières sans aucune offre, et un
étudiant de cette filière qui ne peut même pas s'inscrire.

Contrat prouvé ici (`BaseScraper.save`) :
    1. une filière refusée par la base est ÉLAGUÉE, l'offre est quand même
       insérée (les autres filières sont conservées) ;
    2. la filière écartée reste TRAÇABLE dans `metadata['filieres_ignorees_base']`
       (aucune perte silencieuse) ;
    3. si plus aucune filière ne passe, repli sur `autre` (valeur de l'enum
       d'origine) ;
    4. une offre saine n'écrit PAS la clé de trace (non-régression) ;
    5. une erreur qui n'est PAS un refus d'enum échoue normalement (on ne
       masque rien) ;
    6. l'élagage est BORNÉ (pas de boucle infinie) : au pire `_MAX_ELAGAGES`
       tentatives puis l'offre compte comme erreur.

Usage : python -X utf8 scripts/test-enum-filiere-elasticite.py
Sortie : checks OK/KO — code retour 0 si tout est vert.
"""
import copy
import os
import sys
from datetime import date
from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]  # lawol-mr
sys.path.insert(0, str(RACINE))
os.environ.setdefault("SESSION_SECRET", "session-de-test-bidon-" + "x" * 32)

from apps.api.app.modules.scraper.sources import base as base_mod
from apps.api.app.modules.scraper.sources.base import BaseScraper
from apps.api.app.modules.shared.models import (
    OffreStageCreate,
    SourceType,
)

CHECKS: list[tuple[bool, str]] = []


def check(condition: bool, libelle: str) -> None:
    CHECKS.append((bool(condition), libelle))
    print(f"  [{'OK' if condition else 'KO'}] {libelle}")


# ------------------------- Faux Supabase (zéro réseau) -------------------------
class FauxRefusEnum(Exception):
    """Refus PostgREST d'une valeur d'enum (code 22P02)."""


class FauxReseau(Exception):
    """Panne réseau simulée."""


class _Resultat:
    def __init__(self, data):
        self.data = data


class FauxSupabase:
    """Refuse les valeurs absentes de `valeurs_enum` comme le ferait PostgREST."""

    def __init__(self, valeurs_enum: set[str], echec_non_enum: bool = False):
        self.valeurs = set(valeurs_enum)
        self.echec_non_enum = echec_non_enum
        self.ecrits: list[dict] = []
        self.appels = 0

    def table(self, nom: str):
        assert nom == "offres", f"table inattendue : {nom}"
        return _Constructeur(self)


class _Constructeur:
    def __init__(self, faux: FauxSupabase):
        self._faux = faux
        self._data: dict = {}

    def upsert(self, data, on_conflict=None):
        self._data = copy.deepcopy(data)
        return self

    def execute(self):
        self._faux.appels += 1
        for filiere in self._data.get("filieres_cibles") or []:
            if filiere not in self._faux.valeurs:
                raise FauxRefusEnum(
                    "{'message': 'invalid input value for enum filiere: "
                    f'"{filiere}"\', \'code\': \'22P02\'}}'
                )
        if self._faux.echec_non_enum:
            raise FauxReseau("réseau indisponible")
        self._faux.ecrits.append(self._data)
        return _Resultat([self._data])


class FauxScraper(BaseScraper):
    source_name = "scholar-africa"

    def fetch(self):
        return []


def offre(filieres: list[str], url: str = "https://exemple.mr/a") -> OffreStageCreate:
    return OffreStageCreate(
        source=SourceType.AUTRE,
        source_name="scholar-africa",
        source_url=url,
        titre="Bourse de test en génie des procédés",
        entreprise="Université de test",
        filieres_cibles=filieres,
        date_limite=date(2027, 1, 31),
        description="Programme de test.",
        metadata={"content_hash": "abc"},
    )


def installer(faux: FauxSupabase) -> None:
    base_mod.supabase = faux
    base_mod._FILIERES_REFUSEES.clear()  # isolation entre cas


def main() -> int:
    print("=== 1. filière refusée : l'offre est quand même insérée ===")
    faux = FauxSupabase({"informatique", "genie_civil", "autre"})
    installer(faux)
    insere, erreurs = FauxScraper().save([offre(["informatique", "genie_procedes"])])
    ecrit = faux.ecrits[0] if faux.ecrits else {}
    check(insere == 1 and erreurs == 0, f"offre insérée malgré l'enum (insere={insere}, erreurs={erreurs})")
    check(ecrit.get("filieres_cibles") == ["informatique"], f"filière fautive élaguée : {ecrit.get('filieres_cibles')}")
    check(
        ecrit.get("metadata", {}).get(base_mod.CLE_METADATA_FILIERES_IGNOREES) == ["genie_procedes"],
        "filière écartée TRACÉE dans metadata",
    )
    check(ecrit.get("metadata", {}).get("content_hash") == "abc", "les autres clés metadata sont préservées")

    print("=== 2. plus aucune filière valable : repli sur 'autre' ===")
    faux = FauxSupabase({"informatique", "genie_civil", "autre"})
    installer(faux)
    insere, _ = FauxScraper().save([offre(["genie_procedes"])])
    ecrit = faux.ecrits[0] if faux.ecrits else {}
    check(insere == 1, "offre insérée avec repli")
    check(ecrit.get("filieres_cibles") == ["autre"], f"repli appliqué : {ecrit.get('filieres_cibles')}")

    print("=== 3. offre saine : aucune trace parasite ===")
    faux = FauxSupabase({"informatique", "genie_civil", "autre"})
    installer(faux)
    insere, erreurs = FauxScraper().save([offre(["informatique"])])
    ecrit = faux.ecrits[0] if faux.ecrits else {}
    check(insere == 1 and erreurs == 0, "offre saine insérée")
    check(base_mod.CLE_METADATA_FILIERES_IGNOREES not in ecrit.get("metadata", {}), "pas de clé de trace inutile")
    check(faux.appels == 1, f"un seul appel à la base (appels={faux.appels})")

    print("=== 4. erreur NON-enum : jamais masquée ===")
    faux = FauxSupabase({"informatique"}, echec_non_enum=True)
    installer(faux)
    insere, erreurs = FauxScraper().save([offre(["informatique"])])
    check(insere == 0 and erreurs == 1, f"l'erreur réelle est comptée (insere={insere}, erreurs={erreurs})")

    print("=== 5. élagage BORNÉ (pas de boucle infinie) ===")
    faux = FauxSupabase({"informatique"})  # 'autre' NON accepté non plus
    installer(faux)
    insere, erreurs = FauxScraper().save([offre(["genie_procedes"])])
    check(insere == 0 and erreurs == 1, f"offre comptée en erreur (insere={insere}, erreurs={erreurs})")
    check(
        faux.appels == base_mod._MAX_ELAGAGES,
        f"tentatives bornées à {base_mod._MAX_ELAGAGES} (appels={faux.appels})",
    )

    print("=== 6. plusieurs filières fautives dans la même offre ===")
    faux = FauxSupabase({"informatique"})
    installer(faux)
    insere, erreurs = FauxScraper().save([offre(["informatique", "genie_procedes"], url="https://exemple.mr/b")])
    ecrit = faux.ecrits[0] if faux.ecrits else {}
    check(insere == 1 and erreurs == 0, "offre insérée après élagage")
    check(ecrit.get("filieres_cibles") == ["informatique"], f"filières conservées : {ecrit.get('filieres_cibles')}")

    print("=== 7. la valeur refusée est mémorisée : zéro aller-retour ensuite ===")
    faux = FauxSupabase({"informatique", "autre"})
    base_mod.supabase = faux
    base_mod._FILIERES_REFUSEES.clear()
    FauxScraper().save([offre(["genie_procedes"], url="https://exemple.mr/c")])
    appels_apres_premiere = faux.appels
    faux.appels = 0
    insere, erreurs = FauxScraper().save([offre(["genie_procedes"], url="https://exemple.mr/d")])
    check(appels_apres_premiere == 2, f"1re offre : refus + reprise = 2 appels (appels={appels_apres_premiere})")
    check(insere == 1 and erreurs == 0, "2e offre insérée")
    check(faux.appels == 1, f"2e offre : UN seul appel, la valeur est mémorisée (appels={faux.appels})")

    ok = sum(1 for c, _ in CHECKS if c)
    print(f"\n=== BILAN : {ok}/{len(CHECKS)} checks verts ===")
    return 0 if ok == len(CHECKS) else 1


if __name__ == "__main__":
    raise SystemExit(main())
