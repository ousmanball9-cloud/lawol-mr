#!/usr/bin/env python3
"""Harnais du resume de description (`_resume`, sources/bourses.py).

Zero reseau. Mesure qui impose le plafond a 4000 (20/11/2026) : la description
maximale du catalogue faisait 1799 caracteres pour un plafond de 1800, 201 offres
sur 313 etaient coupees au plafond et la phrase d'eligibilite tombait APRES la
coupe (217 offres sans indice d'origine). Le plafond est la seule perte
d'information reelle : il doit laisser passer la description complete tant
qu'elle tient sous 4000, et couper sur une frontiere de phrase au-dela —
jamais au milieu d'un mot.

Sortie : N/N checks verts, exit 1 si un seul KO.

Usage :
    python scripts/test-resume-description.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# `core.database` instancie le client Supabase a l'import : valeurs factices,
# aucun appel reseau (meme garde que `test-origine-eligible.py`).
os.environ.setdefault("SUPABASE_URL", "https://exemple.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "cle-factice-pour-harnais")

if hasattr(sys.stdout, "reconfigure"):  # console cp1252 : jamais de crash d'affichage
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

_checks: list[tuple[bool, str]] = []

PHRASE = "La bourse couvre les frais de scolarite, le logement et le voyage."
ELIGIBILITE = "Eligibilite : ouverte aux etudiants mauritaniens de moins de 30 ans."


def check(ok: bool, libelle: str) -> None:
    _checks.append((bool(ok), libelle))
    if not ok:
        print(f"  KO : {libelle}")


def _remplissage(nb_car: int, phrase: str = PHRASE) -> str:
    """Texte regulier de phrases completes d'au moins `nb_car` caracteres."""
    morceaux: list[str] = []
    total = 0
    while total < nb_car:
        morceaux.append(phrase)
        total += len(phrase) + 1
    return " ".join(morceaux)


def _resume_fn():
    from apps.api.app.modules.scraper.sources.bourses import _resume

    return _resume


def preuve_phrase_eligibilite_conservee() -> None:
    """L'information reellement perdue : la phrase d'eligibilite au-dela de 1800."""
    resume = _resume_fn()
    texte = f"{_remplissage(2460)} {ELIGIBILITE}"
    position = texte.index("Eligibilite")
    print("--- la phrase d'eligibilite tombe apres l'ancien plafond ---")
    check(position > 1800, f"phrase placee au caractere {position} (attendu > 1800)")
    check(len(texte) < 4000, f"description de {len(texte)} car. (< 4000)")

    obtenu = resume(texte)
    check(ELIGIBILITE in obtenu, "phrase d'eligibilite CONSERVEE apres _resume")
    check(obtenu == texte, "description complete rendue telle quelle (aucune coupe)")
    check(len(obtenu) > 1800, f"description de {len(obtenu)} car. servie en entier")


def preuve_coupe_a_frontiere_de_phrase() -> None:
    """Au-dela du plafond : coupe a une fin de phrase, et le plafond est exploite."""
    resume = _resume_fn()
    texte = _remplissage(6000)
    print("--- 6000 caracteres : coupe a une frontiere de phrase ---")
    check(len(texte) >= 6000, f"texte de depart : {len(texte)} car.")

    obtenu = resume(texte)
    check(len(obtenu) <= 4000, f"plafond respecte ({len(obtenu)} car.)")
    check(len(obtenu) > 3800, f"plafond exploite ({len(obtenu)} car., attendu > 3800)")
    check(obtenu == texte[: len(obtenu)], "coupe = prefixe exact (jamais recousue)")
    check(obtenu[-1] in ".!?", f"fin de phrase : ...{obtenu[-40:]!r}")


def preuve_jamais_au_milieu_d_un_mot() -> None:
    """Pas de ponctuation sur des milliers de caracteres : coupe sur un espace."""
    resume = _resume_fn()
    texte = " ".join(["mot"] * 1200)  # 4799 car., aucun point ni virgule
    print("--- texte sans ponctuation : jamais au milieu d'un mot ---")
    check(len(texte) > 4000 and "." not in texte, f"texte de {len(texte)} car. sans ponctuation")

    obtenu = resume(texte)
    check(len(obtenu) <= 4000, f"plafond respecte ({len(obtenu)} car.)")
    check(len(obtenu) > 3800, f"plafond exploite ({len(obtenu)} car., attendu > 3800)")
    check(texte[len(obtenu)] == " ", "le caractere suivant la coupe est un espace")
    check(obtenu.split(" ")[-1] == "mot", "dernier mot entier, jamais tronque")


def preuve_bornes() -> None:
    """Cas limites du brief : vide, court, exactement au plafond, max_car explicite."""
    resume = _resume_fn()
    print("--- cas limites ---")
    check(resume("") == "", "texte vide rendu vide")
    court = "Bourse ouverte aux etudiants africains."
    check(resume(court) == court, "texte court inchange")
    check(resume("  a   b  ") == "a b", "espaces normalises")
    check(resume("x" * 4000) == "x" * 4000, "exactement 4000 : intact")
    check(len(resume(_remplissage(9000), max_car=300)) <= 300, "max_car explicite respecte")
    check(resume(_remplissage(500)) == _remplissage(500), "500 car. : intact")


def main(argv: list[str] | None = None) -> int:
    _ = argv
    print("Harnais resume de description - LAWOL.mr")
    preuve_phrase_eligibilite_conservee()
    preuve_coupe_a_frontiere_de_phrase()
    preuve_jamais_au_milieu_d_un_mot()
    preuve_bornes()

    ko = [libelle for ok, libelle in _checks if not ok]
    print(f"\n=== BILAN : {len(_checks) - len(ko)}/{len(_checks)} checks verts ===")
    for libelle in ko:
        print(f"  KO : {libelle}")
    return 1 if ko else 0


if __name__ == "__main__":
    sys.exit(main())
