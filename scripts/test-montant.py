#!/usr/bin/env python3
"""Harnais de l'extraction de MONTANT (contrat metadata §2.1, lot V4-B).

Zero reseau. Chaque cas est une chaine REELLE du catalogue LAWOL (relevee le
06/11/2026), pas un exemple inventé : un extracteur qui ne passe que des cas
d'ecole ne prouve rien.

Sortie : N/N checks verts, exit 1 si un seul KO.

Usage :
    python scripts/test-montant.py
    python scripts/test-montant.py --sentences   # n'affiche que les cas
"""

from __future__ import annotations

# ruff: noqa: ISC004 — les phrases du catalogue sont longues, la concatenation
# implicite est volontaire (une phrase reelle par cas, pas une chaine coupee).
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from apps.api.app.modules.matching.extraction import (
    montant_depuis_texte,
    montant_effectif,
)

_checks: list[tuple[bool, str]] = []


def check(ok: bool, libelle: str) -> None:
    _checks.append((bool(ok), libelle))
    if not ok:
        print(f"  KO : {libelle}")


# (texte reel, attendu) - attendu None = le contrat exige le SILENCE.
CAS: list[tuple[str, dict | None]] = [
    # --- ce qui DOIT etre extrait -------------------------------------------
    (
        "D Studentship Program for International Students 2027 | Fully Funded "
        "(€21,805 Per Year) . Date de cloture : January 6, 2027.",
        {"valeur": 21805, "devise": "EUR", "periode": "an"},
    ),
    (
        "The Netherlands High Potential Scholarship programme offers 21 full "
        "scholarships of €36.000 (including tuition fee waiver and monthly stipend)",
        {"valeur": 36000, "devise": "EUR", "periode": "total"},
    ),
    (
        "The Scholarship Covers: Full Tuition fees Full insurance Tuition Fees "
        "1400 Euros/month to cover (Travel, visa, installation, and subsistence costs).",
        {"valeur": 1400, "devise": "EUR", "periode": "mois"},
    ),
    (
        "Successful Erasmus Mundus scholarship recipients receive: €1,400 per month "
        "Scholarship for the full 24-month programme Tuition fee",
        {"valeur": 1400, "devise": "EUR", "periode": "mois"},
    ),
    (
        "WAAW Foundation Scholarship 2026 for African Female Students ($500 award) . "
        "Date de cloture : December 18, 2026.",
        {"valeur": 500, "devise": "USD", "periode": "total"},
    ),
    (
        "Hong Kong PhD Fellowship Scheme 2027/28: HK$344,400 Annual Stipend for "
        "International PhD Students in Hong Kong",
        {"valeur": 344400, "devise": "HKD", "periode": "an"},
    ),
    (
        "Newberry Library Short-Term Fellowships: $3,000 Monthly Funding for PhD "
        "Scholars and ABD Researchers in Chicago",
        {"valeur": 3000, "devise": "USD", "periode": "mois"},
    ),
    (
        "Five Women Scientists to Receive $75,000 Research Grants",
        {"valeur": 75000, "devise": "USD", "periode": "total"},
    ),
    (
        "the scholarship provides €25,900 to support excellent students enrolling "
        "in selected LLM Masters programmes",
        {"valeur": 25900, "devise": "EUR", "periode": "total"},
    ),
    (
        "The living-cost scholarship totals up to two years of support, alongside "
        "tuition and travel insurance. Students receive £21,805.",
        {"valeur": 21805, "devise": "GBP", "periode": "total"},
    ),
    # --- ce qui doit rester SILENCIEUX ---------------------------------------
    (
        "Does McDonald Fellowship 2027 Really offer €55,000/Year to MS Researchers? "
        "Date de cloture : 1 December 2026.",
        None,  # une question n'affirme rien
    ),
    (
        "University of Twente Scholarships 2027 With Up to €22,000 Funding",
        None,  # plafond, pas un montant recu
    ),
    (
        "The Dutch scholarship is a contribution towards living costs € 5.000 EUR "
        "or 10.000 EUR for one year.",
        None,  # deux montants = ambiguite
    ),
    (
        "Full Tuition Fee Waiver 100% tuition coverage ($43,800 per year value) "
        "Monthly Living Stipend $600 per month for personal costs",
        None,  # deux montants differents dans la meme fenetre
    ),
    (
        "The scholarship provides €5,000, €10,000 or €15,000, paid during the first "
        "year of study.",
        None,  # trois montants = ambiguite
    ),
    (
        "A partial scholarship will reduce your tuition fee to € 2,771. For example: "
        "a grant holder will pay this amount.",
        None,  # ce que l'etudiant PAIE
    ),
    (
        "the tuition contribution is capped at €3,000 per year in this call",
        None,  # idem : frais a payer
    ),
    (
        "The Scholarship Covers: Full Tuition fees, insurance, and a monthly stipend.",
        None,  # aucun chiffre n'est publie
    ),
    (
        "Fully funded scholarship: 100% of course fees, travel and 5 steps to apply.",
        None,  # 100 % et « 5 steps » ne sont pas des montants
    ),
    (
        "An application fee of $50 must be paid before the deadline.",
        None,  # sous le seuil : frais, pas une bourse
    ),
    # --- devises prefixees : le piege qui a fait classer NZD en USD ----------
    (
        "University of Auckland Doctoral Scholarship 2026-2027: Receive "
        "NZ$35,468 Per Year, Tuition Fee Coverage and Health Insurance",
        {"valeur": 35468, "devise": "NZD", "periode": "an"},
    ),
    (
        "CIFAR Azrieli Global Scholars Program 2027/2029 for Early Career "
        "Researchers (CDN $100,000 in Funding).",
        {"valeur": 100000, "devise": "CAD", "periode": "total"},
    ),
    # Enveloppe de programme : 420 000 EUR pour tout un appel, pas par etudiant.
    (
        "Mosaic 3.0 PhD Scholarship Programme in the Netherlands: €420,000 Funding "
        "for the whole cohort of researchers",
        None,
    ),
]


