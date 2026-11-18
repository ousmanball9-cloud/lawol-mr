#!/usr/bin/env python3
"""Preuve du point d'ecriture unique : `metadata['calendrier']` survit a une collecte.

Pourquoi ce harnais existe (mesure du 18/11/2026) : le backfill `--apply` du
17/11 avait ecrit 8 calendriers (commit 5dff311), et le 18/11 il n'en restait
qu'UN sur 305 offres publiques, alors que `montant` (45) et `origine_eligible`
(59) avaient survecu et progresse. Cause : `BaseScraper.save` RECONSTRUIT
`metadata` a chaque upsert, donc une collecte qui ne pose pas la cle l'efface
(c'est la lecon du 06/11 pour `montant`, 19/42 disparus). Le harnais verifie
l'INVARIANT — la cle est posee *au point d'ecriture*, pas la forme du fichier.

Le test n'appelle AUCUN reseau : le client Supabase est remplace par un faux qui
capture le payload d'upsert ET applique la semantique reelle (remplacement
complet de `metadata`), pour pouvoir rejouer une collecte sur la meme offre.

Usage :
    python -X utf8 scripts/test-calendrier-ecriture.py
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Self

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# `core.database` instancie le client a l'import : valeurs factices AVANT,
# sinon l'import leve. Aucun appel reseau n'est fait a la creation.
os.environ.setdefault("SUPABASE_URL", "https://exemple.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "cle-factice-pour-harnais")

_checks: list[tuple[bool, str]] = []


def check(ok: bool, libelle: str) -> None:
    _checks.append((bool(ok), libelle))
    if not ok:
        print(f"  KO : {libelle}")


class _FauxTable:
    """Faux builder Supabase : capture le payload et tient une table en memoire.

    L'upsert applique la semantique du vrai PostgREST : la ligne est remplacee
    par le payload, `metadata` compris. C'est cette semantique qui efface une
    cle que l'ecriture ne repose pas — le harnais doit donc la reproduire, pas
    la contourner.
    """

    def __init__(self, lignes: dict[str, dict], captures: list[dict]) -> None:
        self._lignes = lignes
        self._captures = captures

    def upsert(self, data: dict, on_conflict: str | None = None):
        self._captures.append({"data": data, "on_conflict": on_conflict})
        cle = data.get(on_conflict or "id")
        self._lignes[cle] = dict(data)
        return self

    def execute(self):
        return type("Reponse", (), {"data": [{"id": "00000000-0000-0000-0000-000000000000"}]})()


class _FauxSupabase:
    def __init__(self, lignes: dict[str, dict], captures: list[dict]) -> None:
        self._lignes = lignes
        self._captures = captures

    def table(self, _nom: str) -> _FauxTable:
        return _FauxTable(self._lignes, self._captures)


class _Bac:
    """Contexte : faux Supabase branche sur `base`, lignes reelles en memoire."""

    def __init__(self) -> None:
        from apps.api.app.modules.scraper.sources import base

        self.base = base
        self.lignes: dict[str, dict] = {}
        self.captures: list[dict] = []
        self._vrai = base.supabase

    def __enter__(self) -> Self:
        self.base.supabase = _FauxSupabase(self.lignes, self.captures)  # type: ignore[assignment]
        return self

    def __exit__(self, *_exc) -> None:
        self.base.supabase = self._vrai  # type: ignore[assignment]


def _offre(titre: str, description: str):
    from apps.api.app.modules.shared.models import OffreStageCreate

    return OffreStageCreate(
        source="autre",
        titre=titre,
        entreprise="Exemple Foundation",
        description=description,
        filieres_cibles=["informatique"],
        type_offre="bourse",
        date_limite="2028-12-31",
        source_name="exemple",
        source_url=f"https://exemple.mr/{abs(hash(titre))}",
        active=True,
    )


def _scraper_de_test():
    """Sous-classe concrete : `save` vit sur la base, `fetch` n'est pas appele."""
    from apps.api.app.modules.scraper.sources import base

    class _Scraper(base.BaseScraper):
        source_name = "exemple"

        def fetch(self):
            return []

    return _Scraper()


