#!/usr/bin/env python3
"""Preuve du point d'écriture unique : `metadata['montant']` survit à une collecte.

Pourquoi ce harnais existe (mesuré le 06/11/2026) : un backfill avait écrit 42
montants en base, mais `BaseScraper.save` RECONSTRUIT `metadata` puis upsert —
19 des 42 avaient disparu après une passe de collecte. Une écriture qui n'est
pas faite au point d'écriture unique ne tient pas.

Le test n'appelle AUCUN réseau : le client Supabase est remplacé par un faux
qui capture le payload réellement envoyé à `upsert`.

Usage :
    python scripts/test-montant-ecriture.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Le client Supabase est instancié à l'import de `core.database` : on fournit
# des valeurs factices AVANT, sinon l'import échoue sans credentials. Aucun
# appel réseau n'est fait à la création du client.
os.environ.setdefault("SUPABASE_URL", "https://exemple.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "cle-factice-pour-harnais")

_checks: list[tuple[bool, str]] = []


def check(ok: bool, libelle: str) -> None:
    _checks.append((bool(ok), libelle))
    if not ok:
        print(f"  KO : {libelle}")


class _FauxTable:
    """Faux builder Supabase : capture le payload, ne sort jamais de la machine."""

    def __init__(self, captures: list[dict]) -> None:
        self._captures = captures

    def upsert(self, data: dict, on_conflict: str | None = None):
        self._captures.append({"data": data, "on_conflict": on_conflict})
        return self

    def execute(self):
        return type("Reponse", (), {"data": [{"id": "00000000-0000-0000-0000-000000000000"}]})()


class _FauxSupabase:
    def __init__(self, captures: list[dict]) -> None:
        self._captures = captures

    def table(self, _nom: str) -> _FauxTable:
        return _FauxTable(self._captures)


def _offre(titre: str, description: str):
    from apps.api.app.modules.shared.models import OffreStageCreate

    return OffreStageCreate(
        source="autre",
        titre=titre,
        entreprise="Exemple Foundation",
        description=description,
        filieres_cibles=["informatique"],
        type_offre="bourse",
        date_limite="2027-12-31",
        source_name="exemple",
        source_url=f"https://exemple.mr/{abs(hash(titre))}",
        active=True,
    )


def _scraper_de_test():
    """Sous-classe concrète : `save` vit sur la base, `fetch` n'est pas appelé."""
    from apps.api.app.modules.scraper.sources import base

    class _Scraper(base.BaseScraper):
        source_name = "exemple"

        def fetch(self):
            return []

    return _Scraper()


def preuve_ecriture() -> None:
    from apps.api.app.modules.scraper.sources import base

    print("--- metadata['montant'] posé au point d'écriture ---")
    captures: list[dict] = []
    vrai_client = base.supabase
    base.supabase = _FauxSupabase(captures)  # type: ignore[assignment]
    try:
        scraper = _scraper_de_test()
        # Le scrapeur réel passe par `save` ; on l'appelle avec deux offres :
        # une chiffrée (montant certain) et une qui ne l'est pas (silence).
        inserées, erreurs = scraper.save(
            [
                _offre(
                    "Bourse Example 2027",
                    "The programme provides €21,805 per year to selected students.",
                ),
                _offre(
                    "Bourse Sans Chiffre 2027",
                    "Fully funded scholarship: tuition, insurance and travel are covered.",
                ),
            ]
        )
    finally:
        base.supabase = vrai_client  # type: ignore[assignment]

    check(erreurs == 0, f"aucune erreur d'écriture (obtenu {erreurs})")
    check(inserées == 2, f"deux offres écrites (obtenu {inserées})")
    check(len(captures) == 2, f"deux upserts capturés (obtenu {len(captures)})")

    if len(captures) == 2:
        chiffree = captures[0]["data"]
        muette = captures[1]["data"]
        check(
            chiffree.get("metadata", {}).get("montant")
            == {"valeur": 21805, "devise": "EUR", "periode": "an"},
            f"montant écrit dans metadata : {chiffree.get('metadata', {}).get('montant')}",
        )
        check(
            "montant" not in {k for k, v in (muette.get("metadata") or {}).items() if v},
            "aucune clé montant quand le texte ne chiffre rien (silence)",
        )
        check(
            chiffree.get("metadata", {}).get("categorie_bourse") is not None,
            "la catégorie de bourse reste écrite (aucune régression du voisin)",
        )
        check(
            captures[0]["on_conflict"] == "source_url",
            "l'upsert garde sa clé d'idempotence `source_url`",
        )


def preuve_reecriture_ne_perd_pas() -> None:
    """Une SECONDE collecte du même texte réécrit le montant (pas d'effacement)."""
    from apps.api.app.modules.scraper.sources import base

    print("--- une collecte suivante ne perd pas la clé ---")
    captures: list[dict] = []
    vrai_client = base.supabase
    base.supabase = _FauxSupabase(captures)  # type: ignore[assignment]
    try:
        scraper = _scraper_de_test()
        offre = _offre(
            "Bourse Example 2028",
            "Scholarship of £25,900 to support excellent students.",
        )
        scraper.save([offre])
        scraper.save([offre])
    finally:
        base.supabase = vrai_client  # type: ignore[assignment]

    montants = [c["data"].get("metadata", {}).get("montant") for c in captures]
    check(len(montants) == 2, f"deux écritures (obtenu {len(montants)})")
    check(
        all(m == {"valeur": 25900, "devise": "GBP", "periode": "total"} for m in montants),
        f"le montant est réécrit à l'identique à chaque collecte : {montants}",
    )


def preuve_silence_sans_extraction() -> None:
    """Contrôle négatif : sans extraction, la clé ne doit PAS apparaître.

    Si ce check passe alors que `montant_depuis_texte` ne rend rien, c'est
    qu'un autre chemin écrit un montant — donc qu'il n'est pas prouvé.
    """
    from apps.api.app.modules.scraper.sources import base

    print("--- contrôle négatif : extraction neutralisée ---")
    captures: list[dict] = []
    vrai_client = base.supabase
    vrai_extracteur = base.montant_depuis_texte
    base.supabase = _FauxSupabase(captures)  # type: ignore[assignment]
    base.montant_depuis_texte = lambda _texte: None  # type: ignore[assignment]
    try:
        _scraper_de_test().save(
            [
                _offre(
                    "Bourse Example 2029",
                    "The programme provides €21,805 per year to selected students.",
                )
            ]
        )
    finally:
        base.supabase = vrai_client  # type: ignore[assignment]
        base.montant_depuis_texte = vrai_extracteur  # type: ignore[assignment]

    meta = (captures[0]["data"].get("metadata") or {}) if captures else {}
    check(len(captures) == 1, f"l'offre est bien écrite (obtenu {len(captures)})")
    check("montant" not in meta, f"aucune clé montant sans extraction : {meta.get('montant')}")


def main() -> int:
    print("Harnais écriture MONTANT - LAWOL.mr (zéro réseau)")
    preuve_ecriture()
    preuve_reecriture_ne_perd_pas()
    preuve_silence_sans_extraction()

    ko = [libelle for ok, libelle in _checks if not ok]
    print(f"\n=== BILAN : {len(_checks) - len(ko)}/{len(_checks)} checks verts ===")
    for libelle in ko:
        print(f"  KO : {libelle}")
    return 1 if ko else 0


if __name__ == "__main__":
    sys.exit(main())