def preuve_cas() -> None:
    print("--- cas reels du catalogue ---")
    for index, (texte, attendu) in enumerate(CAS, start=1):
        obtenu = montant_depuis_texte(texte)
        check(
            obtenu == attendu,
            f"cas {index} : attendu {attendu}, obtenu {obtenu} | {texte[:60]}...",
        )


def preuve_nombre() -> None:
    from apps.api.app.modules.matching.extraction import _nombre_montant

    print("--- normalisation des nombres ---")
    attendus = {
        "21,805": 21805,
        "36.000": 36000,
        "5.000": 5000,
        "1 400": 1400,
        "1400": 1400,
        "1200.50": 1200.5,
        "1200,50": 1200.5,
    }
    for brut, valeur in attendus.items():
        obtenu = _nombre_montant(brut)
        check(obtenu == valeur, f"nombre {brut!r} -> {valeur}, obtenu {obtenu}")
    for invalide in ("", "abc", "1.2.3", "12,34,567"):
        check(_nombre_montant(invalide) is None, f"nombre invalide refuse : {invalide!r}")


def preuve_metadonnee_prioritaire() -> None:
    """Une valeur stockee et valide gagne ; une valeur non conforme est ignoree."""
    print("--- metadata prioritaire sur le texte ---")
    offre = {
        "titre": "Bourse X",
        "description": "montant annonce : €1,400 per month",
        "metadata": {"montant": {"valeur": 999, "devise": "EUR", "periode": "an"}},
    }
    check(
        montant_effectif(offre) == {"valeur": 999, "devise": "EUR", "periode": "an"},
        "metadata valide prioritaire sur le texte",
    )

    casse = dict(offre, metadata={"montant": {"valeur": 999, "devise": "euros", "periode": "an"}})
    check(
        montant_effectif(casse) == {"valeur": 1400, "devise": "EUR", "periode": "mois"},
        "metadata non conforme ignoree, texte repris",
    )

    vide = {"titre": "Sans chiffre", "description": "bourse entierement financee", "metadata": {}}
    check(montant_effectif(vide) is None, "aucun montant -> None (silence)")


def preuve_ambiguite_isolee() -> None:
    """Le garde-fou d'ambiguite doit tomber SEUL si on le retire."""
    print("--- garde-fous isoles ---")
    # La phrase a un seul montant : elle passe. Ajouter un second montant
    # different dans la meme fenetre doit la faire taire.
    seul = "The grant is €21,805 per year for master students."
    deux = "The grant is €21,805 per year, the stipend is €600 per month."
    check(montant_depuis_texte(seul) is not None, "un seul montant : extrait")
    check(montant_depuis_texte(deux) is None, "deux montants : silence")


def main() -> int:
    print("Harnais extraction MONTANT - LAWOL.mr (zero reseau)")
    preuve_cas()
    preuve_nombre()
    preuve_metadonnee_prioritaire()
    preuve_ambiguite_isolee()

    ko = [libelle for ok, libelle in _checks if not ok]
    print(f"\n=== BILAN : {len(_checks) - len(ko)}/{len(_checks)} checks verts ===")
    for libelle in ko:
        print(f"  KO : {libelle}")
    return 1 if ko else 0


if __name__ == "__main__":
    sys.exit(main())