def _annee_future() -> int:
    return datetime.now(timezone.utc).year + 1


def _meta_ecrite(captures: list[dict], index: int = 0) -> dict:
    if len(captures) <= index:
        return {}
    return captures[index]["data"].get("metadata") or {}


def preuve_ecriture() -> None:
    from apps.api.app.modules.matching.extraction import calendrier_stocke

    print("--- metadata['calendrier'] pose au point d'ecriture ---")
    annee = _annee_future()
    texte = (
        f"Application deadline: 15 January {annee}. "
        f"Results will be announced: 30 April {annee}."
    )
    with _Bac() as bac:
        ecrites, erreurs = _scraper_de_test().save([_offre("Bourse Example", texte)])

    meta = _meta_ecrite(bac.captures)
    check(erreurs == 0, f"aucune erreur d'ecriture (obtenu {erreurs})")
    check(ecrites == 1, f"une offre ecrite (obtenu {ecrites})")
    check(len(bac.captures) == 1, f"un upsert capture (obtenu {len(bac.captures)})")
    check(
        meta.get("calendrier") == [
            {"etape": "candidature", "date": f"{annee}-01-15"},
            {"etape": "resultat", "date": f"{annee}-04-30"},
        ],
        f"calendrier ecrit dans metadata : {meta.get('calendrier')}",
    )
    check(
        calendrier_stocke(meta) is not None,
        "le calendrier ecrit respecte le contrat §2.3 (calendrier_stocke)",
    )
    check(
        bac.captures[0]["on_conflict"] == "source_url",
        "l'upsert garde sa cle d'idempotence `source_url`",
    )


def preuve_rescrape_ne_perd_pas() -> None:
    """Deux collectes de la meme offre : la cle est reposee, jamais effacee."""
    print("--- une collecte suivante ne perd pas la cle ---")
    annee = _annee_future()
    offre = _offre(
        "Bourse Example (rescrape)",
        f"Deadline de candidature : 15 janvier {annee}. "
        f"Preselection : 20 fevrier {annee}. Resultats annonces : 30 avril {annee}.",
    )
    with _Bac() as bac:
        scraper = _scraper_de_test()
        scraper.save([offre])
        apres_premiere = dict(bac.lignes[offre.source_url].get("metadata") or {})
        scraper.save([offre])
        apres_seconde = dict(bac.lignes[offre.source_url].get("metadata") or {})

    check(len(bac.captures) == 2, f"deux collectes ont ecrit (obtenu {len(bac.captures)})")
    check(
        apres_premiere.get("calendrier") is not None,
        "la premiere collecte pose le calendrier",
    )
    check(
        apres_seconde.get("calendrier") is not None
        and apres_seconde.get("calendrier") == apres_premiere.get("calendrier"),
        "le RESCRAPE reecrit le calendrier a l'identique (il ne disparait pas) : "
        f"{apres_seconde.get('calendrier')}",
    )
    check(
        len(apres_seconde.get("calendrier") or []) == 3,
        f"les trois etapes sont conservees : {apres_seconde.get('calendrier')}",
    )


def preuve_voisins_intacts() -> None:
    """Le calendrier n'ecrase pas les cles du meme point d'ecriture."""
    print("--- les cles voisines restent ecrites (montant, categorie) ---")
    annee = _annee_future()
    with _Bac() as bac:
        _scraper_de_test().save(
            [
                _offre(
                    "Bourse Example (voisins)",
                    f"Le programme offre 21805 EUR par an. "
                    f"Date limite : 15 janvier {annee}. Resultats : 30 avril {annee}.",
                )
            ]
        )

    meta = _meta_ecrite(bac.captures)
    check(meta.get("calendrier") is not None, "le calendrier est present")
    check(
        meta.get("montant") == {"valeur": 21805, "devise": "EUR", "periode": "an"},
        f"le montant reste ecrit : {meta.get('montant')}",
    )
    check(
        meta.get("categorie_bourse") is not None,
        "la categorie de bourse reste ecrite (aucune regression du voisin)",
    )


def preuve_parcours_termine() -> None:
    """Une seule etape datee, ou un parcours fini : pas de cle (contrat §2.3)."""
    print("--- silence : une seule etape / parcours deja termine ---")
    annee = _annee_future()
    with _Bac() as bac:
        ecrites, erreurs = _scraper_de_test().save(
            [
                _offre(
                    "Bourse une seule date",
                    f"Application deadline: 15 January {annee}.",
                ),
                _offre(
                    "Bourse parcours termine",
                    "Application deadline: 15 January 2021. Results announced: 30 April 2021.",
                ),
            ]
        )

    check(erreurs == 0, f"aucune erreur d'ecriture (obtenu {erreurs})")
    check(ecrites == 2, f"deux offres ecrites (obtenu {ecrites})")
    for index, libelle in (
        (0, "une seule etape datee -> aucune cle calendrier"),
        (1, "parcours deja termine -> aucune cle calendrier"),
    ):
        meta = _meta_ecrite(bac.captures, index)
        check(meta.get("calendrier") is None, f"{libelle} (obtenu {meta.get('calendrier')})")


def controle_negatif_sans_extraction() -> None:
    """Controle negatif : sans le point d'ecriture, la collecte EFFACE la cle.

    On neutralise l'extracteur du point d'ecriture : c'est exactement l'etat du
    code deploye le 18/11/2026 (branche `main`, sans le bloc V4-G). Le faux
    Supabase remplace `metadata` comme PostgREST : le calendrier deja stocke
    doit disparaitre. Si ce controle passait, c'est qu'un autre chemin ecrit la
    cle — donc que le point d'ecriture n'est pas prouve.
    """
    print("--- controle negatif : point d'ecriture neutralise ---")
    annee = _annee_future()
    offre = _offre(
        "Bourse Example (controle negatif)",
        f"Application deadline: 15 January {annee}. Results announced: 30 April {annee}.",
    )
    with _Bac() as bac:
        bac.lignes[offre.source_url] = {
            "source_url": offre.source_url,
            "metadata": {
                "calendrier": [
                    {"etape": "candidature", "date": f"{annee}-01-15"},
                    {"etape": "resultat", "date": f"{annee}-04-30"},
                ]
            },
        }
        vrai_extracteur = bac.base.calendrier_depuis_texte
        bac.base.calendrier_depuis_texte = lambda _texte: None  # type: ignore[assignment]
        try:
            _scraper_de_test().save([offre])
        finally:
            bac.base.calendrier_depuis_texte = vrai_extracteur  # type: ignore[assignment]
        apres = dict(bac.lignes[offre.source_url].get("metadata") or {})

    check(len(bac.captures) == 1, f"l'offre est bien reecrite (obtenu {len(bac.captures)})")
    check(
        apres.get("calendrier") is None,
        "sans point d'ecriture, le calendrier stocke est efface par le rescrape "
        f"(obtenu {apres.get('calendrier')})",
    )


def main() -> int:
    print("Harnais ecriture CALENDRIER - LAWOL.mr (zero reseau)")
    preuve_ecriture()
    preuve_rescrape_ne_perd_pas()
    preuve_voisins_intacts()
    preuve_parcours_termine()
    controle_negatif_sans_extraction()

    ko = [libelle for ok, libelle in _checks if not ok]
    print(f"\n=== BILAN : {len(_checks) - len(ko)}/{len(_checks)} checks verts ===")
    for libelle in ko:
        print(f"  KO : {libelle}")
    return 1 if ko else 0


if __name__ == "__main__":
    sys.exit(main())
